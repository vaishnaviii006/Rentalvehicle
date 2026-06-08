import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true
  },

  // ─── Customer ──────────────────────────────────────────────────────────────
  customer: {
    name: { type: String, required: true },
    fatherName: { type: String, default: '' },
    phone: { type: String, required: true },
    alternatePhone: { type: String, default: '' },
    email: { type: String, default: '' },
    drivingLicense: { type: String, default: '' },
    aadhaar: { type: String, default: '' },
    docAadhaarFront: { type: String, default: '' },
    docAadhaarBack: { type: String, default: '' },
    docLicense: { type: String, default: '' },
    docRegistration: { type: String, default: '' },
    address: {
      street: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' }
    }
  },

  // ─── Vehicle ───────────────────────────────────────────────────────────────
  vehicleId: { type: String, required: true }, // e.g. VEH-00001
  vehicleDetails: {
    name: { type: String },
    regNumber: { type: String },
    category: { type: String }
  },

  // ─── Rental Period ─────────────────────────────────────────────────────────
  rentalPeriod: {
    startDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    actualPickupDate: { type: Date },
    actualReturnDate: { type: Date }
  },

  // ─── Handover & Accessories ────────────────────────────────────────────────
  handover: {
    startMeter: { type: Number, default: 0 },
    fuelIncluded: { type: Boolean, default: false }
  },
  accessoriesChecklist: {
    helmetCount: { type: Number, default: 0 },
    toolkit: { type: Boolean, default: false },
    spareTyre: { type: Boolean, default: false },
    firstAid: { type: Boolean, default: false }
  },

  // ─── Plan ──────────────────────────────────────────────────────────────────
  selectedPlan: {
    planType: { type: String, required: true }, // Hourly | 12-Hour | 24-Hour | Weekly | Monthly
    rate: { type: Number, required: true },
    kmLimit: { type: Number, default: 0 },
    extraKmCharge: { type: Number, default: 0 },
    extraHourCharge: { type: Number, default: 0 }
  },

  // ─── Addons ────────────────────────────────────────────────────────────────
  addons: {
    helmetsCount: { type: Number, default: 0 },
    helmetsPrice: { type: Number, default: 50 },
    otherAccessories: { type: String, default: '' }
  },

  // ─── Active Booking Snapshot ───────────────────────────────────────────────
  // These are the PRIMARY source of truth. All screens must read from these.
  durationHours: { type: Number, default: 0 },
  durationDays: { type: Number, default: 0 },
  expectedReturnDate: { type: Date },   // = rentalPeriod.expectedEndDate
  actualPickupDate: { type: Date },     // = rentalPeriod.actualPickupDate
  actualReturnDate: { type: Date },     // = rentalPeriod.actualReturnDate

  rentalCost: { type: Number, default: 0 },       // cumulative base fare (incl. extensions)
  securityDeposit: { type: Number, default: 0 },  // original deposit required
  depositHeld: { type: Number, default: 0 },       // actual deposit collected so far
  rentalPaid: { type: Number, default: 0 },        // total rental paid so far
  outstandingRent: { type: Number, default: 0 },   // remaining rental due
  collectAmount: { type: Number, default: 0 },     // final collection needed at settlement
  refundAmount: { type: Number, default: 0 },      // refund due at settlement

  discount: { type: Number, default: 0 },
  baseFare: { type: Number, default: 0 },          // same as rentalCost (kept for compatibility during migration)

  // ─── Payment ───────────────────────────────────────────────────────────────
  paymentMode: { type: String, default: 'Cash' },
  paymentCollection: [{
    mode: { type: String, enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Mixed', 'UPI Refund', 'Cash Refund', 'Mixed Refund'] },
    amount: { type: Number, default: 0 },
    cashAmount: { type: Number, default: 0 },
    onlineAmount: { type: Number, default: 0 },
    cardAmount: { type: Number, default: 0 },
    workerId: { type: String, default: 'System' },
    transactionId: { type: String, default: '' },
    reference: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  }],

  depositDetails: {
    mode: { type: String, enum: ['Cash', 'Online', 'Mixed'], default: 'Cash' },
    cashAmount: { type: Number, default: 0 },
    onlineAmount: { type: Number, default: 0 }
  },

  // ─── Payment split totals (derived from paymentCollection) ─────────────────
  cashAmount: { type: Number, default: 0 },
  onlineAmount: { type: Number, default: 0 },
  cardAmount: { type: Number, default: 0 },

  // ─── Drop-Off ──────────────────────────────────────────────────────────────
  dropDetails: {
    actualTime: { type: Date },
    endMeter: { type: Number, default: 0 },
    endFuelLevel: { type: String, enum: ['Empty', '25%', '50%', '75%', 'Full', ''], default: '' },
    vehicleCondition: { type: String, enum: ['Excellent', 'Good', 'Minor Damage', 'Major Damage', 'Accident', ''], default: '' },
    damageNotes: { type: String, default: '' },
    damageCharges: { type: Number, default: 0 },
    cleaningCharges: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    photos: [{ type: String }],
    operator: { type: String }
  },

  refundDetails: {
    amount: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Processed', 'Completed', ''], default: '' },
    method: { type: String, default: '' },
    notes: { type: String, default: '' }
  },

  // ─── Settlement sub-document (audit record of final settlement) ─────────────
  settlement: {
    actualBill: { type: Number, default: 0 },
    totalBill: { type: Number, default: 0 },         // alias for actualBill (kept for compatibility)
    previousPaid: { type: Number, default: 0 },      // = rentalPaid at settlement time
    depositCollected: { type: Number, default: 0 },  // = depositHeld at settlement time
    depositHeld: { type: Number, default: 0 },
    depositAdjustment: { type: Number, default: 0 },
    depositRefund: { type: Number, default: 0 },
    depositRefundMode: { type: String, enum: ['Full', 'Partial', 'No Refund', ''], default: '' },
    depositRefundReason: { type: String, default: '' },
    remainingToPay: { type: Number, default: 0 },    // = outstandingRent at settlement time
    collectAmount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 }
  },

  // ─── Booking Status ────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['Reserved', 'Ongoing', 'Extended', 'Overdue', 'Completed', 'Cancelled'],
    default: 'Reserved'
  },

  workerId: { type: String, default: 'System' },

  // ─── History ───────────────────────────────────────────────────────────────
  extensions: [{
    newEndDateTime: Date,
    extraCharges: Number,
    remarks: String,
    timestamp: { type: Date, default: Date.now }
  }],

  replacements: [{
    oldVehicleId: String,
    oldVehicleReg: String,
    oldVehicleClosingMeter: Number,
    newVehicleId: String,
    newVehicleReg: String,
    newVehicleStartingMeter: Number,
    reason: String,
    timestamp: { type: Date, default: Date.now },
    operatorName: String
  }],

  // ─── Revision History (AUDIT ONLY — never used to drive calculations) ───────
  revisions: [{
    revisionNumber: { type: Number, required: true },
    actionType: { type: String },
    description: { type: String, required: true },
    operator: { type: String, default: 'System' },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, default: '' },

    oldValues: {
      rentalCost: Number,
      deposit: Number,
      rentalPaid: Number,
      depositCollected: Number,
      outstandingRent: Number
    },
    newValues: {
      rentalCost: Number,
      deposit: Number,
      rentalPaid: Number,
      depositCollected: Number,
      outstandingRent: Number
    },

    financialSnapshotAfterChange: {
      rentalCost: Number,
      depositHeld: Number,
      rentalPaid: Number,
      depositCollected: Number,
      outstandingRent: Number,
      paymentBreakdown: {
        rentalCash: { type: Number, default: 0 },
        rentalOnline: { type: Number, default: 0 },
        rentalCard: { type: Number, default: 0 },
        depositCash: { type: Number, default: 0 },
        depositOnline: { type: Number, default: 0 },
        depositCard: { type: Number, default: 0 }
      }
    },

    fieldChanges: [{
      fieldName: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }],

    collectionDetails: {
      amount: Number,
      mode: String,
      cashSplit: Number,
      onlineSplit: Number,
      cardSplit: Number,
      remarks: String
    },
    depositDetails: {
      oldDeposit: Number,
      newDeposit: Number,
      difference: Number,
      mode: String,
      cashAmount: Number,
      onlineAmount: Number
    },
    vehicleDetails: {
      oldVehicleId: String,
      oldVehicleName: String,
      oldVehicleReg: String,
      newVehicleId: String,
      newVehicleName: String,
      newVehicleReg: String,
      oldPricing: Number,
      newPricing: Number,
      oldDeposit: Number,
      newDeposit: Number,
      additionalCollection: Number,
      refundDifference: Number
    },
    meterDetails: {
      oldVehicleClosingMeter: Number,
      newVehicleStartingMeter: Number
    },
    durationDetails: {
      oldDuration: Number,
      newDuration: Number,
      difference: Number
    }
  }]
}, {
  timestamps: true
});

// ─── Auto-generate bookingId ──────────────────────────────────────────────────
bookingSchema.pre('save', async function (next) {
  if (!this.bookingId) {
    try {
      const lastBooking = await this.constructor.findOne(
        { bookingId: { $regex: /^VB-\d+$/ } },
        {},
        { sort: { createdAt: -1 } }
      );
      let nextNum = 10001;
      if (lastBooking?.bookingId) {
        const parts = lastBooking.bookingId.split('-');
        nextNum = parseInt(parts[1], 10) + 1;
      }
      this.bookingId = `VB-${nextNum}`;
    } catch (err) {
      return next(err);
    }
  }

  // ─── Keep snapshot fields in sync with rentalPeriod ────────────────────────
  if (this.rentalPeriod) {
    if (!this.expectedReturnDate && this.rentalPeriod.expectedEndDate) {
      this.expectedReturnDate = this.rentalPeriod.expectedEndDate;
    }
    if (!this.actualPickupDate && this.rentalPeriod.actualPickupDate) {
      this.actualPickupDate = this.rentalPeriod.actualPickupDate;
    }
    if (!this.actualReturnDate && this.rentalPeriod.actualReturnDate) {
      this.actualReturnDate = this.rentalPeriod.actualReturnDate;
    }
  }

  // ─── Keep rentalCost in sync with baseFare ─────────────────────────────────
  if (this.baseFare > 0 && this.rentalCost === 0) {
    this.rentalCost = this.baseFare;
  }
  if (this.rentalCost > 0) {
    this.baseFare = this.rentalCost;
  }

  // ─── Calculate payment mode splits from paymentCollection ─────────────────
  let cash = 0;
  let online = 0;
  let card = 0;
  if (this.paymentCollection?.length > 0) {
    this.paymentCollection.forEach(p => {
      if (p.mode === 'Cash') {
        cash += p.cashAmount || p.amount || 0;
      } else if (p.mode === 'Card') {
        card += p.cardAmount || p.amount || 0;
      } else if (p.mode === 'Mixed') {
        cash += p.cashAmount || 0;
        online += p.onlineAmount || 0;
        card += p.cardAmount || 0;
      } else if (['UPI', 'Online', 'Bank Transfer'].includes(p.mode)) {
        online += p.onlineAmount || p.amount || 0;
      }
    });
  }
  this.cashAmount = Math.round(cash);
  this.onlineAmount = Math.round(online);
  this.cardAmount = Math.round(card);

  next();
});

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
