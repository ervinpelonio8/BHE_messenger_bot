"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);
const databaseName = process.env.MONGO_DB;
const database = client.db(databaseName);
const collection = database.collection("order");

async function findOrder(filter) {
  return collection.findOne(filter);
}

async function updateOrder(filter, update) {
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createOrder(order) {
  return collection.insertOne(order);
}

async function orderExists(orderNumber) {
  const record = await findOrder({ orderNumber: orderNumber });
  return record != null;
}

module.exports = {
  findOrder,
  updateOrder,
  createOrder,
  orderExists,
};
