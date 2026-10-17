import mongoose from 'mongoose';
import env from './env.js';

let mongodInstance = null;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  try {
    if (env.MONGODB_URI === 'memory') {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      const uri = mongodInstance.getUri();
      console.log('📦 Using in-memory MongoDB server at', uri);
      await mongoose.connect(uri);
      console.log('✅ Connected to in-memory MongoDB');
      return mongoose.connection;
    }

    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(
        `✅ Connected to MongoDB (${mongoose.connection.host}/${mongoose.connection.name})`
      );
      return mongoose.connection;
    } catch (primaryErr) {
      if (env.NODE_ENV === 'development') {
        console.warn(`⚠️ Could not connect to primary MongoDB URI (${primaryErr.message}).`);
        console.warn('⚠️ Starting MongoMemoryServer for seamless local development...');
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create();
        const uri = mongodInstance.getUri();
        await mongoose.connect(uri);
        console.log(`✅ Connected to fallback in-memory MongoDB at ${uri}`);
        return mongoose.connection;
      }
      throw primaryErr;
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongodInstance) {
      await mongodInstance.stop();
    }
    console.log('Disconnected from MongoDB.');
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
};

export default connectDB;
