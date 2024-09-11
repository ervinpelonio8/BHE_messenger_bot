"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);
const databaseName = process.env.MONGO_DB;
const database = client.db(databaseName);
const collection = database.collection("driver");

async function findDriver(filter) {
  return collection.findOne(filter);
}

async function updateDriver(filter, update) {
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createDriver(order) {
  return collection.insertOne(order);
}

async function isDriver(senderPsid) {
  const count = await collection.countDocuments({ Psid: senderPsid });
  return count > 0;
}

module.exports = {
  findDriver,
  updateDriver,
  createDriver,
  isDriver,
};
