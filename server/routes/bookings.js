import express from 'express';
import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import { 
  isDbConnected, 
  getBookings, 
  addBooking, 
  updateBooking, 
  getVehicles, 
  updateVehicle 
} from '../memoryDb.js';

const router = express.Router();

// GET all bookings
router.get('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      const bookings = await Booking.find().sort({ createdAt: -1 });
      res.json(bookings);
    } else {
      res.json(getBookings().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single booking
router.get('/:bookingId', async (req, res) => {
  try {
    if (isDbConnected()) {
      const booking = await Booking.findOne({ bookingId: req.params.bookingId });
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      res.json(booking);
    } else {
      const booking = getBookings().find(b => b.bookingId === req.params.bookingId);
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      res.json(booking);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create booking
router.post('/', async (req, res) => {
  try {
    const { vehicleId } = req.body;
    let vehicle;
    if (isDbConnected()) {
      vehicle = await Vehicle.findOne({ vehicleId });
    } else {
      vehicle = getVehicles().find(v => v.vehicleId === vehicleId);
    }

    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // Validate availability
    if (vehicle.status !== 'Available' && vehicle.status !== 'Active') {
      // Allow booking if it's Available or Active
      if (vehicle.status !== 'Available') {
        return res.status(400).json({ message: `Vehicle is not available (Status: ${vehicle.status})` });
      }
    }

    // Save payload directly
    const payload = { ...req.body };
    payload.vehicleDetails = {
      name: vehicle.name,
      regNumber: vehicle.regNumber,
      category: vehicle.category
    };

    // Initialize active snapshot fields
    payload.rentalPaid = payload.advancePaid || 0;
    payload.depositHeld = payload.securityDeposit || 0;
    const baseFare = payload.baseFare || 0;
    const helmetsCount = payload.addons?.helmetsCount || 0;
    const helmetsPrice = payload.addons?.helmetsPrice || 50;
    const discount = payload.discount || 0;
    const advancePaid = payload.advancePaid || 0;
    payload.outstandingRent = Math.max(0, baseFare + (helmetsCount * helmetsPrice) - discount - advancePaid);
    payload.paymentMode = payload.paymentMethod || 'Cash';

    // Snapshot fields
    payload.rentalCost = baseFare;
    payload.collectAmount = 0;
    payload.refundAmount = 0;
    if (payload.rentalPeriod) {
      payload.expectedReturnDate = payload.rentalPeriod.expectedEndDate;
    }

    // Map initial paymentCollection splits and worker attribution
    if (payload.paymentCollection) {
      payload.paymentCollection = payload.paymentCollection.map(p => {
        const pObj = { ...p };
        pObj.workerId = payload.workerId || 'System';
        if (pObj.cashAmount === undefined) {
          pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
        }
        if (pObj.onlineAmount === undefined) {
          pObj.onlineAmount = ['UPI', 'Online', 'Bank Transfer'].includes(pObj.mode) ? pObj.amount : 0;
        }
        if (pObj.cardAmount === undefined) {
          pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
        }
        return pObj;
      });
    }

    const isFuture = new Date(payload.rentalPeriod?.startDate) > new Date();
    if (isDbConnected()) {
      if (isFuture) {
        payload.status = 'Reserved';
      } else {
        payload.status = 'Ongoing';
        payload.actualPickupDate = new Date(payload.rentalPeriod?.startDate || new Date());
        payload.rentalPeriod.actualPickupDate = new Date(payload.rentalPeriod?.startDate || new Date());
      }
      const booking = new Booking(payload);
      const newBooking = await booking.save();
      
      if (isFuture) {
        vehicle.status = 'Reserved';
      } else {
        vehicle.status = 'Ongoing';
        vehicle.meterReading = payload.handover?.startMeter || vehicle.meterReading;
      }
      await vehicle.save();
      
      res.status(201).json(newBooking);
    } else {
      if (isFuture) {
        payload.status = 'Reserved';
        const newBooking = addBooking(payload);
        updateVehicle(vehicleId, { status: 'Reserved' });
        res.status(201).json(newBooking);
      } else {
        payload.status = 'Ongoing';
        payload.actualPickupDate = new Date(payload.rentalPeriod?.startDate || new Date());
        payload.rentalPeriod.actualPickupDate = new Date(payload.rentalPeriod?.startDate || new Date());
        const newBooking = addBooking(payload);
        updateVehicle(vehicleId, { 
          status: 'Ongoing',
          meterReading: payload.handover?.startMeter || 0
        });
        res.status(201).json(newBooking);
      }
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST Handle Pickup
router.post('/:bookingId/pickup', async (req, res) => {
  try {
    const { handover, accessoriesChecklist, workerId, paymentCollection } = req.body;
    
    let booking;
    if (isDbConnected()) {
      booking = await Booking.findOne({ bookingId: req.params.bookingId });
    } else {
      booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const pickupUpdates = {
      status: 'Ongoing',
      'rentalPeriod.actualPickupDate': new Date(),
      actualPickupDate: new Date(),
      handover: {
        startMeter: handover?.startMeter || booking.handover?.startMeter || 0,
        fuelIncluded: handover?.fuelIncluded || false
      },
      accessoriesChecklist: accessoriesChecklist || { helmetCount: 0, toolkit: false, spareTyre: false, firstAid: false },
      workerId: workerId || booking.workerId
    };

    // If an initial payment was received during pickup
    let finalPayments = [...(booking.paymentCollection || [])];
    if (paymentCollection && paymentCollection.amount > 0) {
      const pObj = { ...paymentCollection };
      pObj.workerId = workerId || pObj.workerId || booking.workerId || 'System';
      if (pObj.cashAmount === undefined) {
        pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
      }
      if (pObj.onlineAmount === undefined) {
        pObj.onlineAmount = ['UPI', 'Online', 'Bank Transfer'].includes(pObj.mode) ? pObj.amount : 0;
      }
      if (pObj.cardAmount === undefined) {
        pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
      }
      finalPayments.push(pObj);

      pickupUpdates.paymentCollection = finalPayments;
      // Update settlement previous paid
      const prevPaid = (booking.settlement?.previousPaid || 0) + paymentCollection.amount;
      const totalBill = booking.settlement?.totalBill || 0;
      pickupUpdates.settlement = {
        ...booking.settlement,
        previousPaid: prevPaid,
        remainingToPay: totalBill - prevPaid
      };
    }

    // Synchronize active snapshot fields
    const addedPayment = (paymentCollection && paymentCollection.amount > 0) ? paymentCollection.amount : 0;
    pickupUpdates.rentalPaid = (booking.rentalPaid || booking.advancePaid || 0) + addedPayment;
    pickupUpdates.depositHeld = booking.depositHeld || booking.securityDeposit || 0;
    const baseFare = booking.baseFare || 0;
    const helmetsCount = booking.addons?.helmetsCount || 0;
    const helmetsPrice = booking.addons?.helmetsPrice || 50;
    const discount = booking.discount || 0;
    pickupUpdates.outstandingRent = Math.max(0, baseFare + (helmetsCount * helmetsPrice) - discount - pickupUpdates.rentalPaid);
    if (paymentCollection && paymentCollection.mode) {
      pickupUpdates.paymentMode = paymentCollection.mode;
    }

    pickupUpdates.rentalCost = baseFare;
    if (booking.rentalPeriod) {
      pickupUpdates.expectedReturnDate = booking.rentalPeriod.expectedEndDate;
    }

    if (isDbConnected()) {
      Object.assign(booking, pickupUpdates);
      if (pickupUpdates.handover !== undefined) booking.markModified('handover');
      if (pickupUpdates.accessoriesChecklist !== undefined) booking.markModified('accessoriesChecklist');
      if (pickupUpdates.settlement !== undefined) booking.markModified('settlement');
      await booking.save();

      // Update vehicle status
      const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
      if (vehicle) {
        vehicle.status = 'Ongoing'; // Sync with specification: "Booked" or "Ongoing"
        vehicle.meterReading = handover?.startMeter || vehicle.meterReading;
        await vehicle.save();
      }
      res.json(booking);
    } else {
      const updatedBooking = updateBooking(req.params.bookingId, pickupUpdates);
      updateVehicle(booking.vehicleId, { 
        status: 'Ongoing', 
        meterReading: handover?.startMeter || 0 
      });
      res.json(updatedBooking);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST Extend Booking
router.post('/:bookingId/extend', async (req, res) => {
  const { newEndDateTime, extraCharges, remarks, workerId, paymentCollection } = req.body;

  try {
    let booking;
    if (isDbConnected()) {
      booking = await Booking.findOne({ bookingId: req.params.bookingId });
    } else {
      booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const extensionItem = {
      newEndDateTime,
      extraCharges: Number(extraCharges) || 0,
      remarks: remarks || '',
      timestamp: new Date()
    };

    const exts = [...(booking.extensions || []), extensionItem];
    const newExpectedEndDate = new Date(newEndDateTime);

    // Sync variables from body or compute fallbacks
    const newAdvancePaid = req.body.advancePaid !== undefined ? Number(req.body.advancePaid) : booking.advancePaid;
    const newSecurityDeposit = req.body.securityDeposit !== undefined ? Number(req.body.securityDeposit) : booking.securityDeposit;
    const newBaseFare = req.body.baseFare !== undefined ? Number(req.body.baseFare) : (booking.baseFare + (Number(extraCharges) || 0));

    const totalBill = newBaseFare + ((booking.addons?.helmetsCount || 0) * 50);

    const settlementUpdates = {
      ...booking.settlement,
      totalBill: totalBill,
      actualBill: totalBill,
      previousPaid: newAdvancePaid,
      depositCollected: newSecurityDeposit,
      remainingToPay: Math.max(0, totalBill - newAdvancePaid)
    };

    const payments = [...(booking.paymentCollection || [])];
    if (paymentCollection && paymentCollection.amount > 0) {
      const alreadyPushed = payments.some(p => p.transactionId === paymentCollection.transactionId);
      if (!alreadyPushed) {
        const pObj = { ...paymentCollection };
        pObj.workerId = workerId || pObj.workerId || booking.workerId || 'System';
        if (pObj.cashAmount === undefined) {
          pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
        }
        if (pObj.onlineAmount === undefined) {
          pObj.onlineAmount = ['UPI', 'Online', 'Bank Transfer'].includes(pObj.mode) ? pObj.amount : 0;
        }
        if (pObj.cardAmount === undefined) {
          pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
        }
        payments.push(pObj);
      }
    }

    const updates = {
      extensions: exts,
      'rentalPeriod.expectedEndDate': newExpectedEndDate,
      expectedDropDate: newExpectedEndDate,
      expectedReturnDate: newExpectedEndDate,
      baseFare: newBaseFare,
      rentalCost: newBaseFare,
      securityDeposit: newSecurityDeposit,
      advancePaid: newAdvancePaid,
      rentalPaid: newAdvancePaid,
      depositHeld: newSecurityDeposit,
      outstandingRent: Math.max(0, totalBill - newAdvancePaid),
      finalAmount: Math.max(0, totalBill - newAdvancePaid),
      settlement: settlementUpdates,
      paymentCollection: payments,
      status: 'Extended',
      workerId: workerId || booking.workerId,
      ...(paymentCollection?.mode && { paymentMode: paymentCollection.mode }),
      ...(req.body.depositDetails !== undefined && { depositDetails: req.body.depositDetails }),
      ...(req.body.revisions !== undefined && { revisions: req.body.revisions }),
      ...(req.body.durationHours !== undefined && { durationHours: Number(req.body.durationHours) }),
      ...(req.body.durationDays !== undefined && { durationDays: Number(req.body.durationDays) }),
      ...(req.body.selectedPlan !== undefined && { selectedPlan: req.body.selectedPlan })
    };

    if (isDbConnected()) {
      Object.assign(booking, updates);
      if (req.body.selectedPlan !== undefined) booking.markModified('selectedPlan');
      if (req.body.depositDetails !== undefined) booking.markModified('depositDetails');
      if (req.body.revisions !== undefined) booking.markModified('revisions');
      await booking.save();
      res.json(booking);
    } else {
      const updatedBooking = updateBooking(req.params.bookingId, updates);
      res.json(updatedBooking);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST Replace Vehicle
router.post('/:bookingId/replace', async (req, res) => {
  const { newVehicleId, reason, workerId } = req.body;

  try {
    let booking;
    if (isDbConnected()) {
      booking = await Booking.findOne({ bookingId: req.params.bookingId });
    } else {
      booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const oldVehicleId = booking.vehicleId;
    if (oldVehicleId === newVehicleId) {
      return res.status(400).json({ message: 'New vehicle must be different' });
    }

    let newVehicle;
    if (isDbConnected()) {
      newVehicle = await Vehicle.findOne({ vehicleId: newVehicleId });
    } else {
      newVehicle = getVehicles().find(v => v.vehicleId === newVehicleId);
    }

    if (!newVehicle) return res.status(404).json({ message: 'New vehicle not found' });
    if (newVehicle.status !== 'Available' && newVehicle.status !== 'Active') {
      return res.status(400).json({ message: `Replacement vehicle is not Available (Status: ${newVehicle.status})` });
    }

    const oldVehicleReg = booking.vehicleDetails?.regNumber || '';
    const oldVehicleClosingMeter = Number(req.body.oldVehicleClosingMeter) || 0;
    const newVehicleReg = newVehicle.regNumber || '';
    const newVehicleStartingMeter = Number(req.body.newVehicleStartingMeter) || newVehicle.meterReading || 0;

    const replacementItem = {
      oldVehicleId,
      oldVehicleReg,
      oldVehicleClosingMeter,
      newVehicleId,
      newVehicleReg,
      newVehicleStartingMeter,
      reason: reason || 'Routine Swap',
      timestamp: new Date(),
      operatorName: workerId || 'System'
    };

    const swaps = [...(booking.replacements || []), replacementItem];

    let finalPayments = req.body.paymentCollection ? [...req.body.paymentCollection] : [...(booking.paymentCollection || [])];
    finalPayments = finalPayments.map(p => {
      const pObj = { ...p };
      pObj.workerId = workerId || pObj.workerId || booking.workerId || 'System';
      if (pObj.cashAmount === undefined) {
        pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
      }
      if (pObj.onlineAmount === undefined) {
        pObj.onlineAmount = ['UPI', 'Online', 'Bank Transfer'].includes(pObj.mode) ? pObj.amount : 0;
      }
      if (pObj.cardAmount === undefined) {
        pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
      }
      return pObj;
    });

    const updates = {
      replacements: swaps,
      vehicleId: newVehicleId,
      vehicleDetails: {
        name: newVehicle.name,
        regNumber: newVehicle.regNumber,
        category: newVehicle.category
      },
      workerId: workerId || booking.workerId,
      rentalCost: req.body.baseFare !== undefined ? Number(req.body.baseFare) : booking.baseFare,
      baseFare: req.body.baseFare !== undefined ? Number(req.body.baseFare) : booking.baseFare,
      securityDeposit: req.body.securityDeposit !== undefined ? Number(req.body.securityDeposit) : booking.securityDeposit,
      depositHeld: req.body.securityDeposit !== undefined ? Number(req.body.securityDeposit) : booking.securityDeposit,
      advancePaid: req.body.advancePaid !== undefined ? Number(req.body.advancePaid) : booking.advancePaid,
      rentalPaid: req.body.advancePaid !== undefined ? Number(req.body.advancePaid) : booking.advancePaid,
      paymentCollection: finalPayments,
      depositDetails: req.body.depositDetails !== undefined ? req.body.depositDetails : booking.depositDetails,
      settlement: req.body.settlement !== undefined ? req.body.settlement : booking.settlement,
      outstandingRent: req.body.settlement?.remainingToPay !== undefined ? Number(req.body.settlement.remainingToPay) : booking.outstandingRent,
      revisions: req.body.revisions !== undefined ? req.body.revisions : booking.revisions,
      selectedPlan: req.body.selectedPlan !== undefined ? req.body.selectedPlan : booking.selectedPlan
    };

    if (isDbConnected()) {
      // Release old vehicle
      const oldVehicle = await Vehicle.findOne({ vehicleId: oldVehicleId });
      if (oldVehicle) {
        oldVehicle.status = 'Available';
        oldVehicle.meterReading = oldVehicleClosingMeter;
        oldVehicle.auditLogs.push({
          employee: workerId || 'System',
          action: `Returned During Replacement. Meter: ${oldVehicleClosingMeter} KM`,
          timestamp: new Date()
        });
        await oldVehicle.save();
      }

      // Book new vehicle
      newVehicle.status = booking.status === 'Reserved' ? 'Reserved' : 'Ongoing';
      newVehicle.meterReading = newVehicleStartingMeter;
      newVehicle.auditLogs.push({
        employee: workerId || 'System',
        action: `Issued During Replacement. Meter: ${newVehicleStartingMeter} KM`,
        timestamp: new Date()
      });
      await newVehicle.save();

      Object.assign(booking, updates);
      if (req.body.selectedPlan !== undefined) booking.markModified('selectedPlan');
      if (req.body.depositDetails !== undefined) booking.markModified('depositDetails');
      if (req.body.revisions !== undefined) booking.markModified('revisions');
      if (updates.vehicleDetails !== undefined) booking.markModified('vehicleDetails');
      await booking.save();
      res.json(booking);
    } else {
      // In-memory fallback mode
      const oldVehicle = getVehicles().find(v => v.vehicleId === oldVehicleId);
      if (oldVehicle) {
        const oldAudits = oldVehicle.auditLogs || [];
        oldAudits.push({
          employee: workerId || 'System',
          action: `Returned During Replacement. Meter: ${oldVehicleClosingMeter} KM`,
          timestamp: new Date()
        });
        updateVehicle(oldVehicleId, {
          status: 'Available',
          meterReading: oldVehicleClosingMeter,
          auditLogs: oldAudits
        });
      }

      const newVehicleMem = getVehicles().find(v => v.vehicleId === newVehicleId);
      if (newVehicleMem) {
        const newAudits = newVehicleMem.auditLogs || [];
        newAudits.push({
          employee: workerId || 'System',
          action: `Issued During Replacement. Meter: ${newVehicleStartingMeter} KM`,
          timestamp: new Date()
        });
        updateVehicle(newVehicleId, {
          status: booking.status === 'Reserved' ? 'Reserved' : 'Ongoing',
          meterReading: newVehicleStartingMeter,
          auditLogs: newAudits
        });
      }

      const updatedBooking = updateBooking(req.params.bookingId, updates);
      res.json(updatedBooking);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST Drop Off Return / Settle
router.post('/:bookingId/dropoff', async (req, res) => {
  try {
    const { 
      dropDetails, 
      paymentCollection, 
      refundDetails, 
      settlement,
      workerId 
    } = req.body;

    let booking;
    if (isDbConnected()) {
      booking = await Booking.findOne({ bookingId: req.params.bookingId });
    } else {
      booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const finalDropDetails = {
      ...dropDetails,
      actualTime: new Date()
    };

    let finalPayments = [...(booking.paymentCollection || [])];
    if (paymentCollection && paymentCollection.amount > 0) {
      const pObj = { ...paymentCollection };
      pObj.workerId = workerId || pObj.workerId || booking.workerId || 'System';
      if (pObj.cashAmount === undefined) {
        pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
      }
      if (pObj.onlineAmount === undefined) {
        pObj.onlineAmount = ['UPI', 'Online', 'Bank Transfer'].includes(pObj.mode) ? pObj.amount : 0;
      }
      if (pObj.cardAmount === undefined) {
        pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
      }
      finalPayments.push(pObj);
    }

    finalPayments = finalPayments.map(p => {
      const pObj = { ...p };
      pObj.workerId = pObj.workerId || workerId || booking.workerId || 'System';
      if (pObj.cashAmount === undefined) {
        pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
      }
      if (pObj.onlineAmount === undefined) {
        pObj.onlineAmount = ['UPI', 'Online', 'Bank Transfer'].includes(pObj.mode) ? pObj.amount : 0;
      }
      if (pObj.cardAmount === undefined) {
        pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
      }
      return pObj;
    });

    const updates = {
      status: 'Completed',
      'rentalPeriod.actualReturnDate': new Date(),
      actualReturnDate: new Date(),
      dropDetails: finalDropDetails,
      paymentCollection: finalPayments,
      refundDetails: refundDetails || {},
      settlement: settlement || booking.settlement,
      workerId: workerId || booking.workerId,
      rentalPaid: settlement ? settlement.previousPaid : ((booking.rentalPaid || booking.advancePaid || 0) + (paymentCollection?.amount || 0)),
      outstandingRent: settlement ? settlement.remainingToPay : 0,
      collectAmount: settlement ? (settlement.collectAmount || 0) : 0,
      refundAmount: settlement ? (settlement.refundAmount || 0) : 0,
      depositHeld: settlement ? Math.max(0, (settlement.depositHeld || 0) - (settlement.depositAdjustment || 0)) : booking.depositHeld,
      ...(req.body.revisions !== undefined && { revisions: req.body.revisions })
    };

    if (isDbConnected()) {
      Object.assign(booking, updates);
      await booking.save();

      // Release vehicle
      const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
      if (vehicle) {
        vehicle.status = 'Available';
        vehicle.meterReading = dropDetails?.endMeter || vehicle.meterReading;
        await vehicle.save();
      }
      res.json(booking);
    } else {
      const updatedBooking = updateBooking(req.params.bookingId, updates);
      updateVehicle(booking.vehicleId, { 
        status: 'Available', 
        meterReading: dropDetails?.endMeter || 0 
      });
      res.json(updatedBooking);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH Cancel Booking
router.patch('/:bookingId/cancel', async (req, res) => {
  try {
    let booking;
    if (isDbConnected()) {
      booking = await Booking.findOne({ bookingId: req.params.bookingId });
    } else {
      booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (isDbConnected()) {
      booking.status = 'Cancelled';
      await booking.save();

      const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
      if (vehicle) {
        vehicle.status = 'Available';
        await vehicle.save();
      }
      res.json(booking);
    } else {
      const updatedBooking = updateBooking(req.params.bookingId, { status: 'Cancelled' });
      updateVehicle(booking.vehicleId, { status: 'Available' });
      res.json(updatedBooking);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH Admin Override
router.patch('/:bookingId/override', async (req, res) => {
  try {
    let booking;
    if (isDbConnected()) {
      booking = await Booking.findOne({ bookingId: req.params.bookingId });
    } else {
      booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (isDbConnected()) {
      Object.assign(booking, req.body);
      const updatedBooking = await booking.save();
      
      // Re-sync vehicle status if status changes
      if (req.body.status) {
        const vStatus = (req.body.status === 'Completed' || req.body.status === 'Cancelled')
          ? 'Available'
          : req.body.status === 'Ongoing'
            ? 'Ongoing'
            : 'Reserved';
        
        const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
        if (vehicle) {
          vehicle.status = vStatus;
          await vehicle.save();
        }
      }
      res.json(updatedBooking);
    } else {
      const updatedBooking = updateBooking(req.params.bookingId, req.body);
      if (req.body.status) {
        const vStatus = (req.body.status === 'Completed' || req.body.status === 'Cancelled')
          ? 'Available'
          : req.body.status === 'Ongoing'
            ? 'Ongoing'
            : 'Reserved';
        updateVehicle(booking.vehicleId, { status: vStatus });
      }
      res.json(updatedBooking);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// POST Record standalone payment collections
router.post('/:bookingId/payment', async (req, res) => {
  try {
    const { payment, securityDeposit, depositDetails, advancePaid, revisions } = req.body;
    
    let booking;
    if (isDbConnected()) {
      booking = await Booking.findOne({ bookingId: req.params.bookingId });
    } else {
      booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    }

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const mappedPayments = [...(booking.paymentCollection || [])];
    if (payment) {
      const pObj = { ...payment };
      pObj.workerId = req.body.workerId || pObj.workerId || booking.workerId || 'System';
      if (pObj.cashAmount === undefined) {
        pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
      }
      if (pObj.onlineAmount === undefined) {
        pObj.onlineAmount = ['UPI', 'Online', 'Bank Transfer'].includes(pObj.mode) ? pObj.amount : 0;
      }
      if (pObj.cardAmount === undefined) {
        pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
      }
      if (pObj.mode === 'Mixed') {
        const ref = pObj.reference || '';
        const cashM = ref.match(/Cash:\s*([\d.]+)/i);
        const onlineM = ref.match(/Online:\s*([\d.]+)/i);
        const cardM = ref.match(/Card:\s*([\d.]+)/i);
        if (cashM) pObj.cashAmount = parseFloat(cashM[1]) || 0;
        if (onlineM) pObj.onlineAmount = parseFloat(onlineM[1]) || 0;
        if (cardM) pObj.cardAmount = parseFloat(cardM[1]) || 0;
      }
      mappedPayments.push(pObj);
    }

    const newAdvancePaid = advancePaid !== undefined ? Number(advancePaid) : booking.advancePaid;
    const newSecurityDeposit = securityDeposit !== undefined ? Number(securityDeposit) : booking.securityDeposit;
    const totalBill = booking.settlement?.actualBill || booking.settlement?.totalBill || booking.baseFare || 0;

    const settlementUpdates = {
      ...booking.settlement,
      previousPaid: newAdvancePaid,
      depositCollected: newSecurityDeposit,
      remainingToPay: Math.max(0, totalBill - newAdvancePaid)
    };

    const updates = {
      paymentCollection: mappedPayments,
      advancePaid: newAdvancePaid,
      securityDeposit: newSecurityDeposit,
      rentalPaid: newAdvancePaid,
      depositHeld: newSecurityDeposit,
      rentalCost: totalBill,
      outstandingRent: Math.max(0, totalBill - newAdvancePaid),
      finalAmount: Math.max(0, totalBill - newAdvancePaid),
      settlement: settlementUpdates,
      revisions: revisions || booking.revisions,
      ...(depositDetails !== undefined && { depositDetails })
    };

    if (payment) {
      updates.paymentMode = payment.mode;
      let cashAmt = 0;
      let onlineAmt = 0;
      let cardAmt = 0;
      if (payment.mode === 'Cash') {
        cashAmt = payment.amount;
      } else if (['UPI', 'Online', 'Bank Transfer'].includes(payment.mode)) {
        onlineAmt = payment.amount;
      } else if (payment.mode === 'Card') {
        cardAmt = payment.amount;
      } else if (payment.mode === 'Mixed') {
        const ref = payment.reference || '';
        const cashM = ref.match(/Cash:\s*(\d+)/i);
        const onlineM = ref.match(/Online:\s*(\d+)/i);
        const cardM = ref.match(/Card:\s*(\d+)/i);
        if (cashM) cashAmt = Number(cashM[1]);
        if (onlineM) onlineAmt = Number(onlineM[1]);
        if (cardM) cardAmt = Number(cardM[1]);
      }
      updates.cashAmount = cashAmt;
      updates.onlineAmount = onlineAmt;
      updates.cardAmount = cardAmt;
    }

    if (isDbConnected()) {
      Object.assign(booking, updates);
      await booking.save();
      res.json(booking);
    } else {
      const updatedBooking = updateBooking(req.params.bookingId, updates);
      res.json(updatedBooking);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
