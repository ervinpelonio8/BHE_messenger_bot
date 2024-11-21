"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { connectToDatabase } = require("./db.js");

async function findOrderTracking(filter) {
  const database = await connectToDatabase();
  const collection = database.collection("order_state_tracking");
  return collection.findOne(filter);
}

async function updateOrderTracking(filter, update) {
  const database = await connectToDatabase();
  const collection = database.collection("order_state_tracking");
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createOrderTracking(userPsid) {
  const database = await connectToDatabase();
  const collection = database.collection("order_state_tracking");
  return await collection.insertOne({
    user: userPsid,
    state: 1,
    type: "",
    details: "",
    dateCreated: new Date(),
  });
}

module.exports = {
  findOrderTracking,
  updateOrderTracking,
  createOrderTracking,
};
