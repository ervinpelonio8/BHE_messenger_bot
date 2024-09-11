require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    console.error("👌 Using existing connection");
    return Promise.resolve(cachedDb);
  }

  return MongoClient.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
  })
    .then((client) => {
      let db = client.db(process.env.MONGO_DB);
      console.error("🔥 New DB Connection");
      cachedDb = db;
      return cachedDb;
    })
    .catch((error) => {
      console.error("Mongo connect Error");
      console.error(error);
    });
};

module.exports = {
  connectToDatabase,
};
