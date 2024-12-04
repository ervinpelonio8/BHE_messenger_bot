"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);
const databaseName = process.env.MONGO_DB;
const database = client.db(databaseName);
const collection = database.collection("reload_history");

async function createReloadHistory(reloadHistory) {
  return collection.insertOne(reloadHistory);
}

module.exports = {
  createReloadHistory,
};
