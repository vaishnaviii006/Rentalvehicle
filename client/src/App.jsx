import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './components/DashboardHome';
import VehicleManagement from './components/VehicleManagement';
import AvailableVehicles from './components/AvailableVehicles';
import BookingForm from './components/BookingForm';
import BookedVehicles from './components/BookedVehicles';
import DailyHisab from './components/DailyHisab';

export default function App() {
  const [userRole, setUserRole] = useState('admin'); // 'admin' | 'worker'
  const [currentWorker, setCurrentWorker] = useState('Ramesh Kumar');
  const [currentTab, setCurrentTab] = useState('dashboard');

  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingVehicle, setBookingVehicle] = useState(null); // Vehicle details when booking form is open

  const [backendActive, setBackendActive] = useState(false);
  const [dbStatus, setDbStatus] = useState({ connected: false, mode: 'Checking...', host: '' });

  const fetchDbStatus = async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/system/database-status');
      if (res.ok) {
        const data = await res.json();
        setDbStatus({
          connected: data.connected,
          mode: data.mode === 'mongodb' ? 'MongoDB Cloud' : 'In-Memory Fallback',
          host: data.host || 'localhost',
          database: data.database
        });
      } else {
        setDbStatus({ connected: false, mode: 'In-Memory Fallback', host: 'localhost' });
      }
    } catch (err) {
      setDbStatus({ connected: false, mode: 'Offline', host: '' });
    }
  };


  useEffect(() => {
    fetchInitialData();
    fetchDbStatus();
    const interval = setInterval(fetchDbStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchInitialData = async () => {
    try {
      const [vRes, bRes] = await Promise.all([
        fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/vehicles'),
        fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/bookings')
      ]);

      if (vRes.ok && bRes.ok) {
        const vData = await vRes.json();
        const bData = await bRes.json();
        setVehicles(vData);
        setBookings(bData);
        setBackendActive(true);
      } else {
        throw new Error('Fallback to local states');
      }
    } catch (err) {
      console.warn('[App] Backend unreachable. Showing empty state.');
      setVehicles([]);
      setBookings([]);
      setBackendActive(false);
    }
  };

  // Operational Actions

  // 1. Vehicles
  const handleAddVehicle = async (formData) => {
    if (backendActive) {
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      const newV = {
        ...formData,
        vehicleId: `V-${1000 + vehicles.length + 1}`,
        createdAt: new Date().toISOString()
      };
      setVehicles([newV, ...vehicles]);
    }
  };

  const handleUpdateVehicle = async (vehicleId, formData) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/vehicles/${vehicleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      setVehicles(vehicles.map(v => v.vehicleId === vehicleId ? { ...v, ...formData } : v));
    }
  };

  const handleToggleVehicleStatus = async (vehicleId, status) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/vehicles/${vehicleId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      setVehicles(vehicles.map(v => v.vehicleId === vehicleId ? { ...v, status } : v));
    }
  };

  // 2. Bookings
  const handleConfirmBooking = async (bookingData) => {
    if (backendActive) {
      try {
        const res = await fetch((import.meta.env.VITE_API_BASE_URL || '') + '/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData)
        });
        if (res.ok) {
          fetchInitialData();
          setBookingVehicle(null);
          setCurrentTab('bookings');
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(`Booking submission failed: ${errData.message || res.statusText || 'Unknown server error'}`);
        }
      } catch (err) {
        console.error(err);
        alert(`Network error connecting to backend: ${err.message}`);
      }
    } else {
      // Local implementation
      const matchedVehicle = vehicles.find(v => v.vehicleId === bookingData.vehicleId);

      const newB = {
        bookingId: `BK-${2000 + bookings.length + 1}`,
        ...bookingData,
        vehicleName: matchedVehicle.name,
        vehicleRegNumber: matchedVehicle.regNumber,
        perDayRate: bookingData.perDayRate ?? matchedVehicle.perDayRate,
        perHourRate: bookingData.perHourRate ?? matchedVehicle.perHourRate,
        baseFare: bookingData.baseFare,
        finalAmount: bookingData.finalAmount,
        status: 'Reserved',
        extensions: [],
        replacements: [],
        createdAt: new Date().toISOString()
      };

      setBookings([newB, ...bookings]);
      setVehicles(vehicles.map(v => v.vehicleId === bookingData.vehicleId ? { ...v, status: 'Reserved' } : v));
      setBookingVehicle(null);
      setCurrentTab('bookings');
    }
  };

  const handlePickup = async (bookingId, pickupData) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/bookings/${bookingId}/pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pickupData)
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      const booking = bookings.find(b => b.bookingId === bookingId);
      if (booking) {
        booking.status = 'Ongoing';
        booking.pickupDetails = pickupData;
        setBookings([...bookings]);
        setVehicles(vehicles.map(v => v.vehicleId === booking.vehicleId ? { ...v, status: 'Ongoing' } : v));
      }
    }
  };

  const handleExtend = async (bookingId, extendData) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/bookings/${bookingId}/extend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extendData)
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      const booking = bookings.find(b => b.bookingId === bookingId);
      if (booking) {
        booking.expectedDropDate = extendData.newEndDateTime;
        booking.expectedReturnDate = extendData.newEndDateTime;
        booking.extensions.push({
          newEndDateTime: extendData.newEndDateTime,
          extraCharges: extendData.extraCharges,
          remarks: extendData.remarks,
          timestamp: new Date()
        });

        if (extendData.baseFare !== undefined) {
          booking.baseFare = extendData.baseFare;
          booking.rentalCost = extendData.baseFare;
        }
        if (extendData.securityDeposit !== undefined) {
          booking.securityDeposit = extendData.securityDeposit;
          booking.depositHeld = extendData.securityDeposit;
        }
        if (extendData.depositDetails !== undefined) booking.depositDetails = extendData.depositDetails;
        if (extendData.advancePaid !== undefined) {
          booking.advancePaid = extendData.advancePaid;
          booking.rentalPaid = extendData.advancePaid;
        }
        if (extendData.paymentCollection) {
          const pObj = { ...extendData.paymentCollection };
          pObj.workerId = extendData.workerId || 'System';
          pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
          pObj.onlineAmount = ['UPI', 'Online'].includes(pObj.mode) ? pObj.amount : 0;
          pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
          booking.paymentCollection.push(pObj);
        }
        if (extendData.durationHours !== undefined) booking.durationHours = extendData.durationHours;
        if (extendData.durationDays !== undefined) booking.durationDays = extendData.durationDays;
        if (extendData.selectedPlan !== undefined) booking.selectedPlan = extendData.selectedPlan;

        const totalBill = booking.baseFare + ((booking.addons?.helmetsCount || 0) * 50);
        booking.outstandingRent = Math.max(0, totalBill - booking.discount - booking.advancePaid);
        booking.finalAmount = booking.outstandingRent;

        setBookings([...bookings]);
      }
    }
  };

  const handleReplaceVehicle = async (bookingId, replaceData) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/bookings/${bookingId}/replace`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(replaceData)
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      const booking = bookings.find(b => b.bookingId === bookingId);
      const newV = vehicles.find(v => v.vehicleId === replaceData.newVehicleId);
      if (booking && newV) {
        const oldVehicleId = booking.vehicleId;
        const oldVehicleReg = booking.vehicleDetails?.regNumber || '';
        const oldVehicleClosingMeter = Number(replaceData.oldVehicleClosingMeter) || 0;
        const newVehicleReg = newV.regNumber || '';
        const newVehicleStartingMeter = Number(replaceData.newVehicleStartingMeter) || newV.meterReading || 0;
        
        // Log swap
        booking.replacements.push({
          oldVehicleId,
          oldVehicleReg,
          oldVehicleClosingMeter,
          newVehicleId,
          newVehicleReg,
          newVehicleStartingMeter,
          reason: replaceData.reason,
          timestamp: new Date(),
          operatorName: replaceData.workerId || 'System'
        });

        // Update booking details
        booking.vehicleId = replaceData.newVehicleId;
        booking.vehicleDetails = {
          name: newV.name,
          regNumber: newV.regNumber,
          category: newV.category
        };

        if (replaceData.applyNewPricing) {
          booking.baseFare = Number(replaceData.baseFare);
          booking.rentalCost = Number(replaceData.baseFare);
          booking.securityDeposit = Number(replaceData.securityDeposit);
          booking.depositHeld = Number(replaceData.securityDeposit);
          booking.depositDetails = replaceData.depositDetails;
          booking.advancePaid = Number(replaceData.advancePaid);
          booking.rentalPaid = Number(replaceData.advancePaid);
          if (replaceData.settlement) booking.settlement = replaceData.settlement;
        }
        if (replaceData.selectedPlan) {
          booking.selectedPlan = replaceData.selectedPlan;
        }

        if (replaceData.revisions) {
          booking.revisions = replaceData.revisions;
        }

        setBookings([...bookings]);

        // Toggle vehicle statuses, audit logs and meter readings
        setVehicles(vehicles.map(v => {
          if (v.vehicleId === oldVehicleId) {
            const audits = v.auditLogs || [];
            audits.push({
              employee: replaceData.workerId || 'System',
              action: `Returned During Replacement. Meter: ${oldVehicleClosingMeter} KM`,
              timestamp: new Date()
            });
            return { ...v, status: 'Available', meterReading: oldVehicleClosingMeter, auditLogs: audits };
          }
          if (v.vehicleId === replaceData.newVehicleId) {
            const audits = v.auditLogs || [];
            audits.push({
              employee: replaceData.workerId || 'System',
              action: `Issued During Replacement. Meter: ${newVehicleStartingMeter} KM`,
              timestamp: new Date()
            });
            return { ...v, status: booking.status === 'Reserved' ? 'Reserved' : 'Booked', meterReading: newVehicleStartingMeter, auditLogs: audits };
          }
          return v;
        }));
      }
    }
  };

  const handleDropOff = async (bookingId, dropOffData) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/bookings/${bookingId}/dropoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dropOffData)
        });
        if (res.ok) {
          fetchInitialData();
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(`Drop-off submission failed: ${errData.message || res.statusText || 'Unknown server error'}`);
        }
      } catch (err) {
        console.error(err);
        alert(`Network error connecting to backend: ${err.message}`);
      }
    } else {
      // Local implementation
      const booking = bookings.find(b => b.bookingId === bookingId);
      if (booking) {
        booking.status = 'Completed';
        if (booking.rentalPeriod) {
          booking.rentalPeriod.actualReturnDate = dropOffData.dropDetails?.actualTime || new Date().toISOString();
          booking.actualReturnDate = booking.rentalPeriod.actualReturnDate;
        }
        booking.dropDetails = dropOffData.dropDetails;
        
        // Merge final payment split collection
        let finalPayments = [...(booking.paymentCollection || [])];
        if (dropOffData.paymentCollection && dropOffData.paymentCollection.amount > 0) {
          const pObj = { ...dropOffData.paymentCollection };
          pObj.workerId = dropOffData.workerId || 'System';
          pObj.cashAmount = pObj.mode === 'Cash' ? pObj.amount : 0;
          pObj.onlineAmount = ['UPI', 'Online'].includes(pObj.mode) ? pObj.amount : 0;
          pObj.cardAmount = pObj.mode === 'Card' ? pObj.amount : 0;
          finalPayments.push(pObj);
          booking.advancePaid = (booking.advancePaid || 0) + pObj.amount;
        }

        finalPayments = finalPayments.map(p => {
          const pObj = { ...p };
          pObj.workerId = pObj.workerId || dropOffData.workerId || 'System';
          pObj.cashAmount = pObj.cashAmount !== undefined ? pObj.cashAmount : (pObj.mode === 'Cash' ? pObj.amount : 0);
          pObj.onlineAmount = pObj.onlineAmount !== undefined ? pObj.onlineAmount : (['UPI', 'Online'].includes(pObj.mode) ? pObj.amount : 0);
          pObj.cardAmount = pObj.cardAmount !== undefined ? pObj.cardAmount : (pObj.mode === 'Card' ? pObj.amount : 0);
          return pObj;
        });

        booking.paymentCollection = finalPayments;

        // Adjust security deposit in local state
        if (dropOffData.settlement) {
          booking.settlement = dropOffData.settlement;
          booking.collectAmount = dropOffData.settlement.collectAmount || 0;
          booking.refundAmount = dropOffData.settlement.refundAmount || 0;
          booking.depositHeld = Math.max(0, (dropOffData.settlement.depositHeld || 0) - (dropOffData.settlement.depositAdjustment || 0));
          booking.securityDeposit = booking.depositHeld;
          booking.outstandingRent = dropOffData.settlement.remainingToPay || 0;
          booking.rentalPaid = dropOffData.settlement.previousPaid || booking.rentalPaid;
        }
        
        booking.refundDetails = dropOffData.refundDetails || {};
        booking.revisions = dropOffData.revisions || booking.revisions;
        booking.workerId = dropOffData.workerId || booking.workerId;

        // Update active vehicle status & odometer
        const finalOdo = dropOffData.dropDetails?.endMeter || 0;
        setVehicles(vehicles.map(v => 
          v.vehicleId === booking.vehicleId 
            ? { ...v, status: 'Available', meterReading: finalOdo } 
            : v
        ));
        setBookings([...bookings]);
      }
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/bookings/${bookingId}/cancel`, {
          method: 'PATCH'
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      const booking = bookings.find(b => b.bookingId === bookingId);
      if (booking) {
        booking.status = 'Cancelled';
        setBookings([...bookings]);
        setVehicles(vehicles.map(v => v.vehicleId === booking.vehicleId ? { ...v, status: 'Available' } : v));
      }
    }
  };

  const handleAdminOverride = async (bookingId, overrideData) => {
    if (backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/bookings/${bookingId}/override`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(overrideData)
        });
        if (res.ok) fetchInitialData();
      } catch (err) {
        console.error(err);
      }
    } else {
      // Local implementation
      const booking = bookings.find(b => b.bookingId === bookingId);
      if (booking) {
        Object.assign(booking, overrideData);
        
        if (overrideData.status !== undefined) {
          const oldStatus = booking.status;
          booking.status = overrideData.status;
          
          // Re-sync vehicle status locally
          const vStatus = (overrideData.status === 'Completed' || overrideData.status === 'Cancelled')
            ? 'Available' 
            : overrideData.status === 'Ongoing' 
              ? 'Ongoing' 
              : 'Reserved';
          
          setVehicles(vehicles.map(v => v.vehicleId === booking.vehicleId ? { ...v, status: vStatus } : v));
        }

        setBookings([...bookings]);
      }
    }
  };

  // Record worker cash deposit to admin via API
  const handleRecordDeposit = async (date, workerId, amount, remarks) => {
    if (!backendActive) {
      alert('Cannot record settlement: backend is offline.');
      return;
    }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/accounting/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, workerId, depositAmount: amount, remarks })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Settlement failed: ${err.message || res.statusText}`);
      }
    } catch (err) {
      console.error('[Settlement]', err);
      alert(`Network error recording settlement: ${err.message}`);
    }
  };

  // Page Routing Render Switch
  const renderTabContent = () => {
    // If Booking Form is open, it takes precedence in Available view
    if (bookingVehicle && currentTab === 'available') {
      return (
        <BookingForm 
          vehicle={bookingVehicle} 
          onConfirmBooking={handleConfirmBooking}
          onCancel={() => setBookingVehicle(null)}
          currentWorker={currentWorker}
        />
      );
    }

    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardHome
            vehicles={vehicles}
            bookings={bookings}
            userRole={userRole}
            setCurrentTab={setCurrentTab}
            onPickup={() => setCurrentTab('bookings')}
            onDropOff={() => setCurrentTab('bookings')}
          />
        );
      case 'available':
        return (
          <AvailableVehicles 
            vehicles={vehicles} 
            bookings={bookings}
            onBookVehicle={(vehicle) => setBookingVehicle(vehicle)} 
            onUpdateVehicle={handleUpdateVehicle}
            onToggleStatus={handleToggleVehicleStatus}
          />
        );
      case 'vehicles':
        // Hide from workers just in case
        if (userRole !== 'admin') {
          setCurrentTab('dashboard');
          return null;
        }
        return (
          <VehicleManagement 
            vehicles={vehicles} 
            bookings={bookings}
            onAddVehicle={handleAddVehicle}
            onUpdateVehicle={handleUpdateVehicle}
            onToggleStatus={handleToggleVehicleStatus}
          />
        );
      case 'bookings':
        return (
          <BookedVehicles 
            bookings={bookings} 
            vehicles={vehicles}
            userRole={userRole}
            currentWorker={currentWorker}
            onPickup={handlePickup}
            onExtend={handleExtend}
            onReplace={handleReplaceVehicle}
            onDropOff={handleDropOff}
            onCancelBooking={handleCancelBooking}
            onAdminOverride={handleAdminOverride}
          />
        );
      case 'hisab':
        return (
          <DailyHisab 
            userRole={userRole}
            currentWorker={currentWorker}
            vehicles={vehicles}
            bookings={bookings}
            onRecordDeposit={handleRecordDeposit}
          />
        );
      default:
        return <DashboardHome vehicles={vehicles} bookings={bookings} userRole={userRole} setCurrentTab={setCurrentTab} />;
    }
  };

  // Helper to open operations directly from Dashboard shortcuts
  const setSelectedBookingForOps = (booking, mode) => {
    setCurrentTab('bookings');
    // We let the child BookedVehicles handle opening the modal via the DOM/state rendering,
    // so we switch to the Bookings Tab. Once in the Bookings tab, the worker can click Details or actions.
    // To make it instant, we will scroll/point them there.
  };

  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        userRole={userRole} 
      />

      {/* Main Content Area */}
      <main className="main-content">
        <Header 
          currentTab={currentTab}
          userRole={userRole} 
          setUserRole={setUserRole} 
          currentWorker={currentWorker}
          setCurrentWorker={setCurrentWorker}
          dbStatus={dbStatus}
        />

        {/* Dynamic Route Screen */}
        <div style={{ flex: 1 }}>
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
