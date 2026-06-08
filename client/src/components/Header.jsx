import React from 'react';

export default function Header({ currentTab, userRole, setUserRole, currentWorker, setCurrentWorker, dbStatus }) {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'Rental Overview Dashboard';
      case 'available': return 'Available Vehicles Booking';
      case 'vehicles': return 'Vehicle Fleet Management';
      case 'bookings': return 'Rental Bookings & Operations';
      case 'hisab': return 'Daily Hisab (Accounting & Settlement)';
      default: return 'Vehicle Rental System';
    }
  };

  return (
    <header className="header animate-fade">
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1>{getTabTitle()}</h1>
        {dbStatus && (
          <div className="db-status-container" title={`Database Host: ${dbStatus.host || 'unknown'}`}>
            <span className={`db-status-dot ${dbStatus.connected ? 'connected' : dbStatus.mode === 'Offline' ? 'offline' : 'fallback'}`}></span>
            <span className="db-status-text">
              Database: <strong>{dbStatus.mode}</strong>
            </span>
          </div>
        )}
      </div>

      <div className="header-right">
        {/* Worker Simulator Dropdown when role is worker */}
        {userRole === 'worker' && (
          <div className="form-group" style={{ marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <label style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Worker Persona:</label>
            <select 
              className="form-control"
              style={{ padding: '6px 30px 6px 12px', fontSize: '0.85rem', width: '160px' }}
              value={currentWorker}
              onChange={(e) => setCurrentWorker(e.target.value)}
            >
              <option value="Ramesh Kumar">Ramesh Kumar</option>
              <option value="Suresh Singh">Suresh Singh</option>
            </select>
          </div>
        )}

        {/* Role Toggle Switch */}
        <div className="role-toggle-container">
          <button 
            className={`role-btn ${userRole === 'admin' ? 'active admin' : ''}`}
            onClick={() => setUserRole('admin')}
          >
            <span>👤</span> Admin
          </button>
          <button 
            className={`role-btn ${userRole === 'worker' ? 'active worker' : ''}`}
            onClick={() => setUserRole('worker')}
          >
            <span>👷</span> Worker
          </button>
        </div>
      </div>
    </header>
  );
}
