"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);
const databaseName = process.env.MONGO_DB;
const database = client.db(databaseName);
const collection = database.collection("order_state_tracking");

async function findOrderTracking(filter) {
  return collection.findOne(filter);
}

async function updateOrderTracking(filter, update) {
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createOrderTracking(userPsid) {
  return await collection.insertOne({
    user: userPsid,
    state: 1,
    type: "",
    details: "",
  });
}

module.exports = {
  findOrderTracking,
  updateOrderTracking,
  createOrderTracking,
};
