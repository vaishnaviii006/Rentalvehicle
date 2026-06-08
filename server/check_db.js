import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './models/Booking.js';

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/twenty');
    console.log('Connected to DB');
    const bookings = await Booking.find({});
    console.log('Bookings in DB:', bookings.length);
    bookings.forEach(b => {
      console.log(`Booking ID: ${b.bookingId}, Status: ${b.status}, Customer: ${b.customerName}, Vehicle: ${b.vehicleDetails?.name}`);
    });
  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
}
run();
