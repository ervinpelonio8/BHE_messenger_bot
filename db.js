require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    console.log("👌 Using existing connection");
    return Promise.resolve(cachedDb);
  }

  return MongoClient.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
  })
    .then((client) => {
      let db = client.db(process.env.MONGO_DB);
      console.log("🔥 New DB Connection");
      cachedDb = db;
      return cachedDb;
    })
    .catch((error) => {
      console.log("Mongo connect Error");
      console.log(error);
    });
};

module.exports = {
  connectToDatabase,
};
