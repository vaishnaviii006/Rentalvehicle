import express from 'express';
import Booking from '../models/Booking.js';
import Settlement from '../models/Settlement.js';
import { 
  isDbConnected, 
  getBookings, 
  getSettlements, 
  addSettlement 
} from '../memoryDb.js';

const safeDateStr = (dateVal) => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch (err) {
    return '';
  }
};

const parseMixedRef = (refStr) => {
  let cash = 0;
  let online = 0;
  let card = 0;
  if (!refStr) return { cash, online, card };
  const cashMatch = refStr.match(/Cash:\s*([\d.]+)/i);
  if (cashMatch) cash = parseFloat(cashMatch[1]) || 0;
  const onlineMatch = refStr.match(/Online:\s*([\d.]+)/i);
  if (onlineMatch) online = parseFloat(onlineMatch[1]) || 0;
  const cardMatch = refStr.match(/Card:\s*([\d.]+)/i);
  if (cardMatch) card = parseFloat(cardMatch[1]) || 0;
  return { cash, online, card };
};

const getPaymentOperator = (p, revisions) => {
  if (!revisions || revisions.length === 0) return 'System';
  let closestRev = null;
  let minDiff = Infinity;
  revisions.forEach(r => {
    if (!r.timestamp) return;
    const diff = Math.abs(new Date(r.timestamp).getTime() - new Date(p.timestamp).getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestRev = r;
    }
  });
  if (minDiff < 15000 && closestRev) {
    return closestRev.operator || 'System';
  }
  return 'System';
};

const router = express.Router();

// GET daily accounting summary with filters
router.get('/', async (req, res) => {
  const { date, workerId, vehicleId } = req.query;

  try {
    let bookingsToAnalyze = [];

    if (isDbConnected()) {
      bookingsToAnalyze = await Booking.find();
    } else {
      bookingsToAnalyze = getBookings();
    }

    // Filter date matches (YYYY-MM-DD)
    const targetDateStr = date || new Date().toISOString().slice(0, 10);

    let totalBookings = 0;
    let totalRevenue = 0;
    let pendingPayments = 0;
    let totalCashHandledByWorker = 0;

    const rentalCollections = { cash: 0, upi: 0, card: 0, total: 0 };
    const depositCollections = { cash: 0, upi: 0, card: 0, total: 0 };
    const depositRefunds = { cash: 0, upi: 0, card: 0, total: 0 };

    const matchedBookingsList = [];

    bookingsToAnalyze.forEach(b => {
      // Gather all activity today
      const todayPayments = b.paymentCollection?.filter(p => safeDateStr(p.timestamp) === targetDateStr) || [];
      const todayRevisions = b.revisions?.filter(r => safeDateStr(r.timestamp) === targetDateStr) || [];
      const returnDateStr = safeDateStr(b.rentalPeriod?.actualReturnDate);
      const isRefundToday = b.refundDetails?.status === 'Completed' && (returnDateStr === targetDateStr || safeDateStr(b.updatedAt || b.createdAt) === targetDateStr);

      if (todayPayments.length === 0 && todayRevisions.length === 0 && !isRefundToday) {
        return; // No activity today
      }

      // Check if workerId filter matches revision operators
      let hasWorkerActivity = false;
      if (!workerId || workerId === 'All') {
        hasWorkerActivity = true;
      } else {
        const hasPaymentByWorker = todayPayments.some(p => {
          const op = getPaymentOperator(p, b.revisions);
          return op === workerId;
        });
        const hasRevisionByWorker = todayRevisions.some(r => r.operator === workerId);
        let hasRefundByWorker = false;
        if (isRefundToday) {
          const dropOffRev = b.revisions?.find(r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === targetDateStr);
          const refundOp = dropOffRev?.operator || b.workerId || 'System';
          hasRefundByWorker = (refundOp === workerId);
        }
        hasWorkerActivity = hasPaymentByWorker || hasRevisionByWorker || hasRefundByWorker;
      }

      if (!hasWorkerActivity) return;

      // Filter vehicle
      if (vehicleId && vehicleId !== 'All' && b.vehicleId !== vehicleId) return;

      // Increment matching count
      totalBookings++;

      // Calculations based on Active Booking Snapshot
      let revenueContrib = b.settlement?.actualBill || b.settlement?.totalBill || b.baseFare || 0;
      totalRevenue += revenueContrib;
      pendingPayments += b.settlement?.remainingToPay || b.outstandingRent || 0;

      // Loop through individual payments matching this day
      todayPayments.forEach(p => {
        const op = getPaymentOperator(p, b.revisions);
        if (workerId && workerId !== 'All' && op !== workerId) return;

        let cash = 0;
        let upi = 0;
        let card = 0;

        if (p.mode === 'Cash') cash = p.amount;
        else if (p.mode === 'Card') card = p.amount;
        else if (['UPI', 'Online', 'Bank Transfer'].includes(p.mode)) upi = p.amount;
        else if (p.mode === 'Mixed') {
          const split = parseMixedRef(p.reference);
          cash = split.cash;
          upi = split.online;
          card = split.card;
        }

        rentalCollections.cash += cash;
        rentalCollections.upi += upi;
        rentalCollections.card += card;
        rentalCollections.total += (cash + upi + card);

        if (op === workerId || !workerId || workerId === 'All') {
          totalCashHandledByWorker += cash;
        }
      });

      // Loop through revisions today to find deposit collections
      todayRevisions.forEach(rev => {
        const op = rev.operator || 'System';
        if (workerId && workerId !== 'All' && op !== workerId) return;

        if (rev.depositDetails && rev.depositDetails.difference > 0) {
          const diff = rev.depositDetails.difference;
          let cash = 0;
          let upi = 0;
          let card = 0;

          if (rev.depositDetails.mode === 'Cash') {
            cash = diff;
          } else if (rev.depositDetails.mode === 'Card') {
            card = diff;
          } else if (['UPI', 'Online'].includes(rev.depositDetails.mode)) {
            upi = diff;
          } else if (rev.depositDetails.mode === 'Mixed') {
            const prevRev = b.revisions.find(r => r.revisionNumber === rev.revisionNumber - 1);
            const curCash = rev.financialSnapshotAfterChange?.paymentBreakdown?.depositCash || 0;
            const prevCash = prevRev ? (prevRev.financialSnapshotAfterChange?.paymentBreakdown?.depositCash || 0) : 0;
            cash = Math.max(0, curCash - prevCash);

            const curOnline = rev.financialSnapshotAfterChange?.paymentBreakdown?.depositOnline || 0;
            const prevOnline = prevRev ? (prevRev.financialSnapshotAfterChange?.paymentBreakdown?.depositOnline || 0) : 0;
            upi = Math.max(0, curOnline - prevOnline);

            const curCard = rev.financialSnapshotAfterChange?.paymentBreakdown?.depositCard || 0;
            const prevCard = prevRev ? (prevRev.financialSnapshotAfterChange?.paymentBreakdown?.depositCard || 0) : 0;
            card = Math.max(0, curCard - prevCard);
          }

          depositCollections.cash += cash;
          depositCollections.upi += upi;
          depositCollections.card += card;
          depositCollections.total += (cash + upi + card);

          if (op === workerId || !workerId || workerId === 'All') {
            totalCashHandledByWorker += cash;
          }
        }
      });

      // Loop through refunds today
      if (isRefundToday) {
        const dropOffRev = b.revisions?.find(r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === targetDateStr);
        const op = dropOffRev?.operator || b.workerId || 'System';
        
        if (!workerId || workerId === 'All' || op === workerId) {
          let cash = 0;
          let upi = 0;
          let card = 0;
          const amt = b.refundDetails.amount || 0;

          if (b.refundDetails.method === 'Cash') {
            cash = amt;
          } else if (b.refundDetails.method === 'Card') {
            card = amt;
          } else if (['UPI', 'Online'].includes(b.refundDetails.method)) {
            upi = amt;
          } else if (b.refundDetails.method === 'Mixed') {
            const split = parseMixedRef(b.refundDetails.notes);
            cash = split.cash;
            upi = split.online;
            card = split.card;
          }

          depositRefunds.cash += cash;
          depositRefunds.upi += upi;
          depositRefunds.card += card;
          depositRefunds.total += (cash + upi + card);

          if (op === workerId || !workerId || workerId === 'All') {
            totalCashHandledByWorker -= cash;
          }
        }
      }

      matchedBookingsList.push({
        bookingId: b.bookingId,
        customerName: b.customer?.name || b.customerName,
        vehicleId: b.vehicleId,
        vehicleName: b.vehicleDetails?.name || b.vehicleName,
        status: b.status,
        totalAmount: revenueContrib,
        paid: b.settlement?.previousPaid || b.rentalPaid || 0,
        pending: b.settlement?.remainingToPay || b.outstandingRent || 0,
        refund: b.settlement?.depositRefund || 0,
        workerId: b.workerId
      });
    });

    // Worker Settlement details
    let depositToAdmin = 0;
    let balance = 0;

    if (date && workerId && workerId !== 'All') {
      if (isDbConnected()) {
        const settlementRecord = await Settlement.findOne({ date, workerId });
        if (settlementRecord) {
          depositToAdmin = settlementRecord.depositToAdmin;
          balance = settlementRecord.balance;
        } else {
          balance = totalCashHandledByWorker;
        }
      } else {
        const settlementRecord = getSettlements().find(s => s.date === date && s.workerId === workerId);
        if (settlementRecord) {
          depositToAdmin = settlementRecord.depositToAdmin;
          balance = settlementRecord.balance;
        } else {
          balance = totalCashHandledByWorker;
        }
      }
    }

    res.json({
      summary: {
        totalBookings,
        totalRevenue,
        rentalCollections,
        depositCollections,
        depositRefunds,
        netCollection: rentalCollections.total - depositRefunds.total
      },
      bookings: matchedBookingsList,
      workerSettlement: {
        workerId: workerId || 'All',
        date: date || '',
        totalCashHandled: totalCashHandledByWorker,
        depositToAdmin,
        balance: date && workerId && workerId !== 'All' ? balance : totalCashHandledByWorker - depositToAdmin
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET settlements list
router.get('/settlements', async (req, res) => {
  try {
    if (isDbConnected()) {
      const settlements = await Settlement.find().sort({ createdAt: -1 });
      res.json(settlements);
    } else {
      res.json(getSettlements().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST record worker deposit to admin
router.post('/settle', async (req, res) => {
  const { date, workerId, depositAmount, remarks } = req.body;

  if (!date || !workerId || depositAmount === undefined) {
    return res.status(400).json({ message: 'date, workerId, and depositAmount are required.' });
  }

  try {
    let bookingsToSettle = [];
    if (isDbConnected()) {
      bookingsToSettle = await Booking.find();
    } else {
      bookingsToSettle = getBookings();
    }

    let totalCashCollected = 0;
    bookingsToSettle.forEach(b => {
      // Rental Cash Collections by this worker on this date
      b.paymentCollection?.forEach(p => {
        const pDateStr = safeDateStr(p.timestamp);
        if (pDateStr === date && p.mode === 'Cash') {
          const op = getPaymentOperator(p, b.revisions);
          if (op === workerId) {
            totalCashCollected += p.amount || 0;
          }
        }
      });

      // Deposit Cash Collections by this worker on this date
      b.revisions?.forEach(rev => {
        const revDateStr = safeDateStr(rev.timestamp);
        if (revDateStr === date && rev.operator === workerId) {
          if (rev.depositDetails && rev.depositDetails.difference > 0 && rev.depositDetails.mode === 'Cash') {
            totalCashCollected += rev.depositDetails.difference;
          }
        }
      });

      // Cash Refund processed by this worker on this date
      const returnDateStr = safeDateStr(b.rentalPeriod?.actualReturnDate);
      const isRefundToday = b.refundDetails?.status === 'Completed' && (returnDateStr === date || safeDateStr(b.updatedAt || b.createdAt) === date);
      if (isRefundToday && b.refundDetails.method === 'Cash') {
        const dropOffRev = b.revisions?.find(r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === date);
        const refundOp = dropOffRev?.operator || b.workerId || 'System';
        if (refundOp === workerId) {
          totalCashCollected -= (b.refundDetails.amount || 0);
        }
      }
    });

    if (isDbConnected()) {
      let settlement = await Settlement.findOne({ date, workerId });
      if (!settlement) {
        settlement = new Settlement({
          date,
          workerId,
          cashCollected: totalCashCollected,
          depositToAdmin: 0,
          remarks: remarks || ''
        });
      }
      settlement.cashCollected = totalCashCollected;
      settlement.depositToAdmin += Number(depositAmount);
      if (remarks) settlement.remarks = remarks;

      const savedSettlement = await settlement.save();
      res.json(savedSettlement);
    } else {
      const savedSettlement = addSettlement({
        date,
        workerId,
        cashCollected: totalCashCollected,
        depositAmount: Number(depositAmount),
        remarks
      });
      res.json(savedSettlement);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
