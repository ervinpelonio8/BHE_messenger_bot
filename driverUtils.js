"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { connectToDatabase } = require("./db.js");

async function findDriver(filter) {
  const database = await connectToDatabase();
  const collection = database.collection("driver");
  return collection.findOne(filter);
}

async function updateDriver(filter, update) {
  const database = await connectToDatabase();
  const collection = database.collection("driver");
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createDriver(order) {
  const database = await connectToDatabase();
  const collection = database.collection("driver");
  return collection.insertOne(order);
}

async function getBalance(driverPsid) {
  const driver = await findDriver({ Psid: driverPsid });
  return parseInt(driver.balance);
}

async function isDriver(senderPsid) {
  const database = await connectToDatabase();
  const collection = database.collection("driver");
  const count = await collection.countDocuments({ Psid: senderPsid });
  return count > 0;
}

module.exports = {
  findDriver,
  updateDriver,
  createDriver,
  isDriver,
  getBalance,
};
