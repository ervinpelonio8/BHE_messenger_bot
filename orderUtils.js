"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { connectToDatabase } = require("./db.js");

async function findOrder(filter) {
  const database = await connectToDatabase();
  const collection = database.collection("order");
  return collection.findOne(filter);
}

async function updateOrder(filter, update) {
  const database = await connectToDatabase();
  const collection = database.collection("order");
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createOrder(order) {
  const database = await connectToDatabase();
  const collection = database.collection("order");
  return collection.insertOne(order);
}

async function orderExists(orderNumber) {
  const database = await connectToDatabase();
  const collection = database.collection("order");
  const record = await findOrder({ orderNumber: orderNumber });
  return record != null;
}

async function hasPendingOrders() {
  const record = await findOrder({
    withRider: false,
    isCancelled: false,
  });
  return record != null;
}
module.exports = {
  findOrder,
  updateOrder,
  createOrder,
  orderExists,
  hasPendingOrders,
};
