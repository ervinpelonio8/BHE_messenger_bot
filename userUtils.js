"use strict";

// Use dotenv to read .env vars into Node
require("dotenv").config();
const { MongoClient } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI, {
  useUnifiedTopology: true,
});
const axios = require("axios");
const databaseName = process.env.MONGO_DB;
const database = client.db(databaseName);
const collection = database.collection("user");

async function findUser(filter) {
  return collection.findOne(filter);
}

async function updateUser(filter, update) {
  return collection.findOneAndUpdate(filter, update, {
    returnDocument: "after",
  });
}

async function createUser(order) {
  return collection.insertOne(order);
}

async function getUserInformation(psid) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  try {
    const url = `https://graph.facebook.com/v20.0/${psid}?fields=first_name,last_name&access_token=${PAGE_ACCESS_TOKEN}`;
    const response = await axios.get(url);

    // Extract user's full name
    const { first_name, last_name } = response.data;
    return { first_name, last_name };
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  findUser,
  updateUser,
  createUser,
  getUserInformation,
};
