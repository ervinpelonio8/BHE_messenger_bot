require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
let cachedDb = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    console.info("👌 Using existing connection");
    return Promise.resolve(cachedDb);
  }

  return MongoClient.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true,
  })
    .then((client) => {
      let db = client.db(process.env.MONGO_DB);
      console.info("🔥 New DB Connection");
      cachedDb = db;
      return cachedDb;
    })
    .catch((error) => {
      console.info("Mongo connect Error");
      console.info(error);
    });
};

module.exports = {
  connectToDatabase,
};
