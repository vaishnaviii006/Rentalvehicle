import express from 'express';
import Booking from '../models/Booking.js';
import Settlement from '../models/Settlement.js';
import {
  isDbConnected,
  getBookings,
  getSettlements,
  addSettlement
} from '../memoryDb.js';

const router = express.Router();

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Return YYYY-MM-DD string for a date value, or '' if invalid */
const safeDateStr = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

/** Parse mixed payment reference string → { cash, online, card } */
const parseMixedRef = (refStr = '') => {
  const cashMatch = refStr.match(/Cash:\s*([\d.]+)/i);
  const onlineMatch = refStr.match(/Online:\s*([\d.]+)/i);
  const cardMatch = refStr.match(/Card:\s*([\d.]+)/i);
  return {
    cash: parseFloat(cashMatch?.[1]) || 0,
    online: parseFloat(onlineMatch?.[1]) || 0,
    card: parseFloat(cardMatch?.[1]) || 0
  };
};

/**
 * Get cash/online/card split for a single payment entry.
 * Uses stored cashAmount/onlineAmount/cardAmount first (reliable),
 * falls back to parsing Mixed reference string.
 */
const getPaymentSplit = (p) => {
  let cash = 0, online = 0, card = 0;

  if (p.mode === 'Cash') {
    cash = p.cashAmount || p.amount || 0;
  } else if (p.mode === 'Card') {
    card = p.cardAmount || p.amount || 0;
  } else if (['UPI', 'Online', 'Bank Transfer'].includes(p.mode)) {
    online = p.onlineAmount || p.amount || 0;
  } else if (p.mode === 'Mixed') {
    // Use stored splits if available (set during normalization)
    if (p.cashAmount || p.onlineAmount || p.cardAmount) {
      cash = p.cashAmount || 0;
      online = p.onlineAmount || 0;
      card = p.cardAmount || 0;
    } else {
      // Fallback to parsing reference string
      const split = parseMixedRef(p.reference || '');
      cash = split.cash;
      online = split.online;
      card = split.card;
    }
  } else if (p.mode?.includes('Refund')) {
    // Refund modes — treated as negative cash/online
    cash = -(p.cashAmount || 0);
    online = -(p.onlineAmount || 0);
    card = -(p.cardAmount || 0);
  }

  return { cash, online, card };
};

// ─── GET daily accounting summary ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { date, workerId, vehicleId } = req.query;

  try {
    const allBookings = isDbConnected()
      ? await Booking.find()
      : getBookings();

    const targetDate = date || new Date().toISOString().slice(0, 10);

    let totalBookings = 0;
    let totalRevenue = 0;
    let totalOutstanding = 0;

    const rentalCollections = { cash: 0, online: 0, card: 0, total: 0 };
    const depositCollections = { cash: 0, online: 0, card: 0, total: 0 };
    const depositRefunds = { cash: 0, online: 0, card: 0, total: 0 };
    let totalCashHandledByWorker = 0;

    const matchedBookingsList = [];

    for (const b of allBookings) {
      // ── Filter: only bookings with activity on targetDate ─────────────────
      const todayPayments = (b.paymentCollection || []).filter(
        p => safeDateStr(p.timestamp) === targetDate
      );
      const todayRevisions = (b.revisions || []).filter(
        r => safeDateStr(r.timestamp) === targetDate
      );

      // Refund activity: completed refund and return date matches
      const returnDateStr = safeDateStr(b.actualReturnDate || b.rentalPeriod?.actualReturnDate);
      const isRefundToday =
        b.refundDetails?.status === 'Completed' && returnDateStr === targetDate;

      if (todayPayments.length === 0 && todayRevisions.length === 0 && !isRefundToday) {
        continue;
      }

      // ── Filter: worker ─────────────────────────────────────────────────────
      const workerFilter = workerId && workerId !== 'All';

      if (workerFilter) {
        // Check payments attributed to this worker (workerId stored directly on payment)
        const hasPaymentByWorker = todayPayments.some(p => p.workerId === workerId);
        const hasRevisionByWorker = todayRevisions.some(r => r.operator === workerId);
        let hasRefundByWorker = false;
        if (isRefundToday) {
          const dropOffRev = (b.revisions || []).find(
            r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === targetDate
          );
          const refundOp = dropOffRev?.operator || b.workerId || 'System';
          hasRefundByWorker = refundOp === workerId;
        }
        if (!hasPaymentByWorker && !hasRevisionByWorker && !hasRefundByWorker) {
          continue;
        }
      }

      // ── Filter: vehicle ────────────────────────────────────────────────────
      if (vehicleId && vehicleId !== 'All' && b.vehicleId !== vehicleId) {
        continue;
      }

      totalBookings++;

      // ── Revenue from snapshot fields (primary source of truth) ─────────────
      const revenueContrib = Number(b.rentalCost) || Number(b.baseFare) || 0;
      const outstandingContrib = Number(b.outstandingRent) || 0;
      totalRevenue += revenueContrib;
      totalOutstanding += outstandingContrib;

      // ── Rental payment splits for today ────────────────────────────────────
      for (const p of todayPayments) {
        if (workerFilter && p.workerId !== workerId) continue;

        const { cash, online, card } = getPaymentSplit(p);
        rentalCollections.cash += cash;
        rentalCollections.online += online;
        rentalCollections.card += card;
        rentalCollections.total += cash + online + card;

        if (!workerFilter || p.workerId === workerId) {
          totalCashHandledByWorker += cash;
        }
      }

      // ── Deposit collections from revisions today ───────────────────────────
      for (const rev of todayRevisions) {
        if (workerFilter && rev.operator !== workerId) continue;
        if (!rev.depositDetails || (rev.depositDetails.difference || 0) <= 0) continue;

        const diff = rev.depositDetails.difference || 0;
        const mode = rev.depositDetails.mode || '';
        let cash = 0, online = 0, card = 0;

        if (mode === 'Cash') {
          cash = diff;
        } else if (mode === 'Card') {
          card = diff;
        } else if (['UPI', 'Online'].includes(mode)) {
          online = diff;
        } else if (mode === 'Mixed') {
          // Use snapshot paymentBreakdown delta to get accurate mixed split
          const snapshot = rev.financialSnapshotAfterChange?.paymentBreakdown || {};
          const prevRev = (b.revisions || []).find(r => r.revisionNumber === rev.revisionNumber - 1);
          const prevSnapshot = prevRev?.financialSnapshotAfterChange?.paymentBreakdown || {};
          cash = Math.max(0, (snapshot.depositCash || 0) - (prevSnapshot.depositCash || 0));
          online = Math.max(0, (snapshot.depositOnline || 0) - (prevSnapshot.depositOnline || 0));
          card = Math.max(0, (snapshot.depositCard || 0) - (prevSnapshot.depositCard || 0));
        }

        depositCollections.cash += cash;
        depositCollections.online += online;
        depositCollections.card += card;
        depositCollections.total += cash + online + card;
        totalCashHandledByWorker += cash;
      }

      // ── Deposit refund today ───────────────────────────────────────────────
      if (isRefundToday) {
        const dropOffRev = (b.revisions || []).find(
          r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === targetDate
        );
        const refundOp = dropOffRev?.operator || b.workerId || 'System';
        if (!workerFilter || refundOp === workerId) {
          const refundAmt = Number(b.refundDetails?.amount) || 0;
          const method = b.refundDetails?.method || '';
          let cash = 0, online = 0, card = 0;

          if (method === 'Cash') cash = refundAmt;
          else if (method === 'Card') card = refundAmt;
          else if (['UPI', 'Online'].includes(method)) online = refundAmt;
          else if (method === 'Mixed') {
            const split = parseMixedRef(b.refundDetails?.notes || '');
            cash = split.cash; online = split.online; card = split.card;
          }

          depositRefunds.cash += cash;
          depositRefunds.online += online;
          depositRefunds.card += card;
          depositRefunds.total += cash + online + card;
          totalCashHandledByWorker -= cash; // refund is outgoing cash
        }
      }

      matchedBookingsList.push({
        bookingId: b.bookingId,
        customerName: b.customer?.name || '—',
        vehicleId: b.vehicleId,
        vehicleName: b.vehicleDetails?.name || '—',
        status: b.status,
        rentalCost: revenueContrib,
        rentalPaid: Number(b.rentalPaid) || 0,
        outstanding: outstandingContrib,
        depositHeld: Number(b.depositHeld) || 0,
        collectAmount: Number(b.collectAmount) || 0,
        refundAmount: Number(b.refundAmount) || 0,
        workerId: b.workerId
      });
    }

    // ── Worker settlement record ───────────────────────────────────────────
    let depositToAdmin = 0;
    let workerBalance = totalCashHandledByWorker;

    if (date && workerId && workerId !== 'All') {
      const settlementRecord = isDbConnected()
        ? await Settlement.findOne({ date, workerId })
        : getSettlements().find(s => s.date === date && s.workerId === workerId);

      if (settlementRecord) {
        depositToAdmin = settlementRecord.depositToAdmin;
        workerBalance = settlementRecord.balance;
      }
    }

    res.json({
      summary: {
        totalBookings,
        totalRevenue,
        totalOutstanding,
        rentalCollections,
        depositCollections,
        depositRefunds,
        netCashCollection: rentalCollections.cash + depositCollections.cash - depositRefunds.cash,
        netCollection: rentalCollections.total + depositCollections.total - depositRefunds.total
      },
      bookings: matchedBookingsList,
      workerSettlement: {
        workerId: workerId || 'All',
        date: date || '',
        totalCashHandled: Math.round(totalCashHandledByWorker),
        depositToAdmin,
        balance: Math.round(workerBalance)
      }
    });
  } catch (error) {
    console.error('[Accounting] Error computing daily summary:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// ─── GET settlements list ─────────────────────────────────────────────────────
router.get('/settlements', async (req, res) => {
  try {
    if (isDbConnected()) {
      const settlements = await Settlement.find().sort({ createdAt: -1 });
      return res.json(settlements);
    }
    res.json(getSettlements().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── POST record worker deposit to admin ──────────────────────────────────────
router.post('/settle', async (req, res) => {
  const { date, workerId, depositAmount, remarks } = req.body;

  if (!date || !workerId || depositAmount === undefined) {
    return res.status(400).json({ message: 'date, workerId, and depositAmount are required.' });
  }

  try {
    const allBookings = isDbConnected() ? await Booking.find() : getBookings();

    // Calculate total cash this worker collected on this date
    // Use workerId stored directly on each payment entry (reliable — no fuzzy timestamp matching)
    let totalCashCollected = 0;

    for (const b of allBookings) {
      // Rental cash payments by this worker today
      for (const p of b.paymentCollection || []) {
        if (safeDateStr(p.timestamp) === date && p.workerId === workerId) {
          const { cash } = getPaymentSplit(p);
          totalCashCollected += cash;
        }
      }

      // Deposit cash collected via revisions by this worker today
      for (const rev of b.revisions || []) {
        if (
          safeDateStr(rev.timestamp) === date &&
          rev.operator === workerId &&
          rev.depositDetails?.difference > 0 &&
          rev.depositDetails?.mode === 'Cash'
        ) {
          totalCashCollected += rev.depositDetails.difference;
        }
      }

      // Deduct cash refunds processed by this worker today
      const returnDateStr = safeDateStr(b.actualReturnDate || b.rentalPeriod?.actualReturnDate);
      const isRefundToday = b.refundDetails?.status === 'Completed' && returnDateStr === date;
      if (isRefundToday && b.refundDetails?.method === 'Cash') {
        const dropOffRev = (b.revisions || []).find(
          r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === date
        );
        const refundOp = dropOffRev?.operator || b.workerId || 'System';
        if (refundOp === workerId) {
          totalCashCollected -= Number(b.refundDetails.amount) || 0;
        }
      }
    }

    if (isDbConnected()) {
      let settlement = await Settlement.findOne({ date, workerId });
      if (!settlement) {
        settlement = new Settlement({ date, workerId, cashCollected: 0, depositToAdmin: 0 });
      }
      settlement.cashCollected = Math.round(totalCashCollected);
      settlement.depositToAdmin += Number(depositAmount);
      if (remarks) settlement.remarks = remarks;
      const saved = await settlement.save();
      return res.json(saved);
    }

    const saved = addSettlement({
      date,
      workerId,
      cashCollected: Math.round(totalCashCollected),
      depositAmount: Number(depositAmount),
      remarks
    });
    res.json(saved);
  } catch (error) {
    console.error('[Accounting] Error recording settlement:', error.message);
    res.status(400).json({ message: error.message });
  }
});

export default router;
