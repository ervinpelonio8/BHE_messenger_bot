require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    console.warn("👌 Using existing connection");
    return Promise.resolve(cachedDb);
  }

  return MongoClient.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
  })
    .then((client) => {
      let db = client.db(process.env.MONGO_DB);
      console.warn("🔥 New DB Connection");
      cachedDb = db;
      return cachedDb;
    })
    .catch((error) => {
      console.warn("Mongo connect Error");
      console.warn(error);
    });
};

module.exports = {
  connectToDatabase,
};
