// lib/mongodb.js
// Connection pooling untuk Vercel serverless — cache koneksi di global scope

import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) throw new Error('MONGODB_URI belum diset di environment variables')

let cached = global._mongooseCache
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands:           false,
      maxPoolSize:              10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}

export default connectDB
