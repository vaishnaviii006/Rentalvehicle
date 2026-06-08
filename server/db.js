import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;
let lastAttemptTime = 0;
const RECONNECT_COOLDOWN_MS = 30000; // wait 30s between failed attempts

const connectDB = async () => {
  // Already connected
  if (isConnected && mongoose.connection.readyState === 1) return;

  // Cooldown between failed attempts to prevent hammering Atlas
  const now = Date.now();
  if (!isConnected && (now - lastAttemptTime) < RECONNECT_COOLDOWN_MS) {
    return; // Still in cooldown — skip this attempt
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[DB] MONGODB_URI is not set. Cannot connect to MongoDB.');
    if (process.env.DISABLE_MEMORY_FALLBACK === 'true') {
      console.error('[DB] DISABLE_MEMORY_FALLBACK is true. Server will not start without MongoDB.');
      process.exit(1);
    }
    console.warn('[DB] Falling back to In-Memory mode. ALL DATA WILL BE LOST ON RESTART.');
    return;
  }

  lastAttemptTime = now;

  try {
    mongoose.set('bufferCommands', false);

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    const { host, name } = mongoose.connection;
    console.log(`[DB] MongoDB Connected: ${host || 'unknown'} — DB: ${name || 'unknown'}`);

    // Register event listeners only once
    if (!mongoose.connection.listenerCount('disconnected')) {
      mongoose.connection.on('disconnected', () => {
        isConnected = false;
        console.warn('[DB] MongoDB disconnected. Will attempt reconnect on next request (30s cooldown).');
      });

      mongoose.connection.on('reconnected', () => {
        isConnected = true;
        console.log('[DB] MongoDB reconnected successfully.');
      });

      mongoose.connection.on('error', (err) => {
        isConnected = false;
        console.error(`[DB] MongoDB connection error: ${err.message}`);
      });
    }

  } catch (error) {
    isConnected = false;
    console.error(`[DB] MongoDB Connection Failed: ${error.message}`);

    if (process.env.DISABLE_MEMORY_FALLBACK === 'true') {
      console.error('[DB] DISABLE_MEMORY_FALLBACK is true. Exiting.');
      process.exit(1);
    }

    console.warn('[DB] Running in In-Memory Fallback Mode. DATA IS NOT PERSISTED.');
  }
};

export default connectDB;
