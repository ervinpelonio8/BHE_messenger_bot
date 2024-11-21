"use strict";
const util = require("util");
// Use dotenv to read .env vars into Node
require("dotenv").config();
const {
  findOrder,
  createOrder,
  updateOrder,
  orderExists,
  hasPendingOrders,
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
  getBalance,
} = require("./driverUtils");
const {
  findDriverUserPair,
  updateDriverUserPair,
  createDriverUserPair,
  getDriverActiveTransaction,
  getUserActiveTransaction,
  isOrderAssigned,
  appendMessage,
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
  sendBalanceToDriver,
  sendRideAssigned,
  sendQuickReplyMessage,
} = require("./messageSendingUtils");

const {
  chooseServiceQuickReply,
  cancelOrderUserQuickReply,
  driverRideConvoQuickReply,
  driverOrderConvoQuickReply,
  userRideCompletedQuickReply,
  userOrderDeliveredQuickReply,
} = require("./constants.js");

const express = require("express"),
  app = express(),
  { urlencoded, json } = require("body-parser");
app.use(urlencoded({ extended: true }));

const { connectToDatabase } = require("./db.js");

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
  // console.log(
  //   util.inspect(body, { showHidden: false, depth: null, colors: true })
  // );

  if (body.object === "page") {
    body.entry.forEach(async (entry) => {
      let webhookEvent = entry.messaging[0];
      let senderPsid = webhookEvent.sender.id;
      if (webhookEvent.message && !webhookEvent.message.is_echo) {
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
                if (
                  await handleBalanceInquiry(
                    senderPsid,
                    webhookEvent.message.text
                  )
                ) {
                  return;
                }
                const ratePerTransaction = parseInt(
                  await getSetting("RATE_PER_TRANSACTION")
                );
                if ((await getBalance(senderPsid)) < ratePerTransaction) {
                  await sendGenericMessage(senderPsid, "DRIVER_NO_BALANCE");
                  return;
                }
                if (await hasPendingOrders()) {
                  await sendPendingOrdersToVacantDriver(senderPsid);
                } else {
                  await sendGenericMessage(senderPsid, "IDLE_DRIVER_MESSAGE");
                }
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
              appendMessage(
                "driver",
                driverTransaction._id,
                webhookEvent.message.text
              );
              await callSendAPI(driverTransaction.user, responseToUser);
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
                (webhookEvent.message.text.toLowerCase() === "mistake" ||
                  webhookEvent.message.text.toLowerCase() ===
                    "must be a mistake")
              ) {
                await updateDriverUserPair(
                  { _id: userTransaction._id },
                  { $set: { status: "Ongoing" } }
                );
                const order = await findOrder({
                  orderNumber: userTransaction.orderNumber,
                });

                await sendUndeliveredMessage(
                  userTransaction.driver,
                  userTransaction.orderNumber,
                  order.orderType.toLowerCase() === "ride"
                    ? driverRideConvoQuickReply
                    : driverOrderConvoQuickReply
                );
              } else if (
                userTransaction.status.toLowerCase() === "delivered" &&
                (webhookEvent.message.text.toLowerCase() ===
                  "order completed" ||
                  webhookEvent.message.text.toLowerCase() === "ride completed")
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
                const ratePerTransaction = parseInt(
                  await getSetting("RATE_PER_TRANSACTION")
                );

                await updateDriver(
                  { Psid: userTransaction.driver },
                  {
                    $set: { status: "Vacant" },
                    $inc: { balance: -ratePerTransaction }, // Subtracts ratePerTransaction from balance
                  }
                );
                sendBalanceToDriver(userTransaction.driver);
                if (
                  (await getBalance(userTransaction.driver)) <
                  ratePerTransaction
                ) {
                  await sendGenericMessage(
                    userTransaction.driver,
                    "DRIVER_NO_BALANCE"
                  );
                } else {
                  await sendPendingOrdersToVacantDriver(userTransaction.driver);
                }
              } else {
                const order = await findOrder({
                  orderNumber: userTransaction.orderNumber,
                });
                const responseToUser = {
                  text: webhookEvent.message.text,
                  quick_replies:
                    order.orderType.toLowerCase() === "ride"
                      ? driverRideConvoQuickReply
                      : driverOrderConvoQuickReply,
                };
                appendMessage(
                  "user",
                  userTransaction._id,
                  webhookEvent.message.text
                );
                await callSendAPI(userTransaction.driver, responseToUser);
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

async function handleBalanceInquiry(senderPsid, message) {
  if (message.toLowerCase() == "bal") {
    sendBalanceToDriver(senderPsid);
    return true;
  }
  return false;
}

async function handleOrderCancelled(senderPsid, message) {
  if (
    message.toLowerCase() == "cancel order" ||
    message.toLowerCase() == "cancel ride"
  ) {
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
    // const userInfo = await getUserInformation(Psid);
    await createUser({ Psid: Psid, dateCreated: new Date() });
  }
}
async function handleStartTransaction(senderPsid, message) {
  const orderTrackingRecord = await findOrderTracking({
    user: senderPsid,
    state: { $nin: [4, 5] },
  });
  if (orderTrackingRecord == null) {
    await handleUserRegistration(senderPsid);
    await sendQuickReplyMessage(
      senderPsid,
      "ORDER_START",
      chooseServiceQuickReply
    );
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
      await sendQuickReplyMessage(
        senderPsid,
        "ORDER_START",
        chooseServiceQuickReply
      );
      await createOrderTracking(senderPsid);
      return;
    }
    if (orderTrackingRecord.state == 1) {
      if (message.toLowerCase() === "grocery") {
        await sendGenericMessage(senderPsid, "GROCERY_INSTRUCTIONS");
        await updateOrderTrackingState(
          { user: senderPsid, type: message.toLowerCase() },
          2
        );
      } else if (message.toLowerCase() === "food delivery") {
        await sendGenericMessage(senderPsid, "FOOD_DELIVERY_INSTRUCTIONS");
        await updateOrderTrackingState(
          { user: senderPsid, type: message.toLowerCase() },
          2
        );
      } else if (message.toLowerCase() === "ride") {
        await sendGenericMessage(senderPsid, "RIDE_INSTRUCTIONS");
        await updateOrderTrackingState(
          { user: senderPsid, type: message.toLowerCase() },
          2
        );
      } else {
        await sendQuickReplyMessage(
          senderPsid,
          "SPECIFY_ORDER_TYPE",
          chooseServiceQuickReply
        );
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
        dateCreated: new Date(),
      });

      await broadcastNewOrder(orderNumber, orderTrackingRecord.type, message);
      await sendQuickReplyMessage(
        senderPsid,
        "WAITING_FOR_RIDER",
        cancelOrderUserQuickReply
      );
    } else if (orderTrackingRecord.state == 3) {
      await sendQuickReplyMessage(
        senderPsid,
        "WAITING_FOR_RIDER",
        cancelOrderUserQuickReply
      );
    }
  }
}

async function handleOrderDelivered(senderPsid, message) {
  if (
    message.toLowerCase() === "order delivered" ||
    message.toLowerCase() === "passenger delivered"
  ) {
    const record = await updateDriverUserPair(
      {
        driver: senderPsid,
        status: "Ongoing",
      },
      { $set: { status: "Delivered" } }
    );
    if (message.toLowerCase() === "passenger delivered") {
      await sendQuickReplyMessage(
        record.user,
        "PASSENGER_DELIVERED",
        userRideCompletedQuickReply
      );
    } else {
      await sendQuickReplyMessage(
        record.user,
        "ORDER_DELIVERED",
        userOrderDeliveredQuickReply
      );
    }
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
      if (order.orderType.toLowerCase() === "ride") {
        await sendRideAssigned(senderPsid, orderNumber);
      } else {
        await sendOrderAssigned(senderPsid, orderNumber);
      }
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
    messages: [],
    status: "Ongoing",
    dateCreated: new Date(),
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
      // const { first_name, last_name } = await getUserInformation(senderPsid);
      const result = await createDriver({
        Psid: senderPsid,
        // first_name: first_name,
        // last_name: last_name,
        status: "Vacant",
        verified: false,
        balance: 0,
        dateCreated: new Date(),
      });
      await sendGenericMessage(senderPsid, "DRIVER_SUCCESSFUL_REGISTRATION");
      await sendGenericMessage(senderPsid, "NEW_DRIVER_BALANCE_INFO");
    }
    return true;
  }
  return false;
}

// Handles messaging_postbacks events
async function handlePostback(senderPsid, receivedPostback) {
  // Get the payload for the postback
  let payload = receivedPostback.payload;

  // Set the response based on the postback payload
  if (payload === "WELCOME_MESSAGE") {
    await handleStartTransaction(senderPsid, "");
  }
}

async function getNextSequenceValue(collectionName) {
  try {
    const database = await connectToDatabase();
    const countersCollection = database.collection("counters");

    const result = await countersCollection.findOneAndUpdate(
      { _id: collectionName },
      { $inc: { sequence_value: 1 } },
      { returnDocument: "after" }
    );

    return result.sequence_value;
  } catch (err) {
    console.error("Error getting next sequence!", err);
  }
}

async function createCountersCollection() {
  try {
    const database = await connectToDatabase();
    const countersCollection = database.collection("counters");

    // Create a counter document for a collection named 'yourCollection'
    await countersCollection.updateOne(
      { _id: "order" },
      { $setOnInsert: { sequence_value: 0 } },
      { upsert: true }
    );
  } catch (err) {
    console.error("Error creating counters!", err);
  }
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.error("Your app is listening on port " + listener.address().port);
});
