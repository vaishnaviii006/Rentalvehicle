import React, { useState, useEffect, useRef } from 'react';

export default function VehicleManagement({ vehicles, bookings = [], onAddVehicle, onUpdateVehicle, onToggleStatus }) {
  // Search & Filter state variables
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('All Zones');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('Newest First');
  const [showFilters, setShowFilters] = useState(true);

  // Modal display controllers
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Selected vehicle object for modals
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // Active sub-tab in Details / Edit modal (1 to 5)
  const [activeSubTab, setActiveSubTab] = useState(1);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Camera integration state variables
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [selectedImageType, setSelectedImageType] = useState('front');
  const videoRef = useRef(null);

  // Add Vehicle Form state
  const [addFormData, setAddFormData] = useState({
    name: '',
    brand: 'Honda',
    regNumber: '',
    category: 'Scooty',
    fuelType: 'Petrol',
    description: '',
    zone: 'Vijay Nagar',
    branch: 'Vijay Nagar Branch'
  });

  // Edit / Config Form state
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

  // History filtering state variables
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('All');
  const [historyDate, setHistoryDate] = useState('');

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
      setCameraActive(true); // Open container for mock simulation
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
        images: {
          ...prev.images,
          [selectedImageType]: base64Str
        }
      }));
      stopCamera();
    } else {
      // Mock snapshot creation
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      // Gradient background
      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);
      
      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`SNAP: ${selectedImageType.toUpperCase()}`, 50, 100);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Reg: ${formData.regNumber || 'New Registration'}`, 50, 140);
      ctx.fillText(`Captured: ${new Date().toLocaleString()}`, 50, 175);
      
      // Decorative motor shape
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(220, 300, 40, 0, Math.PI * 2);
      ctx.arc(420, 300, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(200, 240, 240, 40);
      
      const base64Str = canvas.toDataURL('image/jpeg');
      setFormData(prev => ({
        ...prev,
        images: {
          ...prev.images,
          [selectedImageType]: base64Str
        }
      }));
      setCameraActive(false);
      alert(`Simulation snapshot created for: ${selectedImageType}`);
    }
  };

  // Cleanup stream on unmount
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
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const nameMatch = v.name?.toLowerCase().includes(query);
        const numMatch = v.regNumber?.toLowerCase().includes(query);
        const brandMatch = v.brand?.toLowerCase().includes(query);
        if (!nameMatch && !numMatch && !brandMatch) return false;
      }

      // 2. Zone
      const zone = v.locationDetails?.currentZone || v.location || 'Vijay Nagar';
      if (selectedZone !== 'All Zones' && zone !== selectedZone) return false;

      // 3. Status
      if (selectedStatus !== 'All Status') {
        if (selectedStatus === 'Ongoing') {
          if (v.status !== 'Ongoing' && v.status !== 'Booked') return false;
        } else {
          if (v.status !== selectedStatus) return false;
        }
      }

      // 4. Category
      const cat = v.category || v.type || 'Car';
      if (selectedCategory !== 'All Categories' && cat !== selectedCategory) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'Newest First') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortBy === 'Oldest First') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortBy === 'Name A-Z') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'Name Z-A') {
        return (b.name || '').localeCompare(a.name || '');
      }
      return 0;
    });

  // ----------------------------------------------------
  // MODAL OPEN TRIGGERS
  // ----------------------------------------------------
  const openAddModal = () => {
    setAddFormData({
      name: '',
      brand: 'Honda',
      regNumber: '',
      category: 'Scooty',
      fuelType: 'Petrol',
      description: '',
      zone: 'Vijay Nagar',
      branch: 'Vijay Nagar Branch'
    });
    setShowAddModal(true);
  };

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

  const openLocationModal = (v) => {
    setSelectedVehicle(v);
    setFormData(prev => ({
      ...prev,
      locationDetails: {
        currentZone: v.locationDetails?.currentZone || v.location || 'Vijay Nagar',
        currentBranch: v.locationDetails?.currentBranch || 'Main Branch',
        parkingLocation: v.locationDetails?.parkingLocation || '',
        gps: {
          lat: v.locationDetails?.gps?.lat ?? 22.7196,
          lng: v.locationDetails?.gps?.lng ?? 75.8577
        }
      }
    }));
    setShowLocationModal(true);
  };

  const openDeleteModal = (v) => {
    setSelectedVehicle(v);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  // ----------------------------------------------------
  // SUBMISSIONS
  // ----------------------------------------------------
  const handleAddSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: addFormData.name,
      brand: addFormData.brand,
      regNumber: addFormData.regNumber,
      category: addFormData.category,
      fuelType: addFormData.fuelType,
      description: addFormData.description,
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
      locationDetails: {
        currentZone: addFormData.zone,
        currentBranch: addFormData.branch,
        parkingLocation: '',
        gps: { lat: 22.7196, lng: 75.8577 }
      },
      documents: { rcUrl: '', insuranceUrl: '', pucUrl: '', fitnessUrl: '' },
      images: { front: '', back: '', left: '', right: '', interior: '', document: '', other: '' },
      availability: { availableForBooking: true, reason: '' },
      seatingCapacity: addFormData.category === 'Car' ? 5 : 2,
      color: 'White',
      meterReading: 0,
      fuelCapacity: addFormData.category === 'Car' ? 40 : 6,
      mileage: addFormData.category === 'Car' ? 18 : 45,
      maintenanceRecords: [],
      auditLogs: []
    };

    onAddVehicle(payload);
    setShowAddModal(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();

    // Map compatibility values back
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

  const handleLocationSubmit = (e) => {
    e.preventDefault();
    const updatedPayload = {
      ...selectedVehicle,
      locationDetails: {
        ...selectedVehicle.locationDetails,
        currentZone: formData.locationDetails.currentZone,
        currentBranch: formData.locationDetails.currentBranch,
        parkingLocation: formData.locationDetails.parkingLocation,
        gps: formData.locationDetails.gps
      },
      location: formData.locationDetails.currentZone
    };
    onUpdateVehicle(selectedVehicle.vehicleId, updatedPayload);
    setShowLocationModal(false);
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    if (deleteConfirmText !== 'DELETE') {
      return alert('Please type DELETE to confirm vehicle deletion.');
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/vehicles/${selectedVehicle.vehicleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Vehicle deleted successfully.');
        window.location.reload();
      } else {
        alert('Failed to delete vehicle.');
      }
    } catch (err) {
      console.warn("Offline simulation: Deleting vehicle locally.");
      alert('Local Mode: Vehicle deleted from local memory array.');
      window.location.reload();
    }
  };

  // ----------------------------------------------------
  // HELPERS
  // ----------------------------------------------------
  const handleNestedChange = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const handlePricingPlanChange = (plan, field, value) => {
    setFormData(prev => ({
      ...prev,
      pricingPlans: {
        ...prev.pricingPlans,
        [plan]: {
          ...prev.pricingPlans[plan],
          [field]: Number(value)
        }
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

  const handleFileChange = (e, imgType) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          images: {
            ...prev.images,
            [imgType]: reader.result
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderVehiclePlaceholder = (category) => {
    if (category === 'Car') {
      return (
        <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.8 16 10 16 10s-1.3-3.8-1.7-4.2C13.9 5.3 13 5 12 5H7c-.9 0-1.7.3-2.1.8C4.5 6.2 3 10 3 10S.3 10.8.1 11.1C0 11.4 0 11.7 0 12v4c0 .6.4 1 1 1h2m16 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10h12l-1.5-4h-9L6 10Z" />
        </svg>
      );
    }
    if (category === 'Bike') {
      return (
        <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <circle cx="5" cy="18" r="3" />
          <circle cx="19" cy="18" r="3" />
          <path d="M12 18V9m0 0l-5 5m5-5h5l2-4m-2 4h-5V5m0 0H8m4 0h3" />
        </svg>
      );
    }
    if (category === 'Scooty') {
      return (
        <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <circle cx="6" cy="18" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M6 18c0-3.5 2.5-6.5 6-6.5h3c.8 0 1.5-.7 1.5-1.5V6m0 0h-2m2 0l2 2m-8.5 2.5V7m-3 11h9" />
        </svg>
      );
    }
    // EV
    return (
      <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="var(--accent)" strokeWidth="1.5">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.8 16 10 16 10s-1.3-3.8-1.7-4.2C13.9 5.3 13 5 12 5H7c-.9 0-1.7.3-2.1.8C4.5 6.2 3 10 3 10S.3 10.8.1 11.1C0 11.4 0 11.7 0 12v4c0 .6.4 1 1 1h2m16 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM12 8l-2 3h4l-2 3" />
      </svg>
    );
  };

  return (
    <div className="animate-slide-up">
      {/* 1. MODULE HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>Vehicle Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your vehicle inventory</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <span>➕</span> Add Vehicle
        </button>
      </div>

      {/* 2. SEARCH & FILTERS SECTION */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFilters ? '16px' : '0' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>Filters & Search</h3>
          <button 
            className="btn btn-secondary" 
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.85rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'rgba(99, 102, 241, 0.1)', 
              borderColor: 'var(--primary-glow)' 
            }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <span>🔍</span> {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'center' }} className="animate-fade">
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search Vehicle Name or Number..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <div>
              <select className="form-control" value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                <option value="All Zones">All Zones</option>
                <option value="Vijay Nagar">Vijay Nagar</option>
                <option value="Bhawarkua">Bhawarkua</option>
                <option value="Rajendra Nagar">Rajendra Nagar</option>
                <option value="Palasia">Palasia</option>
              </select>
            </div>

            <div>
              <select className="form-control" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="All Status">All Status</option>
                <option value="Active">Active</option>
                <option value="Reserved">Reserved</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Out Of Service">Out Of Service</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <select className="form-control" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="All Categories">All Categories</option>
                <option value="Bike">Bike</option>
                <option value="Scooty">Scooty</option>
                <option value="Car">Car</option>
                <option value="EV">EV</option>
              </select>
            </div>

            <div>
              <select className="form-control" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="Newest First">Newest First</option>
                <option value="Oldest First">Oldest First</option>
                <option value="Name A-Z">Name A-Z</option>
                <option value="Name Z-A">Name Z-A</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 3. VEHICLE CARDS GRID */}
      <div className="vehicles-grid animate-fade">
        {filteredVehicles.map(v => (
          <div key={v.vehicleId} className="vehicle-grid-card">
            
            {/* Status Badges Floating Top-Left */}
            <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 10 }}>
              <span className={`badge badge-${(v.status === 'Booked' ? 'ongoing' : (v.status || 'Active').toLowerCase())}`}>{v.status === 'Booked' ? 'Ongoing' : (v.status || 'Active')}</span>
              {/* Stacked indicator if reservation is blocked */}
              {v.availability?.availableForBooking === false && (
                <span className="badge badge-maintenance" style={{ fontSize: '0.65rem' }}>Blocked</span>
              )}
            </div>

            {/* Circular Actions Floating Top-Right */}
            <div className="card-header-actions">
              <button className="circle-action-btn view" title="Details / Config" onClick={() => openEditModal(v)}>👁️</button>
              <button className="circle-action-btn history" title="Rent History" onClick={() => openHistoryModal(v)}>🕒</button>
              <button className="circle-action-btn availability" title="Booking Permission" onClick={() => openAvailabilityModal(v)}>🟢</button>
              <button className="circle-action-btn location" title="Coordinate Location" onClick={() => openLocationModal(v)}>📍</button>
              <button className="circle-action-btn delete" title="Delete Fleet Item" onClick={() => openDeleteModal(v)}>🗑️</button>
            </div>

            {/* Vehicle Image View */}
            <div className="vehicle-card-image-wrapper">
              {v.images?.front ? (
                <img src={v.images.front} alt={v.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div className="vehicle-card-image-placeholder">
                  {renderVehiclePlaceholder(v.category || v.type)}
                </div>
              )}
            </div>

            {/* Vehicle Card Info Footer */}
            <div className="vehicle-card-info-wrapper">
              <div className="vehicle-card-info-title">{v.name}</div>
              <div className="vehicle-card-info-subtitle">{v.regNumber}</div>
              <div className="vehicle-card-info-bottom">
                <div className="vehicle-card-info-price">
                  ₹{v.pricingPlans?.twentyFourHour?.baseRate || v.perDayRate || 0}/day • ₹{v.pricingPlans?.hourly?.rate || v.perHourRate || 0}/hr
                </div>
                <div className="vehicle-card-info-zone">
                  📍 {v.locationDetails?.currentZone || v.location || 'Vijay Nagar'}
                </div>
              </div>
            </div>

          </div>
        ))}

        {filteredVehicles.length === 0 && (
          <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h3>No vehicles match your search filter criteria.</h3>
            <p style={{ marginTop: '8px' }}>Try resetting filters or registering a new fleet item.</p>
          </div>
        )}
      </div>

      {/* ==========================================================================
         4. ADD VEHICLE MODAL (Dedicated Popup)
         ========================================================================== */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>Register New Vehicle</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Vehicle Name</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Honda Activa 6G"
                      value={addFormData.name} 
                      onChange={e => setAddFormData({ ...addFormData, name: e.target.value })} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Company / Brand</label>
                    <select 
                      className="form-control"
                      value={addFormData.brand}
                      onChange={e => setAddFormData({ ...addFormData, brand: e.target.value })}
                    >
                      <option value="Honda">Honda</option>
                      <option value="TVS">TVS</option>
                      <option value="Hero">Hero</option>
                      <option value="Bajaj">Bajaj</option>
                      <option value="Yamaha">Yamaha</option>
                      <option value="Suzuki">Suzuki</option>
                      <option value="Hyundai">Hyundai</option>
                      <option value="Tata">Tata</option>
                      <option value="Mahindra">Mahindra</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Vehicle Number</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. MP09AB1234"
                      value={addFormData.regNumber} 
                      onChange={e => setAddFormData({ ...addFormData, regNumber: e.target.value })} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select 
                      className="form-control"
                      value={addFormData.category}
                      onChange={e => setAddFormData({ ...addFormData, category: e.target.value })}
                    >
                      <option value="Bike">Bike</option>
                      <option value="Scooty">Scooty</option>
                      <option value="Car">Car</option>
                      <option value="EV">EV</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Fuel Type</label>
                    <select 
                      className="form-control"
                      value={addFormData.fuelType}
                      onChange={e => setAddFormData({ ...addFormData, fuelType: e.target.value })}
                    >
                      <option value="Petrol">Petrol</option>
                      <option value="Diesel">Diesel</option>
                      <option value="CNG">CNG</option>
                      <option value="EV">EV</option>
                      <option value="Petrol + CNG">Petrol + CNG</option>
                      <option value="Diesel + CNG">Diesel + CNG</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Operation Zone</label>
                    <select 
                      className="form-control"
                      value={addFormData.zone}
                      onChange={e => setAddFormData({ ...addFormData, zone: e.target.value })}
                    >
                      <option value="Vijay Nagar">Vijay Nagar</option>
                      <option value="Bhawarkua">Bhawarkua</option>
                      <option value="Rajendra Nagar">Rajendra Nagar</option>
                      <option value="Palasia">Palasia</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Zone Branch Location</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="e.g. Main Branch"
                      value={addFormData.branch}
                      onChange={e => setAddFormData({ ...addFormData, branch: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Generate ID Preview</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={`VEH-${String(vehicles.length + 1).padStart(5, '0')}`} 
                      disabled 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>Description Note</label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    placeholder="Provide vehicle condition, keys instructions, etc."
                    value={addFormData.description} 
                    onChange={e => setAddFormData({ ...addFormData, description: e.target.value })} 
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Vehicle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
         5. EDIT / CONFIG MODAL (Tabbed popup - 👁️)
         ========================================================================== */}
      {showEditModal && selectedVehicle && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '1000px', height: '85vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            
            <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-light)' }}>
              <h2>Vehicle Configuration ({selectedVehicle.vehicleId})</h2>
              <button className="btn btn-secondary btn-icon" style={{ borderRadius: '50%' }} onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              
              {/* Tab Selector Sidebar */}
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
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      transition: 'all 0.3s'
                    }}
                    onClick={() => setActiveSubTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Form Content panel */}
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                <form onSubmit={handleEditSubmit} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ flex: 1 }}>
                    
                    {/* TAB 1: BASIC INFORMATION */}
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
                            <input 
                              type="text" 
                              className="form-control" 
                              value={formData.name} 
                              onChange={e => setFormData({ ...formData, name: e.target.value })} 
                              required 
                            />
                          </div>

                          <div className="form-group">
                            <label>Company / Brand</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              value={formData.brand} 
                              onChange={e => setFormData({ ...formData, brand: e.target.value })} 
                              required 
                            />
                          </div>

                          <div className="form-group">
                            <label>Vehicle Number</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              value={formData.regNumber} 
                              onChange={e => setFormData({ ...formData, regNumber: e.target.value })} 
                              required 
                            />
                          </div>

                          <div className="form-group">
                            <label>Category</label>
                            <select 
                              className="form-control" 
                              value={formData.category} 
                              onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                              <option value="Bike">Bike</option>
                              <option value="Scooty">Scooty</option>
                              <option value="Car">Car</option>
                              <option value="EV">EV</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Fuel Type</label>
                            <select 
                              className="form-control" 
                              value={formData.fuelType} 
                              onChange={e => setFormData({ ...formData, fuelType: e.target.value })}
                            >
                              <option value="Petrol">Petrol</option>
                              <option value="Diesel">Diesel</option>
                              <option value="CNG">CNG</option>
                              <option value="EV">EV</option>
                              <option value="Petrol + CNG">Petrol + CNG</option>
                              <option value="Diesel + CNG">Diesel + CNG</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Seating Capacity</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={formData.seatingCapacity} 
                              onChange={e => setFormData({ ...formData, seatingCapacity: Number(e.target.value) })} 
                              min="1" 
                            />
                          </div>

                          <div className="form-group">
                            <label>Color</label>
                            <input 
                              type="text" 
                              className="form-control" 
                              value={formData.color} 
                              onChange={e => setFormData({ ...formData, color: e.target.value })} 
                            />
                          </div>

                          <div className="form-group">
                            <label>Meter Reading (KM)</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={formData.meterReading} 
                              onChange={e => setFormData({ ...formData, meterReading: Number(e.target.value) })} 
                            />
                          </div>

                          <div className="form-group">
                            <label>Fuel Capacity (Liters or %)</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={formData.fuelCapacity} 
                              onChange={e => setFormData({ ...formData, fuelCapacity: Number(e.target.value) })} 
                            />
                          </div>

                          <div className="form-group">
                            <label>Mileage (KM/L or KM/Charge)</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={formData.mileage} 
                              onChange={e => setFormData({ ...formData, mileage: Number(e.target.value) })} 
                            />
                          </div>

                          <div className="form-group">
                            <label>Operation Zone</label>
                            <select 
                              className="form-control" 
                              value={formData.locationDetails.currentZone} 
                              onChange={e => handleNestedChange('locationDetails', 'currentZone', e.target.value)}
                            >
                              <option value="Vijay Nagar">Vijay Nagar</option>
                              <option value="Bhawarkua">Bhawarkua</option>
                              <option value="Rajendra Nagar">Rajendra Nagar</option>
                              <option value="Palasia">Palasia</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-group" style={{ marginTop: '12px' }}>
                          <label>Description</label>
                          <textarea 
                            className="form-control" 
                            rows="2" 
                            value={formData.description} 
                            onChange={e => setFormData({ ...formData, description: e.target.value })} 
                          />
                        </div>
                      </div>
                    )}

                    {/* TAB 2: PRICING PLANS */}
                    {activeSubTab === 2 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--secondary)', marginBottom: '16px' }}>🏷️ Multi-Plan Pricing Parameters</h3>
                        
                        {/* 1. Hourly Plan */}
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>Hourly Plan limits (6 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Rate Per Hour (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.hourly.rate} onChange={e => handlePricingPlanChange('hourly', 'rate', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Free KM Per Hour</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.hourly.freeKm} onChange={e => handlePricingPlanChange('hourly', 'freeKm', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Fuel Charge Per KM (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.hourly.fuelChargePerKm} onChange={e => handlePricingPlanChange('hourly', 'fuelChargePerKm', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra KM Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.hourly.extraKmCharge} onChange={e => handlePricingPlanChange('hourly', 'extraKmCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>With Fuel Rate (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.hourly.withFuel} onChange={e => handlePricingPlanChange('hourly', 'withFuel', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Without Fuel Rate (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.hourly.withoutFuel} onChange={e => handlePricingPlanChange('hourly', 'withoutFuel', e.target.value)} />
                            </div>
                          </div>
                        </div>

                        {/* 2. 12 Hour Plan */}
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>12 Hour Plan configs (9 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Base Rate (12h) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.baseRate} onChange={e => handlePricingPlanChange('twelveHour', 'baseRate', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Rate Per Hour (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.ratePerHour} onChange={e => handlePricingPlanChange('twelveHour', 'ratePerHour', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>KM Limit (12h)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.kmLimit} onChange={e => handlePricingPlanChange('twelveHour', 'kmLimit', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Fuel Charge Per KM (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.fuelChargePerKm} onChange={e => handlePricingPlanChange('twelveHour', 'fuelChargePerKm', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra KM Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.extraKmCharge} onChange={e => handlePricingPlanChange('twelveHour', 'extraKmCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra Hour Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.extraHourCharge} onChange={e => handlePricingPlanChange('twelveHour', 'extraHourCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Grace Period (Minutes)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.gracePeriod} onChange={e => handlePricingPlanChange('twelveHour', 'gracePeriod', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>With Fuel Price (12h) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.withFuel} onChange={e => handlePricingPlanChange('twelveHour', 'withFuel', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Without Fuel Price (12h) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twelveHour.withoutFuel} onChange={e => handlePricingPlanChange('twelveHour', 'withoutFuel', e.target.value)} />
                            </div>
                          </div>
                        </div>

                        {/* 3. 24 Hour Plan */}
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>24 Hour Plan configs (9 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Base Rate (24h) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.baseRate} onChange={e => handlePricingPlanChange('twentyFourHour', 'baseRate', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Rate Per Hour (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.ratePerHour} onChange={e => handlePricingPlanChange('twentyFourHour', 'ratePerHour', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>KM Limit (24h)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.kmLimit} onChange={e => handlePricingPlanChange('twentyFourHour', 'kmLimit', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Fuel Charge Per KM (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.fuelChargePerKm} onChange={e => handlePricingPlanChange('twentyFourHour', 'fuelChargePerKm', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra KM Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.extraKmCharge} onChange={e => handlePricingPlanChange('twentyFourHour', 'extraKmCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra Hour Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.extraHourCharge} onChange={e => handlePricingPlanChange('twentyFourHour', 'extraHourCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Grace Period (Minutes)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.gracePeriod} onChange={e => handlePricingPlanChange('twentyFourHour', 'gracePeriod', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>With Fuel Price (24h) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.withFuel} onChange={e => handlePricingPlanChange('twentyFourHour', 'withFuel', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Without Fuel Price (24h) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.twentyFourHour.withoutFuel} onChange={e => handlePricingPlanChange('twentyFourHour', 'withoutFuel', e.target.value)} />
                            </div>
                          </div>
                        </div>

                        {/* 4. Weekly Plan */}
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>Weekly Plan parameters (5 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Base Rate (Weekly) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.weekly.baseRate} onChange={e => handlePricingPlanChange('weekly', 'baseRate', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>KM Limit (Weekly)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.weekly.kmLimit} onChange={e => handlePricingPlanChange('weekly', 'kmLimit', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra KM Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.weekly.extraKmCharge} onChange={e => handlePricingPlanChange('weekly', 'extraKmCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra Day Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.weekly.extraDayCharge} onChange={e => handlePricingPlanChange('weekly', 'extraDayCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Grace Period (Minutes)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.weekly.gracePeriod} onChange={e => handlePricingPlanChange('weekly', 'gracePeriod', e.target.value)} />
                            </div>
                          </div>
                        </div>

                        {/* 5. Monthly Plan */}
                        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '6px' }}>
                          <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '8px' }}>Monthly Plan parameters (4 fields)</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Base Rate (Monthly) (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.monthly.baseRate} onChange={e => handlePricingPlanChange('monthly', 'baseRate', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>KM Limit (Monthly)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.monthly.kmLimit} onChange={e => handlePricingPlanChange('monthly', 'kmLimit', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra KM Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.monthly.extraKmCharge} onChange={e => handlePricingPlanChange('monthly', 'extraKmCharge', e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Extra Day Charge (₹)</label>
                              <input type="number" className="form-control" value={formData.pricingPlans.monthly.extraDayCharge} onChange={e => handlePricingPlanChange('monthly', 'extraDayCharge', e.target.value)} />
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* TAB 3: DEPOSIT & PAYMENT */}
                    {activeSubTab === 3 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '16px' }}>💰 Deposit & Advance reservation</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px' }}>
                            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '12px' }}>Deposit Configuration</h4>
                            
                            <div className="form-group">
                              <label>Require Security Deposit</label>
                              <select 
                                className="form-control"
                                value={formData.depositSettings.requireDeposit ? 'Yes' : 'No'}
                                onChange={e => handleNestedChange('depositSettings', 'requireDeposit', e.target.value === 'Yes')}
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>

                            {formData.depositSettings.requireDeposit && (
                              <div className="form-group">
                                <label>Deposit Amount (₹)</label>
                                <input 
                                  type="number" 
                                  className="form-control" 
                                  value={formData.depositSettings.amount} 
                                  onChange={e => handleNestedChange('depositSettings', 'amount', Number(e.target.value))} 
                                />
                              </div>
                            )}
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px' }}>
                            <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '12px' }}>Payment Configuration</h4>
                            
                            <div className="form-group">
                              <label>Advance Payment Required</label>
                              <select 
                                className="form-control"
                                value={formData.paymentSettings.advanceRequired ? 'Yes' : 'No'}
                                onChange={e => handleNestedChange('paymentSettings', 'advanceRequired', e.target.value === 'Yes')}
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>

                            {formData.paymentSettings.advanceRequired && (
                              <div className="form-group animate-fade">
                                <label>Required Payment Percentage (%)</label>
                                <input 
                                  type="number" 
                                  className="form-control" 
                                  value={formData.paymentSettings.percentage} 
                                  onChange={e => handleNestedChange('paymentSettings', 'percentage', Number(e.target.value))} 
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="form-group">
                          <label style={{ fontWeight: 'bold' }}>Accepted Payment Modes</label>
                          <div style={{ display: 'flex', gap: '20px', marginTop: '6px' }}>
                            {['Cash', 'UPI', 'Card', 'Bank Transfer'].map(mode => (
                              <label key={mode} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input 
                                  type="checkbox" 
                                  checked={formData.paymentSettings.acceptedModes.includes(mode)}
                                  onChange={() => handlePaymentModeToggle(mode)}
                                />
                                {mode}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 4: SETTINGS */}
                    {activeSubTab === 4 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--secondary)', marginBottom: '16px' }}>⚙️ Booking settings</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                          <div className="form-group">
                            <label>Minimum Buffer Time (Minutes)</label>
                            <input 
                              type="number" 
                              className="form-control" 
                              value={formData.bookingConfig.bufferTime} 
                              onChange={e => handleNestedChange('bookingConfig', 'bufferTime', Number(e.target.value))} 
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required turnaround gap between rentals.</span>
                          </div>

                          <div className="form-group">
                            <label>Vehicle Status</label>
                            <select 
                              className="form-control"
                              value={formData.status}
                              onChange={e => {
                                const newStat = e.target.value;
                                setFormData(prev => ({
                                  ...prev,
                                  status: newStat,
                                  bookingConfig: { ...prev.bookingConfig, status: newStat },
                                  availability: {
                                    ...prev.availability,
                                    availableForBooking: newStat === 'Active' || newStat === 'Available'
                                  }
                                }));
                              }}
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Maintenance">Maintenance</option>
                              <option value="Out Of Service">Out Of Service</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Booking Enabled</label>
                            <select 
                              className="form-control"
                              value={formData.bookingConfig.bookingEnabled ? 'Yes' : 'No'}
                              onChange={e => handleNestedChange('bookingConfig', 'bookingEnabled', e.target.value === 'Yes')}
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Instant Booking</label>
                            <select 
                              className="form-control"
                              value={formData.bookingConfig.instantBooking ? 'Enable' : 'Disable'}
                              onChange={e => handleNestedChange('bookingConfig', 'instantBooking', e.target.value === 'Enable')}
                            >
                              <option value="Enable">Enable</option>
                              <option value="Disable">Disable</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 5: IMAGES */}
                    {activeSubTab === 5 && (
                      <div className="animate-fade">
                        <h3 style={{ fontSize: '1rem', color: 'var(--accent)', marginBottom: '16px' }}>🖼️ Vehicle Gallery Uploads</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px' }}>
                          <div>
                            <div className="form-group">
                              <label>Select Image Type to Upload/Capture</label>
                              <select 
                                className="form-control" 
                                value={selectedImageType} 
                                onChange={e => setSelectedImageType(e.target.value)}
                              >
                                <option value="front">Front View</option>
                                <option value="back">Back View</option>
                                <option value="left">Left View</option>
                                <option value="right">Right View</option>
                                <option value="interior">Interior View</option>
                                <option value="document">Registration Document</option>
                                <option value="other">Other View</option>
                              </select>
                            </div>

                            {/* Drag and Drop Zone */}
                            <div 
                              style={{ 
                                border: '2px dashed var(--border-light)', 
                                padding: '24px', 
                                borderRadius: '8px', 
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: 'rgba(255, 255, 255, 0.01)',
                                marginBottom: '16px'
                              }}
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => {
                                e.preventDefault();
                                const file = e.dataTransfer.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setFormData(prev => ({
                                      ...prev,
                                      images: { ...prev.images, [selectedImageType]: reader.result }
                                    }));
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              onClick={() => document.getElementById('file-picker-elem').click()}
                            >
                              <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '8px' }}>📁</span>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Drag & Drop Image or Click to Browse</span>
                              <input 
                                id="file-picker-elem"
                                type="file" 
                                accept="image/*" 
                                style={{ display: 'none' }} 
                                onChange={e => handleFileChange(e, selectedImageType)} 
                              />
                            </div>

                            {/* Camera Actions */}
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              style={{ width: '100%', marginBottom: '8px' }}
                              onClick={cameraActive ? stopCamera : startCamera}
                            >
                              📷 {cameraActive ? 'Turn Off Camera' : 'Take Picture with Camera'}
                            </button>
                          </div>

                          {/* Image Preview / Live Camera Feed */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Selected Image Type Preview ({selectedImageType.toUpperCase()})
                            </h4>

                            {cameraActive ? (
                              <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', position: 'relative', height: '240px' }}>
                                {cameraStream ? (
                                  <video 
                                    ref={videoRef} 
                                    autoPlay 
                                    playsInline 
                                    id="camera-feed"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                  />
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', height: '100%', color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                                    Offline simulation active. Click "Capture Snapshot" to generate mock canvas illustration.
                                  </div>
                                )}
                                
                                <div style={{ position: 'absolute', bottom: '12px', left: '0', right: '0', display: 'flex', justifyContent: 'center', gap: '10px', zIndex: 20 }}>
                                  <button type="button" className="btn btn-accent" onClick={captureSnapshot}>Capture Snapshot</button>
                                  <button type="button" className="btn btn-secondary" onClick={stopCamera}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ border: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.1)', height: '240px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {formData.images[selectedImageType] ? (
                                  <img 
                                    src={formData.images[selectedImageType]} 
                                    alt="Preview" 
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                                  />
                                ) : (
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No image uploaded for this category yet.</div>
                                )}
                              </div>
                            )}

                            {/* Small gallery icons strip */}
                            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
                              {['front', 'back', 'left', 'right', 'interior', 'document', 'other'].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setSelectedImageType(type)}
                                  style={{
                                    border: selectedImageType === type ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    background: selectedImageType === type ? 'rgba(99,102,241,0.1)' : 'transparent',
                                    color: formData.images[type] ? 'var(--status-available)' : 'var(--text-muted)',
                                    fontSize: '0.7rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {type.toUpperCase()} {formData.images[type] ? '✓' : ''}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                  <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', paddingBottom: '8px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
         6. VEHICLE HISTORY MODAL (Dedicated Popup - 🕒)
         ========================================================================== */}
      {showHistoryModal && selectedVehicle && (() => {
        // Dynamic aggregations from bookings database
        const matchedBookings = bookings.filter(b => b.vehicleId === selectedVehicle.vehicleId);
        const completed = matchedBookings.filter(b => b.status === 'Completed');
        const revenue = completed.reduce((sum, b) => sum + (b.settlement?.totalBill || b.baseFare || 0), 0);
        const kmDriven = completed.reduce((sum, b) => {
          const start = b.handover?.startMeter || 0;
          const end = b.dropDetails?.endMeter || 0;
          return sum + (end > start ? (end - start) : 0);
        }, 0);

        // Filter search logic
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
            <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '900px', maxHeight: '85vh' }}>
              <div className="modal-header">
                <h2>Vehicle Operations History</h2>
                <button className="btn btn-secondary btn-icon" onClick={() => setShowHistoryModal(false)}>✕</button>
              </div>

              <div className="modal-body" style={{ overflowY: 'auto' }}>
                {/* Profile Header */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ width: '100px', height: '60px', borderRadius: '4px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedVehicle.images?.front ? (
                      <img src={selectedVehicle.images.front} alt="front" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                      renderVehiclePlaceholder(selectedVehicle.category)
                    )}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedVehicle.name}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <code>{selectedVehicle.regNumber}</code> • {selectedVehicle.category} • {selectedVehicle.locationDetails?.currentZone || selectedVehicle.location}
                    </p>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span className={`badge badge-${selectedVehicle.status === 'Booked' ? 'ongoing' : selectedVehicle.status.toLowerCase()}`}>{selectedVehicle.status === 'Booked' ? 'Ongoing' : selectedVehicle.status}</span>
                  </div>
                </div>

                {/* Statistics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Bookings</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '4px' }}>{matchedBookings.length}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completed Trips</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--status-available)', marginTop: '4px' }}>{completed.length}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Revenue</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'white', marginTop: '4px' }}>₹{revenue}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>KM Driven</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--status-reserved)', marginTop: '4px' }}>{kmDriven} KM</div>
                  </div>
                </div>

                {/* History Filter inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Search Customer or Booking ID..." 
                    value={historySearch} 
                    onChange={e => setHistorySearch(e.target.value)} 
                  />
                  <select 
                    className="form-control" 
                    value={historyStatus} 
                    onChange={e => setHistoryStatus(e.target.value)}
                  >
                    <option value="All">All Status</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={historyDate} 
                    onChange={e => setHistoryDate(e.target.value)} 
                  />
                </div>

                {/* Booking Logs Table */}
                <div className="table-responsive" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        <th>Customer</th>
                        <th>Pickup</th>
                        <th>Return</th>
                        <th>Status</th>
                        <th>Amount</th>
                        <th>KM Used</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map(b => {
                        const startM = b.handover?.startMeter || 0;
                        const endM = b.dropDetails?.endMeter || 0;
                        const kmUsed = endM > startM ? (endM - startM) : 0;
                        const finalAmt = b.settlement?.totalBill || b.finalAmount || b.baseFare || 0;
                        const pickupDate = new Date(b.pickupDate || b.rentalPeriod?.startDate).toLocaleDateString();
                        const dropDate = b.dropDetails?.actualTime 
                          ? new Date(b.dropDetails.actualTime).toLocaleDateString()
                          : new Date(b.expectedDropDate || b.rentalPeriod?.expectedEndDate).toLocaleDateString();

                        return (
                          <tr key={b.bookingId}>
                            <td><code>{b.bookingId}</code></td>
                            <td>{b.customerName || b.customer?.name}</td>
                            <td>{pickupDate}</td>
                            <td>{dropDate}</td>
                            <td>
                              <span className={`badge badge-${b.status.toLowerCase()}`}>{b.status}</span>
                            </td>
                            <td>₹{finalAmt}</td>
                            <td>{b.status === 'Completed' ? `${kmUsed} KM` : 'N/A'}</td>
                          </tr>
                        );
                      })}
                      {filteredHistory.length === 0 && (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                            No operations logs found matching criteria.
                          </td>
                        </tr>
                      )}
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
         7. AVAILABILITY MODAL (Dedicated Popup - 🟢)
         ========================================================================== */}
      {showAvailabilityModal && selectedVehicle && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Booking Availability Status</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowAvailabilityModal(false)}>✕</button>
            </div>

            <form onSubmit={handleAvailabilitySubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Available For Booking</label>
                  <select 
                    className="form-control"
                    value={formData.availability.availableForBooking ? 'Yes' : 'No'}
                    onChange={e => handleNestedChange('availability', 'availableForBooking', e.target.value === 'Yes')}
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>

                {!formData.availability.availableForBooking && (
                  <div className="form-group animate-fade">
                    <label>Reason If Disabled</label>
                    <select 
                      className="form-control"
                      value={formData.availability.reason}
                      onChange={e => handleNestedChange('availability', 'reason', e.target.value)}
                      required
                    >
                      <option value="">Select reason...</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Accident">Accident</option>
                      <option value="Reserved">Reserved</option>
                      <option value="Out Of Service">Out Of Service</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginTop: '12px' }}>
                  If disabled, this vehicle will be hidden from dispatcher checkout screens and worker panels.
                </span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAvailabilityModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Availability</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
         8. LOCATION MODAL (Dedicated Popup - 📍)
         ========================================================================== */}
      {showLocationModal && selectedVehicle && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Vehicle Coordinate Location</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowLocationModal(false)}>✕</button>
            </div>

            <form onSubmit={handleLocationSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Current Zone</label>
                  <select 
                    className="form-control"
                    value={formData.locationDetails.currentZone}
                    onChange={e => handleNestedChange('locationDetails', 'currentZone', e.target.value)}
                  >
                    <option value="Vijay Nagar">Vijay Nagar</option>
                    <option value="Bhawarkua">Bhawarkua</option>
                    <option value="Rajendra Nagar">Rajendra Nagar</option>
                    <option value="Palasia">Palasia</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Current Branch</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={formData.locationDetails.currentBranch}
                    onChange={e => handleNestedChange('locationDetails', 'currentBranch', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Parking Location</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="e.g. Basement A-12, Slot 34"
                    value={formData.locationDetails.parkingLocation}
                    onChange={e => handleNestedChange('locationDetails', 'parkingLocation', e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label>GPS Latitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={formData.locationDetails.gps.lat}
                      onChange={e => {
                        const newLat = Number(e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          locationDetails: {
                            ...prev.locationDetails,
                            gps: { ...prev.locationDetails.gps, lat: newLat }
                          }
                        }));
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>GPS Longitude (Optional)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control"
                      value={formData.locationDetails.gps.lng}
                      onChange={e => {
                        const newLng = Number(e.target.value);
                        setFormData(prev => ({
                          ...prev,
                          locationDetails: {
                            ...prev.locationDetails,
                            gps: { ...prev.locationDetails.gps, lng: newLng }
                          }
                        }));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLocationModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Location</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
         9. DELETE MODAL (Dedicated Popup - 🗑️)
         ========================================================================== */}
      {showDeleteModal && selectedVehicle && (() => {
        const bookingsCount = bookings.filter(b => b.vehicleId === selectedVehicle.vehicleId).length;
        return (
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ width: '90%', maxWidth: '450px' }}>
              <div className="modal-header">
                <h2>Delete Vehicle</h2>
                <button className="btn btn-secondary btn-icon" onClick={() => setShowDeleteModal(false)}>✕</button>
              </div>

              <form onSubmit={handleDeleteSubmit}>
                <div className="modal-body">
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
                    <h3 style={{ color: 'var(--status-cancelled)', fontSize: '1rem', marginBottom: '8px' }}>⚠️ Warning: Dangerous Action</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      You are about to permanently delete <strong>{selectedVehicle.name}</strong> (<code>{selectedVehicle.regNumber}</code>) from the ERP node registry.
                    </p>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    <div style={{ margin: '4px 0' }}>• Current Status: <strong style={{ color: 'white' }}>{selectedVehicle.status}</strong></div>
                    <div style={{ margin: '4px 0' }}>• Total Bookings History: <strong style={{ color: 'white' }}>{bookingsCount} Bookings</strong></div>
                  </div>

                  <div className="form-group">
                    <label style={{ fontWeight: 'bold' }}>To confirm delete, type <span style={{ color: 'var(--status-cancelled)' }}>DELETE</span> below:</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Type DELETE..." 
                      value={deleteConfirmText} 
                      onChange={e => setDeleteConfirmText(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                  <button 
                    type="submit" 
                    className="btn btn-danger" 
                    disabled={deleteConfirmText !== 'DELETE'}
                  >
                    Delete Vehicle Permanently
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
