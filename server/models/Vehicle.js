import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  vehicleId: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true // Honda, TVS, Bajaj, etc.
  },
  regNumber: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['Bike', 'Scooty', 'Car', 'EV'],
    required: true
  },
  fuelType: {
    type: String,
    required: true // Petrol, Diesel, CNG, EV, Petrol + CNG, Diesel + CNG
  },
  seatingCapacity: {
    type: Number,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  meterReading: {
    type: Number,
    required: true,
    default: 0 // KM reading
  },
  fuelCapacity: {
    type: Number,
    required: true,
    default: 0 // Liters or Charge %
  },
  mileage: {
    type: Number,
    required: true,
    default: 0 // KM/L or KM/Charge
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['Available', 'Active', 'Reserved', 'Booked', 'Maintenance', 'Out Of Service', 'Inactive', 'Ongoing'],
    default: 'Active'
  },
  
  // Pricing plans
  pricingPlans: {
    hourly: {
      rate: { type: Number, default: 0 },
      freeKm: { type: Number, default: 0 },
      fuelChargePerKm: { type: Number, default: 0 },
      extraKmCharge: { type: Number, default: 0 },
      withFuel: { type: Number, default: 0 },
      withoutFuel: { type: Number, default: 0 }
    },
    twelveHour: {
      baseRate: { type: Number, default: 0 },
      ratePerHour: { type: Number, default: 0 },
      kmLimit: { type: Number, default: 0 },
      fuelChargePerKm: { type: Number, default: 0 },
      extraKmCharge: { type: Number, default: 0 },
      extraHourCharge: { type: Number, default: 0 },
      gracePeriod: { type: Number, default: 0 }, // in minutes
      withFuel: { type: Number, default: 0 },
      withoutFuel: { type: Number, default: 0 }
    },
    twentyFourHour: {
      baseRate: { type: Number, default: 0 },
      ratePerHour: { type: Number, default: 0 },
      kmLimit: { type: Number, default: 0 },
      fuelChargePerKm: { type: Number, default: 0 },
      extraKmCharge: { type: Number, default: 0 },
      extraHourCharge: { type: Number, default: 0 },
      gracePeriod: { type: Number, default: 0 },
      withFuel: { type: Number, default: 0 },
      withoutFuel: { type: Number, default: 0 }
    },
    weekly: {
      baseRate: { type: Number, default: 0 },
      kmLimit: { type: Number, default: 0 },
      extraKmCharge: { type: Number, default: 0 },
      extraDayCharge: { type: Number, default: 0 },
      gracePeriod: { type: Number, default: 0 }
    },
    monthly: {
      baseRate: { type: Number, default: 0 },
      kmLimit: { type: Number, default: 0 },
      extraKmCharge: { type: Number, default: 0 },
      extraDayCharge: { type: Number, default: 0 }
    }
  },

  // Deposit and Payment Configuration
  depositSettings: {
    requireDeposit: { type: Boolean, default: true },
    amount: { type: Number, default: 0 }
  },
  paymentSettings: {
    advanceRequired: { type: Boolean, default: false },
    percentage: { type: Number, default: 50 },
    acceptedModes: [{ type: String }] // Cash, UPI, Card, Bank Transfer
  },

  // Booking settings
  bookingConfig: {
    bufferTime: { type: Number, default: 30 }, // in minutes
    status: { type: String, default: 'Active' },
    bookingEnabled: { type: Boolean, default: true },
    instantBooking: { type: Boolean, default: true }
  },

  // Location configuration
  locationDetails: {
    currentZone: { type: String, required: true }, // Vijay Nagar, Bhawarkua, Rajendra Nagar, Palasia
    currentBranch: { type: String, default: 'Main Branch' },
    parkingLocation: { type: String }, // e.g. Basement A-12
    gps: {
      lat: { type: Number },
      lng: { type: Number }
    }
  },

  // Documentation URLs
  documents: {
    rcUrl: { type: String, default: '' },
    insuranceUrl: { type: String, default: '' },
    pucUrl: { type: String, default: '' },
    fitnessUrl: { type: String, default: '' }
  },

  // Vehicle Gallery Images (Base64)
  images: {
    front: { type: String, default: '' },
    back: { type: String, default: '' },
    left: { type: String, default: '' },
    right: { type: String, default: '' },
    interior: { type: String, default: '' },
    document: { type: String, default: '' },
    other: { type: String, default: '' }
  },

  // Availability detail
  availability: {
    availableForBooking: { type: Boolean, default: true },
    reason: { type: String, default: '' } // Maintenance, Accident, Reserved, Out Of Service, Other
  },

  // Maintenance and Service Logs
  maintenanceRecords: [{
    serviceDate: { type: Date, default: Date.now },
    cost: { type: Number, default: 0 },
    nextDue: { type: Date },
    notes: { type: String }
  }],

  // Employee actions audits
  auditLogs: [{
    employee: { type: String },
    action: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  
  assignedWorker: {
    type: String,
    default: 'Unassigned'
  }
}, {
  timestamps: true
});

// Auto-increment vehicleId: VEH-00001, VEH-00002, etc.
vehicleSchema.pre('save', async function(next) {
  if (!this.vehicleId) {
    try {
      const lastVehicle = await this.constructor.findOne(
        { vehicleId: { $regex: /^VEH-\d+$/ } },
        {},
        { sort: { vehicleId: -1 } }
      );
      let nextNum = 1;
      if (lastVehicle && lastVehicle.vehicleId) {
        const parts = lastVehicle.vehicleId.split('-');
        nextNum = parseInt(parts[1], 10) + 1;
      }
      this.vehicleId = `VEH-${String(nextNum).padStart(5, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
