import express from 'express';
import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import { calculateDropOffSettlement } from '../utils/billingEngine.js';
import {
  isDbConnected,
  getBookings,
  addBooking,
  updateBooking,
  getVehicles,
  updateVehicle
} from '../memoryDb.js';

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize payment object — set cash/online/card splits from mode */
function normalizePayment(p, workerId) {
  const obj = { ...p };
  obj.workerId = obj.workerId || workerId || 'System';

  if (obj.mode === 'Cash') {
    obj.cashAmount = obj.cashAmount ?? obj.amount ?? 0;
    obj.onlineAmount = obj.onlineAmount ?? 0;
    obj.cardAmount = obj.cardAmount ?? 0;
  } else if (obj.mode === 'Card') {
    obj.cardAmount = obj.cardAmount ?? obj.amount ?? 0;
    obj.cashAmount = obj.cashAmount ?? 0;
    obj.onlineAmount = obj.onlineAmount ?? 0;
  } else if (['UPI', 'Online', 'Bank Transfer'].includes(obj.mode)) {
    obj.onlineAmount = obj.onlineAmount ?? obj.amount ?? 0;
    obj.cashAmount = obj.cashAmount ?? 0;
    obj.cardAmount = obj.cardAmount ?? 0;
  } else if (obj.mode === 'Mixed') {
    // Keep existing splits if already set
    obj.cashAmount = obj.cashAmount ?? 0;
    obj.onlineAmount = obj.onlineAmount ?? 0;
    obj.cardAmount = obj.cardAmount ?? 0;
  }

  return obj;
}

/** Return true if vehicle is available for booking */
function isVehicleAvailable(vehicle) {
  return vehicle.status === 'Available' || vehicle.status === 'Active';
}

// ─── GET all bookings ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (isDbConnected()) {
      const bookings = await Booking.find().sort({ createdAt: -1 });
      return res.json(bookings);
    }
    res.json(getBookings().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── GET single booking ───────────────────────────────────────────────────────
router.get('/:bookingId', async (req, res) => {
  try {
    if (isDbConnected()) {
      const booking = await Booking.findOne({ bookingId: req.params.bookingId });
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
      return res.json(booking);
    }
    const booking = getBookings().find(b => b.bookingId === req.params.bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST create booking ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { vehicleId } = req.body;

    const vehicle = isDbConnected()
      ? await Vehicle.findOne({ vehicleId })
      : getVehicles().find(v => v.vehicleId === vehicleId);

    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    if (!isVehicleAvailable(vehicle)) {
      return res.status(400).json({ message: `Vehicle is not available (Status: ${vehicle.status})` });
    }

    const payload = { ...req.body };

    // Attach vehicle details
    payload.vehicleDetails = {
      name: vehicle.name,
      regNumber: vehicle.regNumber,
      category: vehicle.category
    };

    // Normalize payment collection
    if (Array.isArray(payload.paymentCollection)) {
      payload.paymentCollection = payload.paymentCollection.map(p =>
        normalizePayment(p, payload.workerId)
      );
    }

    // Compute base snapshot fields
    const baseFare = Number(payload.baseFare) || 0;
    const helmetsTotal = (payload.addons?.helmetsCount || 0) * (payload.addons?.helmetsPrice || 50);
    const discount = Number(payload.discount) || 0;
    const rentalPaid = Number(payload.advancePaid) || 0;
    const depositHeld = Number(payload.securityDeposit) || 0;

    payload.rentalCost = baseFare;
    payload.rentalPaid = rentalPaid;
    payload.depositHeld = depositHeld;
    payload.outstandingRent = Math.max(0, baseFare + helmetsTotal - discount - rentalPaid);
    payload.collectAmount = 0;
    payload.refundAmount = 0;
    payload.paymentMode = payload.paymentMethod || 'Cash';

    if (payload.rentalPeriod?.expectedEndDate) {
      payload.expectedReturnDate = payload.rentalPeriod.expectedEndDate;
    }

    const isFuture = new Date(payload.rentalPeriod?.startDate) > new Date();
    payload.status = isFuture ? 'Reserved' : 'Ongoing';

    if (!isFuture) {
      const pickupTime = new Date(payload.rentalPeriod?.startDate || new Date());
      payload.actualPickupDate = pickupTime;
      payload.rentalPeriod.actualPickupDate = pickupTime;
    }

    if (isDbConnected()) {
      const booking = new Booking(payload);
      const newBooking = await booking.save();

      vehicle.status = isFuture ? 'Reserved' : 'Ongoing';
      if (!isFuture) vehicle.meterReading = payload.handover?.startMeter || vehicle.meterReading;
      await vehicle.save();

      return res.status(201).json(newBooking);
    }

    // Memory fallback
    const newBooking = addBooking(payload);
    updateVehicle(vehicleId, {
      status: isFuture ? 'Reserved' : 'Ongoing',
      ...(!isFuture && { meterReading: payload.handover?.startMeter || 0 })
    });
    res.status(201).json(newBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── POST Handle Pickup ───────────────────────────────────────────────────────
router.post('/:bookingId/pickup', async (req, res) => {
  try {
    const { handover, accessoriesChecklist, workerId, paymentCollection } = req.body;

    const booking = isDbConnected()
      ? await Booking.findOne({ bookingId: req.params.bookingId })
      : getBookings().find(b => b.bookingId === req.params.bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const pickupTime = new Date();
    const updates = {
      status: 'Ongoing',
      'rentalPeriod.actualPickupDate': pickupTime,
      actualPickupDate: pickupTime,
      handover: {
        startMeter: handover?.startMeter ?? booking.handover?.startMeter ?? 0,
        fuelIncluded: handover?.fuelIncluded ?? false
      },
      accessoriesChecklist: accessoriesChecklist || booking.accessoriesChecklist || {},
      workerId: workerId || booking.workerId
    };

    // Add pickup payment if provided
    let payments = [...(booking.paymentCollection || [])];
    if (paymentCollection?.amount > 0) {
      payments.push(normalizePayment(paymentCollection, workerId));
    }
    updates.paymentCollection = payments;

    // Recalculate snapshot
    const addedPayment = paymentCollection?.amount > 0 ? paymentCollection.amount : 0;
    updates.rentalPaid = (Number(booking.rentalPaid) || 0) + addedPayment;
    updates.depositHeld = Number(booking.depositHeld) || 0;
    const baseFare = Number(booking.baseFare) || Number(booking.rentalCost) || 0;
    const helmetsTotal = (booking.addons?.helmetsCount || 0) * (booking.addons?.helmetsPrice || 50);
    const discount = Number(booking.discount) || 0;
    updates.outstandingRent = Math.max(0, baseFare + helmetsTotal - discount - updates.rentalPaid);
    updates.rentalCost = baseFare;
    updates.expectedReturnDate = booking.rentalPeriod?.expectedEndDate || booking.expectedReturnDate;

    if (isDbConnected()) {
      Object.assign(booking, updates);
      booking.markModified('handover');
      booking.markModified('accessoriesChecklist');
      booking.markModified('paymentCollection');
      await booking.save();

      const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
      if (vehicle) {
        vehicle.status = 'Ongoing';
        vehicle.meterReading = handover?.startMeter || vehicle.meterReading;
        await vehicle.save();
      }
      return res.json(booking);
    }

    const updated = updateBooking(req.params.bookingId, updates);
    updateVehicle(booking.vehicleId, {
      status: 'Ongoing',
      meterReading: handover?.startMeter || 0
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── POST Extend Booking ──────────────────────────────────────────────────────
router.post('/:bookingId/extend', async (req, res) => {
  const { newEndDateTime, extraCharges, remarks, workerId, paymentCollection } = req.body;

  try {
    const booking = isDbConnected()
      ? await Booking.findOne({ bookingId: req.params.bookingId })
      : getBookings().find(b => b.bookingId === req.params.bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const extensionCost = Number(extraCharges) || 0;
    const extensionItem = {
      newEndDateTime,
      extraCharges: extensionCost,
      remarks: remarks || '',
      timestamp: new Date()
    };

    const exts = [...(booking.extensions || []), extensionItem];
    const newExpectedEndDate = new Date(newEndDateTime);

    // ─── BILLING: new rentalCost = existing rentalCost + this extension's charge
    // The frontend must send extraCharges as ONLY the delta for this extension period.
    // If req.body.baseFare is provided, it is the full new cumulative cost (from frontend calc).
    const currentRentalCost = Number(booking.rentalCost) || Number(booking.baseFare) || 0;
    const newRentalCost = req.body.baseFare !== undefined
      ? Number(req.body.baseFare)
      : currentRentalCost + extensionCost;

    const newRentalPaid = req.body.advancePaid !== undefined
      ? Number(req.body.advancePaid)
      : Number(booking.rentalPaid) || 0;

    const newDepositHeld = req.body.securityDeposit !== undefined
      ? Number(req.body.securityDeposit)
      : Number(booking.depositHeld) || 0;

    const helmetsTotal = (booking.addons?.helmetsCount || 0) * (booking.addons?.helmetsPrice || 50);
    const discount = Number(booking.discount) || 0;
    const outstandingRent = Math.max(0, newRentalCost + helmetsTotal - discount - newRentalPaid);

    let payments = [...(booking.paymentCollection || [])];
    if (paymentCollection?.amount > 0) {
      const alreadyPushed = payments.some(p => p.transactionId && p.transactionId === paymentCollection.transactionId);
      if (!alreadyPushed) {
        payments.push(normalizePayment(paymentCollection, workerId));
      }
    }

    const updates = {
      extensions: exts,
      'rentalPeriod.expectedEndDate': newExpectedEndDate,
      expectedReturnDate: newExpectedEndDate,
      baseFare: newRentalCost,
      rentalCost: newRentalCost,
      securityDeposit: newDepositHeld,
      depositHeld: newDepositHeld,
      rentalPaid: newRentalPaid,
      outstandingRent,
      paymentCollection: payments,
      status: 'Extended',
      workerId: workerId || booking.workerId,
      ...(req.body.durationHours !== undefined && { durationHours: Number(req.body.durationHours) }),
      ...(req.body.durationDays !== undefined && { durationDays: Number(req.body.durationDays) }),
      ...(req.body.selectedPlan !== undefined && { selectedPlan: req.body.selectedPlan }),
      ...(req.body.depositDetails !== undefined && { depositDetails: req.body.depositDetails }),
      ...(req.body.revisions !== undefined && { revisions: req.body.revisions }),
      ...(paymentCollection?.mode && { paymentMode: paymentCollection.mode }),
      settlement: {
        ...(booking.settlement || {}),
        totalBill: newRentalCost,
        actualBill: newRentalCost,
        previousPaid: newRentalPaid,
        depositCollected: newDepositHeld,
        remainingToPay: outstandingRent
      }
    };

    if (isDbConnected()) {
      Object.assign(booking, updates);
      if (req.body.selectedPlan) booking.markModified('selectedPlan');
      if (req.body.depositDetails) booking.markModified('depositDetails');
      if (req.body.revisions) booking.markModified('revisions');
      booking.markModified('extensions');
      booking.markModified('paymentCollection');
      booking.markModified('settlement');
      await booking.save();
      return res.json(booking);
    }

    const updated = updateBooking(req.params.bookingId, updates);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── POST Replace Vehicle ─────────────────────────────────────────────────────
router.post('/:bookingId/replace', async (req, res) => {
  const { newVehicleId, reason, workerId } = req.body;

  try {
    const booking = isDbConnected()
      ? await Booking.findOne({ bookingId: req.params.bookingId })
      : getBookings().find(b => b.bookingId === req.params.bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    const oldVehicleId = booking.vehicleId;
    if (oldVehicleId === newVehicleId) {
      return res.status(400).json({ message: 'New vehicle must be different from current vehicle' });
    }

    const newVehicle = isDbConnected()
      ? await Vehicle.findOne({ vehicleId: newVehicleId })
      : getVehicles().find(v => v.vehicleId === newVehicleId);

    if (!newVehicle) return res.status(404).json({ message: 'Replacement vehicle not found' });
    if (!isVehicleAvailable(newVehicle)) {
      return res.status(400).json({ message: `Replacement vehicle is not available (Status: ${newVehicle.status})` });
    }

    const oldVehicleReg = booking.vehicleDetails?.regNumber || '';
    const oldVehicleClosingMeter = Number(req.body.oldVehicleClosingMeter) || 0;
    const newVehicleStartingMeter = Number(req.body.newVehicleStartingMeter) || newVehicle.meterReading || 0;

    const replacementItem = {
      oldVehicleId,
      oldVehicleReg,
      oldVehicleClosingMeter,
      newVehicleId,
      newVehicleReg: newVehicle.regNumber || '',
      newVehicleStartingMeter,
      reason: reason || 'Routine Swap',
      timestamp: new Date(),
      operatorName: workerId || 'System'
    };

    let payments = [...(booking.paymentCollection || [])];
    if (Array.isArray(req.body.paymentCollection)) {
      payments = req.body.paymentCollection.map(p => normalizePayment(p, workerId));
    }

    const newRentalCost = req.body.baseFare !== undefined
      ? Number(req.body.baseFare)
      : Number(booking.rentalCost) || Number(booking.baseFare) || 0;

    const newDepositHeld = req.body.securityDeposit !== undefined
      ? Number(req.body.securityDeposit)
      : Number(booking.depositHeld) || 0;

    const newRentalPaid = req.body.advancePaid !== undefined
      ? Number(req.body.advancePaid)
      : Number(booking.rentalPaid) || 0;

    const updates = {
      replacements: [...(booking.replacements || []), replacementItem],
      vehicleId: newVehicleId,
      vehicleDetails: {
        name: newVehicle.name,
        regNumber: newVehicle.regNumber,
        category: newVehicle.category
      },
      workerId: workerId || booking.workerId,
      rentalCost: newRentalCost,
      baseFare: newRentalCost,
      securityDeposit: newDepositHeld,
      depositHeld: newDepositHeld,
      rentalPaid: newRentalPaid,
      outstandingRent: req.body.settlement?.remainingToPay !== undefined
        ? Number(req.body.settlement.remainingToPay)
        : booking.outstandingRent,
      paymentCollection: payments,
      ...(req.body.depositDetails !== undefined && { depositDetails: req.body.depositDetails }),
      ...(req.body.settlement !== undefined && { settlement: req.body.settlement }),
      ...(req.body.revisions !== undefined && { revisions: req.body.revisions }),
      ...(req.body.selectedPlan !== undefined && { selectedPlan: req.body.selectedPlan })
    };

    if (isDbConnected()) {
      // Release old vehicle
      const oldVehicle = await Vehicle.findOne({ vehicleId: oldVehicleId });
      if (oldVehicle) {
        oldVehicle.status = 'Available';
        oldVehicle.meterReading = oldVehicleClosingMeter;
        oldVehicle.auditLogs.push({
          employee: workerId || 'System',
          action: `Returned via replacement. Meter: ${oldVehicleClosingMeter} KM`,
          timestamp: new Date()
        });
        await oldVehicle.save();
      }

      // Assign new vehicle
      newVehicle.status = booking.status === 'Reserved' ? 'Reserved' : 'Ongoing';
      newVehicle.meterReading = newVehicleStartingMeter;
      newVehicle.auditLogs.push({
        employee: workerId || 'System',
        action: `Issued via replacement. Meter: ${newVehicleStartingMeter} KM`,
        timestamp: new Date()
      });
      await newVehicle.save();

      Object.assign(booking, updates);
      booking.markModified('replacements');
      booking.markModified('vehicleDetails');
      if (req.body.selectedPlan) booking.markModified('selectedPlan');
      if (req.body.depositDetails) booking.markModified('depositDetails');
      if (req.body.revisions) booking.markModified('revisions');
      await booking.save();
      return res.json(booking);
    }

    // Memory fallback
    const oldVehicleMem = getVehicles().find(v => v.vehicleId === oldVehicleId);
    if (oldVehicleMem) {
      const oldAudits = [...(oldVehicleMem.auditLogs || [])];
      oldAudits.push({ employee: workerId || 'System', action: `Returned via replacement. Meter: ${oldVehicleClosingMeter} KM`, timestamp: new Date() });
      updateVehicle(oldVehicleId, { status: 'Available', meterReading: oldVehicleClosingMeter, auditLogs: oldAudits });
    }
    const newVehicleMem = getVehicles().find(v => v.vehicleId === newVehicleId);
    if (newVehicleMem) {
      const newAudits = [...(newVehicleMem.auditLogs || [])];
      newAudits.push({ employee: workerId || 'System', action: `Issued via replacement. Meter: ${newVehicleStartingMeter} KM`, timestamp: new Date() });
      updateVehicle(newVehicleId, { status: booking.status === 'Reserved' ? 'Reserved' : 'Ongoing', meterReading: newVehicleStartingMeter, auditLogs: newAudits });
    }

    const updated = updateBooking(req.params.bookingId, updates);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── POST Drop-Off (with canonical settlement formula) ────────────────────────
router.post('/:bookingId/dropoff', async (req, res) => {
  try {
    const { dropDetails, paymentCollection, refundDetails, settlement, workerId } = req.body;

    const booking = isDbConnected()
      ? await Booking.findOne({ bookingId: req.params.bookingId })
      : getBookings().find(b => b.bookingId === req.params.bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // ─── Canonical settlement calculation ──────────────────────────────────────
    // If client sends pre-computed settlement, validate and use it.
    // Otherwise compute server-side from snapshot fields + drop details.
    let finalSettlement;

    if (settlement && settlement.actualBill !== undefined) {
      // Client sent computed settlement — use it (client uses same billingEngine)
      finalSettlement = settlement;
    } else {
      // Compute server-side
      const computed = calculateDropOffSettlement(booking, dropDetails || {});
      finalSettlement = {
        actualBill: computed.actualBill,
        totalBill: computed.actualBill,
        previousPaid: Number(booking.rentalPaid) || 0,
        depositCollected: Number(booking.depositHeld) || 0,
        depositHeld: Number(booking.depositHeld) || 0,
        depositAdjustment: computed.depositAdjustment,
        depositRefund: computed.finalRefund,
        remainingToPay: computed.finalCollection,
        collectAmount: computed.finalCollection,
        refundAmount: computed.finalRefund
      };
    }

    const finalDropDetails = { ...dropDetails, actualTime: new Date() };

    let payments = [...(booking.paymentCollection || [])];
    if (paymentCollection?.amount > 0) {
      payments.push(normalizePayment(paymentCollection, workerId));
    }

    const updates = {
      status: 'Completed',
      'rentalPeriod.actualReturnDate': new Date(),
      actualReturnDate: new Date(),
      dropDetails: finalDropDetails,
      paymentCollection: payments,
      refundDetails: refundDetails || {},
      settlement: finalSettlement,
      workerId: workerId || booking.workerId,
      // Snapshot fields updated from settlement
      rentalPaid: finalSettlement.previousPaid || Number(booking.rentalPaid) || 0,
      outstandingRent: 0,
      collectAmount: finalSettlement.collectAmount || 0,
      refundAmount: finalSettlement.refundAmount || 0,
      depositHeld: Math.max(0, Number(booking.depositHeld) - (finalSettlement.depositAdjustment || 0)),
      ...(req.body.revisions !== undefined && { revisions: req.body.revisions })
    };

    if (isDbConnected()) {
      Object.assign(booking, updates);
      booking.markModified('dropDetails');
      booking.markModified('paymentCollection');
      booking.markModified('settlement');
      booking.markModified('refundDetails');
      await booking.save();

      const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
      if (vehicle) {
        vehicle.status = 'Available';
        vehicle.meterReading = dropDetails?.endMeter || vehicle.meterReading;
        await vehicle.save();
      }
      return res.json(booking);
    }

    const updated = updateBooking(req.params.bookingId, updates);
    updateVehicle(booking.vehicleId, {
      status: 'Available',
      meterReading: dropDetails?.endMeter || 0
    });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── PATCH Cancel Booking ─────────────────────────────────────────────────────
router.patch('/:bookingId/cancel', async (req, res) => {
  try {
    const booking = isDbConnected()
      ? await Booking.findOne({ bookingId: req.params.bookingId })
      : getBookings().find(b => b.bookingId === req.params.bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (isDbConnected()) {
      booking.status = 'Cancelled';
      await booking.save();
      const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
      if (vehicle) { vehicle.status = 'Available'; await vehicle.save(); }
      return res.json(booking);
    }

    const updated = updateBooking(req.params.bookingId, { status: 'Cancelled' });
    updateVehicle(booking.vehicleId, { status: 'Available' });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── PATCH Admin Override ─────────────────────────────────────────────────────
router.patch('/:bookingId/override', async (req, res) => {
  try {
    const booking = isDbConnected()
      ? await Booking.findOne({ bookingId: req.params.bookingId })
      : getBookings().find(b => b.bookingId === req.params.bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (isDbConnected()) {
      Object.assign(booking, req.body);
      const updated = await booking.save();

      if (req.body.status) {
        const vStatus = ['Completed', 'Cancelled'].includes(req.body.status)
          ? 'Available'
          : req.body.status === 'Ongoing' ? 'Ongoing' : 'Reserved';
        const vehicle = await Vehicle.findOne({ vehicleId: booking.vehicleId });
        if (vehicle) { vehicle.status = vStatus; await vehicle.save(); }
      }
      return res.json(updated);
    }

    const updated = updateBooking(req.params.bookingId, req.body);
    if (req.body.status) {
      const vStatus = ['Completed', 'Cancelled'].includes(req.body.status)
        ? 'Available'
        : req.body.status === 'Ongoing' ? 'Ongoing' : 'Reserved';
      updateVehicle(booking.vehicleId, { status: vStatus });
    }
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ─── POST Record Payment ──────────────────────────────────────────────────────
router.post('/:bookingId/payment', async (req, res) => {
  try {
    const { payment, securityDeposit, depositDetails, advancePaid, revisions } = req.body;

    const booking = isDbConnected()
      ? await Booking.findOne({ bookingId: req.params.bookingId })
      : getBookings().find(b => b.bookingId === req.params.bookingId);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    let payments = [...(booking.paymentCollection || [])];
    if (payment) {
      payments.push(normalizePayment(payment, req.body.workerId || booking.workerId));
    }

    const newRentalPaid = advancePaid !== undefined ? Number(advancePaid) : Number(booking.rentalPaid) || 0;
    const newDepositHeld = securityDeposit !== undefined ? Number(securityDeposit) : Number(booking.depositHeld) || 0;
    const rentalCost = Number(booking.rentalCost) || Number(booking.baseFare) || 0;
    const helmetsTotal = (booking.addons?.helmetsCount || 0) * (booking.addons?.helmetsPrice || 50);
    const discount = Number(booking.discount) || 0;

    const updates = {
      paymentCollection: payments,
      rentalPaid: newRentalPaid,
      depositHeld: newDepositHeld,
      securityDeposit: newDepositHeld,
      rentalCost,
      baseFare: rentalCost,
      outstandingRent: Math.max(0, rentalCost + helmetsTotal - discount - newRentalPaid),
      settlement: {
        ...(booking.settlement || {}),
        previousPaid: newRentalPaid,
        depositCollected: newDepositHeld,
        remainingToPay: Math.max(0, rentalCost + helmetsTotal - discount - newRentalPaid)
      },
      ...(depositDetails !== undefined && { depositDetails }),
      ...(revisions !== undefined && { revisions })
    };

    if (isDbConnected()) {
      Object.assign(booking, updates);
      booking.markModified('paymentCollection');
      booking.markModified('settlement');
      await booking.save();
      return res.json(booking);
    }

    const updated = updateBooking(req.params.bookingId, updates);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
