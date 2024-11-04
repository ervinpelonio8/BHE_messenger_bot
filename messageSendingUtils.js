require("dotenv").config();
const request = require("request"),
  express = require("express"),
  { urlencoded, json, text } = require("body-parser"),
  app = express();

const util = require("util");
const { connectToDatabase } = require("./db.js");

async function sendGenericMessage(recepientPsid, messageKeyword) {
  const message = await getSetting(messageKeyword);
  const response = {
    text: message,
  };
  await callSendAPI(recepientPsid, response);
}

async function sendUndeliveredMessage(recepientPsid, orderNumber) {
  const message = await getSetting("DELIVERY_UNCONFIRMED");
  const response = {
    text: util.format(message, orderNumber),
  };
  await callSendAPI(recepientPsid, response);
}

async function broadcastDriverOrderAssignment(orderNumber) {
  const driverAssignedMessage = await getSetting("DRIVER_ASSIGNED_MESSAGE");
  const driverAssignedResponse = {
    text: util.format(driverAssignedMessage, orderNumber),
  };
  await broadcastMessageToAvailableRiders(driverAssignedResponse);
}

async function broadcastUserOrderCancellation(orderNumber) {
  const orderCancellationMessage = await getSetting("ORDER_CANCELLED_BY_USER");
  const orderCancellationResponse = {
    text: util.format(orderCancellationMessage, orderNumber),
  };
  await broadcastMessageToAvailableRiders(orderCancellationResponse);
}

async function broadcastNewOrder(orderNumber, type, details) {
  const newOrderMessage = await getSetting("NEW_ORDER_BROADCAST");
  const newOrderResponse = {
    text: util.format(newOrderMessage, orderNumber, type, details),
  };
  await broadcastMessageToAvailableRiders(newOrderResponse);
}

async function broadcastMessageToAvailableRiders(message) {
  const database = await connectToDatabase();
  const driverCollection = database.collection("driver");

  const cursor = driverCollection.find({
    status: "Vacant",
    balance: { $gt: 0 },
  });

  await cursor.forEach(async (doc) => {
    await callSendAPI(doc.Psid, message);
  });
}

async function getSetting(settingName) {
  const database = await connectToDatabase();
  const settingsCollection = database.collection("setting");
  const setting = await settingsCollection.findOne({ name: settingName });

  if (setting == null || setting === undefined) {
    return "";
  } else {
    return setting.value;
  }
}

async function sendOrderAlreadyAssigned(recepientPsid, orderNumber) {
  const alreadyAssignedMessage = await getSetting("ORDER_ALREADY_ASSIGNED");
  const alreadyAssignedResponse = {
    text: util.format(alreadyAssignedMessage, orderNumber),
  };
  await callSendAPI(recepientPsid, alreadyAssignedResponse);
}

async function sendOrderDoesNotExist(recepientPsid, orderNumber) {
  const orderDoesNotExistMessage = await getSetting("NON_EXISTING_ORDER");
  const orderDoesNotExistResponse = {
    text: util.format(orderDoesNotExistMessage, orderNumber),
  };
  await callSendAPI(recepientPsid, orderDoesNotExistResponse);
}

async function sendOrderAssigned(recepientPsid, orderNumber) {
  const orderAssignedMessage = await getSetting("ORDER_ASSIGNED_MESSAGE");
  const orderAssignedResponse = {
    text: util.format(orderAssignedMessage, orderNumber),
  };
  await callSendAPI(recepientPsid, orderAssignedResponse);
}

async function sendRideAssigned(recepientPsid, orderNumber) {
  const rideAssignedMessage = await getSetting("RIDE_ASSIGNED_MESSAGE");
  const rideAssignedResponse = {
    text: util.format(rideAssignedMessage, orderNumber),
  };
  await callSendAPI(recepientPsid, rideAssignedResponse);
}

async function sendOrderCompleted(recepientPsid, orderNumber) {
  const orderCompletedMessage = await getSetting("ORDER_COMPLETED");
  const orderCompletedResponse = {
    text: util.format(orderCompletedMessage, orderNumber),
  };
  await callSendAPI(recepientPsid, orderCompletedResponse);
}

async function sendBalanceToDriver(driverPsid) {
  const driverBalanceMessage = await getSetting("DRIVER_BALANCE");
  const database = await connectToDatabase();
  const collection = database.collection("driver");
  const driver = await collection.findOne({ Psid: driverPsid });
  const driverBalanceResponse = {
    text: util.format(driverBalanceMessage, driver.balance),
  };
  await callSendAPI(driverPsid, driverBalanceResponse);
}

async function sendOrderAssignedToDriver(recepientPsid, driverName) {
  const orderAssignedMessage = await getSetting("ORDER_ASSIGNED_TO_DRIVER");
  const orderAssignedResponse = {
    text: util.format(orderAssignedMessage, driverName),
  };
  await callSendAPI(recepientPsid, orderAssignedResponse);
}

async function sendPendingOrdersToVacantDriver(driverPsid) {
  const database = await connectToDatabase();
  const orderCollection = database.collection("order");
  const orderQuery = {
    withRider: false,
    isCancelled: false,
  };

  // Fetch the documents
  const cursor = orderCollection.find(orderQuery);

  // Process each document
  await cursor.forEach(async (order) => {
    const newOrderMessage = await getSetting("NEW_ORDER_BROADCAST");
    const newOrderResponse = {
      text: util.format(
        newOrderMessage,
        order.orderNumber,
        order.orderType,
        order.details
      ),
    };
    await callSendAPI(driverPsid, newOrderResponse);
  });
}

async function sendOrderCancelledInfoToDriver(recepientPsid, orderNumber) {
  const orderAssignedMessage = await getSetting(
    "ORDER_CANCELLED_BY_DRIVER_INFO_TO_DRIVER"
  );
  const orderAssignedResponse = {
    text: util.format(orderAssignedMessage, orderNumber),
  };
  await callSendAPI(recepientPsid, orderAssignedResponse);
}

// Sends response messages via the Send API
function callSendAPI(senderPsid, response) {
  console.error("SenderPsid: ", senderPsid);
  console.error("Response: ", response);

  // The page access token we have generated in your app settings
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  // Construct the message body
  let requestBody = {
    recipient: {
      id: senderPsid,
    },
    message: response,
  };

  // Send the HTTP request to the Messenger Platform
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: PAGE_ACCESS_TOKEN },
      method: "POST",
      json: requestBody,
    },
    (err, _res, _body) => {
      if (!err) {
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

module.exports = {
  getSetting,
  callSendAPI,
  broadcastDriverOrderAssignment,
  broadcastMessageToAvailableRiders,
  sendGenericMessage,
  sendOrderAlreadyAssigned,
  sendOrderAssigned,
  broadcastUserOrderCancellation,
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
};
