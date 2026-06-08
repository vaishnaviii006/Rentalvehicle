import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true
  },
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
  
  vehicleId: {
    type: String, // references Vehicle.vehicleId (e.g. VEH-00001)
    required: true
  },
  vehicleDetails: {
    name: { type: String },
    regNumber: { type: String },
    category: { type: String }
  },

  rentalPeriod: {
    startDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    actualPickupDate: { type: Date },
    actualReturnDate: { type: Date }
  },

  handover: {
    startMeter: { type: Number, default: 0 },
    fuelIncluded: { type: Boolean, default: false }
  },

  selectedPlan: {
    planType: { type: String, required: true }, // Hourly, 12-Hour, 24-Hour, Weekly, Monthly
    rate: { type: Number, required: true },
    kmLimit: { type: Number, default: 0 },
    extraKmCharge: { type: Number, default: 0 },
    extraHourCharge: { type: Number, default: 0 }
  },

  addons: {
    helmetsCount: { type: Number, default: 0 },
    helmetsPrice: { type: Number, default: 50 }, // Per helmet price
    otherAccessories: { type: String, default: '' }
  },

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

  accessoriesChecklist: {
    helmetCount: { type: Number, default: 0 },
    toolkit: { type: Boolean, default: false },
    spareTyre: { type: Boolean, default: false },
    firstAid: { type: Boolean, default: false }
  },

  dropDetails: {
    actualTime: { type: Date },
    endMeter: { type: Number, default: 0 },
    endFuelLevel: { type: String, enum: ['Empty', '25%', '50%', '75%', 'Full', ''] },
    vehicleCondition: { type: String, enum: ['Excellent', 'Good', 'Minor Damage', 'Major Damage', 'Accident', ''] },
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

  settlement: {
    totalBill: { type: Number, default: 0 },
    actualBill: { type: Number, default: 0 },
    previousPaid: { type: Number, default: 0 },
    depositCollected: { type: Number, default: 0 },
    depositRefund: { type: Number, default: 0 },
    depositRefundMode: { type: String, enum: ['Full', 'Partial', 'No Refund', ''], default: '' },
    depositRefundReason: { type: String, default: '' },
    remainingToPay: { type: Number, default: 0 }
  },

  depositDetails: {
    mode: { type: String, enum: ['Cash', 'Online', 'Mixed'], default: 'Cash' },
    cashAmount: { type: Number, default: 0 },
    onlineAmount: { type: Number, default: 0 }
  },

  status: {
    type: String,
    enum: ['Ongoing', 'Extended', 'Overdue', 'Completed', 'Cancelled', 'Reserved'],
    default: 'Reserved'
  },
  
  workerId: {
    type: String,
    default: 'System'
  },
  
  rentalPaid: { type: Number, default: 0 },
  depositHeld: { type: Number, default: 0 },
  outstandingRent: { type: Number, default: 0 },
  cashAmount: { type: Number, default: 0 },
  onlineAmount: { type: Number, default: 0 },
  cardAmount: { type: Number, default: 0 },
  paymentMode: { type: String, default: 'Cash' },
  
  // Active Booking Snapshot fields
  expectedReturnDate: { type: Date },
  actualReturnDate: { type: Date },
  actualPickupDate: { type: Date },
  rentalCost: { type: Number, default: 0 },
  collectAmount: { type: Number, default: 0 },
  refundAmount: { type: Number, default: 0 },
  
  // Keep fields compatible with earlier routers if needed
  customerName: { type: String },
  customerPhone: { type: String },
  customerIdProof: { type: String },
  pickupDate: { type: Date },
  expectedDropDate: { type: Date },
  pickupLocation: { type: String },
  dropLocation: { type: String },
  perDayRate: { type: Number },
  perHourRate: { type: Number },
  discount: { type: Number, default: 0 },
  advancePaid: { type: Number, default: 0 },
  securityDeposit: { type: Number, default: 0 },
  durationHours: { type: Number, default: 0 },
  durationDays: { type: Number, default: 0 },
  baseFare: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'Cash' },
  settled: { type: Boolean, default: false },

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
  revisions: [{
    revisionNumber: { type: Number, required: true },
    actionType: { type: String },
    description: { type: String, required: true },
    operator: { type: String, default: 'System' },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String, default: '' },
    
    // Financial differences (Old vs. New)
    oldValues: {
      rentalCost: Number,
      deposit: Number,
      bookingValue: Number,
      rentalPaid: Number,
      depositCollected: Number,
      outstandingRent: Number,
      pendingDeposit: Number
    },
    newValues: {
      rentalCost: Number,
      deposit: Number,
      bookingValue: Number,
      rentalPaid: Number,
      depositCollected: Number,
      outstandingRent: Number,
      pendingDeposit: Number
    },
    difference: {
      rentalCost: Number,
      deposit: Number,
      bookingValue: Number,
      rentalPaid: Number,
      depositCollected: Number
    },
    
    // Balance snapshot immediately after this revision
    financialSnapshotAfterChange: {
      rentalCost: Number,
      depositHeld: Number,
      bookingValue: Number,
      rentalPaid: Number,
      depositCollected: Number,
      outstandingRent: Number,
      pendingDeposit: Number,
      paymentBreakdown: {
        rentalCash: { type: Number, default: 0 },
        rentalOnline: { type: Number, default: 0 },
        rentalCard: { type: Number, default: 0 },
        depositCash: { type: Number, default: 0 },
        depositOnline: { type: Number, default: 0 },
        depositCard: { type: Number, default: 0 }
      }
    },

    // Field-level change audit trail
    fieldChanges: [{
      fieldName: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }],

    // Action-specific structural metadata
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

// Sync compatibility helpers on save
bookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    try {
      const lastBooking = await this.constructor.findOne(
        { bookingId: { $regex: /^VB-\d+$/ } },
        {},
        { sort: { bookingId: -1 } }
      );
      let nextNum = 10001;
      if (lastBooking && lastBooking.bookingId) {
        const parts = lastBooking.bookingId.split('-');
        nextNum = parseInt(parts[1], 10) + 1;
      }
      this.bookingId = `VB-${nextNum}`;
    } catch (err) {
      return next(err);
    }
  }

  // Map sub-object variables to top-level fields for compatibility with older code blocks
  if (this.customer) {
    this.customerName = this.customer.name;
    this.customerPhone = this.customer.phone;
    this.customerIdProof = `DL: ${this.customer.alternatePhone || 'N/A'}`;
  }
  if (this.rentalPeriod) {
    this.pickupDate = this.rentalPeriod.startDate;
    this.expectedDropDate = this.rentalPeriod.expectedEndDate;
    this.expectedReturnDate = this.rentalPeriod.expectedEndDate;
    this.actualReturnDate = this.rentalPeriod.actualReturnDate;
    this.actualPickupDate = this.rentalPeriod.actualPickupDate;
  }
  if (this.selectedPlan) {
    this.perDayRate = this.selectedPlan.planType.includes('Day') || this.selectedPlan.planType.includes('24') ? this.selectedPlan.rate : 0;
    this.perHourRate = this.selectedPlan.planType.includes('Hour') ? this.selectedPlan.rate : 0;
  }
  
  this.rentalCost = this.baseFare || 0;

  if (this.settlement) {
    this.securityDeposit = this.settlement.depositCollected;
    this.advancePaid = this.settlement.previousPaid;
    this.finalAmount = this.settlement.remainingToPay;
    this.collectAmount = this.settlement.collectAmount || 0;
    this.refundAmount = this.settlement.refundAmount || 0;
  }

  // Force active snapshot fields to stay in sync
  this.rentalPaid = this.advancePaid || 0;
  this.depositHeld = this.securityDeposit || 0;
  this.outstandingRent = this.finalAmount || 0;

  // Enforce discount lock rule: discount cannot exceed baseFare
  if (this.discount > (this.baseFare || 0)) {
    this.discount = this.baseFare || 0;
  }

  // Calculate splits from paymentCollection
  let cash = 0;
  let online = 0;
  let card = 0;
  if (this.paymentCollection && this.paymentCollection.length > 0) {
    this.paymentCollection.forEach(p => {
      const amt = p.amount || 0;
      if (p.mode === 'Cash') {
        cash += amt;
      } else if (p.mode === 'Card') {
        card += amt;
      } else if (p.mode === 'Mixed') {
        if (p.cashAmount || p.onlineAmount || p.cardAmount) {
          cash += p.cashAmount || 0;
          online += p.onlineAmount || 0;
          card += p.cardAmount || 0;
        } else {
          // parse mixed ref
          const ref = p.reference || '';
          const cashM = ref.match(/Cash:\s*([\d.]+)/i);
          const onlineM = ref.match(/Online:\s*([\d.]+)/i);
          const cardM = ref.match(/Card:\s*([\d.]+)/i);
          if (cashM) cash += parseFloat(cashM[1]) || 0;
          if (onlineM) online += parseFloat(onlineM[1]) || 0;
          if (cardM) card += parseFloat(cardM[1]) || 0;
        }
      } else if (['UPI', 'Online', 'Bank Transfer'].includes(p.mode)) {
        online += amt;
      }
    });
  }
  this.cashAmount = cash;
  this.onlineAmount = online;
  this.cardAmount = card;

  next();
});

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
