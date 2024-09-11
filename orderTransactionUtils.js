"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);
const databaseName = process.env.MONGO_DB;
const database = client.db(databaseName);
const collection = database.collection("driver_user_pair");

async function findDriverUserPair(filter) {
  return collection.findOne(filter);
}

async function updateDriverUserPair(filter, update) {
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createDriverUserPair(order) {
  return collection.insertOne(order);
}

async function getDriverActiveTransaction(driverPsid) {
  const record = await collection.findOne({
    driver: driverPsid,
    status: { $nin: ["Completed", "Cancelled"] },
  });
  return record;
}

async function getUserActiveTransaction(userPsid) {
  const record = await collection.findOne({
    user: userPsid,
    status: { $nin: ["Completed", "Cancelled"] },
  });

  console.log("This is the retrieved record for user transaction: ", record);
  return record;
}

async function isOrderAssigned(orderNumber) {
  const record = await collection.findOne({ orderNumber: orderNumber });
  return record != null;
}

module.exports = {
  findDriverUserPair,
  updateDriverUserPair,
  createDriverUserPair,
  getDriverActiveTransaction,
  getUserActiveTransaction,
  isOrderAssigned,
};
