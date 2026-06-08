import React, { useState, useEffect } from 'react';

// Embedded high-fidelity styles to match your design guidelines
const rawStyles = `
  .hisab-container {
    padding: 24px;
    background: #0f111a;
    color: #f3f4f6;
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
  }
  .hisab-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .hisab-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }
  .hisab-subtitle {
    font-size: 0.9rem;
    color: #9ca3af;
    margin: 4px 0 0 0;
  }
  .hisab-refresh-btn {
    background: transparent;
    border: 1px solid #374151;
    color: #9ca3af;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .hisab-refresh-btn:hover {
    color: #ffffff;
    border-color: #4b5563;
    background: rgba(255,255,255,0.03);
  }
  .hisab-date-picker-bar {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .hisab-date-btn {
    background: #0f172a;
    border: 1px solid #334155;
    color: #94a3b8;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.2s;
  }
  .hisab-date-btn:hover {
    color: #ffffff;
    background: #1e293b;
    border-color: #475569;
  }
  .hisab-date-input-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .hisab-date-input {
    background: #0f172a;
    border: 1px solid #334155;
    color: #ffffff;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.95rem;
    outline: none;
    font-weight: 600;
    cursor: pointer;
  }
  .hisab-date-text {
    font-size: 0.95rem;
    color: #94a3b8;
    font-weight: 500;
  }
  .hisab-date-today-badge {
    background: #2563eb;
    color: #ffffff;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .hisab-date-today-badge:hover {
    background: #1d4ed8;
  }
  .hisab-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  .hisab-kpi-card {
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 110px;
    border: 1px solid transparent;
  }
  .hisab-kpi-card.total-in {
    background: rgba(16, 185, 129, 0.05);
    border-color: rgba(16, 185, 129, 0.2);
  }
  .hisab-kpi-card.total-out {
    background: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.2);
  }
  .hisab-kpi-card.collect {
    background: rgba(245, 158, 11, 0.05);
    border-color: rgba(245, 158, 11, 0.2);
  }
  .hisab-kpi-card.ongoing {
    background: rgba(139, 92, 246, 0.05);
    border-color: rgba(139, 92, 246, 0.2);
  }
  .hisab-kpi-title {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .total-in .hisab-kpi-title { color: #10b981; }
  .total-out .hisab-kpi-title { color: #ef4444; }
  .collect .hisab-kpi-title { color: #f59e0b; }
  .ongoing .hisab-kpi-title { color: #8b5cf6; }
  
  .hisab-kpi-value {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 8px 0;
  }
  .total-in .hisab-kpi-value { color: #10b981; }
  .total-out .hisab-kpi-value { color: #ef4444; }
  .collect .hisab-kpi-value { color: #f59e0b; }
  .ongoing .hisab-kpi-value { color: #8b5cf6; }

  .hisab-kpi-desc {
    font-size: 0.75rem;
    color: #9ca3af;
  }
  .hisab-filters-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 20px;
  }
  .hisab-filters-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .hisab-filters-title {
    font-size: 1rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
  }
  .hisab-filters-badges {
    display: flex;
    gap: 8px;
  }
  .hisab-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .hisab-badge.booked {
    background: rgba(37, 99, 235, 0.15);
    color: #3b82f6;
  }
  .hisab-badge.returned {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }
  .hisab-filters-row {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
  }
  .hisab-select {
    background: #0f172a;
    border: 1px solid #334155;
    color: #ffffff;
    padding: 8px 12px;
    border-radius: 8px;
    outline: none;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .hisab-select:focus {
    border-color: #2563eb;
  }
  .hisab-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }
  .hisab-item-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .hisab-item-card:hover {
    border-color: #475569;
  }
  .hisab-item-header {
    padding: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
  }
  .hisab-item-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .hisab-item-icon {
    font-size: 1.8rem;
    background: rgba(255,255,255,0.03);
    border: 1px solid #334155;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hisab-item-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hisab-item-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hisab-item-title {
    font-size: 1rem;
    font-weight: 600;
    color: #ffffff;
  }
  .hisab-item-reg {
    font-size: 0.8rem;
    color: #94a3b8;
    background: rgba(255,255,255,0.05);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }
  .hisab-item-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .hisab-pill {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .hisab-pill.plan { background: rgba(37, 99, 235, 0.15); color: #3b82f6; }
  .hisab-pill.fuel { border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b; }
  .hisab-pill.location { background: rgba(255,255,255,0.05); color: #94a3b8; }
  .hisab-pill.status-completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
  .hisab-pill.status-ongoing { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
  .hisab-pill.status-reserved { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
  .hisab-pill.new-badge { background: #10b981; color: #ffffff; }
  .hisab-pill.returned-badge { background: #ef4444; color: #ffffff; }

  .hisab-item-right-grid {
    display: flex;
    gap: 24px;
    align-items: center;
    text-align: right;
  }
  .hisab-item-right-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 90px;
  }
  .hisab-item-right-label {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-bottom: 2px;
  }
  .hisab-item-right-val {
    font-size: 0.9rem;
    font-weight: 700;
  }
  .hisab-item-right-subval {
    font-size: 0.65rem;
    color: #64748b;
    margin-top: 1px;
  }

  .hisab-chevron {
    color: #94a3b8;
    font-size: 1.1rem;
    margin-left: 8px;
    transition: transform 0.2s;
  }
  .hisab-chevron.open {
    transform: rotate(180deg);
  }

  .hisab-details-panel {
    background: #0f172a;
    border-top: 1px solid #334155;
    padding: 20px 24px;
    font-size: 0.85rem;
    color: #cbd5e1;
  }
  .hisab-details-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }
  .hisab-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    padding-bottom: 8px;
  }
  .hisab-detail-label {
    color: #94a3b8;
    font-size: 0.85rem;
  }
  .hisab-detail-val {
    font-weight: 600;
    color: #ffffff;
    font-size: 0.85rem;
  }
  .hisab-returned-banner {
    background: rgba(249, 115, 22, 0.08);
    border: 1px solid rgba(249, 115, 22, 0.2);
    color: #f97316;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 600;
    margin-bottom: 16px;
    font-size: 0.9rem;
  }
  .hisab-details-subsections {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
  }
  .hisab-subsec-container {
    border-top: 1px solid #334155;
    padding-top: 12px;
  }
  .hisab-subsec-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
  }
  .hisab-subsec-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hisab-subsec-item {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
  }
  
  .hisab-footer-banner {
    background: rgba(37, 99, 235, 0.05);
    border: 1px dashed rgba(37, 99, 235, 0.2);
    padding: 16px;
    border-radius: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .hisab-footer-left {
    display: flex;
    flex-direction: column;
  }
  .hisab-footer-title {
    font-size: 1rem;
    font-weight: 700;
    color: #ffffff;
  }
  .hisab-footer-desc {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 4px;
  }

  /* Timelines & Snapshot Comparison layout additions */
  .hisab-snapshot-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 20px;
  }
  .hisab-snapshot-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }
  .hisab-snapshot-title {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-bottom: 6px;
    text-transform: uppercase;
    font-weight: 700;
  }
  .hisab-snapshot-compare {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .hisab-snapshot-old {
    color: #ef4444;
    text-decoration: line-through;
  }
  .hisab-snapshot-arrow {
    color: #94a3b8;
  }
  .hisab-snapshot-new {
    color: #10b981;
  }

  .hisab-timeline-three-col {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-top: 20px;
    margin-bottom: 20px;
  }
  @media (max-width: 1024px) {
    .hisab-timeline-three-col {
      grid-template-columns: 1fr;
    }
  }

  .hisab-timeline-container {
    border-left: 2px solid #334155;
    margin-left: 10px;
    padding-left: 16px;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hisab-timeline-item {
    position: relative;
  }
  .hisab-timeline-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #2563eb;
    position: absolute;
    left: -22px;
    top: 5px;
    border: 2px solid #0f172a;
  }
  .hisab-timeline-item.completed .hisab-timeline-dot {
    background: #10b981;
  }
  .hisab-timeline-item.warning .hisab-timeline-dot {
    background: #f59e0b;
  }
  .hisab-timeline-item.danger .hisab-timeline-dot {
    background: #ef4444;
  }
  .hisab-timeline-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 4px;
  }
  .hisab-timeline-time {
    color: #64748b;
    font-size: 0.75rem;
  }
  .hisab-timeline-desc {
    color: #cbd5e1;
    font-size: 0.8rem;
  }
  .hisab-timeline-operator {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-top: 2px;
  }

  .hisab-settlement-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-top: 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 16px;
  }
  .hisab-settlement-cell {
    display: flex;
    flex-direction: column;
  }
  .hisab-settlement-label {
    font-size: 0.7rem;
    color: #94a3b8;
    margin-bottom: 4px;
  }
  .hisab-settlement-val {
    font-size: 0.85rem;
    font-weight: 700;
    color: #ffffff;
  }

  .hisab-group-breakdown {
    border: 1px solid #334155;
    background: rgba(255,255,255,0.01);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
  }
  .hisab-group-title {
    font-size: 0.8rem;
    font-weight: 700;
    color: #cbd5e1;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #334155;
    padding-bottom: 4px;
    display: flex;
    justify-content: space-between;
  }
  .hisab-group-splits {
    font-size: 0.7rem;
    color: #94a3b8;
    font-weight: normal;
  }

  .hisab-activity-summary-row {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    gap: 16px;
    flex-wrap: wrap;
  }
  .hisab-activity-summary-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hisab-activity-summary-stats {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  .hisab-activity-stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
  }
  .hisab-activity-stat-label {
    color: #94a3b8;
  }
  .hisab-activity-stat-value {
    background: rgba(37, 99, 235, 0.15);
    color: #3b82f6;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.85rem;
  }
`;

export default function DailyHisab({ 
  userRole, 
  currentWorker, 
  vehicles, 
  bookings, 
  onRecordDeposit 
}) {
  const isAdmin = userRole === 'admin';

  // Get current local date string (YYYY-MM-DD)
  const getTodayString = () => {
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    return new Date(today - tzOffset).toISOString().slice(0, 10);
  };

  const [dateFilter, setDateFilter] = useState(getTodayString());
  const [workerFilter, setWorkerFilter] = useState(isAdmin ? 'All' : currentWorker);
  const [selectedZone, setSelectedZone] = useState('All Zones');
  const [selectedCategory, setSelectedCategory] = useState('All Vehicle Categories');
  const [selectedFuelType, setSelectedFuelType] = useState('All Fuel Types');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [expandedBookingId, setExpandedBookingId] = useState(null);

  // Accounting fetch & records handover state
  const [hisabData, setHisabData] = useState({
    summary: {
      totalBookings: 0,
      totalRevenue: 0,
      rentalCollections: { cash: 0, upi: 0, card: 0, total: 0 },
      depositCollections: { cash: 0, upi: 0, card: 0, total: 0 },
      depositRefunds: { cash: 0, upi: 0, card: 0, total: 0 },
      netCollection: 0
    },
    bookings: [],
    workerSettlement: {
      workerId: '',
      date: '',
      totalCashHandled: 0,
      depositToAdmin: 0,
      balance: 0
    }
  });

  const [depositAmount, setDepositAmount] = useState('');
  const [depositRemarks, setDepositRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-sync worker simulator choice
  useEffect(() => {
    if (!isAdmin) {
      setWorkerFilter(currentWorker);
    }
  }, [userRole, currentWorker, isAdmin]);

  // Trigger data updates
  useEffect(() => {
    fetchHisabData();
  }, [dateFilter, workerFilter, bookings]);

  // Safe date helper to avoid 500 crashes
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

  // Safe time helper
  const formatTimeDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
    } catch (err) {
      return '';
    }
  };

  // Safe datetime helper for Rental Period
  const formatDateTime = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      
      const day = d.getDate();
      const realMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = realMonthNames[d.getMonth()];
      const year = d.getFullYear();
      
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const formattedHours = hours.toString().padStart(2, '0');
      
      return `${day} ${month} ${year} ${formattedHours}:${minutes} ${ampm}`;
    } catch (err) {
      return '';
    }
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

  // Helper to parse mixed payments split (e.g., "Cash: 100, Online: 200, Card: 300")
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

  const fetchHisabData = async () => {
    setLoading(true);
    try {
      const url = `${import.meta.env.VITE_API_BASE_URL || ''}/api/accounting?date=${dateFilter}&workerId=${workerFilter}&vehicleId=All`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setHisabData(data);
      } else {
        console.warn('Backend accounting API failed. Running local engine calculations.');
        calculateLocalHisab();
      }
    } catch (err) {
      console.error('Error fetching accounting summary:', err);
      calculateLocalHisab();
    } finally {
      setLoading(false);
    }
  };

  const calculateLocalHisab = () => {
    let totalBookings = 0;
    let totalRevenue = 0;
    let totalCashHandledByWorker = 0;

    const rentalCollections = { cash: 0, upi: 0, card: 0, total: 0 };
    const depositCollections = { cash: 0, upi: 0, card: 0, total: 0 };
    const depositRefunds = { cash: 0, upi: 0, card: 0, total: 0 };

    const matchedBookingsList = [];

    bookings.forEach(b => {
      const todayPayments = b.paymentCollection?.filter(p => safeDateStr(p.timestamp) === dateFilter) || [];
      const todayRevisions = b.revisions?.filter(r => safeDateStr(r.timestamp) === dateFilter) || [];
      const returnDateStr = safeDateStr(b.actualReturnDate || b.rentalPeriod?.actualReturnDate);
      const isRefundToday = b.refundDetails?.status === 'Completed' && (returnDateStr === dateFilter || safeDateStr(b.updatedAt || b.createdAt) === dateFilter);

      if (todayPayments.length === 0 && todayRevisions.length === 0 && !isRefundToday) {
        return;
      }

      // Check if workerFilter matches
      let hasWorkerActivity = false;
      if (workerFilter === 'All') {
        hasWorkerActivity = true;
      } else {
        const hasPaymentByWorker = todayPayments.some(p => {
          const op = getPaymentOperator(p, b.revisions);
          return op === workerFilter;
        });
        const hasRevisionByWorker = todayRevisions.some(r => r.operator === workerFilter);
        let hasRefundByWorker = false;
        if (isRefundToday) {
          const dropOffRev = b.revisions?.find(r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === dateFilter);
          const refundOp = dropOffRev?.operator || b.workerId || 'System';
          hasRefundByWorker = (refundOp === workerFilter);
        }
        hasWorkerActivity = hasPaymentByWorker || hasRevisionByWorker || hasRefundByWorker;
      }

      if (!hasWorkerActivity) return;

      totalBookings++;
      let revenueContrib = b.settlement?.actualBill || b.settlement?.totalBill || b.baseFare || 0;
      totalRevenue += revenueContrib;

      // Loop through individual payments
      todayPayments.forEach(p => {
        const op = getPaymentOperator(p, b.revisions);
        if (workerFilter !== 'All' && op !== workerFilter) return;

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

        if (op === workerFilter || workerFilter === 'All') {
          totalCashHandledByWorker += cash;
        }
      });

      // Loop through revisions today to find deposit collections
      todayRevisions.forEach(rev => {
        const op = rev.operator || 'System';
        if (workerFilter !== 'All' && op !== workerFilter) return;

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

          if (op === workerFilter || workerFilter === 'All') {
            totalCashHandledByWorker += cash;
          }
        }
      });

      // Loop through refunds today
      if (isRefundToday) {
        const dropOffRev = b.revisions?.find(r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === dateFilter);
        const op = dropOffRev?.operator || b.workerId || 'System';

        if (workerFilter === 'All' || op === workerFilter) {
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

          if (op === workerFilter || workerFilter === 'All') {
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

    setHisabData(prev => {
      const depositToAdmin = prev.workerSettlement?.depositToAdmin || 0;
      return {
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
          workerId: workerFilter,
          date: dateFilter,
          totalCashHandled: totalCashHandledByWorker,
          depositToAdmin,
          balance: totalCashHandledByWorker - depositToAdmin
        }
      };
    });
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (!depositAmount || Number(depositAmount) <= 0) {
      return alert('Please enter a valid deposit amount.');
    }
    if (workerFilter === 'All') {
      return alert('Please select a specific worker to record a deposit.');
    }

    try {
      const response = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/accounting/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateFilter,
          workerId: workerFilter,
          depositAmount: Number(depositAmount),
          remarks: depositRemarks
        })
      });

      if (response.ok) {
        setDepositAmount('');
        setDepositRemarks('');
        alert(`Successfully recorded deposit of ₹${depositAmount} from ${workerFilter}!`);
        fetchHisabData();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (err) {
      console.warn('Network offline: Recording deposit locally.');
      onRecordDeposit(dateFilter, workerFilter, Number(depositAmount), depositRemarks);
      setHisabData(prev => {
        const dep = prev.workerSettlement.depositToAdmin + Number(depositAmount);
        return {
          ...prev,
          workerSettlement: {
            ...prev.workerSettlement,
            depositToAdmin: dep,
            balance: prev.workerSettlement.totalCashHandled - dep
          }
        };
      });
      setDepositAmount('');
      setDepositRemarks('');
      alert(`Local Mode: Handover of ₹${depositAmount} logged successfully.`);
    }
  };

  const handlePrevDate = () => {
    const d = new Date(dateFilter);
    d.setDate(d.getDate() - 1);
    const tzOffset = d.getTimezoneOffset() * 60000;
    setDateFilter(new Date(d - tzOffset).toISOString().slice(0, 10));
    setExpandedBookingId(null);
  };

  const handleNextDate = () => {
    const d = new Date(dateFilter);
    d.setDate(d.getDate() + 1);
    const tzOffset = d.getTimezoneOffset() * 60000;
    setDateFilter(new Date(d - tzOffset).toISOString().slice(0, 10));
    setExpandedBookingId(null);
  };

  // Helper date text formatter
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Helper to get booking snapshot summary
  const getSnapshotDetails = (b) => {
    const originalPlan = b.revisions && b.revisions.length > 0 ? (b.revisions[0].selectedPlan?.planType || b.revisions[0].financialSnapshotAfterChange?.planType || b.selectedPlan?.planType) : b.selectedPlan?.planType;
    const currentPlan = b.selectedPlan?.planType;

    const getDurationHrs = (rev) => {
      if (!rev) return 0;
      return rev.durationHours || (rev.durationDays * 24) || 0;
    };
    const originalDuration = b.revisions && b.revisions.length > 0 ? getDurationHrs(b.revisions[0]) : (b.durationHours || b.durationDays * 24 || 0);
    const currentDuration = b.durationHours || b.durationDays * 24 || 0;

    const originalDeposit = b.revisions && b.revisions.length > 0 ? (b.revisions[0].securityDeposit || b.revisions[0].depositHeld || 0) : (b.securityDeposit || 0);
    const currentDeposit = b.securityDeposit || 0;

    return {
      originalPlan,
      currentPlan,
      originalDuration,
      currentDuration,
      originalDeposit,
      currentDeposit
    };
  };

  // Helper to extract booking modifications log
  const getModificationSummary = (b) => {
    const logs = [];
    if (!b.revisions || b.revisions.length === 0) return ["No revisions logged."];

    b.revisions.forEach((rev, idx) => {
      const dateStr = formatDateTime(rev.timestamp);
      const op = rev.operator || 'System';
      
      if (rev.actionType === 'CustomerDetailsUpdated') {
        logs.push(`[${dateStr}] Customer details updated by ${op}`);
      } else if (rev.actionType === 'BookingDetailsUpdated') {
        logs.push(`[${dateStr}] Booking plan / details updated by ${op}`);
      } else if (rev.actionType === 'RentalCostChanged') {
        logs.push(`[${dateStr}] Rental cost changed by ${op} (New: ₹${rev.financialSnapshotAfterChange?.baseFare || 0})`);
      } else if (rev.actionType === 'DepositChanged') {
        const diff = rev.depositDetails?.difference || 0;
        logs.push(`[${dateStr}] Deposit changed by ${op} (${diff >= 0 ? '+' : ''}₹${diff})`);
      } else if (rev.actionType === 'Extend') {
        const hrs = rev.durationHours || 0;
        logs.push(`[${dateStr}] Extended plan by ${op} (Duration increased to ${hrs} hrs)`);
      } else if (rev.actionType === 'Replace') {
        const oldV = rev.replacementDetails?.oldVehicleReg || 'previous vehicle';
        const newV = rev.replacementDetails?.newVehicleReg || 'new vehicle';
        logs.push(`[${dateStr}] Swapped vehicle from ${oldV} to ${newV} by ${op}`);
      } else if (rev.actionType === 'Pickup') {
        logs.push(`[${dateStr}] Vehicle picked up by ${op}`);
      } else if (rev.actionType === 'DropOff') {
        logs.push(`[${dateStr}] Drop-off completed and settled by ${op}`);
      }
    });

    return logs.length > 0 ? logs : ["No modifications recorded."];
  };

  // Helper to get operational activity timeline
  const getActivityTimeline = (b) => {
    const timeline = [];
    if (!b.revisions || b.revisions.length === 0) {
      timeline.push({
        time: formatDateTime(b.createdAt),
        title: 'Booking Created',
        desc: `Booking VB-${b.bookingId} reserved. Plan: ${b.selectedPlan?.planType || '24-Hour'}`,
        operator: b.workerId || 'System',
        status: 'warning'
      });
      if (b.actualPickupDate || b.rentalPeriod?.actualPickupDate) {
        timeline.push({
          time: formatDateTime(b.actualPickupDate || b.rentalPeriod.actualPickupDate),
          title: 'Picked Up',
          desc: `Vehicle issued to customer. Meter: ${b.handover?.startMeter || 0} KM.`,
          operator: b.handover?.operator || b.workerId || 'System',
          status: 'completed'
        });
      }
      if (b.status === 'Completed') {
        timeline.push({
          time: formatDateTime(b.actualReturnDate || b.rentalPeriod?.actualReturnDate),
          title: 'Dropped Off',
          desc: `Vehicle returned. End Meter: ${b.dropDetails?.endMeter || 0} KM.`,
          operator: b.dropDetails?.operator || b.workerId || 'System',
          status: 'completed'
        });
      }
      return timeline;
    }

    b.revisions.forEach((rev) => {
      let title = '';
      let desc = '';
      let status = 'warning';

      if (rev.actionType === 'Pickup') {
        title = 'Vehicle Issued (Pickup)';
        desc = `Vehicle handed over. Start Meter: ${rev.financialSnapshotAfterChange?.handover?.startMeter || b.handover?.startMeter || 0} KM.`;
        status = 'completed';
      } else if (rev.actionType === 'Extend') {
        title = 'Booking Extended';
        desc = `Extended rental duration. New expected drop: ${formatDateTime(rev.financialSnapshotAfterChange?.rentalPeriod?.expectedEndDate)}.`;
        status = 'completed';
      } else if (rev.actionType === 'Replace') {
        title = 'Vehicle Swapped';
        desc = `Replaced vehicle. Reason: ${rev.description || rev.remarks || 'Routine Swap'}.`;
        status = 'completed';
      } else if (rev.actionType === 'DropOff') {
        title = 'Completed Return';
        desc = `Vehicle drop-off completed. Final meter: ${b.dropDetails?.endMeter || 0} KM.`;
        status = 'completed';
      } else {
        return; // skip other updates in this view
      }

      timeline.push({
        time: formatDateTime(rev.timestamp),
        title,
        desc,
        operator: rev.operator || 'System',
        status
      });
    });

    return timeline;
  };

  // Helper to extract payment journey timeline
  const getPaymentTimeline = (b) => {
    const timeline = [];
    if (!b.paymentCollection || b.paymentCollection.length === 0) return [];

    b.paymentCollection.forEach(p => {
      const op = getPaymentOperator(p, b.revisions);
      timeline.push({
        time: formatDateTime(p.timestamp),
        title: `Payment Collected (${p.mode})`,
        desc: `Amount: ₹${p.amount.toLocaleString()} ${p.reference ? `[Ref: ${p.reference}]` : ''}`,
        operator: op,
        status: 'completed'
      });
    });

    if (b.refundDetails?.status === 'Completed' && b.refundDetails.amount > 0) {
      timeline.push({
        time: formatDateTime(b.refundDetails.timestamp || b.actualReturnDate || b.rentalPeriod?.actualReturnDate || b.updatedAt),
        title: `Refund Processed (${b.refundDetails.method})`,
        desc: `Amount: ₹${b.refundDetails.amount.toLocaleString()} [Notes: ${b.refundDetails.notes || 'Drop-off Refund'}]`,
        operator: b.dropDetails?.operator || b.workerId || 'System',
        status: 'danger'
      });
    }

    return timeline;
  };

  // Helper to extract deposit state transition timeline
  const getDepositTimeline = (b) => {
    const timeline = [];
    let cumulativeDeposit = 0;

    if (b.revisions && b.revisions.length > 0) {
      b.revisions.forEach((rev) => {
        const dateStr = formatDateTime(rev.timestamp);
        const op = rev.operator || 'System';

        if (rev.actionType === 'Pickup' || rev.revisionNumber === 1) {
          const initDep = rev.financialSnapshotAfterChange?.securityDeposit || rev.depositDetails?.cashAmount + rev.depositDetails?.onlineAmount || b.securityDeposit || 0;
          cumulativeDeposit = initDep;
          timeline.push({
            time: dateStr,
            title: 'Initial Deposit Received',
            desc: `Deposit collected: ₹${initDep.toLocaleString()} (${rev.depositDetails?.mode || b.depositDetails?.mode || 'Cash'})`,
            operator: op,
            status: 'warning'
          });
        } else if (rev.actionType === 'Extend' && rev.depositDetails?.difference > 0) {
          const diff = rev.depositDetails.difference;
          cumulativeDeposit += diff;
          timeline.push({
            time: dateStr,
            title: 'Extension Deposit Increase',
            desc: `Deposit increased by +₹${diff.toLocaleString()} during extension`,
            operator: op,
            status: 'warning'
          });
        } else if (rev.actionType === 'Replace' && rev.depositDetails?.difference > 0) {
          const diff = rev.depositDetails.difference;
          cumulativeDeposit += diff;
          timeline.push({
            time: dateStr,
            title: 'Replacement Deposit Increase',
            desc: `Deposit increased by +₹${diff.toLocaleString()} during vehicle swap`,
            operator: op,
            status: 'warning'
          });
        } else if ((rev.actionType === 'DepositChanged' || rev.actionType === 'DepositChange') && rev.depositDetails?.difference !== 0) {
          const diff = rev.depositDetails.difference;
          cumulativeDeposit += diff;
          timeline.push({
            time: dateStr,
            title: 'Manual Deposit Change',
            desc: `Deposit adjusted: ${diff >= 0 ? '+' : ''}₹${diff.toLocaleString()}`,
            operator: op,
            status: 'warning'
          });
        }
      });
    } else {
      const depAmt = b.securityDeposit || 0;
      cumulativeDeposit = depAmt;
      timeline.push({
        time: formatDateTime(b.createdAt),
        title: 'Initial Deposit Received',
        desc: `Deposit collected: ₹${depAmt.toLocaleString()} (${b.depositDetails?.mode || 'Cash'})`,
        operator: b.workerId || 'System',
        status: 'warning'
      });
    }

    if (b.status === 'Completed') {
      const dateStr = formatDateTime(b.actualReturnDate || b.rentalPeriod?.actualReturnDate || b.updatedAt);
      const op = b.dropDetails?.operator || b.workerId || 'System';

      if (b.settlement?.depositAdjusted > 0) {
        timeline.push({
          time: dateStr,
          title: 'Deposit Adjusted (Rent Due)',
          desc: `Adjusted: -₹${b.settlement.depositAdjusted.toLocaleString()} applied to rent outstanding`,
          operator: op,
          status: 'warning'
        });
      }
      if (b.settlement?.depositRefund > 0) {
        timeline.push({
          time: dateStr,
          title: 'Deposit Refunded',
          desc: `Security deposit returned to customer: -₹${b.settlement.depositRefund.toLocaleString()}`,
          operator: op,
          status: 'danger'
        });
      }
    }

    return timeline;
  };

  // Helper to extract settlement summary metrics
  const getSettlementSummary = (b) => {
    const actualRentalBill = b.settlement?.actualBill || b.settlement?.totalBill || b.baseFare || 0;
    const rentalPaid = b.settlement?.previousPaid || b.rentalPaid || 0;
    const rentalDue = b.settlement?.remainingToPay || b.outstandingRent || 0;
    const depositHeld = b.settlement?.depositCollected || b.securityDeposit || 0;
    const depositAdjusted = b.settlement?.depositAdjusted || 0;
    const depositRefunded = b.settlement?.depositRefund || 0;
    const finalCollection = b.settlement?.finalCollection || 0;
    const finalRefund = b.refundDetails?.status === 'Completed' ? b.refundDetails.amount : 0;

    return {
      actualRentalBill,
      rentalPaid,
      rentalDue,
      depositHeld,
      depositAdjusted,
      depositRefunded,
      finalCollection,
      finalRefund
    };
  };

  // Helper to extract collections & refunds breakdown
  const getCollectionsRefundsBreakdown = (b) => {
    const rentals = [];
    const deposits = [];
    const refunds = [];

    b.paymentCollection?.forEach(p => {
      if (safeDateStr(p.timestamp) === dateFilter) {
        let cash = 0, upi = 0, card = 0;
        if (p.mode === 'Cash') cash = p.amount;
        else if (p.mode === 'Card') card = p.amount;
        else if (['UPI', 'Online', 'Bank Transfer'].includes(p.mode)) upi = p.amount;
        else if (p.mode === 'Mixed') {
          const split = parseMixedRef(p.reference);
          cash = split.cash;
          upi = split.online;
          card = split.card;
        }

        rentals.push({
          time: formatTimeDisplay(p.timestamp),
          mode: p.mode,
          amount: p.amount,
          cash,
          upi,
          card,
          reference: p.reference,
          operator: getPaymentOperator(p, b.revisions)
        });
      }
    });

    b.revisions?.forEach(rev => {
      if (safeDateStr(rev.timestamp) === dateFilter && rev.depositDetails && rev.depositDetails.difference > 0) {
        const diff = rev.depositDetails.difference;
        let cash = 0, upi = 0, card = 0;

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

        deposits.push({
          time: formatTimeDisplay(rev.timestamp),
          mode: rev.depositDetails.mode,
          amount: diff,
          cash,
          upi,
          card,
          operator: rev.operator || 'System'
        });
      }
    });

    const returnDateStr = safeDateStr(b.actualReturnDate || b.rentalPeriod?.actualReturnDate);
    const isRefundToday = b.refundDetails?.status === 'Completed' && (returnDateStr === dateFilter || safeDateStr(b.updatedAt || b.createdAt) === dateFilter);
    if (isRefundToday) {
      const amt = b.refundDetails.amount || 0;
      let cash = 0, upi = 0, card = 0;
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

      refunds.push({
        time: formatTimeDisplay(b.refundDetails.timestamp || b.actualReturnDate || b.rentalPeriod?.actualReturnDate || b.updatedAt),
        mode: b.refundDetails.method,
        amount: amt,
        cash,
        upi,
        card,
        notes: b.refundDetails.notes,
        operator: b.dropDetails?.operator || b.workerId || 'System'
      });
    }

    return { rentals, deposits, refunds };
  };

  // 1. Gather all active bookings that have date-related actions today
  const activeBookings = bookings.filter(b => {
    const createdDateStr = safeDateStr(b.createdAt);
    const pickupDateStr = safeDateStr(b.actualPickupDate || b.rentalPeriod?.actualPickupDate);
    const returnDateStr = safeDateStr(b.actualReturnDate || b.rentalPeriod?.actualReturnDate);

    const todayPayments = b.paymentCollection?.filter(p => safeDateStr(p.timestamp) === dateFilter) || [];
    const todayRevisions = b.revisions?.filter(r => safeDateStr(r.timestamp) === dateFilter) || [];
    const isRefundToday = b.refundDetails?.status === 'Completed' && (returnDateStr === dateFilter || safeDateStr(b.updatedAt || b.createdAt) === dateFilter);

    // If no activity today, exclude it
    if (todayPayments.length === 0 && todayRevisions.length === 0 && createdDateStr !== dateFilter && pickupDateStr !== dateFilter && returnDateStr !== dateFilter && !isRefundToday) {
      return false;
    }

    // Filter worker profile
    if (workerFilter && workerFilter !== 'All') {
      const hasPaymentByWorker = todayPayments.some(p => {
        const op = getPaymentOperator(p, b.revisions);
        return op === workerFilter;
      });
      const hasRevisionByWorker = todayRevisions.some(r => r.operator === workerFilter);
      let hasRefundByWorker = false;
      if (isRefundToday) {
        const dropOffRev = b.revisions?.find(r => r.actionType === 'DropOff' && safeDateStr(r.timestamp) === dateFilter);
        const refundOp = dropOffRev?.operator || b.workerId || 'System';
        hasRefundByWorker = (refundOp === workerFilter);
      }
      const createdByWorker = createdDateStr === dateFilter && (b.workerId === workerFilter);
      const pickupByWorker = pickupDateStr === dateFilter && (b.handover?.operator === workerFilter || b.workerId === workerFilter);
      const returnByWorker = returnDateStr === dateFilter && (b.dropDetails?.operator === workerFilter || b.workerId === workerFilter);

      if (!hasPaymentByWorker && !hasRevisionByWorker && !hasRefundByWorker && !createdByWorker && !pickupByWorker && !returnByWorker) {
        return false;
      }
    }

    return true;
  });

  // Calculate high-fidelity metrics
  let bookingsCreatedCount = 0;
  let returnsTodayCount = 0;
  let todayEarnings = 0;

  activeBookings.forEach(b => {
    const createdDateStr = safeDateStr(b.createdAt);
    const returnDateStr = safeDateStr(b.actualReturnDate || b.rentalPeriod?.actualReturnDate);

    if (createdDateStr === dateFilter) {
      bookingsCreatedCount++;
    }
    if (returnDateStr === dateFilter && b.status === 'Completed') {
      returnsTodayCount++;
      const actualBill = b.settlement?.actualBill || b.settlement?.totalBill || b.baseFare || 0;
      todayEarnings += actualBill;
    }
  });

  // Count active ongoing bookings
  const ongoingBookingsCount = bookings.filter(b => b.status === 'Ongoing').length;

  // Compute Daily Activity Summary counts from revisions today
  let extensionsCount = 0;
  let swapsCount = 0;
  let editsCount = 0;
  let collectionsCount = 0;
  let dropOffsCount = 0;

  bookings.forEach(b => {
    const todayPayments = b.paymentCollection?.filter(p => {
      const matchDate = safeDateStr(p.timestamp) === dateFilter;
      if (!matchDate) return false;
      if (workerFilter && workerFilter !== 'All') {
        const op = getPaymentOperator(p, b.revisions);
        return op === workerFilter;
      }
      return true;
    }) || [];

    collectionsCount += todayPayments.length;

    const todayRevisions = b.revisions?.filter(r => {
      const matchDate = safeDateStr(r.timestamp) === dateFilter;
      if (!matchDate) return false;
      if (workerFilter && workerFilter !== 'All' && r.operator !== workerFilter) return false;
      return true;
    }) || [];

    todayRevisions.forEach(r => {
      if (r.actionType === 'Extend') {
        extensionsCount++;
      } else if (r.actionType === 'Replace') {
        swapsCount++;
      } else if (['CustomerDetailsUpdated', 'BookingDetailsUpdated', 'RentalCostChanged', 'DepositChanged'].includes(r.actionType)) {
        editsCount++;
      } else if (r.actionType === 'DropOff') {
        dropOffsCount++;
      }

      if (r.depositDetails && r.depositDetails.difference > 0) {
        collectionsCount++;
      }
    });
  });

  // Calculate worker cash outstanding balance
  const cashInTotal = (hisabData.summary.rentalCollections?.cash || 0) + (hisabData.summary.depositCollections?.cash || 0);
  const cashOutTotal = hisabData.summary.depositRefunds?.cash || 0;
  const outstandingHandover = hisabData.workerSettlement?.balance || 0;

  // Apply visual dropdown filters
  const filteredBookings = activeBookings.filter(b => {
    const vehicle = vehicles.find(v => v.vehicleId === b.vehicleId);

    // Zone Filter
    const zone = vehicle?.locationDetails?.currentZone || vehicle?.location || b.pickupLocation || 'Vijay Nagar';
    if (selectedZone !== 'All Zones' && zone !== selectedZone) return false;

    // Category Filter
    const category = vehicle?.category || b.vehicleDetails?.category || vehicle?.type || 'Car';
    if (selectedCategory !== 'All Vehicle Categories' && category !== selectedCategory) return false;

    // Fuel Type Filter
    const fuel = vehicle?.fuelType || 'Petrol';
    if (selectedFuelType !== 'All Fuel Types' && fuel !== selectedFuelType) return false;

    // Status Filter
    if (selectedStatus !== 'All Status' && b.status !== selectedStatus) return false;

    return true;
  });

  return (
    <div className="hisab-container animate-slide-up">
      <style dangerouslySetInnerHTML={{ __html: rawStyles }} />

      {/* 1. MODULE TITLE & HEADER */}
      <div className="hisab-header-row">
        <div>
          <h1 className="hisab-title">Daily Hisab</h1>
          <p className="hisab-subtitle">Financial ledger</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="hisab-refresh-btn" title="Refresh Data" onClick={fetchHisabData} disabled={loading}>
            🔄
          </button>
        </div>
      </div>

      {/* 2. SLICK NAVIGATION BAR */}
      <div className="hisab-date-picker-bar">
        <button className="hisab-date-btn" onClick={handlePrevDate}>&lt;</button>
        
        <div className="hisab-date-input-wrapper">
          <input 
            type="date" 
            className="hisab-date-input" 
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setExpandedBookingId(null); }}
          />
          <span className="hisab-date-text">{formatDateDisplay(dateFilter)}</span>
          {dateFilter === getTodayString() && (
            <span className="hisab-date-today-badge" onClick={() => setDateFilter(getTodayString())}>Today</span>
          )}
        </div>

        <button className="hisab-date-btn" onClick={handleNextDate}>&gt;</button>
      </div>

      {/* 3. Sleek Financial KPI Cards Grid */}
      <div className="hisab-kpi-grid">
        {/* TODAY'S BOOKINGS */}
        <div className="hisab-kpi-card collect">
          <span className="hisab-kpi-title">📅 Today's Bookings</span>
          <span className="hisab-kpi-value">{bookingsCreatedCount}</span>
          <div className="hisab-kpi-desc">
            Bookings created on selected date
          </div>
        </div>

        {/* TODAY'S COMPLETED */}
        <div className="hisab-kpi-card total-in">
          <span className="hisab-kpi-title">✅ Today's Completed</span>
          <span className="hisab-kpi-value">{returnsTodayCount}</span>
          <div className="hisab-kpi-desc">
            Bookings completed on selected date
          </div>
        </div>

        {/* TODAY'S EARNINGS */}
        <div className="hisab-kpi-card total-in">
          <span className="hisab-kpi-title">💰 Today's Earnings</span>
          <span className="hisab-kpi-value">₹{todayEarnings.toLocaleString()}</span>
          <div className="hisab-kpi-desc">
            Sum of completed Actual Rental Bills
          </div>
        </div>

        {/* ONGOING BOOKINGS */}
        <div className="hisab-kpi-card ongoing">
          <span className="hisab-kpi-title">⚡ Ongoing Bookings</span>
          <span className="hisab-kpi-value">{ongoingBookingsCount}</span>
          <div className="hisab-kpi-desc">
            Active ongoing bookings count
          </div>
        </div>
      </div>

      {/* Daily Activity Summary Row */}
      <div className="hisab-activity-summary-row">
        <span className="hisab-activity-summary-title">📊 Daily Activity Summary ({workerFilter === 'All' ? 'All Workers' : workerFilter})</span>
        <div className="hisab-activity-summary-stats">
          <div className="hisab-activity-stat-item">
            <span className="hisab-activity-stat-label">Extensions:</span>
            <span className="hisab-activity-stat-value">{extensionsCount}</span>
          </div>
          <div className="hisab-activity-stat-item">
            <span className="hisab-activity-stat-label">Swaps:</span>
            <span className="hisab-activity-stat-value">{swapsCount}</span>
          </div>
          <div className="hisab-activity-stat-item">
            <span className="hisab-activity-stat-label">Edits:</span>
            <span className="hisab-activity-stat-value">{editsCount}</span>
          </div>
          <div className="hisab-activity-stat-item">
            <span className="hisab-activity-stat-label">Collections:</span>
            <span className="hisab-activity-stat-value">{collectionsCount}</span>
          </div>
          <div className="hisab-activity-stat-item">
            <span className="hisab-activity-stat-label">Drop-Offs:</span>
            <span className="hisab-activity-stat-value">{dropOffsCount}</span>
          </div>
        </div>
      </div>

      {/* 4. FILTER CARDS */}
      <div className="hisab-filters-card">
        <div className="hisab-filters-header">
          <h3 className="hisab-filters-title">Transactions ({filteredBookings.length})</h3>
          <div className="hisab-filters-badges">
            <span className="hisab-badge booked">Booked: {bookingsCreatedCount}</span>
            <span className="hisab-badge returned">Returned: {returnsTodayCount}</span>
          </div>
        </div>

        <div className="hisab-filters-row">
          {/* Zone filter */}
          <select className="hisab-select" value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
            <option value="All Zones">All Zones</option>
            <option value="Vijay Nagar">Vijay Nagar</option>
            <option value="Bhawarkua">Bhawarkua</option>
            <option value="Rajendra Nagar">Rajendra Nagar</option>
            <option value="Palasia">Palasia</option>
          </select>

          {/* Vehicle Category filter */}
          <select className="hisab-select" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="All Vehicle Categories">All Categories</option>
            <option value="Bike">Bike</option>
            <option value="Scooty">Scooty</option>
            <option value="Car">Car</option>
            <option value="EV">EV</option>
          </select>

          {/* Fuel type filter */}
          <select className="hisab-select" value={selectedFuelType} onChange={e => setSelectedFuelType(e.target.value)}>
            <option value="All Fuel Types">All Fuel Types</option>
            <option value="Petrol">Petrol</option>
            <option value="Diesel">Diesel</option>
            <option value="CNG">CNG</option>
            <option value="EV">EV</option>
            <option value="Petrol + CNG">Petrol + CNG</option>
          </select>

          {/* Status filter */}
          <select className="hisab-select" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
            <option value="All Status">All Status</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Extended">Extended</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Reserved">Reserved</option>
          </select>

          {/* Worker Filter (Admins only) */}
          <select 
            className="hisab-select" 
            value={workerFilter} 
            onChange={e => setWorkerFilter(e.target.value)}
            disabled={!isAdmin}
          >
            {isAdmin && <option value="All">All Workers</option>}
            <option value="Ramesh Kumar">Ramesh Kumar</option>
            <option value="Suresh Singh">Suresh Singh</option>
          </select>
        </div>
      </div>

      {/* 5. Sleek Collapsible Transaction Cards List */}
      <div className="hisab-list">
        {filteredBookings.map(b => {
          const vehicle = vehicles.find(v => v.vehicleId === b.vehicleId);
          const category = vehicle?.category || b.vehicleDetails?.category || vehicle?.type || 'Car';
          const zone = vehicle?.locationDetails?.currentZone || vehicle?.location || b.pickupLocation || 'Vijay Nagar';
          const fuel = vehicle?.fuelType || 'Petrol';

          const isNewBooking = safeDateStr(b.createdAt) === dateFilter;
          const isReturnBooking = safeDateStr(b.actualReturnDate || b.rentalPeriod?.actualReturnDate) === dateFilter && b.status === 'Completed';

          // 1. Cumulative Security Deposit Held (using priority sequence depositHeld -> depositCollected -> securityDeposit)
          const depAmt = b.depositHeld || b.settlement?.depositCollected || b.securityDeposit || 0;
          let depCash = b.depositDetails?.cashAmount || 0;
          let depOnline = b.depositDetails?.onlineAmount || 0;
          let depCard = b.depositDetails?.cardAmount || 0;
          if (depCash === 0 && depOnline === 0 && depCard === 0 && depAmt > 0) {
            const mode = b.depositDetails?.mode || 'Cash';
            if (mode === 'Card') {
              depCard = depAmt;
            } else if (['Online', 'UPI', 'Card', 'Bank Transfer'].includes(mode)) {
              depOnline = depAmt;
            } else {
              depCash = depAmt; // default to Cash
            }
          }

          // 2. Additional Collection (at drop-off)
          const collectAmount = b.settlement?.collectAmount || 0;
          let additionalCash = 0;
          let additionalOnline = 0;
          let additionalCard = 0;
          if (collectAmount > 0 && b.paymentCollection && b.paymentCollection.length > 0) {
            // Find corresponding payment matching collectAmount
            const matchingPayment = [...b.paymentCollection].reverse().find(p => p.amount === collectAmount);
            if (matchingPayment) {
              if (matchingPayment.mode === 'Cash') {
                additionalCash = collectAmount;
              } else if (matchingPayment.mode === 'Card') {
                additionalCard = collectAmount;
              } else if (matchingPayment.mode === 'Mixed') {
                const split = parseMixedRef(matchingPayment.reference || matchingPayment.notes);
                additionalCash = split.cash;
                additionalOnline = split.online;
                additionalCard = split.card;
              } else {
                additionalOnline = collectAmount;
              }
            } else {
              additionalCash = collectAmount; // default fallback
            }
          }

          // 3. Cumulative rental payments collected from the customer
          let totalRentalCollected = 0;
          let totalRentalCash = 0;
          let totalRentalOnline = 0;
          let totalRentalCard = 0;
          b.paymentCollection?.forEach(p => {
            const amt = p.amount || 0;
            totalRentalCollected += amt;
            if (p.mode === 'Cash') {
              totalRentalCash += amt;
            } else if (p.mode === 'Card') {
              totalRentalCard += amt;
            } else if (p.mode === 'Mixed') {
              const split = parseMixedRef(p.reference || p.notes);
              totalRentalCash += split.cash;
              totalRentalOnline += split.online;
              totalRentalCard += split.card;
            } else {
              totalRentalOnline += amt;
            }
          });

          // Fallback if paymentCollection is empty or under-reports compared to rentalPaid/advancePaid
          const rentalPaidFallback = b.rentalPaid || b.advancePaid || 0;
          if (totalRentalCollected < rentalPaidFallback) {
            totalRentalCollected = rentalPaidFallback;
            totalRentalCash = b.cashAmount || 0;
            totalRentalOnline = b.onlineAmount || 0;
            totalRentalCard = b.cardAmount || 0;
            if (totalRentalCash === 0 && totalRentalOnline === 0 && totalRentalCard === 0) {
              const mode = b.paymentMode || b.paymentMethod || 'Cash';
              if (mode === 'Card') {
                totalRentalCard = rentalPaidFallback;
              } else if (['Online', 'UPI', 'Card', 'Bank Transfer'].includes(mode)) {
                totalRentalOnline = rentalPaidFallback;
              } else {
                totalRentalCash = rentalPaidFallback;
              }
            }
          }

          // Subtract drop-off collection from rental collection to prevent double counting
          const rentalTotal = Math.max(0, totalRentalCollected - collectAmount);
          const rentalCash = Math.max(0, totalRentalCash - additionalCash);
          const rentalOnline = Math.max(0, totalRentalOnline - additionalOnline);
          const rentalCard = Math.max(0, totalRentalCard - additionalCard);

          // 4. Cumulative refunds paid to the customer (supports multiple refund objects/arrays)
          let totalRefundAmt = 0;
          let refundCash = 0;
          let refundOnline = 0;
          let refundCard = 0;
          if (b.refundDetails) {
            const refundEntries = Array.isArray(b.refundDetails) ? b.refundDetails : [b.refundDetails];
            refundEntries.forEach(r => {
              if (r.status === 'Completed' && r.amount > 0) {
                totalRefundAmt += r.amount;
                if (r.method === 'Cash') {
                  refundCash += r.amount;
                } else if (r.method === 'Card') {
                  refundCard += r.amount;
                } else if (r.method === 'Mixed') {
                  const split = parseMixedRef(r.notes);
                  refundCash += split.cash;
                  refundOnline += split.online;
                  refundCard += split.card;
                } else {
                  refundOnline += r.amount;
                }
              }
            });
          }

          // 5. Net Collection & Outstanding Due
          const netCollectionVal = rentalTotal + collectAmount - totalRefundAmt;
          const outstandingDue = b.outstandingRent || 0;
          
          const isExpanded = expandedBookingId === b.bookingId;

          const totalPaidAllDays = (b.paymentCollection?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0) - (b.refundDetails?.status === 'Completed' ? (b.refundDetails?.amount || 0) : 0);

          return (
            <div key={b.bookingId} className="hisab-item-card">
              
              {/* COLLAPSED/EXPANDED HEADER BLOCK */}
              <div className="hisab-item-header" onClick={() => setExpandedBookingId(isExpanded ? null : b.bookingId)}>
                
                {/* Left Side: Vehicle Info & Pills */}
                <div className="hisab-item-left">
                  <div className="hisab-item-icon">
                    {category === 'Car' ? '🚗' : category === 'Scooty' ? '🛵' : '🏍️'}
                  </div>
                  <div className="hisab-item-info">
                    <div className="hisab-item-title-row">
                      <span className="hisab-item-title">{vehicle?.name || b.vehicleName}</span>
                      <span className="hisab-item-reg">{vehicle?.regNumber || b.vehicleRegNumber}</span>
                    </div>
                    <div className="hisab-item-pills">
                      <span className="hisab-pill location">👤 {b.customer?.name || b.customerName}</span>
                      <span className="hisab-pill plan">{b.selectedPlan?.planType || '24-Hour'}</span>
                      <span className="hisab-pill fuel">{fuel}</span>
                      <span className="hisab-pill location">📍 {zone}</span>
                      <span className={`hisab-pill status-${b.status.toLowerCase()}`}>{b.status}</span>
                      {isNewBooking && <span className="hisab-pill new-badge">NEW</span>}
                      {isReturnBooking && <span className="hisab-pill returned-badge">RETURNED</span>}
                    </div>
                  </div>
                </div>

                <div className="hisab-item-right-grid">
                  {/* Column 1: Security Deposit */}
                  <div className="hisab-item-right-col">
                    <span className="hisab-item-right-label">Security Deposit</span>
                    <span className="hisab-item-right-val" style={{ color: '#f59e0b' }}>
                      ₹{depAmt.toLocaleString()}
                    </span>
                    <span className="hisab-item-right-subval">
                      C: {depCash.toLocaleString()} | O: {depOnline.toLocaleString()} | Cd: {depCard.toLocaleString()}
                    </span>
                  </div>

                  {/* Column 2: Rental Collection */}
                  <div className="hisab-item-right-col">
                    <span className="hisab-item-right-label">Rental Collection</span>
                    <span className="hisab-item-right-val" style={{ color: '#10b981' }}>
                      ₹{rentalTotal.toLocaleString()}
                    </span>
                    <span className="hisab-item-right-subval">
                      C: {rentalCash.toLocaleString()} | O: {rentalOnline.toLocaleString()} | Cd: {rentalCard.toLocaleString()}
                    </span>
                  </div>

                  {/* Column 3: Dynamic Settlement Column */}
                  <div className="hisab-item-right-col">
                    {totalRefundAmt > 0 ? (
                      <>
                        <span className="hisab-item-right-label" style={{ color: '#ef4444' }}>Refund</span>
                        <span className="hisab-item-right-val" style={{ color: '#ef4444' }}>
                          ₹{totalRefundAmt.toLocaleString()}
                        </span>
                        <span className="hisab-item-right-subval">
                          C: {refundCash.toLocaleString()} | O: {refundOnline.toLocaleString()} | Cd: {refundCard.toLocaleString()}
                        </span>
                      </>
                    ) : collectAmount > 0 ? (
                      <>
                        <span className="hisab-item-right-label" style={{ color: '#10b981' }}>Additional Collection</span>
                        <span className="hisab-item-right-val" style={{ color: '#10b981' }}>
                          ₹{collectAmount.toLocaleString()}
                        </span>
                        <span className="hisab-item-right-subval">
                          C: {additionalCash.toLocaleString()} | O: {additionalOnline.toLocaleString()} | Cd: {additionalCard.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="hisab-item-right-label">Settled</span>
                        <span className="hisab-item-right-val" style={{ color: '#94a3b8' }}>
                          ₹0
                        </span>
                        <span className="hisab-item-right-subval">
                          C: 0 | O: 0 | Cd: 0
                        </span>
                      </>
                    )}
                  </div>

                  {/* Column 4: Actual Rent Bill */}
                  <div className="hisab-item-right-col">
                    <span className="hisab-item-right-label">Actual Rent Bill</span>
                    <span className="hisab-item-right-val" style={{ color: '#ffffff' }}>
                      ₹{(b.settlement?.actualBill || b.settlement?.totalBill || b.baseFare || 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Column 5: Outstanding Due */}
                  <div className="hisab-item-right-col">
                    <span className="hisab-item-right-label">Outstanding Due</span>
                    <span className="hisab-item-right-val" style={{ color: outstandingDue > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{outstandingDue.toLocaleString()}
                    </span>
                  </div>
                  <span className={`hisab-chevron ${isExpanded ? 'open' : ''}`}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* EXPANDED DETAILS PANEL (Advanced high-fidelity multi-component vertical dashboard) */}
              {isExpanded && (() => {
                const snap = getSnapshotDetails(b);
                const modSummary = getModificationSummary(b);
                const actTimeline = getActivityTimeline(b);
                const payTimeline = getPaymentTimeline(b);
                const depTimeline = getDepositTimeline(b);
                const sett = getSettlementSummary(b);
                const breakd = getCollectionsRefundsBreakdown(b);

                return (
                  <div className="hisab-details-panel">
                    
                    {/* SECTION 1: BOOKING SNAPSHOT SUMMARY */}
                    <div style={{ marginBottom: '20px' }}>
                      <div className="hisab-subsec-title">Booking Snapshot Summary</div>
                      <div className="hisab-snapshot-grid">
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Rental Plan</div>
                          <div className="hisab-snapshot-compare">
                            {snap.originalPlan !== snap.currentPlan ? (
                              <>
                                <span className="hisab-snapshot-old">{snap.originalPlan}</span>
                                <span className="hisab-snapshot-arrow">➔</span>
                                <span className="hisab-snapshot-new">{snap.currentPlan}</span>
                              </>
                            ) : (
                              <span style={{ color: '#ffffff' }}>{snap.currentPlan}</span>
                            )}
                          </div>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Duration</div>
                          <div className="hisab-snapshot-compare">
                            {snap.originalDuration !== snap.currentDuration ? (
                              <>
                                <span className="hisab-snapshot-old">{snap.originalDuration} hrs</span>
                                <span className="hisab-snapshot-arrow">➔</span>
                                <span className="hisab-snapshot-new">{snap.currentDuration} hrs</span>
                              </>
                            ) : (
                              <span style={{ color: '#ffffff' }}>{snap.currentDuration} hrs</span>
                            )}
                          </div>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Security Deposit</div>
                          <div className="hisab-snapshot-compare">
                            {snap.originalDeposit !== snap.currentDeposit ? (
                              <>
                                <span className="hisab-snapshot-old">₹{snap.originalDeposit}</span>
                                <span className="hisab-snapshot-arrow">➔</span>
                                <span className="hisab-snapshot-new">₹{snap.currentDeposit}</span>
                              </>
                            ) : (
                              <span style={{ color: '#ffffff' }}>₹{snap.currentDeposit}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* NEW SECTION: CURRENT BOOKING SNAPSHOT */}
                    <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid #334155', borderRadius: '8px', padding: '16px' }}>
                      <div className="hisab-subsec-title" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', marginBottom: '12px' }}>
                        Current Booking Snapshot
                      </div>
                      <div className="hisab-snapshot-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Current Vehicle</div>
                          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}>
                            {vehicle?.name || b.vehicleName}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                            {vehicle?.regNumber || b.vehicleRegNumber}
                          </span>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Current Plan</div>
                          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}>
                            {b.selectedPlan?.planType || '24-Hour'}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                            ₹{b.selectedPlan?.rate}/unit
                          </span>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Current Duration</div>
                          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}>
                            {snap.currentDuration || 0} hrs
                          </span>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Current KM Limit</div>
                          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.85rem' }}>
                            {b.selectedPlan?.kmLimit || 0} KM
                          </span>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Current Rental Paid</div>
                          <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                            ₹{(b.rentalPaid || b.settlement?.rentalPaid || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Current Deposit Held</div>
                          <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem' }}>
                            ₹{depAmt.toLocaleString()}
                          </span>
                        </div>
                        <div className="hisab-snapshot-card">
                          <div className="hisab-snapshot-title">Current Outstanding Due</div>
                          <span style={{ color: outstandingDue > 0 ? '#ef4444' : '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                            ₹{outstandingDue.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 2: DETAIL ROW GRID & SETTLEMENT LEDGER */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', marginBottom: '20px' }}>
                      {/* Left: General Info */}
                      <div>
                        <div className="hisab-subsec-title">Operational Details</div>
                        <div className="hisab-details-list">
                          <div className="hisab-detail-row">
                            <span className="hisab-detail-label">Booking ID</span>
                            <span className="hisab-detail-val">{b.bookingId}</span>
                          </div>
                          <div className="hisab-detail-row">
                            <span className="hisab-detail-label">Rental Period</span>
                            <span className="hisab-detail-val" style={{ fontSize: '0.8rem' }}>
                              {formatDateTime(b.actualPickupDate || b.rentalPeriod?.actualPickupDate || b.rentalPeriod?.startDate)}&nbsp;➔&nbsp;{formatDateTime(b.actualReturnDate || b.rentalPeriod?.actualReturnDate || b.rentalPeriod?.expectedEndDate)}
                            </span>
                          </div>
                          <div className="hisab-detail-row">
                            <span className="hisab-detail-label">KM Limit</span>
                            <span className="hisab-detail-val">{b.selectedPlan?.kmLimit || 0} KM</span>
                          </div>
                          <div className="hisab-detail-row">
                            <span className="hisab-detail-label">Customer Phone</span>
                            <span className="hisab-detail-val">
                              <a href={`tel:${b.customer?.phone || b.customerPhone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                📞 {b.customer?.phone || b.customerPhone}
                              </a>
                            </span>
                          </div>
                          {b.status === 'Completed' && (
                            <div className="hisab-returned-banner" style={{ margin: '8px 0', fontSize: '0.8rem' }}>
                              Returned to: {b.dropDetails?.operator || b.workerId || 'System'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Settlement Ledger */}
                      <div>
                        <div className="hisab-subsec-title">Settlement Summary Ledger</div>
                        <div className="hisab-settlement-grid">
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Actual Rent Bill</span>
                            <span className="hisab-settlement-val">₹{sett.actualRentalBill.toLocaleString()}</span>
                          </div>
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Rental Paid</span>
                            <span className="hisab-settlement-val" style={{ color: '#10b981' }}>₹{sett.rentalPaid.toLocaleString()}</span>
                          </div>
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Rental Due</span>
                            <span className="hisab-settlement-val" style={{ color: sett.rentalDue > 0 ? '#ef4444' : '#10b981' }}>₹{sett.rentalDue.toLocaleString()}</span>
                          </div>
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Deposit Held</span>
                            <span className="hisab-settlement-val" style={{ color: '#f59e0b' }}>₹{sett.depositHeld.toLocaleString()}</span>
                          </div>
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Deposit Adjusted</span>
                            <span className="hisab-settlement-val" style={{ color: '#f59e0b' }}>₹{sett.depositAdjusted.toLocaleString()}</span>
                          </div>
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Deposit Refunded</span>
                            <span className="hisab-settlement-val" style={{ color: '#ef4444' }}>₹{sett.depositRefunded.toLocaleString()}</span>
                          </div>
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Final Collection</span>
                            <span className="hisab-settlement-val" style={{ color: '#10b981' }}>₹{sett.finalCollection.toLocaleString()}</span>
                          </div>
                          <div className="hisab-settlement-cell">
                            <span className="hisab-settlement-label">Final Refund</span>
                            <span className="hisab-settlement-val" style={{ color: '#ef4444' }}>₹{sett.finalRefund.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 3: THREE-COLUMN TIMELINES */}
                    <div style={{ marginBottom: '20px' }}>
                      <div className="hisab-timeline-three-col">
                        
                        {/* COLUMN 1: ACTIVITY TIMELINE */}
                        <div>
                          <div className="hisab-subsec-title" style={{ marginBottom: '12px' }}>Activity Timeline</div>
                          <div className="hisab-timeline-container">
                            {actTimeline.map((item, idx) => (
                              <div key={idx} className={`hisab-timeline-item ${item.status}`}>
                                <div className="hisab-timeline-dot"></div>
                                <div className="hisab-timeline-header">
                                  <span>{item.title}</span>
                                  <span className="hisab-timeline-time">{item.time}</span>
                                </div>
                                <div className="hisab-timeline-desc">{item.desc}</div>
                                <div className="hisab-timeline-operator">Operator: {item.operator}</div>
                              </div>
                            ))}
                            {actTimeline.length === 0 && (
                              <div style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>No activities logged.</div>
                            )}
                          </div>
                        </div>

                        {/* COLUMN 2: PAYMENT TIMELINE */}
                        <div>
                          <div className="hisab-subsec-title" style={{ marginBottom: '12px' }}>Payment Timeline</div>
                          <div className="hisab-timeline-container">
                            {payTimeline.map((item, idx) => (
                              <div key={idx} className={`hisab-timeline-item ${item.status}`}>
                                <div className="hisab-timeline-dot"></div>
                                <div className="hisab-timeline-header">
                                  <span>{item.title}</span>
                                  <span className="hisab-timeline-time">{item.time}</span>
                                </div>
                                <div className="hisab-timeline-desc">{item.desc}</div>
                                <div className="hisab-timeline-operator">Operator: {item.operator}</div>
                              </div>
                            ))}
                            {payTimeline.length === 0 && (
                              <div style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>No payments logged.</div>
                            )}
                          </div>
                        </div>

                        {/* COLUMN 3: DEPOSIT TIMELINE */}
                        <div>
                          <div className="hisab-subsec-title" style={{ marginBottom: '12px' }}>Deposit Timeline</div>
                          <div className="hisab-timeline-container">
                            {depTimeline.map((item, idx) => (
                              <div key={idx} className={`hisab-timeline-item ${item.status}`}>
                                <div className="hisab-timeline-dot"></div>
                                <div className="hisab-timeline-header">
                                  <span>{item.title}</span>
                                  <span className="hisab-timeline-time">{item.time}</span>
                                </div>
                                <div className="hisab-timeline-desc">{item.desc}</div>
                                <div className="hisab-timeline-operator">Operator: {item.operator}</div>
                              </div>
                            ))}
                            {depTimeline.length === 0 && (
                              <div style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>No deposit transitions logged.</div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* SECTION 4: BOOKING MODIFICATION SUMMARY LOG */}
                    <div style={{ marginBottom: '20px' }}>
                      <div className="hisab-subsec-title">Booking Modification Summary Log</div>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #334155', borderRadius: '8px', padding: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                        {modSummary.map((log, idx) => (
                          <div key={idx} style={{ fontSize: '0.8rem', color: '#cbd5e1', padding: '4px 0', borderBottom: idx < modSummary.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SECTION 5: DAILY COLLECTIONS & REFUNDS BREAKDOWN */}
                    <div>
                      <div className="hisab-subsec-title">Daily Financial Activity ({formatDateDisplay(dateFilter)})</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                        
                        {/* Rental Collections Group */}
                        <div className="hisab-group-breakdown">
                          <div className="hisab-group-title">
                            <span>Rental Collections</span>
                            <span style={{ color: '#10b981' }}>+₹{breakd.rentals.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</span>
                          </div>
                          <div className="hisab-subsec-list">
                            {breakd.rentals.map((r, idx) => (
                              <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                  <span>{r.mode} payment</span>
                                  <span style={{ color: '#10b981' }}>+₹{r.amount.toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>C: {r.cash} | U: {r.upi} | Cd: {r.card}</span>
                                  <span>Op: {r.operator}</span>
                                </div>
                              </div>
                            ))}
                            {breakd.rentals.length === 0 && (
                              <div style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', padding: '6px 0' }}>No rental collections today.</div>
                            )}
                          </div>
                        </div>

                        {/* Deposit Collections Group */}
                        <div className="hisab-group-breakdown">
                          <div className="hisab-group-title">
                            <span>Deposit Collections</span>
                            <span style={{ color: '#f59e0b' }}>+₹{breakd.deposits.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</span>
                          </div>
                          <div className="hisab-subsec-list">
                            {breakd.deposits.map((d, idx) => (
                              <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                  <span>{d.mode} Deposit</span>
                                  <span style={{ color: '#f59e0b' }}>+₹{d.amount.toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>C: {d.cash} | U: {d.upi} | Cd: {d.card}</span>
                                  <span>Op: {d.operator}</span>
                                </div>
                              </div>
                            ))}
                            {breakd.deposits.length === 0 && (
                              <div style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', padding: '6px 0' }}>No deposit collections today.</div>
                            )}
                          </div>
                        </div>

                        {/* Refunds Group */}
                        <div className="hisab-group-breakdown">
                          <div className="hisab-group-title">
                            <span>Refunds Handled</span>
                            <span style={{ color: '#ef4444' }}>-₹{breakd.refunds.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</span>
                          </div>
                          <div className="hisab-subsec-list">
                            {breakd.refunds.map((ref, idx) => (
                              <div key={idx} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)', fontSize: '0.8rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                  <span>{ref.mode} Refund</span>
                                  <span style={{ color: '#ef4444' }}>-₹{ref.amount.toLocaleString()}</span>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>C: {ref.cash} | U: {ref.upi} | Cd: {ref.card}</span>
                                  <span>Op: {ref.operator}</span>
                                </div>
                              </div>
                            ))}
                            {breakd.refunds.length === 0 && (
                              <div style={{ color: '#64748b', fontSize: '0.75rem', fontStyle: 'italic', padding: '6px 0' }}>No refunds today.</div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
                );
              })()}
            </div>
          );
        })}

        {filteredBookings.length === 0 && (
          <div style={{ background: '#1e293b', border: '1px dashed #334155', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <h3>No transaction entries match filters on this date.</h3>
            <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>Select a different date or clear filters.</p>
          </div>
        )}
      </div>

      {/* 6. OUTSTANDING WORKER HANDOVER FOOTER */}
      <div className="hisab-footer-banner">
        <div className="hisab-footer-left">
          <span className="hisab-footer-title" style={{ color: outstandingHandover >= 0 ? '#ffffff' : '#ef4444' }}>
            Amount to collect from worker: ₹{outstandingHandover.toLocaleString()}
          </span>
          <span className="hisab-footer-desc">
            Cash In (₹{cashInTotal.toLocaleString()}) - Cash Out (₹{cashOutTotal.toLocaleString()}) - Deposited (₹{(hisabData.workerSettlement?.depositToAdmin || 0).toLocaleString()})
          </span>
        </div>
      </div>

      {/* Handover Deposit Recording panel (Admins only, if worker selected) */}
      {workerFilter !== 'All' && (
        <div className="glass-panel" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '16px' }}>💰 Record Worker Cash Handover</h3>
          
          <form onSubmit={handleDepositSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                Handover Amount (₹)
              </label>
              <input 
                type="number" 
                className="form-control" 
                placeholder="e.g. 500"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                required
                style={{ background: '#0f172a', borderColor: '#334155', color: '#ffffff' }}
              />
            </div>
            
            <div className="form-group" style={{ flex: '2 1 300px', marginBottom: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
                Handover Remarks
              </label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Daily cash collection deposit"
                value={depositRemarks}
                onChange={(e) => setDepositRemarks(e.target.value)}
                style={{ background: '#0f172a', borderColor: '#334155', color: '#ffffff' }}
              />
            </div>

            {isAdmin ? (
              <button type="submit" className="btn btn-success" style={{ height: '38px', background: '#10b981', color: '#ffffff', fontWeight: 'bold' }}>
                Record Handover
              </button>
            ) : (
              <div style={{ fontSize: '0.75rem', color: '#64748b', padding: '10px', background: '#0f172a', border: '1px dashed #334155', borderRadius: '6px', textAlign: 'center' }}>
                🔒 deposit logs restrict to Admins.
              </div>
            )}
          </form>
        </div>
      )}

    </div>
  );
}
