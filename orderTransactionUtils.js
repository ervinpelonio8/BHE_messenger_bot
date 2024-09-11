"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { connectToDatabase } = require("./db.js");

async function findDriverUserPair(filter) {
  const database = await connectToDatabase();
  const collection = database.collection("driver_user_pair");
  return collection.findOne(filter);
}

async function updateDriverUserPair(filter, update) {
  const database = await connectToDatabase();
  const collection = database.collection("driver_user_pair");
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createDriverUserPair(order) {
  const database = await connectToDatabase();
  const collection = database.collection("driver_user_pair");
  return collection.insertOne(order);
}

async function getDriverActiveTransaction(driverPsid) {
  const database = await connectToDatabase();
  const collection = database.collection("driver_user_pair");
  const record = await collection.findOne({
    driver: driverPsid,
    status: { $nin: ["Completed", "Cancelled"] },
  });
  return record;
}

async function getUserActiveTransaction(userPsid) {
  const database = await connectToDatabase();
  const collection = database.collection("driver_user_pair");
  const record = await collection.findOne({
    user: userPsid,
    status: { $nin: ["Completed", "Cancelled"] },
  });

  console.warn("This is the retrieved record for user transaction: ", record);
  return record;
}

async function isOrderAssigned(orderNumber) {
  const database = await connectToDatabase();
  const collection = database.collection("driver_user_pair");
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
