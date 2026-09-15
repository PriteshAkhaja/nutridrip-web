import mongoose from "mongoose";

/**
 * Next.js hot-reloads modules in dev, which would otherwise open a new
 * connection pool on every reload. Cache the promise on globalThis.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cached: MongooseCache = globalWithMongoose._mongoose ?? { conn: null, promise: null };
globalWithMongoose._mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.");

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}

export default connectDB;
