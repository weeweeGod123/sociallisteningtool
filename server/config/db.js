const mongoose = require("mongoose");
const { MongoClient } = require("mongodb");

let db = null;

const connectDB = async () => {
  try {
    // Connect with Mongoose
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.MONGO_DB_NAME || 'social-listening'
    });
    console.log("🚀 MongoDB Atlas connected successfully with Mongoose");

    // Also connect with native driver for raw operations
    const client = await MongoClient.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    db = client.db(process.env.MONGO_DB_NAME || 'social-listening');
    console.log("🚀 MongoDB Atlas connected successfully with native driver");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
};

module.exports = { connectDB, getDB };
