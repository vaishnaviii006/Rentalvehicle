import React, { useState, useEffect, useRef } from 'react';

export default function AvailableVehicles({ vehicles, bookings = [], onBookVehicle, onUpdateVehicle, onToggleStatus }) {
  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('price-asc');
  const [showFilters, setShowFilters] = useState(true);

  // Modal State Controllers
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Details Config tabs & form state
  const [activeSubTab, setActiveSubTab] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    regNumber: '',
    category: 'Car',
    fuelType: 'Petrol',
    seatingCapacity: 5,
    color: '',
    meterReading: 0,
    fuelCapacity: 50,
    mileage: 15,
    description: '',
    status: 'Active',
    assignedWorker: 'Unassigned',
    pricingPlans: {
      hourly: { rate: 50, freeKm: 5, fuelChargePerKm: 2, extraKmCharge: 5, withFuel: 60, withoutFuel: 50 },
      twelveHour: { baseRate: 350, ratePerHour: 40, kmLimit: 60, fuelChargePerKm: 2, extraKmCharge: 5, extraHourCharge: 40, gracePeriod: 15, withFuel: 450, withoutFuel: 350 },
      twentyFourHour: { baseRate: 500, ratePerHour: 30, kmLimit: 120, fuelChargePerKm: 2, extraKmCharge: 5, extraHourCharge: 30, gracePeriod: 30, withFuel: 650, withoutFuel: 500 },
      weekly: { baseRate: 3000, kmLimit: 800, extraKmCharge: 4, extraDayCharge: 500, gracePeriod: 60 },
      monthly: { baseRate: 9000, kmLimit: 3000, extraKmCharge: 3, extraDayCharge: 400 }
    },
    depositSettings: { requireDeposit: true, amount: 1000 },
    paymentSettings: { advanceRequired: false, percentage: 50, acceptedModes: ['Cash', 'UPI'] },
    bookingConfig: { bufferTime: 30, status: 'Active', bookingEnabled: true, instantBooking: true },
    locationDetails: { currentZone: 'Vijay Nagar', currentBranch: 'Main Branch', parkingLocation: '', gps: { lat: 22.7196, lng: 75.8577 } },
    documents: { rcUrl: '', insuranceUrl: '', pucUrl: '', fitnessUrl: '' },
    images: { front: '', back: '', left: '', right: '', interior: '', document: '', other: '' },
    availability: { availableForBooking: true, reason: '' },
    maintenanceRecords: []
  });

  // History dynamic filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('All');
  const [historyDate, setHistoryDate] = useState('');

  // Camera integration state variables
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [selectedImageType, setSelectedImageType] = useState('front');
  const videoRef = useRef(null);

  // ----------------------------------------------------
  // KPI CALCULATIONS
  // ----------------------------------------------------
  const totalFleet = vehicles.length;
  const countAvailable = vehicles.filter(v => v.status === 'Available' || v.status === 'Active').length;
  const countReserved = vehicles.filter(v => v.status === 'Reserved').length;
  const countPrebooked = vehicles.filter(v => v.status === 'Booked' || v.status === 'Ongoing').length; // or Pre-booked

  // Category counts
  const countScooty = vehicles.filter(v => (v.category || v.type) === 'Scooty').length;
  const countCar = vehicles.filter(v => (v.category || v.type) === 'Car').length;
  const countBike = vehicles.filter(v => (v.category || v.type) === 'Bike' || (v.category || v.type) === 'EV').length;

  // ----------------------------------------------------
  // CAMERA LOGIC
  // ----------------------------------------------------
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Webcam access failed. Falling back to simulation.", err);
      setCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  const captureSnapshot = () => {
    if (cameraStream && videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Str = canvas.toDataURL('image/jpeg');
      
      setFormData(prev => ({
        ...prev,
        images: { ...prev.images, [selectedImageType]: base64Str }
      }));
      stopCamera();
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`CAPTURE: ${selectedImageType.toUpperCase()}`, 50, 100);
      const base64Str = canvas.toDataURL('image/jpeg');
      setFormData(prev => ({
        ...prev,
        images: { ...prev.images, [selectedImageType]: base64Str }
      }));
      setCameraActive(false);
      alert(`Simulation snapshot created for: ${selectedImageType}`);
    }
  };

  const handleFileChange = (e, imgType) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          images: { ...prev.images, [imgType]: reader.result }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // ----------------------------------------------------
  // FILTER & SORT ENGINE
  // ----------------------------------------------------
  const filteredVehicles = vehicles
    .filter(v => {
      // 1. Search Query
      const query = searchTerm.toLowerCase().trim();
      if (query) {
        const nameMatch = v.name?.toLowerCase().includes(query);
        const numMatch = v.regNumber?.toLowerCase().includes(query);
        const brandMatch = v.brand?.toLowerCase().includes(query);
        if (!nameMatch && !numMatch && !brandMatch) return false;
      }

      // 2. Zone
      const zone = v.locationDetails?.currentZone || v.location || 'Vijay Nagar';
      if (selectedZone !== 'All' && zone !== selectedZone) return false;

      // 3. Status
      if (selectedStatus !== 'All') {
        if (selectedStatus === 'Available') {
          if (v.status !== 'Active' && v.status !== 'Available') return false;
        } else if (selectedStatus === 'Ongoing') {
          if (v.status !== 'Ongoing' && v.status !== 'Booked') return false;
        } else {
          if (v.status !== selectedStatus) return false;
        }
      }

      // 4. Category
      const cat = v.category || v.type || 'Car';
      if (selectedCategory !== 'All' && cat !== selectedCategory) return false;

      return true;
    })
    .sort((a, b) => {
      const rateA = a.pricingPlans?.twentyFourHour?.baseRate || a.perDayRate || 0;
      const rateB = b.pricingPlans?.twentyFourHour?.baseRate || b.perDayRate || 0;

      if (sortBy === 'price-asc') {
        return rateA - rateB;
      }
      if (sortBy === 'price-desc') {
        return rateB - rateA;
      }
      if (sortBy === 'name-asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'Newest First') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === 'Oldest First') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      return 0;
    });

  // ----------------------------------------------------
  // MODAL ACTION HANDLERS
  // ----------------------------------------------------
  const openEditModal = (v) => {
    setSelectedVehicle(v);
    setFormData({
      name: v.name || '',
      brand: v.brand || '',
      regNumber: v.regNumber || '',
      category: v.category || v.type || 'Car',
      fuelType: v.fuelType || 'Petrol',
      seatingCapacity: v.seatingCapacity || 2,
      color: v.color || '',
      meterReading: v.meterReading || 0,
      fuelCapacity: v.fuelCapacity || 5,
      mileage: v.mileage || 40,
      description: v.description || '',
      status: v.status || 'Active',
      assignedWorker: v.assignedWorker || 'Unassigned',
      pricingPlans: {
        hourly: {
          rate: v.pricingPlans?.hourly?.rate ?? v.perHourRate ?? 50,
          freeKm: v.pricingPlans?.hourly?.freeKm ?? 5,
          fuelChargePerKm: v.pricingPlans?.hourly?.fuelChargePerKm ?? 2,
          extraKmCharge: v.pricingPlans?.hourly?.extraKmCharge ?? 5,
          withFuel: v.pricingPlans?.hourly?.withFuel ?? 60,
          withoutFuel: v.pricingPlans?.hourly?.withoutFuel ?? 50
        },
        twelveHour: {
          baseRate: v.pricingPlans?.twelveHour?.baseRate ?? 350,
          ratePerHour: v.pricingPlans?.twelveHour?.ratePerHour ?? 40,
          kmLimit: v.pricingPlans?.twelveHour?.kmLimit ?? 60,
          fuelChargePerKm: v.pricingPlans?.twelveHour?.fuelChargePerKm ?? 2,
          extraKmCharge: v.pricingPlans?.twelveHour?.extraKmCharge ?? 5,
          extraHourCharge: v.pricingPlans?.twelveHour?.extraHourCharge ?? 40,
          gracePeriod: v.pricingPlans?.twelveHour?.gracePeriod ?? 15,
          withFuel: v.pricingPlans?.twelveHour?.withFuel ?? 450,
          withoutFuel: v.pricingPlans?.twelveHour?.withoutFuel ?? 350
        },
        twentyFourHour: {
          baseRate: v.pricingPlans?.twentyFourHour?.baseRate ?? v.perDayRate ?? 500,
          ratePerHour: v.pricingPlans?.twentyFourHour?.ratePerHour ?? 30,
          kmLimit: v.pricingPlans?.twentyFourHour?.kmLimit ?? 120,
          fuelChargePerKm: v.pricingPlans?.twentyFourHour?.fuelChargePerKm ?? 2,
          extraKmCharge: v.pricingPlans?.twentyFourHour?.extraKmCharge ?? 5,
          extraHourCharge: v.pricingPlans?.twentyFourHour?.extraHourCharge ?? 30,
          gracePeriod: v.pricingPlans?.twentyFourHour?.gracePeriod ?? 30,
          withFuel: v.pricingPlans?.twentyFourHour?.withFuel ?? 650,
          withoutFuel: v.pricingPlans?.twentyFourHour?.withoutFuel ?? 500
        },
        weekly: {
          baseRate: v.pricingPlans?.weekly?.baseRate ?? 3000,
          kmLimit: v.pricingPlans?.weekly?.kmLimit ?? 800,
          extraKmCharge: v.pricingPlans?.weekly?.extraKmCharge ?? 4,
          extraDayCharge: v.pricingPlans?.weekly?.extraDayCharge ?? 500,
          gracePeriod: v.pricingPlans?.weekly?.gracePeriod ?? 60
        },
        monthly: {
          baseRate: v.pricingPlans?.monthly?.baseRate ?? 9000,
          kmLimit: v.pricingPlans?.monthly?.kmLimit ?? 3000,
          extraKmCharge: v.pricingPlans?.monthly?.extraKmCharge ?? 3,
          extraDayCharge: v.pricingPlans?.monthly?.extraDayCharge ?? 400
        }
      },
      depositSettings: {
        requireDeposit: v.depositSettings?.requireDeposit ?? true,
        amount: v.depositSettings?.amount ?? v.securityDeposit ?? 1000
      },
      paymentSettings: {
        advanceRequired: v.paymentSettings?.advanceRequired ?? false,
        percentage: v.paymentSettings?.percentage ?? 50,
        acceptedModes: v.paymentSettings?.acceptedModes || ['Cash', 'UPI']
      },
      bookingConfig: {
        bufferTime: v.bookingConfig?.bufferTime ?? 30,
        status: v.bookingConfig?.status ?? 'Active',
        bookingEnabled: v.bookingConfig?.bookingEnabled ?? true,
        instantBooking: v.bookingConfig?.instantBooking ?? true
      },
      locationDetails: {
        currentZone: v.locationDetails?.currentZone || v.location || 'Vijay Nagar',
        currentBranch: v.locationDetails?.currentBranch || 'Main Branch',
        parkingLocation: v.locationDetails?.parkingLocation || '',
        gps: {
          lat: v.locationDetails?.gps?.lat ?? 22.7196,
          lng: v.locationDetails?.gps?.lng ?? 75.8577
        }
      },
      documents: {
        rcUrl: v.documents?.rcUrl || '',
        insuranceUrl: v.documents?.insuranceUrl || '',
        pucUrl: v.documents?.pucUrl || '',
        fitnessUrl: v.documents?.fitnessUrl || ''
      },
      images: {
        front: v.images?.front || '',
        back: v.images?.back || '',
        left: v.images?.left || '',
        right: v.images?.right || '',
        interior: v.images?.interior || '',
        document: v.images?.document || '',
        other: v.images?.other || ''
      },
      availability: {
        availableForBooking: v.availability?.availableForBooking ?? true,
        reason: v.availability?.reason || ''
      },
      maintenanceRecords: v.maintenanceRecords || []
    });
    setActiveSubTab(1);
    setShowEditModal(true);
  };

  const openHistoryModal = (v) => {
    setSelectedVehicle(v);
    setHistorySearch('');
    setHistoryStatus('All');
    setHistoryDate('');
    setShowHistoryModal(true);
  };

  const openAvailabilityModal = (v) => {
    setSelectedVehicle(v);
    setFormData(prev => ({
      ...prev,
      availability: {
        availableForBooking: v.availability?.availableForBooking ?? true,
        reason: v.availability?.reason || ''
      }
    }));
    setShowAvailabilityModal(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const finalPayload = {
      ...formData,
      perDayRate: formData.pricingPlans.twentyFourHour.baseRate,
      perHourRate: formData.pricingPlans.hourly.rate,
      securityDeposit: formData.depositSettings.amount,
      location: formData.locationDetails.currentZone,
      type: formData.category
    };
    onUpdateVehicle(selectedVehicle.vehicleId, finalPayload);
    setShowEditModal(false);
  };

  const handleAvailabilitySubmit = (e) => {
    e.preventDefault();
    const isAvail = formData.availability.availableForBooking;
    const reason = formData.availability.reason;
    const mappedStatus = isAvail ? 'Active' : (reason || 'Maintenance');

    onToggleStatus(selectedVehicle.vehicleId, mappedStatus, reason);
    setShowAvailabilityModal(false);
  };

  const handleNestedChange = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      [category]: { ...prev[category], [field]: value }
    }));
  };

  const handlePricingPlanChange = (plan, field, value) => {
    setFormData(prev => ({
      ...prev,
      pricingPlans: {
        ...prev.pricingPlans,
        [plan]: { ...prev.pricingPlans[plan], [field]: Number(value) }
      }
    }));
  };

  const handlePaymentModeToggle = (mode) => {
    const currentModes = [...formData.paymentSettings.acceptedModes];
    const index = currentModes.indexOf(mode);
    if (index === -1) {
      currentModes.push(mode);
    } else {
      currentModes.splice(index, 1);
    }
    handleNestedChange('paymentSettings', 'acceptedModes', currentModes);
  };

  return (
    <div className="animate-slide-up">
      
      {/* 📊 KPI SUMMARY GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        
        {/* Total Vehicles Card with category strip */}
        <div className="glass-panel" style={{ padding: '16px', position: 'relative' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Vehicles</span>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', margin: '4px 0 10px 0', color: '#fff' }}>
            {totalFleet}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge badge-secondary" style={{ textTransform: 'none', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🛵 {countScooty}
            </span>
            <span className="badge badge-secondary" style={{ textTransform: 'none', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🚗 {countCar}
            </span>
            <span className="badge badge-secondary" style={{ textTransform: 'none', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🏍️ {countBike}
            </span>
          </div>
        </div>

        {/* Available Card */}
        <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--status-available)', background: 'rgba(16, 185, 129, 0.02)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--status-available)' }}>Available</span>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px', color: 'var(--status-available)' }}>
            {countAvailable}
          </div>
        </div>

        {/* Reserved Card */}
        <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--status-reserved)', background: 'rgba(245, 158, 11, 0.02)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--status-reserved)' }}>Reserved</span>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px', color: 'var(--status-reserved)' }}>
            {countReserved}
          </div>
        </div>

        {/* Pre-booked Card */}
        <div className="glass-panel" style={{ padding: '16px', borderLeft: '4px solid var(--primary)', background: 'rgba(99, 102, 241, 0.02)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>Ongoing</span>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '10px', color: 'var(--primary)' }}>
            {countPrebooked}
          </div>
        </div>

      </div>

      {/* 🔍 COLLAPSIBLE FILTER & SEARCH BAR */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
            <input 
              type="text" 
              className="form-control" 
              placeholder="Search..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'rgba(99,102,241,0.08)', 
              borderColor: 'var(--primary-glow)',
              color: 'var(--primary)'
            }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <span>⚙️</span> {showFilters ? 'Hide' : 'Show'}
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '14px' }} className="animate-fade">
            <div>
              <select className="form-control" value={selectedZone} onChange={e => setSelectedZone(e.target.value)}>
                <option value="All">All Zones</option>
                <option value="Vijay Nagar">Vijay Nagar</option>
                <option value="Bhawarkua">Bhawarkua</option>
                <option value="Rajendra Nagar">Rajendra Nagar</option>
                <option value="Palasia">Palasia</option>
              </select>
            </div>
            <div>
              <select className="form-control" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                <option value="All">All Statuses</option>
                <option value="Available">Available</option>
                <option value="Reserved">Reserved</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Out Of Service">Out Of Service</option>
              </select>
            </div>
            <div>
              <select className="form-control" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                <option value="All">All Categories</option>
                <option value="Bike">Bike</option>
                <option value="Scooty">Scooty</option>
                <option value="Car">Car</option>
                <option value="EV">EV</option>
              </select>
            </div>
            <div>
              <select className="form-control" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="Newest First">Newest First</option>
                <option value="Oldest First">Oldest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 📋 VEHICLES DATA TABLE */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>VEHICLE</th>
                <th>ACTIONS</th>
                <th>STATUS</th>
                <th>RATE</th>
                <th>SPECS</th>
                <th>LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map(v => {
                const zone = v.locationDetails?.currentZone || v.location || 'Vijay Nagar';
                const branch = v.locationDetails?.currentBranch || 'Main Branch';
                const slot = v.locationDetails?.parkingLocation || 'Slot A';
                const category = v.category || v.type || 'Car';
                const rate24h = v.pricingPlans?.twentyFourHour?.baseRate || v.perDayRate || 0;
                const rate12h = v.pricingPlans?.twelveHour?.baseRate || 500;
                const ratePerHour = v.pricingPlans?.hourly?.rate || v.perHourRate || 0;
                const isUsable = v.status === 'Active' || v.status === 'Available';

                return (
                  <tr key={v.vehicleId}>
                    {/* Column 1: VEHICLE (Icon, Name, Number, fuel label) */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.5rem' }}>
                          {category === 'Car' ? '🚗' : category === 'Scooty' ? '🛵' : '🏍️'}
                        </span>
                        <div>
                          <strong style={{ color: 'white', display: 'block' }}>{v.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                            <code>{v.regNumber}</code>
                          </span>
                          <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '2px 6px', marginTop: '3px', background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', textTransform: 'none' }}>
                            {v.fuelType}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: ACTIONS (status badge) */}
                    <td>
                      {isUsable ? (
                        <span className="badge badge-available" style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-available)' }}></span>
                          Available
                        </span>
                      ) : (
                        <span className={`badge badge-${v.status === 'Booked' ? 'ongoing' : v.status.toLowerCase()}`} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          {v.status === 'Booked' ? 'Ongoing' : v.status}
                        </span>
                      )}
                    </td>

                    {/* Column 3: STATUS (4 Buttons) */}
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {isUsable ? (
                          <button 
                            className="btn btn-success" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: '#10b981', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => onBookVehicle(v)}
                          >
                            📅 Book
                          </button>
                        ) : (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem', opacity: 0.4, cursor: 'not-allowed' }}
                            disabled
                          >
                            📅 Book
                          </button>
                        )}
                        
                        <button 
                          className="circle-action-btn view" 
                          style={{ width: '28px', height: '28px', fontSize: '0.8rem', background: '#2563eb' }}
                          title="History Log"
                          onClick={() => openHistoryModal(v)}
                        >
                          👁️
                        </button>
                        
                        <button 
                          className="circle-action-btn history" 
                          style={{ width: '28px', height: '28px', fontSize: '0.8rem', background: '#7c3aed' }}
                          title="Edit Details"
                          onClick={() => openEditModal(v)}
                        >
                          📝
                        </button>

                        <button 
                          className="circle-action-btn delete" 
                          style={{ width: '28px', height: '28px', fontSize: '0.8rem', background: '#dc2626' }}
                          title="Maintenance Status"
                          onClick={() => openAvailabilityModal(v)}
                        >
                          🔧
                        </button>
                      </div>
                    </td>

                    {/* Column 4: RATE */}
                    <td>
                      <div>
                        <strong style={{ color: 'var(--status-available)', fontSize: '0.85rem', display: 'block' }}>₹{rate24h}/24h</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>₹{rate12h}/12h</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>₹{ratePerHour}/hr</span>
                      </div>
                    </td>

                    {/* Column 5: SPECS */}
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <div>Seats: <strong>{v.seatingCapacity || 2}</strong></div>
                      <div>Color: <strong>{v.color || 'Black'}</strong></div>
                      <div>Fuel: <strong>{v.fuelCapacity || 5}L</strong></div>
                      <div>Mileage: <strong>{v.mileage || 40}kpl</strong></div>
                    </td>

                    {/* Column 6: LOCATION */}
                    <td>
                      <div>
                        <strong style={{ color: 'white', display: 'block', fontSize: '0.85rem' }}>{zone}</strong>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>{slot}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {branch} Office, Indore MP
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredVehicles.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No fleet vehicles registered matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==========================================================================
         POPUP MODAL 1: EDIT / CONFIG MODAL (📝)
         ========================================================================== */}
      {showEditModal && selectedVehicle && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '1000px', height: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
              <h2>Vehicle Configuration ({selectedVehicle.vehicleId})</h2>
              <button className="btn btn-secondary btn-icon" style={{ borderRadius: '50%' }} onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: '220px', borderRight: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.1)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {[
                  { id: 1, label: '📋 Basic Information' },
                  { id: 2, label: '🏷️ Pricing Plans' },
                  { id: 3, label: '💰 Deposit & Payment' },
                  { id: 4, label: '⚙️ Settings' },
                  { id: 5, label: '🖼️ Vehicle Images' }
                ].map(t => (
                  <button 
                    key={t.id}
                    type="button"
                    style={{ 
                      textAlign: 'left',
                      padding: '14px 18px',
                      fontSize: '0.85rem',
                      background: activeSubTab === t.id ? 'var(--primary)' : 'transparent',
                      color: activeSubTab === t.id ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.02)'
                    }}
                    onClick={() => setActiveSubTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                <form onSubmit={handleEditSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1 }}>
                    {activeSubTab === 1 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '16px' }}>📋 Basic Fleet Information</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div className="form-group">
                            <label>Basic ID</label>
                            <input type="text" className="form-control" value={selectedVehicle.vehicleId} disabled />
                          </div>
                          <div className="form-group">
                            <label>Vehicle Name</label>
                            <input type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                          </div>
                          <div className="form-group">
                            <label>Company / Brand</label>
                            <input type="text" className="form-control" value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} required />
                          </div>
                          <div className="form-group">
                            <label>Vehicle Number</label>
                            <input type="text" className="form-control" value={formData.regNumber} onChange={e => setFormData({ ...formData, regNumber: e.target.value })} required />
                          </div>
                          <div className="form-group">
                            <label>Category</label>
                            <select className="form-control" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                              <option value="Bike">Bike</option>
                              <option value="Scooty">Scooty</option>
                              <option value="Car">Car</option>
                              <option value="EV">EV</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Fuel Type</label>
                            <select className="form-control" value={formData.fuelType} onChange={e => setFormData({ ...formData, fuelType: e.target.value })}>
                              <option value="Petrol">Petrol</option>
                              <option value="Diesel">Diesel</option>
                              <option value="CNG">CNG</option>
                              <option value="EV">EV</option>
                              <option value="Petrol + CNG">Petrol + CNG</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Seating Capacity</label>
                            <input type="number" className="form-control" value={formData.seatingCapacity} onChange={e => setFormData({ ...formData, seatingCapacity: Number(e.target.value) })} min="1" />
                          </div>
                          <div className="form-group">
                            <label>Color</label>
                            <input type="text" className="form-control" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                          </div>
                          <div className="form-group">
                            <label>Meter Reading (KM)</label>
                            <input type="number" className="form-control" value={formData.meterReading} onChange={e => setFormData({ ...formData, meterReading: Number(e.target.value) })} />
                          </div>
                          <div className="form-group">
                            <label>Fuel Capacity (Liters or %)</label>
                            <input type="number" className="form-control" value={formData.fuelCapacity} onChange={e => setFormData({ ...formData, fuelCapacity: Number(e.target.value) })} />
                          </div>
                          <div className="form-group">
                            <label>Mileage (KM/L or KM/Charge)</label>
                            <input type="number" className="form-control" value={formData.mileage} onChange={e => setFormData({ ...formData, mileage: Number(e.target.value) })} />
                          </div>
                          <div className="form-group">
                            <label>Operation Zone</label>
                            <select className="form-control" value={formData.locationDetails.currentZone} onChange={e => handleNestedChange('locationDetails', 'currentZone', e.target.value)}>
                              <option value="Vijay Nagar">Vijay Nagar</option>
                              <option value="Bhawarkua">Bhawarkua</option>
                              <option value="Rajendra Nagar">Rajendra Nagar</option>
                              <option value="Palasia">Palasia</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSubTab === 2 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--secondary)', marginBottom: '16px' }}>🏷️ pricing plans</h3>
                        
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>Hourly Plan (6 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="form-group"><label>Rate Per Hour</label><input type="number" className="form-control" value={formData.pricingPlans.hourly.rate} onChange={e => handlePricingPlanChange('hourly', 'rate', e.target.value)} /></div>
                            <div className="form-group"><label>Free KM Per Hour</label><input type="number" className="form-control" value={formData.pricingPlans.hourly.freeKm} onChange={e => handlePricingPlanChange('hourly', 'freeKm', e.target.value)} /></div>
                            <div className="form-group"><label>Fuel Charge Per KM</label><input type="number" className="form-control" value={formData.pricingPlans.hourly.fuelChargePerKm} onChange={e => handlePricingPlanChange('hourly', 'fuelChargePerKm', e.target.value)} /></div>
                            <div className="form-group"><label>Extra KM Charge</label><input type="number" className="form-control" value={formData.pricingPlans.hourly.extraKmCharge} onChange={e => handlePricingPlanChange('hourly', 'extraKmCharge', e.target.value)} /></div>
                            <div className="form-group"><label>With Fuel Rate</label><input type="number" className="form-control" value={formData.pricingPlans.hourly.withFuel} onChange={e => handlePricingPlanChange('hourly', 'withFuel', e.target.value)} /></div>
                            <div className="form-group"><label>Without Fuel Rate</label><input type="number" className="form-control" value={formData.pricingPlans.hourly.withoutFuel} onChange={e => handlePricingPlanChange('hourly', 'withoutFuel', e.target.value)} /></div>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>12 Hour Plan (9 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="form-group"><label>Base Rate</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.baseRate} onChange={e => handlePricingPlanChange('twelveHour', 'baseRate', e.target.value)} /></div>
                            <div className="form-group"><label>Rate Per Hour</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.ratePerHour} onChange={e => handlePricingPlanChange('twelveHour', 'ratePerHour', e.target.value)} /></div>
                            <div className="form-group"><label>KM Limit</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.kmLimit} onChange={e => handlePricingPlanChange('twelveHour', 'kmLimit', e.target.value)} /></div>
                            <div className="form-group"><label>Fuel Charge Per KM</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.fuelChargePerKm} onChange={e => handlePricingPlanChange('twelveHour', 'fuelChargePerKm', e.target.value)} /></div>
                            <div className="form-group"><label>Extra KM Charge</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.extraKmCharge} onChange={e => handlePricingPlanChange('twelveHour', 'extraKmCharge', e.target.value)} /></div>
                            <div className="form-group"><label>Extra Hour Charge</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.extraHourCharge} onChange={e => handlePricingPlanChange('twelveHour', 'extraHourCharge', e.target.value)} /></div>
                            <div className="form-group"><label>Grace Period</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.gracePeriod} onChange={e => handlePricingPlanChange('twelveHour', 'gracePeriod', e.target.value)} /></div>
                            <div className="form-group"><label>With Fuel Price</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.withFuel} onChange={e => handlePricingPlanChange('twelveHour', 'withFuel', e.target.value)} /></div>
                            <div className="form-group"><label>Without Fuel Price</label><input type="number" className="form-control" value={formData.pricingPlans.twelveHour.withoutFuel} onChange={e => handlePricingPlanChange('twelveHour', 'withoutFuel', e.target.value)} /></div>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>24 Hour Plan (9 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="form-group"><label>Base Rate</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.baseRate} onChange={e => handlePricingPlanChange('twentyFourHour', 'baseRate', e.target.value)} /></div>
                            <div className="form-group"><label>Rate Per Hour</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.ratePerHour} onChange={e => handlePricingPlanChange('twentyFourHour', 'ratePerHour', e.target.value)} /></div>
                            <div className="form-group"><label>KM Limit</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.kmLimit} onChange={e => handlePricingPlanChange('twentyFourHour', 'kmLimit', e.target.value)} /></div>
                            <div className="form-group"><label>Fuel Charge Per KM</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.fuelChargePerKm} onChange={e => handlePricingPlanChange('twentyFourHour', 'fuelChargePerKm', e.target.value)} /></div>
                            <div className="form-group"><label>Extra KM Charge</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.extraKmCharge} onChange={e => handlePricingPlanChange('twentyFourHour', 'extraKmCharge', e.target.value)} /></div>
                            <div className="form-group"><label>Extra Hour Charge</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.extraHourCharge} onChange={e => handlePricingPlanChange('twentyFourHour', 'extraHourCharge', e.target.value)} /></div>
                            <div className="form-group"><label>Grace Period</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.gracePeriod} onChange={e => handlePricingPlanChange('twentyFourHour', 'gracePeriod', e.target.value)} /></div>
                            <div className="form-group"><label>With Fuel Price</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.withFuel} onChange={e => handlePricingPlanChange('twentyFourHour', 'withFuel', e.target.value)} /></div>
                            <div className="form-group"><label>Without Fuel Price</label><input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.withoutFuel} onChange={e => handlePricingPlanChange('twentyFourHour', 'withoutFuel', e.target.value)} /></div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px' }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>Weekly Plan (5 fields)</h4>
                            <div className="form-group"><label>Base Rate</label><input type="number" className="form-control" value={formData.pricingPlans.weekly.baseRate} onChange={e => handlePricingPlanChange('weekly', 'baseRate', e.target.value)} /></div>
                            <div className="form-group"><label>KM Limit</label><input type="number" className="form-control" value={formData.pricingPlans.weekly.kmLimit} onChange={e => handlePricingPlanChange('weekly', 'kmLimit', e.target.value)} /></div>
                            <div className="form-group"><label>Extra KM Charge</label><input type="number" className="form-control" value={formData.pricingPlans.weekly.extraKmCharge} onChange={e => handlePricingPlanChange('weekly', 'extraKmCharge', e.target.value)} /></div>
                            <div className="form-group"><label>Extra Day Charge</label><input type="number" className="form-control" value={formData.pricingPlans.weekly.extraDayCharge} onChange={e => handlePricingPlanChange('weekly', 'extraDayCharge', e.target.value)} /></div>
                            <div className="form-group"><label>Grace Period (Mins)</label><input type="number" className="form-control" value={formData.pricingPlans.weekly.gracePeriod} onChange={e => handlePricingPlanChange('weekly', 'gracePeriod', e.target.value)} /></div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px' }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>Monthly Plan (4 fields)</h4>
                            <div className="form-group"><label>Base Rate</label><input type="number" className="form-control" value={formData.pricingPlans.monthly.baseRate} onChange={e => handlePricingPlanChange('monthly', 'baseRate', e.target.value)} /></div>
                            <div className="form-group"><label>KM Limit</label><input type="number" className="form-control" value={formData.pricingPlans.monthly.kmLimit} onChange={e => handlePricingPlanChange('monthly', 'kmLimit', e.target.value)} /></div>
                            <div className="form-group"><label>Extra KM Charge</label><input type="number" className="form-control" value={formData.pricingPlans.monthly.extraKmCharge} onChange={e => handlePricingPlanChange('monthly', 'extraKmCharge', e.target.value)} /></div>
                            <div className="form-group"><label>Extra Day Charge</label><input type="number" className="form-control" value={formData.pricingPlans.monthly.extraDayCharge} onChange={e => handlePricingPlanChange('monthly', 'extraDayCharge', e.target.value)} /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSubTab === 3 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '16px' }}>💰 Deposit & Payment Settings</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                              <input type="checkbox" checked={formData.depositSettings.requireDeposit} onChange={e => handleNestedChange('depositSettings', 'requireDeposit', e.target.checked)} />
                              Require Security Deposit?
                            </label>
                            {formData.depositSettings.requireDeposit && (
                              <div className="form-group">
                                <label>Deposit Amount (₹)</label>
                                <input type="number" className="form-control" value={formData.depositSettings.amount} onChange={e => handleNestedChange('depositSettings', 'amount', Number(e.target.value))} />
                              </div>
                            )}
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '12px' }}>
                              <input type="checkbox" checked={formData.paymentSettings.advanceRequired} onChange={e => handleNestedChange('paymentSettings', 'advanceRequired', e.target.checked)} />
                              Advance Payment Required?
                            </label>
                            {formData.paymentSettings.advanceRequired && (
                              <div className="form-group">
                                <label>Percentage Required (%)</label>
                                <input type="number" className="form-control" value={formData.paymentSettings.percentage} onChange={e => handleNestedChange('paymentSettings', 'percentage', Number(e.target.value))} />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: 'bold' }}>Accepted Payment Modes</label>
                          <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
                            {['Cash', 'UPI', 'Card', 'Bank Transfer'].map(mode => (
                              <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input type="checkbox" checked={formData.paymentSettings.acceptedModes.includes(mode)} onChange={() => handlePaymentModeToggle(mode)} />
                                {mode}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSubTab === 4 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--secondary)', marginBottom: '16px' }}>⚙️ Booking Config & Settings</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div className="form-group">
                            <label>Minimum Buffer Time (Minutes)</label>
                            <input type="number" className="form-control" value={formData.bookingConfig.bufferTime} onChange={e => handleNestedChange('bookingConfig', 'bufferTime', Number(e.target.value))} />
                          </div>
                          <div className="form-group">
                            <label>Vehicle Status</label>
                            <select className="form-control" value={formData.status} onChange={e => {
                              const stat = e.target.value;
                              setFormData(prev => ({
                                ...prev,
                                status: stat,
                                bookingConfig: { ...prev.bookingConfig, status: stat },
                                availability: { ...prev.availability, availableForBooking: stat === 'Active' || stat === 'Available' }
                              }));
                            }}>
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Maintenance">Maintenance</option>
                              <option value="Out Of Service">Out Of Service</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeSubTab === 5 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '16px' }}>🖼️ Vehicle Images</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px' }}>
                          <div>
                            <div className="form-group">
                              <label>Image Type</label>
                              <select className="form-control" value={selectedImageType} onChange={e => setSelectedImageType(e.target.value)}>
                                <option value="front">Front View</option>
                                <option value="back">Back View</option>
                                <option value="left">Left View</option>
                                <option value="right">Right View</option>
                                <option value="interior">Interior View</option>
                              </select>
                            </div>
                            
                            <div 
                              style={{ border: '2px dashed var(--border-light)', padding: '20px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)', marginBottom: '12px' }}
                              onClick={() => document.getElementById('edit-file-picker').click()}
                            >
                              <span>📁 Click to browse image file</span>
                              <input id="edit-file-picker" type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e, selectedImageType)} />
                            </div>

                            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={cameraActive ? stopCamera : startCamera}>
                              📷 {cameraActive ? 'Turn Off Camera' : 'Webcam Capture'}
                            </button>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {cameraActive ? (
                              <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative', height: '200px' }}>
                                {cameraStream ? (
                                  <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                    Webcam stream simulation active. Click "Capture".
                                  </div>
                                )}
                                <div style={{ position: 'absolute', bottom: '8px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                  <button type="button" className="btn btn-accent" onClick={captureSnapshot}>Capture</button>
                                  <button type="button" className="btn btn-secondary" onClick={stopCamera}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ border: '1px solid var(--border-light)', height: '200px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {formData.images[selectedImageType] ? (
                                  <img src={formData.images[selectedImageType]} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No image uploaded.</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Save Changes</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
         POPUP MODAL 2: VEHICLE HISTORY MODAL (👁️)
         ========================================================================== */}
      {showHistoryModal && selectedVehicle && (() => {
        const matchedBookings = bookings.filter(b => b.vehicleId === selectedVehicle.vehicleId);
        const completed = matchedBookings.filter(b => b.status === 'Completed');
        const revenue = completed.reduce((sum, b) => sum + (b.settlement?.totalBill || b.baseFare || 0), 0);
        const kmDriven = completed.reduce((sum, b) => {
          const start = b.handover?.startMeter || 0;
          const end = b.dropDetails?.endMeter || 0;
          return sum + (end > start ? (end - start) : 0);
        }, 0);

        const filteredHistory = matchedBookings.filter(b => {
          if (historyStatus !== 'All' && b.status !== historyStatus) return false;
          if (historySearch) {
            const custMatch = b.customerName?.toLowerCase().includes(historySearch.toLowerCase()) || 
                              b.customer?.name?.toLowerCase().includes(historySearch.toLowerCase());
            const bIdMatch = b.bookingId?.toLowerCase().includes(historySearch.toLowerCase());
            if (!custMatch && !bIdMatch) return false;
          }
          if (historyDate) {
            const dateStr = new Date(b.pickupDate || b.rentalPeriod?.startDate).toDateString();
            const filterDateStr = new Date(historyDate).toDateString();
            if (dateStr !== filterDateStr) return false;
          }
          return true;
        });

        return (
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '850px', maxHeight: '80vh' }}>
              <div className="modal-header">
                <h2>Booking Operations History</h2>
                <button className="btn btn-secondary btn-icon" onClick={() => setShowHistoryModal(false)}>✕</button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Bookings</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '4px' }}>{matchedBookings.length}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completed Trips</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--status-available)', marginTop: '4px' }}>{completed.length}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Revenue</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginTop: '4px' }}>₹{revenue}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Odometer Driven</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--status-reserved)', marginTop: '4px' }}>{kmDriven} KM</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <input type="text" className="form-control" placeholder="Search Customer or Booking ID..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} />
                  <select className="form-control" value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}>
                    <option value="All">All Statuses</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <input type="date" className="form-control" value={historyDate} onChange={e => setHistoryDate(e.target.value)} />
                </div>

                <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Customer</th>
                        <th>Pickup Date</th>
                        <th>Return Date</th>
                        <th>Status</th>
                        <th>Amount</th>
                        <th>KM Driven</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(b => {
                        const start = b.handover?.startMeter || 0;
                        const end = b.dropDetails?.endMeter || 0;
                        const finalAmt = b.settlement?.totalBill || b.finalAmount || b.baseFare || 0;
                        return (
                          <tr key={b.bookingId}>
                            <td><code>{b.bookingId}</code></td>
                            <td>{b.customerName || b.customer?.name}</td>
                            <td>{new Date(b.pickupDate || b.rentalPeriod?.startDate).toLocaleDateString()}</td>
                            <td>{new Date(b.expectedDropDate || b.rentalPeriod?.expectedEndDate).toLocaleDateString()}</td>
                            <td><span className={`badge badge-${b.status.toLowerCase()}`}>{b.status}</span></td>
                            <td>₹{finalAmt}</td>
                            <td>{b.status === 'Completed' ? `${end - start} KM` : 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==========================================================================
         POPUP MODAL 3: AVAILABILITY / MAINTENANCE MODAL (🔧)
         ========================================================================== */}
      {showAvailabilityModal && selectedVehicle && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Set Availability / Maintenance</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowAvailabilityModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleAvailabilitySubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Available For Booking</label>
                  <select className="form-control" value={formData.availability.availableForBooking ? 'Yes' : 'No'} onChange={e => handleNestedChange('availability', 'availableForBooking', e.target.value === 'Yes')}>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {!formData.availability.availableForBooking && (
                  <div className="form-group animate-fade">
                    <label>blockage reason</label>
                    <select className="form-control" value={formData.availability.reason} onChange={e => handleNestedChange('availability', 'reason', e.target.value)} required>
                      <option value="">Select reason...</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Accident">Accident</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Out Of Service">Out Of Service</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAvailabilityModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Settings</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
