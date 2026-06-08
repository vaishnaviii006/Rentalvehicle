import fs from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Vehicle from './models/Vehicle.js';
import Booking from './models/Booking.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in server/.env');
  process.exit(1);
}

async function runMigration() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully.');

    const filePath = '../all_bookings.json';
    if (!fs.existsSync(filePath)) {
      console.error(`Backup file not found at: ${filePath}`);
      process.exit(1);
    }

    const buffer = fs.readFileSync(filePath);
    let rawText;
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      rawText = buffer.toString('utf16le');
    } else if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      rawText = buffer.toString('utf8').substring(1);
    } else {
      rawText = buffer.toString('utf8');
    }

    if (rawText.charCodeAt(0) === 0xFEFF || rawText.charCodeAt(0) === 0xFFFE) {
      rawText = rawText.substring(1);
    }

    let data = JSON.parse(rawText);
    const bookingsArray = Array.isArray(data) ? data : (data.value || data.bookings || []);
    console.log(`Found ${bookingsArray.length} bookings in backup file.`);

    // Fetch existing vehicles to build a map
    const existingVehicles = await Vehicle.find({});
    console.log(`Found ${existingVehicles.length} existing vehicles in database.`);

    // Helper to get next vehicle ID
    const getNextVehicleId = async () => {
      const lastVehicle = await Vehicle.findOne(
        { vehicleId: { $regex: /^VEH-\d+$/ } },
        {},
        { sort: { vehicleId: -1 } }
      );
      let nextNum = 1;
      if (lastVehicle && lastVehicle.vehicleId) {
        const parts = lastVehicle.vehicleId.split('-');
        nextNum = parseInt(parts[1], 10) + 1;
      }
      return `VEH-${String(nextNum).padStart(5, '0')}`;
    };

    for (const bData of bookingsArray) {
      const regNo = bData.vehicleDetails?.regNumber;
      if (!regNo) {
        console.warn(`Skipping booking ${bData.bookingId} due to missing vehicle registration number.`);
        continue;
      }

      // Check if vehicle exists by regNumber
      let vehicle = await Vehicle.findOne({ regNumber: regNo });
      if (!vehicle) {
        console.log(`Vehicle with Reg Number "${regNo}" not found. Creating it...`);
        const nextId = await getNextVehicleId();
        
        // Base vehicle structure
        const newVehicleData = {
          vehicleId: nextId,
          name: bData.vehicleDetails.name || 'Unknown Vehicle',
          brand: bData.vehicleDetails.name?.split(' ')[0] || 'Unknown',
          regNumber: regNo,
          category: bData.vehicleDetails.category || 'Car',
          fuelType: bData.vehicleDetails.category === 'Scooty' ? 'Petrol' : 'Diesel',
          seatingCapacity: bData.vehicleDetails.category === 'Scooty' ? 2 : 4,
          color: 'Standard',
          meterReading: bData.handover?.startMeter || 0,
          fuelCapacity: bData.vehicleDetails.category === 'Scooty' ? 5 : 45,
          mileage: bData.vehicleDetails.category === 'Scooty' ? 40 : 15,
          status: bData.status === 'Ongoing' ? 'Ongoing' : 'Available',
          locationDetails: { currentZone: bData.pickupLocation || 'Vijay Nagar' },
          pricingPlans: {
            hourly: { rate: 100, freeKm: 5, fuelChargePerKm: 3, extraKmCharge: 8 },
            twentyFourHour: { baseRate: bData.selectedPlan?.rate || 1000, kmLimit: bData.selectedPlan?.kmLimit || 200, extraKmCharge: bData.selectedPlan?.extraKmCharge || 10 }
          }
        };

        vehicle = new Vehicle(newVehicleData);
        await vehicle.save();
        console.log(`Created new vehicle: ${vehicle.name} (${vehicle.vehicleId})`);
      }

      // Ensure booking vehicleId matches database vehicleId
      bData.vehicleId = vehicle.vehicleId;

      // Check if booking already exists
      const existingBooking = await Booking.findOne({ bookingId: bData.bookingId });
      if (existingBooking) {
        console.log(`Booking ${bData.bookingId} already exists in database. Skipping.`);
      } else {
        const newBooking = new Booking(bData);
        await newBooking.save();
        console.log(`Imported booking ${bData.bookingId} (${bData.customerName || bData.customer?.name})`);
      }
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

runMigration();
