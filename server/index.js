import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './db.js';

import vehicleRoutes from './routes/vehicles.js';
import bookingRoutes from './routes/bookings.js';
import accountingRoutes from './routes/accounting.js';

dotenv.config();

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all (development only)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    // In production, restrict to ALLOWED_ORIGINS
    if (ALLOWED_ORIGINS && !ALLOWED_ORIGINS.includes(origin)) {
      return callback(new Error(`CORS: Origin ${origin} is not allowed`), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// ─── MongoDB connection middleware (for serverless environments) ───────────────
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1 && process.env.MONGODB_URI) {
    await connectDB();
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/accounting', accountingRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// ─── Database Status (standardized format) ───────────────────────────────────
app.get('/api/system/database-status', (req, res) => {
  const readyState = mongoose.connection.readyState;
  const connected = readyState === 1;

  res.json({
    connected,
    mode: connected ? 'mongodb' : 'memory',
    database: connected ? mongoose.connection.name : null,
    host: connected ? mongoose.connection.host : null,
    readyState
  });
});

// Legacy alias kept for backward compatibility with existing frontend polling
app.get('/api/db-status', (req, res) => {
  const readyState = mongoose.connection.readyState;
  const connected = readyState === 1;
  res.json({
    connected,
    mode: connected ? 'MongoDB Cloud' : 'In-Memory Fallback',
    host: connected ? mongoose.connection.host : 'localhost',
    database: connected ? mongoose.connection.name : null
  });
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.message);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// ─── Server startup ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Seed initial data only if MongoDB is connected and collection is empty
  if (mongoose.connection.readyState === 1) {
    const { default: Vehicle } = await import('./models/Vehicle.js');
    try {
      const vehicleCount = await Vehicle.countDocuments({});
      if (vehicleCount === 0) {
        const { seedVehicles } = await import('./seeds/vehicles.js');
        await Vehicle.insertMany(seedVehicles);
        console.log('[Seed] Initial vehicle data seeded to MongoDB.');
      }
    } catch (err) {
      console.error('[Seed] Failed to seed vehicles:', err.message);
    }
  }
};

// Only call listen when running directly (not in serverless)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, async () => {
    console.log(`[Server] Running on port ${PORT}`);
    await startServer();
  });
} else {
  // Serverless: connect eagerly on cold start
  startServer().catch(err => console.error('[Server] Startup error:', err.message));
}

export default app;
