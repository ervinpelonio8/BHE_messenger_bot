"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const {
  findOrder,
  createOrder,
  updateOrder,
  orderExists,
} = require("./orderUtils");
const {
  findOrderTracking,
  updateOrderTracking,
  createOrderTracking,
} = require("./orderTrackingUtils");
const {
  findDriver,
  updateDriver,
  createDriver,
  isDriver,
} = require("./driverUtils");
const {
  findDriverUserPair,
  updateDriverUserPair,
  createDriverUserPair,
  getDriverActiveTransaction,
  getUserActiveTransaction,
  isOrderAssigned,
} = require("./orderTransactionUtils");
const {
  findUser,
  createUser,
  updateUser,
  getUserInformation,
} = require("./userUtils");
const {
  callSendAPI,
  sendGenericMessage,
  broadcastDriverOrderAssignment,
  broadcastUserOrderCancellation,
  sendOrderAlreadyAssigned,
  sendOrderAssigned,
  broadcastNewOrder,
  sendUndeliveredMessage,
  sendOrderAssignedToDriver,
  sendOrderCancelledInfoToDriver,
  getSetting,
  sendOrderDoesNotExist,
  sendPendingOrdersToVacantDriver,
  sendOrderCompleted,
} = require("./messageSendingUtils");

const express = require("express"),
  app = express(),
  { urlencoded, json } = require("body-parser");
app.use(urlencoded({ extended: true }));

const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);

app.use(json());

app.get("/", function (_req, res) {
  res.send("Hello World");
});

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

app.post("/webhook", async (req, res) => {
  let body = req.body;
  if (body.object === "page") {
    body.entry.forEach(async (entry) => {
      let webhookEvent = entry.messaging[0];
      let senderPsid = webhookEvent.sender.id;
      if (webhookEvent.message) {
        const driverRegistrationRes = await handleDriverRegistration(
          senderPsid,
          webhookEvent.message
        );
        if (driverRegistrationRes) {
          return;
        } else {
          if (await isDriver(senderPsid)) {
            const driverTransaction = await getDriverActiveTransaction(
              senderPsid
            );
            if (driverTransaction == null) {
              if (
                !(await handleOrderAssignment(
                  senderPsid,
                  webhookEvent.message.text
                ))
              ) {
                sendGenericMessage(senderPsid, "IDLE_DRIVER_MESSAGE");
              }
            } else {
              if (
                await handleOrderDelivered(
                  senderPsid,
                  webhookEvent.message.text
                )
              )
                return;
              if (
                await handleOrderCancelled(
                  senderPsid,
                  webhookEvent.message.text
                )
              )
                return;
              const responseToUser = {
                text: webhookEvent.message.text,
              };
              callSendAPI(driverTransaction.user, responseToUser);
            }
          } else {
            const userTransaction = await getUserActiveTransaction(senderPsid);
            if (userTransaction == null) {
              // handle logic for starting a transaction
              await handleStartTransaction(
                senderPsid,
                webhookEvent.message.text
              );
            } else {
              if (
                userTransaction.status.toLowerCase() === "delivered" &&
                webhookEvent.message.text.toLowerCase() === "undelivered"
              ) {
                await updateDriverUserPair(
                  { _id: userTransaction._id },
                  { $set: { status: "Ongoing" } }
                );
                await sendUndeliveredMessage(
                  userTransaction.driver,
                  userTransaction.orderNumber
                );
              } else if (
                userTransaction.status.toLowerCase() === "delivered" &&
                webhookEvent.message.text.toLowerCase() === "order completed"
              ) {
                await updateDriverUserPair(
                  { _id: userTransaction._id },
                  { $set: { status: "Completed" } }
                );
                await sendOrderCompleted(
                  userTransaction.driver,
                  userTransaction.orderNumber
                );
                await sendGenericMessage(
                  userTransaction.user,
                  "THANK_YOU_MESSAGE"
                );
                await updateDriver(
                  { Psid: userTransaction.driver },
                  { $set: { status: "Vacant" } }
                );
                await sendPendingOrdersToVacantDriver(userTransaction.driver);
              } else {
                const responseToUser = {
                  text: webhookEvent.message.text,
                };
                callSendAPI(userTransaction.driver, responseToUser);
              }
            }
          }
        }
      } else if (webhookEvent.postback) {
        await handlePostback(senderPsid, webhookEvent.postback);
      }
    });
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

async function handleOrderCancelled(senderPsid, message) {
  if (message.toLowerCase() == "cancel order") {
    const record = await findDriverUserPair({
      driver: senderPsid,
      status: "Ongoing",
    });
    const transFilter = {
      driver: senderPsid,
      status: "Ongoing",
      user: record.user,
    };
    const transUpdate = {
      $set: { status: "Cancelled" },
    };
    await updateDriverUserPair(transFilter, transUpdate);
    await sendGenericMessage(
      record.user,
      "ORDER_CANCELLED_BY_DRIVER_INFO_TO_USER"
    );
    await sendOrderCancelledInfoToDriver(record.driver, record.orderNumber);
    const driverFilter = { Psid: senderPsid };
    const driverUpdate = {
      $set: { status: "Vacant" },
    };
    await sendPendingOrdersToVacantDriver(senderPsid);
    await updateDriver(driverFilter, driverUpdate);
    await handleStartTransaction(record.user, "");
    return true;
  }
  return false;
}

async function updateOrderTrackingState(orderTrackDetails, state) {
  // state: 1 (start) , 2 (type has been chosen)[update here after answering],
  // 3- details are given, 4 - driver accepted, 5- cancelled (by user, not by driver)

  const filter = {
    user: orderTrackDetails.user,
    state: { $nin: [4, 5] },
  };
  let update = {};
  if (state == 2) {
    update = {
      $set: { state: state, type: orderTrackDetails.type },
    };
  } else if (state == 3) {
    update = {
      $set: { state: state, details: orderTrackDetails.details },
    };
  } else {
    update = {
      $set: { state: state },
    };
  }
  await updateOrderTracking(filter, update);
}

async function handleUserRegistration(Psid) {
  const userRecord = await findUser({ Psid: Psid });
  if (userRecord == null) {
    const userInfo = await getUserInformation(Psid);
    await createUser({ ...userInfo, Psid: Psid });
  }
}
async function handleStartTransaction(senderPsid, message) {
  const orderTrackingRecord = await findOrderTracking({
    user: senderPsid,
    state: { $nin: [4, 5] },
  });
  if (orderTrackingRecord == null) {
    await handleUserRegistration(senderPsid);
    await sendGenericMessage(senderPsid, "ORDER_START");
    await createOrderTracking(senderPsid);
  } else {
    if (message.toLowerCase() === "cancel order") {
      await updateOrderTrackingState({ user: senderPsid }, 5);
      const orderFilter = {
        trackingRefId: orderTrackingRecord._id,
      };
      const order = await updateOrder(orderFilter, {
        $set: { isCancelled: true },
      });
      await broadcastUserOrderCancellation(order.orderNumber);
      await sendGenericMessage(
        senderPsid,
        "USER_ORDER_CANCELLATION_ACKNOWLEDGEMENT"
      );
      await sendGenericMessage(senderPsid, "ORDER_START");
      await createOrderTracking(senderPsid);
    }
    if (orderTrackingRecord.state == 1) {
      if (message.toLowerCase() === "grocery") {
        await sendGenericMessage(senderPsid, "GROCERY_INSTRUCTIONS");
        await updateOrderTrackingState({ user: senderPsid, type: message }, 2);
      } else if (message.toLowerCase() === "food delivery") {
        await sendGenericMessage(senderPsid, "FOOD_DELIVERY_INSTRUCTIONS");
        await updateOrderTrackingState({ user: senderPsid, type: message }, 2);
      } else {
        await sendGenericMessage(senderPsid, "SPECIFY_ORDER_TYPE");
      }
    } else if (orderTrackingRecord.state == 2) {
      await updateOrderTrackingState({ user: senderPsid, details: message }, 3);
      const orderNumber = await getNextSequenceValue("order");
      await createOrder({
        user: orderTrackingRecord.user,
        trackingRefId: orderTrackingRecord._id,
        details: message,
        orderType: orderTrackingRecord.type,
        isCancelled: false,
        orderNumber: orderNumber,
        withRider: false,
      });

      await broadcastNewOrder(orderNumber, orderTrackingRecord.type, message);
      await sendGenericMessage(senderPsid, "WAITING_FOR_RIDER");
    } else if (orderTrackingRecord.state == 3) {
      await sendGenericMessage(senderPsid, "WAITING_FOR_RIDER");
    }
  }
}

async function handleOrderDelivered(senderPsid, message) {
  if (message.toLowerCase() === "order delivered") {
    const record = await updateDriverUserPair(
      {
        driver: senderPsid,
        status: "Ongoing",
      },
      { $set: { status: "Delivered" } }
    );
    sendGenericMessage(record.user, "ORDER_DELIVERED");
    return true;
  }
  return false;
}

async function handleOrderAssignment(senderPsid, message) {
  if (
    message.toLowerCase().includes("accept order") &&
    message.split(" ").length == 3
  ) {
    const orderNumber = parseInt(message.split(" ")[2]);
    if (!(await orderExists(orderNumber))) {
      await sendOrderDoesNotExist(senderPsid, orderNumber);
    } else if (await isOrderAssigned(orderNumber)) {
      await sendOrderAlreadyAssigned(senderPsid, orderNumber);
    } else {
      const driver = await findDriver({
        Psid: senderPsid,
      });
      const order = await findOrder({
        orderNumber: orderNumber,
      });
      await updateOrder(
        {
          orderNumber: orderNumber,
        },
        {
          $set: { withRider: true },
        }
      );
      await startDriverUserTransaction(senderPsid, orderNumber);
      await sendOrderAssigned(senderPsid, orderNumber);
      await sendOrderAssignedToDriver(
        order.user,
        driver.first_name + " " + driver.last_name
      );
      await broadcastDriverOrderAssignment(orderNumber);
      const orderRecord = await findOrder({
        orderNumber: orderNumber,
      });
      const orderTrackingRecord = await updateOrderTracking(
        {
          _id: orderRecord.trackingRefId,
        },
        { $set: { state: 4 } }
      );
      await updateDriver(
        { Psid: senderPsid },
        { $set: { status: "Assigned" } }
      );
    }
    return true;
  } else {
    return false;
  }
}
async function startDriverUserTransaction(driver, orderNumber) {
  const orderRecord = await findOrder({
    orderNumber: orderNumber,
  });
  const result = await createDriverUserPair({
    driver: driver,
    user: orderRecord.user,
    orderNumber: orderRecord.orderNumber,
    status: "Ongoing",
  });

  const filter = { Psid: driver };
  const update = {
    $set: { status: "Assigned" },
  };
  await updateDriver(filter, update);
}

async function handleDriverRegistration(senderPsid, message) {
  const driver_reg_message = await getSetting("DRIVER_CODE");
  if (message.text === driver_reg_message) {
    if (await isDriver(senderPsid)) {
      await sendGenericMessage(senderPsid, "DRIVER_ALREADY_REGISTERED");
    } else {
      const { first_name, last_name } = await getUserInformation(senderPsid);
      const result = await createDriver({
        Psid: senderPsid,
        first_name: first_name,
        last_name: last_name,
        status: "Vacant",
        verified: false,
      });
      await sendGenericMessage(senderPsid, "DRIVER_SUCCESSFUL_REGISTRATION");
      await sendPendingOrdersToVacantDriver(senderPsid);
    }
    return true;
  }
  return false;
}

// Handles messaging_postbacks events
async function handlePostback(senderPsid, receivedPostback) {
  let response;

  // Get the payload for the postback
  let payload = receivedPostback.payload;

  // Set the response based on the postback payload
  if (payload === "WELCOME_MESSAGE") {
    await handleStartTransaction(senderPsid, "");
  }
}

async function getNextSequenceValue(collectionName) {
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB);
    const countersCollection = db.collection("counters");

    const result = await countersCollection.findOneAndUpdate(
      { _id: collectionName },
      { $inc: { sequence_value: 1 } },
      { returnDocument: "after" }
    );

    return result.sequence_value;
  } finally {
    await client.close();
  }
}

async function createCountersCollection() {
  try {
    const db = client.db(database);
    const countersCollection = db.collection("counters");

    // Create a counter document for a collection named 'yourCollection'
    await countersCollection.updateOne(
      { _id: "order" },
      { $setOnInsert: { sequence_value: 0 } },
      { upsert: true }
    );
  } finally {
    await client.close();
  }
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log("Your app is listening on port " + listener.address().port);
});
