import React, { useMemo } from 'react';

// ─── Helper: format INR currency ──────────────────────────────────────────────
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// ─── Helper: check if a date string is today ──────────────────────────────────
const isToday = (dateVal) => {
  if (!dateVal) return false;
  try {
    const d = new Date(dateVal);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  } catch {
    return false;
  }
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, color, bg, onClick, sub }) {
  return (
    <div
      className="glass-panel kpi-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s', userSelect: 'none' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div className="kpi-icon" style={{ background: bg, color }}>{icon}</div>
      <div className="kpi-info">
        <span className="kpi-title">{label}</span>
        <span className="kpi-value" style={{ color }}>{value}</span>
        {sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</span>}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title }) {
  return (
    <h3 style={{ marginBottom: '16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
      <span>{icon}</span> {title}
    </h3>
  );
}

// ─── Booking Row ──────────────────────────────────────────────────────────────
function BookingRow({ booking, action, actionLabel, actionColor, onAction }) {
  const customerName = booking.customer?.name || booking.customerName || '—';
  const vehicleName = booking.vehicleDetails?.name || booking.vehicleName || '—';
  const outstanding = Number(booking.outstandingRent) || 0;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: 'rgba(255,255,255,0.03)', padding: '10px 12px',
      borderRadius: '6px', fontSize: '0.82rem', marginBottom: '6px',
      border: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{customerName}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{vehicleName} · {booking.bookingId}</div>
        {outstanding > 0 && (
          <div style={{ color: 'var(--status-overdue)', fontSize: '0.72rem', marginTop: '2px' }}>
            Due: {fmt(outstanding)}
          </div>
        )}
      </div>
      {onAction && (
        <button
          className="btn"
          style={{ padding: '5px 12px', fontSize: '0.75rem', background: actionColor || 'var(--primary)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', flexShrink: 0, marginLeft: '12px' }}
          onClick={() => onAction(booking)}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
export default function DashboardHome({ vehicles, bookings, userRole, setCurrentTab, onPickup, onDropOff }) {
  const isAdmin = userRole === 'admin';
  const now = new Date();

  // ── Fleet counts ───────────────────────────────────────────────────────────
  const fleetStats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'Available' || v.status === 'Active').length,
    ongoing: vehicles.filter(v => v.status === 'Ongoing').length,
    reserved: vehicles.filter(v => v.status === 'Reserved').length,
    maintenance: vehicles.filter(v => v.status === 'Maintenance' || v.status === 'Out Of Service' || v.status === 'Inactive').length,
  }), [vehicles]);

  // ── Booking stats ──────────────────────────────────────────────────────────
  const bookingStats = useMemo(() => {
    const todayPickups = bookings.filter(b =>
      isToday(b.actualPickupDate || b.rentalPeriod?.actualPickupDate)
    );
    const todayReturns = bookings.filter(b =>
      isToday(b.actualReturnDate || b.rentalPeriod?.actualReturnDate) && b.status === 'Completed'
    );
    const overdue = bookings.filter(b => {
      if (!['Ongoing', 'Extended'].includes(b.status)) return false;
      const expected = b.expectedReturnDate || b.rentalPeriod?.expectedEndDate;
      return expected && new Date(expected) < now;
    });
    const pendingPickups = bookings.filter(b => b.status === 'Reserved');
    const ongoingTrips = bookings.filter(b => ['Ongoing', 'Extended'].includes(b.status));

    return { todayPickups, todayReturns, overdue, pendingPickups, ongoingTrips };
  }, [bookings]);

  // ── Financial stats ────────────────────────────────────────────────────────
  const financials = useMemo(() => {
    const todayStr = now.toISOString().slice(0, 10);

    // Today's earnings = all payments collected today across all bookings
    let todayEarnings = 0;
    bookings.forEach(b => {
      (b.paymentCollection || []).forEach(p => {
        if (!p.timestamp) return;
        const pDate = new Date(p.timestamp).toISOString().slice(0, 10);
        if (pDate === todayStr && !p.mode?.includes('Refund')) {
          todayEarnings += Number(p.amount) || 0;
        }
      });
    });

    // Outstanding due = sum of outstandingRent for all active bookings
    const outstandingDue = bookings
      .filter(b => ['Ongoing', 'Extended', 'Reserved'].includes(b.status))
      .reduce((sum, b) => sum + (Number(b.outstandingRent) || 0), 0);

    // Total completed revenue
    const completedRevenue = bookings
      .filter(b => b.status === 'Completed')
      .reduce((sum, b) => sum + (Number(b.rentalCost) || Number(b.baseFare) || 0), 0);

    return { todayEarnings, outstandingDue, completedRevenue };
  }, [bookings]);

  // ── Action handlers that navigate to the bookings tab ─────────────────────
  const handlePickup = (booking) => {
    setCurrentTab('bookings');
    if (onPickup) onPickup(booking);
  };
  const handleDropOff = (booking) => {
    setCurrentTab('bookings');
    if (onDropOff) onDropOff(booking);
  };

  const overdueCount = bookingStats.overdue.length;

  return (
    <div className="animate-slide-up">

      {/* ── Row 1: Fleet Status Cards ────────────────────────────────────── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: 600 }}>
          Fleet Status
        </div>
        <div className="kpi-grid">
          <KpiCard icon="🚗" label="Total Fleet" value={fleetStats.total} color="var(--primary)" bg="rgba(99,102,241,0.15)" onClick={() => setCurrentTab('vehicles')} />
          <KpiCard icon="✅" label="Available" value={fleetStats.available} color="var(--status-available)" bg="rgba(16,185,129,0.15)" onClick={() => setCurrentTab('available')} />
          <KpiCard icon="🛣️" label="Ongoing" value={fleetStats.ongoing} color="var(--status-ongoing)" bg="rgba(59,130,246,0.15)" onClick={() => setCurrentTab('bookings')} />
          <KpiCard icon="⏳" label="Reserved" value={fleetStats.reserved} color="var(--status-reserved)" bg="rgba(245,158,11,0.15)" onClick={() => setCurrentTab('bookings')} />
          <KpiCard icon="🔧" label="Maintenance" value={fleetStats.maintenance} color="var(--status-maintenance)" bg="rgba(239,68,68,0.12)" />
        </div>
      </div>

      {/* ── Row 2: Today's Operations Cards ──────────────────────────────── */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: 600, marginTop: '8px' }}>
          Today's Operations
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          <KpiCard
            icon="🆕"
            label="Pickups Today"
            value={bookingStats.todayPickups.length}
            color="var(--status-ongoing)"
            bg="rgba(59,130,246,0.12)"
            onClick={() => setCurrentTab('bookings')}
          />
          <KpiCard
            icon="🏁"
            label="Returns Today"
            value={bookingStats.todayReturns.length}
            color="var(--status-available)"
            bg="rgba(16,185,129,0.12)"
            onClick={() => setCurrentTab('bookings')}
          />
          <KpiCard
            icon="⚠️"
            label="Overdue"
            value={overdueCount}
            color={overdueCount > 0 ? 'var(--status-overdue)' : 'var(--text-muted)'}
            bg={overdueCount > 0 ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.05)'}
            onClick={() => setCurrentTab('bookings')}
          />
          <KpiCard
            icon="⏰"
            label="Awaiting Pickup"
            value={bookingStats.pendingPickups.length}
            color="var(--status-reserved)"
            bg="rgba(245,158,11,0.12)"
            onClick={() => setCurrentTab('bookings')}
          />
        </div>
      </div>

      {/* ── Row 3: Financial Cards ────────────────────────────────────────── */}
      {isAdmin && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: 600, marginTop: '8px' }}>
            Financial Overview
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <KpiCard
              icon="💰"
              label="Today's Collections"
              value={fmt(financials.todayEarnings)}
              color="#10b981"
              bg="rgba(16,185,129,0.13)"
              onClick={() => setCurrentTab('hisab')}
            />
            <KpiCard
              icon="📋"
              label="Outstanding Due"
              value={fmt(financials.outstandingDue)}
              color="#f59e0b"
              bg="rgba(245,158,11,0.12)"
              sub="Active bookings"
            />
            <KpiCard
              icon="📈"
              label="Total Completed Rev."
              value={fmt(financials.completedRevenue)}
              color="var(--primary)"
              bg="rgba(99,102,241,0.12)"
              onClick={() => setCurrentTab('hisab')}
            />
          </div>
        </div>
      )}

      {/* ── Row 4: Action Lists ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: '20px', marginTop: '12px' }}>

        {/* Pending Pickups */}
        <div className="glass-panel">
          <SectionHeader icon="🔑" title={`Awaiting Pickup (${bookingStats.pendingPickups.length})`} />
          {bookingStats.pendingPickups.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', padding: '12px 0', textAlign: 'center' }}>
              No bookings waiting for pickup.
            </div>
          ) : (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {bookingStats.pendingPickups.map(b => (
                <BookingRow
                  key={b.bookingId}
                  booking={b}
                  actionLabel="Pickup"
                  actionColor="var(--status-reserved)"
                  onAction={handlePickup}
                />
              ))}
            </div>
          )}
        </div>

        {/* Ongoing Trips */}
        <div className="glass-panel">
          <SectionHeader icon="🛣️" title={`Ongoing Trips (${bookingStats.ongoingTrips.length})`} />
          {bookingStats.ongoingTrips.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', padding: '12px 0', textAlign: 'center' }}>
              No active trips right now.
            </div>
          ) : (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {bookingStats.ongoingTrips.map(b => {
                const expectedReturn = b.expectedReturnDate || b.rentalPeriod?.expectedEndDate;
                const isOverdue = expectedReturn && new Date(expectedReturn) < now;
                return (
                  <BookingRow
                    key={b.bookingId}
                    booking={{
                      ...b,
                      vehicleName: b.vehicleDetails?.name || b.vehicleName,
                      outstandingRent: isOverdue ? (b.outstandingRent || 0) : 0
                    }}
                    actionLabel={isOverdue ? '⚠️ Drop Off' : 'Drop Off'}
                    actionColor={isOverdue ? '#ef4444' : 'var(--status-ongoing)'}
                    onAction={handleDropOff}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Actions (Worker) ────────────────────────────────────────── */}
      {!isAdmin && (
        <div className="glass-panel" style={{ marginTop: '20px' }}>
          <SectionHeader icon="⚡" title="Quick Actions" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="glass-card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }} onClick={() => setCurrentTab('available')}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🚗</div>
              <div style={{ fontWeight: 600, color: 'var(--status-available)', marginBottom: '4px' }}>New Rental</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Create a new booking</div>
            </div>
            <div className="glass-card" style={{ cursor: 'pointer', textAlign: 'center', padding: '20px' }} onClick={() => setCurrentTab('bookings')}>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>📋</div>
              <div style={{ fontWeight: 600, color: 'var(--status-ongoing)', marginBottom: '4px' }}>Manage Bookings</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pickup, extend, drop-off</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
