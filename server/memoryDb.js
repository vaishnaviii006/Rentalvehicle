import mongoose from 'mongoose';
import { seedVehicles } from './seeds/vehicles.js';

// ─── DB connection check ──────────────────────────────────────────────────────
export const isDbConnected = () => mongoose.connection.readyState === 1;

// ─── In-Memory stores ─────────────────────────────────────────────────────────
// WARNING: These are volatile — data is lost on every server restart.
// Only used when MongoDB is unavailable. Set DISABLE_MEMORY_FALLBACK=true
// in production to prevent silent fallback to this mode.

export let vehicles = seedVehicles.map(v => ({ ...v, createdAt: new Date() }));

export let bookings = [];

export let settlements = [];

// ─── Vehicle CRUD ─────────────────────────────────────────────────────────────

export const getVehicles = () => vehicles;

export const addVehicle = (v) => {
  const existingNums = vehicles
    .map(item => parseInt(item.vehicleId?.split('-')[1] || '0', 10))
    .filter(n => !isNaN(n));
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
  const newV = {
    ...v,
    vehicleId: `VEH-${String(nextNum).padStart(5, '0')}`,
    createdAt: new Date()
  };
  vehicles.push(newV);
  return newV;
};

export const updateVehicle = (id, data) => {
  const idx = vehicles.findIndex(v => v.vehicleId === id);
  if (idx === -1) return null;
  vehicles[idx] = { ...vehicles[idx], ...data };
  return vehicles[idx];
};

// ─── Booking CRUD ─────────────────────────────────────────────────────────────

export const getBookings = () => bookings;

export const addBooking = (b) => {
  const existingNums = bookings
    .map(item => parseInt(item.bookingId?.split('-')[1] || '0', 10))
    .filter(n => !isNaN(n));
  const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 10001;
  const newB = {
    ...b,
    bookingId: `VB-${nextNum}`,
    createdAt: new Date(),
    extensions: b.extensions || [],
    replacements: b.replacements || [],
    revisions: b.revisions || [],
    paymentCollection: b.paymentCollection || []
  };
  bookings.push(newB);
  return newB;
};

export const updateBooking = (id, data) => {
  const idx = bookings.findIndex(b => b.bookingId === id);
  if (idx === -1) return null;
  bookings[idx] = { ...bookings[idx], ...data };
  return bookings[idx];
};

// ─── Settlement CRUD ──────────────────────────────────────────────────────────

export const getSettlements = () => settlements;

export const addSettlement = (s) => {
  const idx = settlements.findIndex(
    item => item.date === s.date && item.workerId === s.workerId
  );

  if (idx !== -1) {
    // Update existing record
    settlements[idx].cashCollected = s.cashCollected;
    settlements[idx].depositToAdmin += Number(s.depositAmount) || 0;
    settlements[idx].balance = settlements[idx].cashCollected - settlements[idx].depositToAdmin;
    settlements[idx].status = settlements[idx].balance === 0 ? 'Settled' : 'Pending';
    if (s.remarks) settlements[idx].remarks = s.remarks;
    return settlements[idx];
  }

  // New record
  const depositAmount = Number(s.depositAmount) || 0;
  const cashCollected = Number(s.cashCollected) || 0;
  const newS = {
    date: s.date,
    workerId: s.workerId,
    cashCollected,
    depositToAdmin: depositAmount,
    balance: cashCollected - depositAmount,
    status: cashCollected === depositAmount ? 'Settled' : 'Pending',
    remarks: s.remarks || '',
    createdAt: new Date()
  };
  settlements.push(newS);
  return newS;
};
