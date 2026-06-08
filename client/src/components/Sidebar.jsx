import React from 'react';

export default function Sidebar({ currentTab, setCurrentTab, userRole }) {
  const isAdmin = userRole === 'admin';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">V</div>
        <span className="logo-text">VeloRent</span>
      </div>

      <nav className="sidebar-nav">
        <div 
          className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentTab('dashboard')}
        >
          <span>📊</span>
          <span>Dashboard</span>
        </div>

        <div 
          className={`nav-item ${currentTab === 'available' ? 'active' : ''}`}
          onClick={() => setCurrentTab('available')}
        >
          <span>🚗</span>
          <span>Available Vehicles</span>
        </div>

        {isAdmin && (
          <div 
            className={`nav-item ${currentTab === 'vehicles' ? 'active' : ''}`}
            onClick={() => setCurrentTab('vehicles')}
          >
            <span>🔧</span>
            <span>Vehicle Fleet</span>
          </div>
        )}

        <div 
          className={`nav-item ${currentTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setCurrentTab('bookings')}
        >
          <span>📅</span>
          <span>Bookings List</span>
        </div>

        <div 
          className={`nav-item ${currentTab === 'hisab' ? 'active' : ''}`}
          onClick={() => setCurrentTab('hisab')}
        >
          <span>💰</span>
          <span>Daily Hisab</span>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div>VeloRent System v1.0</div>
        <div style={{ marginTop: '4px', fontSize: '0.7rem' }}>Logged in as {isAdmin ? 'Admin' : 'Worker'}</div>
      </div>
    </aside>
  );
}
