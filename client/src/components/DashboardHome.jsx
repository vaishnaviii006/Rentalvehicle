import React from 'react';

export default function DashboardHome({ vehicles, bookings, userRole, setCurrentTab, startPickup, startDropOff }) {
  const isAdmin = userRole === 'admin';

  // Calculate metrics
  const totalFleet = vehicles.length;
  const availableCount = vehicles.filter(v => v.status === 'Available' || v.status === 'Active').length;
  const ongoingCount = vehicles.filter(v => v.status === 'Ongoing' || v.status === 'Booked').length;
  const reservedCount = vehicles.filter(v => v.status === 'Reserved').length;
  const maintenanceCount = vehicles.filter(v => v.status === 'Maintenance' || v.status === 'Out Of Service').length;

  // Filter pending actions
  const pendingPickups = bookings.filter(b => b.status === 'Reserved').slice(0, 3);
  const pendingDropoffs = bookings.filter(b => b.status === 'Ongoing').slice(0, 3);

  // Calculate total revenue for admin
  const totalRevenue = bookings
    .filter(b => b.status === 'Completed')
    .reduce((sum, b) => {
      const extCost = b.extensions?.reduce((s, e) => s + e.extraCharges, 0) || 0;
      const extraCost = b.dropDetails
        ? (b.dropDetails.damageCharges || 0) + 
          (b.dropDetails.lateCharges || 0) + 
          (b.dropDetails.fuelCharges || 0) +
          (b.dropDetails.cleaningCharges || 0) +
          (b.dropDetails.otherCharges || 0)
        : 0;
      const grossTotal = b.settlement?.actualBill || b.settlement?.totalBill || (b.baseFare + extCost + extraCost - b.discount);
      return sum + grossTotal;
    }, 0);

  return (
    <div className="animate-slide-up">
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>🚗</div>
          <div className="kpi-info">
            <span className="kpi-title">Total Fleet</span>
            <span className="kpi-value">{totalFleet}</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--status-available)' }}>✅</div>
          <div className="kpi-info">
            <span className="kpi-title">Available</span>
            <span className="kpi-value">{availableCount}</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--status-ongoing)' }}>🛣️</div>
          <div className="kpi-info">
            <span className="kpi-title">Ongoing Trips</span>
            <span className="kpi-value">{ongoingCount}</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--status-reserved)' }}>⏳</div>
          <div className="kpi-info">
            <span className="kpi-title">Reserved</span>
            <span className="kpi-value">{reservedCount}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '2fr 1fr' : '1fr 1fr', gap: '24px', marginTop: '12px' }}>
        {/* Left Side: Role Specific Main Section */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: '20px', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span> Quick Action Center
          </h2>
          
          {isAdmin ? (
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Welcome, System Administrator. You have full oversight of operations, accounting, pricing overrides, and vehicle management.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setCurrentTab('vehicles')}>
                  <h4 style={{ color: 'var(--accent)', marginBottom: '8px' }}>Manage Fleet</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Add new vehicles, edit specifications, assign workers, and toggle status.</p>
                </div>
                <div className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setCurrentTab('hisab')}>
                  <h4 style={{ color: 'var(--secondary)', marginBottom: '8px' }}>Financial Reports</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>View comprehensive accounting summaries, log deposits, and check worker balance.</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Logged in as Operator. You can view available vehicles, create new bookings, handle customer pickups, extensions, replacements, and vehicle drop-offs.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setCurrentTab('available')}>
                  <h4 style={{ color: 'var(--status-available)', marginBottom: '8px' }}>New Rental</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Search available vehicles and create a new customer booking instantly.</p>
                </div>
                <div className="glass-card" style={{ cursor: 'pointer' }} onClick={() => setCurrentTab('bookings')}>
                  <h4 style={{ color: 'var(--status-ongoing)', marginBottom: '8px' }}>Update Bookings</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Access operational forms for ongoing rentals and process drop-offs.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Quick Action List */}
        {isAdmin ? (
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Admin Financials</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>TOTAL COMPLETED REVENUE</span>
                <h2 style={{ fontSize: '2rem', color: 'var(--status-available)', fontFamily: 'var(--font-title)' }}>
                  ₹{totalRevenue.toLocaleString()}
                </h2>
              </div>
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OUT OF SERVICE FLEET</span>
                <h3 style={{ fontSize: '1.4rem', color: 'var(--status-maintenance)' }}>
                  {maintenanceCount} Vehicles
                </h3>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Pending Action Items</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingPickups.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--status-reserved)', marginBottom: '6px', textTransform: 'uppercase' }}>Awaiting Pickup</h4>
                  {pendingPickups.map(b => (
                    <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <div>
                        <strong>{b.customerName}</strong> ({b.vehicleName})
                      </div>
                      <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => startPickup(b)}>
                        Pickup
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pendingDropoffs.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--status-ongoing)', marginBottom: '6px', textTransform: 'uppercase' }}>Ongoing Trips</h4>
                  {pendingDropoffs.map(b => (
                    <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <div>
                        <strong>{b.customerName}</strong> ({b.vehicleName})
                      </div>
                      <button className="btn btn-accent" style={{ padding: '4px 8px', fontSize: '0.7rem' }} onClick={() => startDropOff(b)}>
                        Drop Off
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pendingPickups.length === 0 && pendingDropoffs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  🎉 All clean! No pending operational items.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
