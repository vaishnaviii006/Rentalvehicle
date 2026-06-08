import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './models/Booking.js';
import Settlement from './models/Settlement.js';
import Vehicle from './models/Vehicle.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in server/.env');
  process.exit(1);
}

async function clearBookings() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.');

    console.log('Deleting all bookings...');
    const bookingResult = await Booking.deleteMany({});
    console.log(`Deleted ${bookingResult.deletedCount} bookings.`);

    console.log('Deleting all settlements...');
    const settlementResult = await Settlement.deleteMany({});
    console.log(`Deleted ${settlementResult.deletedCount} settlements.`);

    console.log('Resetting all vehicle statuses to "Available"...');
    const vehicleResult = await Vehicle.updateMany({}, { status: 'Available' });
    console.log(`Reset status for ${vehicleResult.modifiedCount} vehicles.`);

    console.log('All bookings and settlements cleared successfully!');
  } catch (error) {
    console.error('Failed to clear database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

clearBookings();
