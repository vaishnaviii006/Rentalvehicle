import React, { useState, useEffect, useRef } from 'react';

export default function BookingForm({ vehicle, onConfirmBooking, onCancel, currentWorker }) {
  // Section 1: Customer Information
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [altPhoneNumber, setAltPhoneNumber] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [email, setEmail] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Section 2: Vehicle Handover
  const [startMeter, setStartMeter] = useState(vehicle.meterReading || 0);
  const [includeFuel, setIncludeFuel] = useState(false);

  // Section 3: Rental Period
  const getDefaultDates = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + (30 - (now.getMinutes() % 30)));
    now.setSeconds(0);
    now.setMilliseconds(0);

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const formatLocal = (d) => {
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d - tzOffset).toISOString().slice(0, 16);
    };
    return { pickup: formatLocal(now), drop: formatLocal(tomorrow) };
  };

  const dates = getDefaultDates();
  const [pickupDate, setPickupDate] = useState(dates.pickup);
  const [expectedDropDate, setExpectedDropDate] = useState(dates.drop);

  const isScooty = vehicle.category?.toLowerCase() === 'scooty';
  const isCar = vehicle.category?.toLowerCase() === 'car';
  const isBike = vehicle.category?.toLowerCase() === 'bike';

  // Section 4: Select Plan
  const [selectedPlanType, setSelectedPlanType] = useState('24-Hour');
  const [planRate, setPlanRate] = useState(0);
  const [planKmLimit, setPlanKmLimit] = useState(0);
  const [planExtraKm, setPlanExtraKm] = useState(0);
  const [planExtraHour, setPlanExtraHour] = useState(0);

  const addHoursToDateString = (dateStr, hours) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setHours(d.getHours() + hours);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d - tzOffset).toISOString().slice(0, 16);
  };

  const getHoursDifference = (startStr, endStr) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diffMs = end.getTime() - start.getTime();
    if (isNaN(diffMs) || diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60));
  };

  const getPlanDuration = (planType, fuel) => {
    if (planType === 'Hourly') {
      return fuel ? 1 : 5;
    }
    if (planType === '12-Hour') {
      return 12;
    }
    if (planType === '24-Hour') {
      return 24;
    }
    return 24; // Default
  };

  const handlePlanChange = (planType) => {
    if (isCar && planType === 'Hourly') return;
    setSelectedPlanType(planType);
    const duration = getPlanDuration(planType, includeFuel);
    const newDropDate = addHoursToDateString(pickupDate, duration);
    setExpectedDropDate(newDropDate);
  };

  const handlePickupDateChange = (val) => {
    setPickupDate(val);
    const duration = getPlanDuration(selectedPlanType, includeFuel);
    const newDropDate = addHoursToDateString(val, duration);
    setExpectedDropDate(newDropDate);
  };

  const handleDropDateChange = (val) => {
    setExpectedDropDate(val);
    const diffHours = getHoursDifference(pickupDate, val);
    if (diffHours <= 0) return;

    let targetPlan = '24-Hour';
    if (isCar) {
      if (diffHours <= 12) {
        targetPlan = '12-Hour';
      } else {
        targetPlan = '24-Hour';
      }
    } else if (isScooty && includeFuel) {
      targetPlan = 'Hourly';
    } else {
      if (diffHours <= 5) {
        targetPlan = 'Hourly';
      } else if (diffHours <= 12) {
        targetPlan = '12-Hour';
      } else {
        targetPlan = '24-Hour';
      }
    }
    setSelectedPlanType(targetPlan);
  };

  const handleIncludeFuelChange = (checked) => {
    setIncludeFuel(checked);
    if (checked) {
      // Force Hourly
      setSelectedPlanType('Hourly');
      const newDropDate = addHoursToDateString(pickupDate, 1);
      setExpectedDropDate(newDropDate);
    } else {
      // Keep Hourly but set duration to 5 hours
      if (selectedPlanType === 'Hourly') {
        const newDropDate = addHoursToDateString(pickupDate, 5);
        setExpectedDropDate(newDropDate);
      }
    }
  };

  // Reset includeFuel if vehicle category is not Scooty
  useEffect(() => {
    if (!isScooty) {
      setIncludeFuel(false);
    }
  }, [vehicle, isScooty]);

  // Sync plan parameters when plan type or vehicle changes
  useEffect(() => {
    const plans = vehicle.pricingPlans || {};
    if (isBike) {
      if (selectedPlanType === 'Hourly') {
        const rateField = plans.hourly?.rate || vehicle.perHourRate || 100;
        setPlanRate(rateField);
        setPlanExtraKm(plans.hourly?.extraKmCharge || 8);
        setPlanExtraHour(rateField);
      } else if (selectedPlanType === '12-Hour') {
        const p = plans.twelveHour || {};
        setPlanRate(p.baseRate || 1200);
        setPlanExtraKm(p.extraKmCharge || 8);
        setPlanExtraHour(p.extraHourCharge || plans.hourly?.rate || 100);
      } else if (selectedPlanType === '24-Hour') {
        const p = plans.twentyFourHour || {};
        setPlanRate(p.baseRate || vehicle.perDayRate || 2400);
        setPlanExtraKm(p.extraKmCharge || 8);
        setPlanExtraHour(p.extraHourCharge || plans.hourly?.rate || 100);
      }
    } else if (isCar) {
      if (selectedPlanType === '12-Hour') {
        const p = plans.twelveHour || {};
        setPlanRate(p.baseRate || 2500);
        setPlanExtraKm(p.extraKmCharge || 12);
        setPlanExtraHour(p.extraHourCharge || 200);
      } else if (selectedPlanType === '24-Hour') {
        const p = plans.twentyFourHour || {};
        setPlanRate(p.baseRate || vehicle.perDayRate || 4500);
        setPlanExtraKm(p.extraKmCharge || 12);
        setPlanExtraHour(p.extraHourCharge || 200);
      }
    } else {
      // Scooty
      if (selectedPlanType === 'Hourly') {
        const isScootyFuel = isScooty && includeFuel;
        const rateField = isScootyFuel 
          ? (plans.hourly?.withFuel || vehicle.perHourRate || 60)
          : (plans.hourly?.rate || vehicle.perHourRate || 40);

        setPlanRate(rateField);
        setPlanExtraKm(plans.hourly?.extraKmCharge || 5);
        setPlanExtraHour(rateField);
      } else if (selectedPlanType === '12-Hour') {
        const p = plans.twelveHour || {};
        setPlanRate(p.baseRate || 350);
        setPlanExtraKm(p.extraKmCharge || 5);
        setPlanExtraHour(p.extraHourCharge || 40);
      } else if (selectedPlanType === '24-Hour') {
        const p = plans.twentyFourHour || {};
        setPlanRate(p.baseRate || vehicle.perDayRate || 500);
        setPlanExtraKm(p.extraKmCharge || 5);
        setPlanExtraHour(p.extraHourCharge || 30);
      }
    }
  }, [selectedPlanType, vehicle, includeFuel, isScooty, isBike, isCar]);

  // Section 5: Add-ons
  const [helmetsCount, setHelmetsCount] = useState(0);
  const helmetsPrice = 50;

  const getDefaultDeposit = () => {
    const isB = vehicle.category?.toLowerCase() === 'bike';
    const isC = vehicle.category?.toLowerCase() === 'car';
    if (isC) return vehicle.depositSettings?.amount ?? vehicle.securityDeposit ?? 5000;
    if (isB) return vehicle.depositSettings?.amount ?? vehicle.securityDeposit ?? 3000;
    return vehicle.depositSettings?.amount ?? vehicle.securityDeposit ?? 1000;
  };

  const [securityDeposit, setSecurityDeposit] = useState(getDefaultDeposit());

  useEffect(() => {
    setSecurityDeposit(getDefaultDeposit());
  }, [vehicle]);
  
  // Deposit Payment mode details (Cash, Online, Mixed)
  const [depositMethod, setDepositMethod] = useState('Cash'); // 'Cash' | 'Online' | 'Mixed'
  const [depositCash, setDepositCash] = useState(vehicle.depositSettings?.amount ?? vehicle.securityDeposit ?? 200);
  const [depositOnline, setDepositOnline] = useState(0);

  // Sync deposit mode values when securityDeposit or depositMethod changes
  useEffect(() => {
    if (depositMethod === 'Cash') {
      setDepositCash(securityDeposit);
      setDepositOnline(0);
    } else if (depositMethod === 'Online') {
      setDepositCash(0);
      setDepositOnline(securityDeposit);
    } else if (depositMethod === 'Mixed') {
      // Re-initialize split only if they don't sum to current securityDeposit
      if (depositCash + depositOnline !== securityDeposit) {
        setDepositCash(Math.ceil(securityDeposit / 2));
        setDepositOnline(Math.floor(securityDeposit / 2));
      }
    }
  }, [securityDeposit, depositMethod]);

  const handleDepositCashChange = (val) => {
    const cash = Math.min(securityDeposit, Math.max(0, val));
    setDepositCash(cash);
    setDepositOnline(securityDeposit - cash);
  };

  const handleDepositOnlineChange = (val) => {
    const online = Math.min(securityDeposit, Math.max(0, val));
    setDepositOnline(online);
    setDepositCash(securityDeposit - online);
  };

  // Section 6: Payment Collection
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'UPI' | 'Card' | 'Mixed'
  const [cashReceived, setCashReceived] = useState(0);
  const [upiTxnId, setUpiTxnId] = useState('');
  const [upiAmount, setUpiAmount] = useState(0);
  const [cardRef, setCardRef] = useState('');
  const [cardAmount, setCardAmount] = useState(0);
  const [mixedCash, setMixedCash] = useState(0);
  const [mixedOnline, setMixedOnline] = useState(0);

  // Discount settings
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState('₹'); // '₹' | '%'

  // Section 7: Billing Summary Collapsible accordion
  const [showBillingSummary, setShowBillingSummary] = useState(true);

  // Section 8: Customer Documents Upload & Camera
  const [showDocuments, setShowDocuments] = useState(true);
  const [docAadhaarFront, setDocAadhaarFront] = useState('');
  const [docAadhaarBack, setDocAadhaarBack] = useState('');
  const [docLicense, setDocLicense] = useState('');
  const [docRegistration, setDocRegistration] = useState('');

  // Camera settings
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [activeDocType, setActiveDocType] = useState(''); // 'aadhaarFront' | 'aadhaarBack' | 'dl' | 'registration'
  const videoRef = useRef(null);

  // Section 9: Notes
  const [bookingNotes, setBookingNotes] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // ----------------------------------------------------
  // WEBCAM LOGIC FOR DOCS
  // ----------------------------------------------------
  const startCamera = async (docType) => {
    setActiveDocType(docType);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setCameraStream(stream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera hardware access denied. Running simulation.", err);
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

  const captureDocSnapshot = () => {
    if (cameraStream && videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Str = canvas.toDataURL('image/jpeg');
      saveDocImage(base64Str);
      stopCamera();
    } else {
      // Simulate doc scan
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 640, 400);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 600, 360);
      
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${activeDocType.toUpperCase()} DOCUMENT MOCK SCAN`, 50, 80);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Customer Name: ${fullName || 'Guest'}`, 50, 130);
      ctx.fillText(`Timestamp: ${new Date().toLocaleString()}`, 50, 160);
      
      // Draw signature or card details
      ctx.fillStyle = '#334155';
      ctx.fillRect(400, 200, 180, 120);
      ctx.strokeStyle = '#64748b';
      ctx.strokeRect(400, 200, 180, 120);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText("PHOTO ID", 450, 260);

      const base64Str = canvas.toDataURL('image/jpeg');
      saveDocImage(base64Str);
      setCameraActive(false);
      alert(`Simulation document scan saved for: ${activeDocType}`);
    }
  };

  const saveDocImage = (base64Str) => {
    if (activeDocType === 'aadhaarFront') setDocAadhaarFront(base64Str);
    if (activeDocType === 'aadhaarBack') setDocAadhaarBack(base64Str);
    if (activeDocType === 'dl') setDocLicense(base64Str);
    if (activeDocType === 'registration') setDocRegistration(base64Str);
  };

  const handleDocFileChange = (e, docType) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (docType === 'aadhaarFront') setDocAadhaarFront(reader.result);
        if (docType === 'aadhaarBack') setDocAadhaarBack(reader.result);
        if (docType === 'dl') setDocLicense(reader.result);
        if (docType === 'registration') setDocRegistration(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // ----------------------------------------------------
  // COMPUTATIONAL ENGINE WITH DETAILED BUSINESS LOGIC
  // ----------------------------------------------------
  const calculateBilling = () => {
    let hours = 0;
    let days = 0;
    let durationText = '';
    let isMinBilling = false;
    let kmLimit = 0;

    if (!pickupDate || !expectedDropDate) {
      return { durationText: '0 Hour(s)', cost: 0, deposit: 0, helmets: 0, grossTotal: 0, moneyReceived: 0, outstanding: 0, discountVal: 0, originalCost: 0, isMinBilling: false, kmLimit: 0 };
    }
    
    const start = new Date(pickupDate);
    const end = new Date(expectedDropDate);
    const diffMs = end.getTime() - start.getTime();

    if (isNaN(diffMs) || diffMs <= 0) {
      return { durationText: '0 Hour(s)', cost: 0, deposit: 0, helmets: 0, grossTotal: 0, moneyReceived: 0, outstanding: 0, discountVal: 0, originalCost: 0, isMinBilling: false, kmLimit: 0 };
    }

    hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    days = Math.ceil(hours / 24);
    durationText = hours >= 24 ? `${days} Day(s) (${hours} hr)` : `${hours} Hour(s)`;

    let cost = 0;

    if (selectedPlanType === 'Hourly') {
      if (isBike) {
        cost = hours * planRate;
      } else if (isScooty) {
        // Rule: Minimum 5-hour booking charge if fuel is NOT included
        if (!includeFuel) {
          if (hours < 5) {
            cost = 5 * planRate;
            isMinBilling = true;
          } else {
            cost = hours * planRate;
          }
        } else {
          cost = hours * planRate;
        }
      } else {
        cost = hours * planRate;
      }
    } else if (selectedPlanType === '12-Hour') {
      cost = planRate;
      if (hours > 12) {
        cost += (hours - 12) * planExtraHour;
      }
    } else if (selectedPlanType === '24-Hour') {
      cost = planRate;
      if (hours > 24) {
        cost += (hours - 24) * planExtraHour;
      }
    }

    // Dynamic Included KM Limit based on Category and Plan
    if (isBike || isCar) {
      kmLimit = hours * 10;
    } else if (isScooty) {
      if (includeFuel) {
        kmLimit = 0;
      } else {
        if (selectedPlanType === 'Hourly') {
          kmLimit = hours * 10;
        } else if (selectedPlanType === '12-Hour') {
          kmLimit = 120;
        } else if (selectedPlanType === '24-Hour') {
          kmLimit = 240;
        }
      }
    } else {
      kmLimit = hours * 10;
    }

    // Rule: Helmet 1 unit free, extra units ₹50/each
    const helmets = helmetsCount > 1 ? (helmetsCount - 1) * helmetsPrice : 0;
    const deposit = Number(securityDeposit) || 0;
    
    // Rule: Discount applies strictly to the rental cost (before addons or deposit)
    let discVal = 0;
    if (discountType === '₹') {
      discVal = Number(discountAmount) || 0;
    } else {
      discVal = (cost * (Number(discountAmount) || 0)) / 100;
    }
    
    // Ensure discount doesn't exceed cost itself
    discVal = Math.min(cost, discVal);
    const costAfterDiscount = cost - discVal;

    const grossTotal = costAfterDiscount + helmets + deposit;

    // Payments received calculation
    let moneyReceived = 0;
    if (paymentMethod === 'Cash') {
      moneyReceived = Number(cashReceived) || 0;
    } else if (paymentMethod === 'UPI') {
      moneyReceived = Number(upiAmount) || 0;
    } else if (paymentMethod === 'Card') {
      moneyReceived = Number(cardAmount) || 0;
    } else if (paymentMethod === 'Mixed') {
      moneyReceived = (Number(mixedCash) || 0) + (Number(mixedOnline) || 0);
    }

    const outstanding = Math.max(0, grossTotal - moneyReceived);

    return {
      durationText,
      cost,
      deposit,
      helmets,
      grossTotal,
      moneyReceived,
      outstanding,
      discountVal: discVal,
      isMinBilling,
      kmLimit
    };
  };

  const bill = calculateBilling();
  const rentalCostTotal = Math.max(0, bill.cost - bill.discountVal) + bill.helmets;
  const depositCollected = Number(depositCash) + Number(depositOnline);
  const totalBookingValue = rentalCostTotal + bill.deposit;
  const totalCollected = bill.moneyReceived + depositCollected;
  const pendingCollection = Math.max(0, totalBookingValue - totalCollected);

  // ----------------------------------------------------
  // SUBMIT HANDLER
  // ----------------------------------------------------
  const handleCheckoutSubmit = (e) => {
    e.preventDefault();

    if (!fullName.trim()) return alert("Full Name is required.");
    if (!phoneNumber.trim() || phoneNumber.length < 10) return alert("Please enter a valid 10-digit phone number.");

    const start = new Date(pickupDate);
    const end = new Date(expectedDropDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return alert("Please enter valid pickup and expected return dates.");
    }
    if (end <= start) {
      return alert("Expected Return Date & Time must be after pickup Date & Time.");
    }

    // Enforce 12-Hour Car Minimum Validation
    const durationHours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
    if (isCar && durationHours < 12) {
      return alert("Minimum booking duration for Car is 12 hours.");
    }
    
    // Validate mixed deposit split matches
    if (depositMethod === 'Mixed') {
      const sum = Number(depositCash) + Number(depositOnline);
      if (sum !== Number(securityDeposit)) {
        return alert(`Mixed Deposit Error: Cash (₹${depositCash}) + Online (₹${depositOnline}) must equal required Security Deposit (₹${securityDeposit}).`);
      }
    }

    const rentalCostTotal = Math.max(0, bill.cost - bill.discountVal) + bill.helmets;
    const outstandingRentalCost = Math.max(0, rentalCostTotal - bill.moneyReceived);
    const depositCollected = Number(depositCash) + Number(depositOnline);

    const isFuture = new Date(pickupDate) > new Date();
    const initialStatus = isFuture ? 'Reserved' : 'Ongoing';

    const finalPayload = {
      customer: {
        name: fullName,
        fatherName,
        phone: phoneNumber,
        alternatePhone: altPhoneNumber,
        email,
        drivingLicense: docLicense ? 'Scan Attached' : '',
        aadhaar: docAadhaarFront ? 'Scan Attached' : '',
        docAadhaarFront: docAadhaarFront || '',
        docAadhaarBack: docAadhaarBack || '',
        docLicense: docLicense || '',
        docRegistration: docRegistration || '',
        address: { street: streetAddress, city, state, pincode }
      },
      vehicleId: vehicle.vehicleId,
      rentalPeriod: {
        startDate: new Date(pickupDate),
        expectedEndDate: new Date(expectedDropDate),
        ...(initialStatus === 'Ongoing' && { actualPickupDate: new Date(pickupDate) })
      },
      ...(initialStatus === 'Ongoing' && { actualPickupDate: new Date(pickupDate) }),
      handover: {
        startMeter: Number(startMeter),
        fuelIncluded: includeFuel
      },
      selectedPlan: {
        planType: selectedPlanType,
        rate: planRate,
        kmLimit: bill.kmLimit,
        extraKmCharge: planExtraKm,
        extraHourCharge: planExtraHour
      },
      addons: {
        helmetsCount: Number(helmetsCount),
        helmetsPrice: helmetsPrice,
        otherAccessories: bookingNotes
      },
      paymentCollection: [
        {
          mode: paymentMethod,
          amount: bill.moneyReceived,
          transactionId: paymentMethod === 'UPI' ? upiTxnId : paymentMethod === 'Card' ? cardRef : '',
          reference: paymentMethod === 'Mixed' ? `Cash: ${mixedCash}, Online: ${mixedOnline}` : 'Advance Checkout',
          timestamp: new Date().toISOString()
        }
      ],
      accessoriesChecklist: {
        helmetCount: Number(helmetsCount),
        toolkit: true,
        spareTyre: false,
        firstAid: true
      },
      settlement: {
        totalBill: rentalCostTotal,
        actualBill: rentalCostTotal,
        previousPaid: bill.moneyReceived,
        depositCollected: depositCollected,
        depositRefund: 0,
        depositRefundMode: '',
        depositRefundReason: '',
        remainingToPay: outstandingRentalCost
      },
      // Save details about security deposit split
      depositDetails: {
        mode: depositMethod,
        cashAmount: Number(depositCash),
        onlineAmount: Number(depositOnline)
      },
      status: initialStatus,
      workerId: currentWorker || 'System',
      revisions: [{
        revisionNumber: 1,
        actionType: 'Create',
        description: initialStatus === 'Ongoing' 
          ? `Booking created and handover completed immediately for ${fullName}. Vehicle: ${vehicle?.name} (${vehicle?.regNumber}).`
          : `Booking created and reserved for ${fullName}. Vehicle: ${vehicle?.name} (${vehicle?.regNumber}).`,
        operator: currentWorker || 'System',
        timestamp: new Date().toISOString(),
        reason: initialStatus === 'Ongoing' ? 'Immediate Handover' : 'Initial Reservation',
        oldValues: {
          rentalCost: 0,
          deposit: 0,
          bookingValue: 0,
          rentalPaid: 0,
          depositCollected: 0,
          outstandingRent: 0,
          pendingDeposit: 0
        },
        newValues: {
          rentalCost: rentalCostTotal,
          deposit: depositCollected,
          bookingValue: rentalCostTotal + depositCollected,
          rentalPaid: bill.moneyReceived,
          depositCollected: depositCollected,
          outstandingRent: outstandingRentalCost,
          pendingDeposit: 0
        },
        difference: {
          rentalCost: rentalCostTotal,
          deposit: depositCollected,
          bookingValue: rentalCostTotal + depositCollected,
          rentalPaid: bill.moneyReceived,
          depositCollected: depositCollected
        },
        financialSnapshotAfterChange: {
          rentalCost: rentalCostTotal,
          depositHeld: depositCollected,
          bookingValue: rentalCostTotal + depositCollected,
          rentalPaid: bill.moneyReceived,
          depositCollected: depositCollected,
          outstandingRent: outstandingRentalCost,
          pendingDeposit: 0,
          paymentBreakdown: {
            rentalCash: paymentMethod === 'Cash' ? bill.moneyReceived : paymentMethod === 'Mixed' ? Number(mixedCash || 0) : 0,
            rentalOnline: ['UPI', 'Online', 'Bank Transfer'].includes(paymentMethod) ? bill.moneyReceived : paymentMethod === 'Mixed' ? Number(mixedOnline || 0) : 0,
            rentalCard: paymentMethod === 'Card' ? bill.moneyReceived : 0,
            depositCash: depositMethod === 'Cash' ? depositCollected : depositMethod === 'Mixed' ? Number(depositCash || 0) : 0,
            depositOnline: ['Online', 'UPI', 'Card'].includes(depositMethod) ? depositCollected : depositMethod === 'Mixed' ? Number(depositOnline || 0) : 0,
            depositCard: 0
          }
        },
        vehicleDetails: {
          newVehicleId: vehicle.vehicleId,
          newVehicleName: vehicle?.name,
          newVehicleReg: vehicle?.regNumber,
          newPricing: rentalCostTotal,
          newDeposit: depositCollected
        }
      }],
      
      // Legacy compatibility mappings
      customerName: fullName,
      customerPhone: phoneNumber,
      customerIdProof: docAadhaarFront ? 'Aadhaar Scan Attached' : 'Details Provided',
      pickupDate,
      expectedDropDate,
      pickupLocation: city || 'Vijay Nagar',
      dropLocation: city || 'Vijay Nagar',
      perDayRate: selectedPlanType.includes('24') ? planRate : 0,
      perHourRate: selectedPlanType.includes('Hour') ? planRate : 0,
      discount: bill.discountVal,
      advancePaid: bill.moneyReceived,
      securityDeposit: bill.deposit,
      durationHours: durationHours,
      durationDays: Math.ceil(durationHours / 24),
      baseFare: bill.cost,
      finalAmount: outstandingRentalCost,
      paymentMethod,
      settled: outstandingRentalCost === 0
    };

    onConfirmBooking(finalPayload);
  };

  return (
    <div className="glass-panel animate-slide-up" style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', background: 'var(--bg-glass)' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.75rem' }}>🛵</span>
          <div>
            <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-primary)' }}>{vehicle.name}</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><code>{vehicle.regNumber}</code></span>
          </div>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={onCancel} style={{ borderRadius: '50%' }}>✕</button>
      </div>

      <form onSubmit={handleCheckoutSubmit}>
        
        {/* SECTION 1: CUSTOMER INFORMATION */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👤 Customer Information
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Full Name *</label>
              <input type="text" className="form-control" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Father's Name (Optional)</label>
              <input type="text" className="form-control" placeholder="Father's Name" value={fatherName} onChange={e => setFatherName(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Phone Number *</label>
              <input type="tel" className="form-control" placeholder="Phone Number (10 digits)" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Alternate Number (Optional)</label>
              <input type="tel" className="form-control" placeholder="Alternate Number" value={altPhoneNumber} onChange={e => setAltPhoneNumber(e.target.value)} />
            </div>
          </div>

          {/* Collapsible Optional Details */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setShowOptionalDetails(!showOptionalDetails)}
            >
              <span>📍 Optional Details (Email & Address)</span>
              <span>{showOptionalDetails ? '▲' : '▼'}</span>
            </button>

            {showOptionalDetails && (
              <div className="animate-fade" style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Email Address</label>
                  <input type="email" className="form-control" placeholder="name@domain.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Street Address</label>
                  <input type="text" className="form-control" placeholder="Street Address" value={streetAddress} onChange={e => setStreetAddress(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>City</label>
                    <input type="text" className="form-control" value={city} onChange={e => setCity(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>State</label>
                    <input type="text" className="form-control" value={state} onChange={e => setState(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Pincode</label>
                    <input type="text" className="form-control" value={pincode} onChange={e => setPincode(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: VEHICLE HANDOVER */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🔑 Vehicle Handover
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: isScooty ? '1.2fr 1fr' : '1fr', gap: '16px', alignItems: 'center' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Start Meter Reading (KM) *</label>
              <input type="number" className="form-control" value={startMeter} onChange={e => setStartMeter(Number(e.target.value))} required />
            </div>

            {/* Rule: Fuel option is visible ONLY for Scooties */}
            {isScooty && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.9rem', fontWeight: 'bold' }}>
                  <input 
                    type="checkbox" 
                    checked={includeFuel} 
                    onChange={e => handleIncludeFuelChange(e.target.checked)} 
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} 
                  />
                  Include Fuel in Rental
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>
                  Locks plan to Hourly + Fuel surcharge.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: RENTAL PERIOD */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📅 Rental Period
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Start Date & Time</label>
              <input 
                type="datetime-local" 
                className="form-control" 
                value={pickupDate} 
                onChange={e => handlePickupDateChange(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>End Date & Time</label>
              <input 
                type="datetime-local" 
                className="form-control" 
                value={expectedDropDate} 
                onChange={e => handleDropDateChange(e.target.value)} 
                required 
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: SELECT PLAN */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏷️ Select Pricing Plan
          </h4>
          
          {(() => {
            const availablePlans = [
              { 
                type: 'Hourly', 
                label: 'Hourly', 
                rate: (isScooty && includeFuel) 
                  ? (vehicle.pricingPlans?.hourly?.withFuel || vehicle.perHourRate || 60)
                  : isBike
                    ? (vehicle.pricingPlans?.hourly?.rate || vehicle.perHourRate || 100)
                    : (vehicle.pricingPlans?.hourly?.rate || vehicle.perHourRate || 40), 
                limit: (isScooty && includeFuel)
                  ? `Fuel Surcharge: ₹${vehicle.pricingPlans?.hourly?.fuelChargePerKm || 2}/KM`
                  : `10 KM/hr Limit`,
                disabled: isCar 
              },
              { 
                type: '12-Hour', 
                label: '12 Hour', 
                rate: isCar
                  ? (vehicle.pricingPlans?.twelveHour?.baseRate || 2500)
                  : isBike
                    ? (vehicle.pricingPlans?.twelveHour?.baseRate || 1200)
                    : (vehicle.pricingPlans?.twelveHour?.baseRate || 350), 
                limit: isCar || isBike
                  ? `10 KM/hr Limit`
                  : `${vehicle.pricingPlans?.twelveHour?.kmLimit || 60} KM Limit`,
                disabled: isScooty && includeFuel
              },
              { 
                type: '24-Hour', 
                label: '24 Hour', 
                rate: isCar
                  ? (vehicle.pricingPlans?.twentyFourHour?.baseRate || 4500)
                  : isBike
                    ? (vehicle.pricingPlans?.twentyFourHour?.baseRate || 2400)
                    : (vehicle.pricingPlans?.twentyFourHour?.baseRate || 500), 
                limit: isCar || isBike
                  ? `10 KM/hr Limit`
                  : `${vehicle.pricingPlans?.twentyFourHour?.kmLimit || 120} KM Limit`,
                disabled: isScooty && includeFuel
              }
            ].filter(plan => !plan.disabled);

            return (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${availablePlans.length}, 1fr)`, gap: '8px', marginBottom: '10px' }}>
                {availablePlans.map(plan => (
                  <label 
                    key={plan.type}
                    style={{ 
                      border: '1px solid ' + (selectedPlanType === plan.type ? 'var(--primary)' : 'var(--border-light)'),
                      background: selectedPlanType === plan.type 
                        ? 'rgba(99, 102, 241, 0.1)' 
                        : 'rgba(255,255,255,0.01)',
                      padding: '10px',
                      borderRadius: '6px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      margin: 0
                    }}
                  >
                    <input 
                      type="radio" 
                      name="pricing_plan_select"
                      checked={selectedPlanType === plan.type} 
                      onChange={() => handlePlanChange(plan.type)} 
                      style={{ marginTop: '3px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.85rem' }}>{plan.label}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 'bold' }}>₹{plan.rate}</span>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{plan.limit}</span>
                    </div>
                  </label>
                ))}
              </div>
            );
          })()}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ opacity: 0.25, border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)', padding: '8px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              📅 Weekly Plan (Future coming soon)
            </div>
            <div style={{ opacity: 0.25, border: '1px solid var(--border-light)', background: 'rgba(255,255,255,0.01)', padding: '8px', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              📅 Monthly Plan (Future coming soon)
            </div>
          </div>
        </div>

        {/* SECTION 5: ADD-ONS (HELMET & DEPOSIT SECTOR SPLIT) */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🛡️ Add-ons & Deposit Details
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px', marginBottom: '14px' }}>
            {/* Helmets (1 unit is Free!) */}
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Helmet Quantity (1 Free!)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, borderRadius: '4px' }}
                  onClick={() => setHelmetsCount(Math.max(0, helmetsCount - 1))}
                >
                  -
                </button>
                <strong style={{ fontSize: '1.1rem', width: '20px', textAlign: 'center' }}>{helmetsCount}</strong>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ width: '32px', height: '32px', padding: 0, borderRadius: '4px' }}
                  onClick={() => setHelmetsCount(helmetsCount + 1)}
                >
                  +
                </button>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Additional units ₹50/each
              </span>
            </div>

            {/* Deposit base amount input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Required Security Deposit (₹)</label>
              <input 
                type="number" 
                className="form-control" 
                value={securityDeposit} 
                onChange={e => setSecurityDeposit(Number(e.target.value))} 
                style={{ borderColor: 'var(--status-reserved)' }} 
              />
            </div>
          </div>

          {/* Deposit Payment splitting (Cash, Online, Mixed) */}
          <div style={{ background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '8px', color: 'white' }}>
              Deposit Collection Mode
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {['Cash', 'Online', 'Mixed'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={`btn ${depositMethod === mode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                  onClick={() => setDepositMethod(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="animate-fade">
              {depositMethod === 'Cash' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Cash Amount Received for Deposit (₹)</label>
                    <input type="number" className="form-control" value={depositCash} disabled />
                  </div>
                </div>
              )}
              {depositMethod === 'Online' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Online Amount Received for Deposit (₹)</label>
                    <input type="number" className="form-control" value={depositOnline} disabled />
                  </div>
                </div>
              )}
              {depositMethod === 'Mixed' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Cash portion (₹)</label>
                    <input type="number" className="form-control" value={depositCash} onChange={e => handleDepositCashChange(Number(e.target.value))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Online portion (₹)</label>
                    <input type="number" className="form-control" value={depositOnline} onChange={e => handleDepositOnlineChange(Number(e.target.value))} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 6: RENTAL COST PAYMENT */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💵 Rental Cost Payment
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {['Cash', 'UPI', 'Card', 'Mixed'].map(mode => (
              <button
                key={mode}
                type="button"
                className={`btn ${paymentMethod === mode ? 'btn-success' : 'btn-secondary'}`}
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '0.8rem',
                  border: paymentMethod === mode ? '1px solid var(--status-available)' : '1px solid var(--border-light)',
                  background: paymentMethod === mode ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: paymentMethod === mode ? 'var(--status-available)' : 'var(--text-secondary)'
                }}
                onClick={() => setPaymentMethod(mode)}
              >
                {mode === 'UPI' ? 'UPI / QR' : mode}
              </button>
            ))}
          </div>

          <div className="animate-fade" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '12px', borderRadius: '6px' }}>
            {paymentMethod === 'Cash' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Cash Amount Received (₹)</label>
                  <input type="number" className="form-control" value={cashReceived} onChange={e => setCashReceived(Number(e.target.value))} />
                </div>
              </div>
            )}

            {paymentMethod === 'UPI' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Amount (₹)</label>
                  <input type="number" className="form-control" value={upiAmount} onChange={e => setUpiAmount(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>UPI Transaction ID</label>
                  <input type="text" className="form-control" placeholder="e.g. TXN100028" value={upiTxnId} onChange={e => setUpiTxnId(e.target.value)} />
                </div>
              </div>
            )}

            {paymentMethod === 'Card' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Amount (₹)</label>
                  <input type="number" className="form-control" value={cardAmount} onChange={e => setCardAmount(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Card Transaction Ref</label>
                  <input type="text" className="form-control" placeholder="Reference code" value={cardRef} onChange={e => setCardRef(e.target.value)} />
                </div>
              </div>
            )}

            {paymentMethod === 'Mixed' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Cash Amount (₹)</label>
                  <input type="number" className="form-control" value={mixedCash} onChange={e => setMixedCash(Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Online Amount (₹)</label>
                  <input type="number" className="form-control" value={mixedOnline} onChange={e => setMixedOnline(Number(e.target.value))} />
                </div>
              </div>
            )}

            {/* Discount Section inside Payment */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Discount Value (Optional)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  value={discountAmount} 
                  onChange={e => setDiscountAmount(Math.max(0, Number(e.target.value)))} 
                  placeholder="e.g. 50" 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Discount Type</label>
                <select className="form-control" value={discountType} onChange={e => setDiscountType(e.target.value)}>
                  <option value="₹">Rupees (₹)</option>
                  <option value="%">Percent (%)</option>
                </select>
              </div>
              <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', color: 'var(--status-available)', marginTop: '4px' }}>
                💡 Note: Discount applies strictly to the Rental Cost (₹{bill.cost}) before deposit and helmet fees.
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 7: BILLING SUMMARY (Collapsible accordion showing redesigned billing structures) */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
            onClick={() => setShowBillingSummary(!showBillingSummary)}
          >
            <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 Billing Summary
            </h4>
            <span style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: 'bold' }}>
              ₹{totalBookingValue} {showBillingSummary ? '▲' : '▼'}
            </span>
          </button>

          {showBillingSummary && (
            <div className="animate-fade" style={{ marginTop: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', padding: '12px', border: '1px solid rgba(255,255,255,0.03)', fontSize: '0.82rem' }}>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                
                {/* COLUMN 1: RENTAL COSTS */}
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Card 1: Rental Summary */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px', marginBottom: '6px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📋 Rental Summary
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
                      <strong>{bill.durationText || 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Included KM:</span>
                      <strong>{bill.kmLimit} KM</strong>
                    </div>
                  </div>

                  {/* Card 2: Cost Breakdown */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px', marginBottom: '6px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      💰 Cost Breakdown
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Base Rental Cost:</span>
                      <span>
                        ₹{bill.cost} 
                        {bill.isMinBilling && <span style={{ fontSize: '0.65rem', color: 'var(--status-reserved)', marginLeft: '4px' }}>(5h Min)</span>}
                      </span>
                    </div>
                    {bill.discountVal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: 'var(--status-available)' }}>
                        <span>Discount:</span>
                        <span>-₹{bill.discountVal}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Net Rental Fare:</span>
                      <strong>₹{Math.max(0, bill.cost - bill.discountVal)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Helmets:</span>
                      <span>₹{bill.helmets}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', fontWeight: 'bold', color: 'white' }}>
                      <span>Rental Cost Total:</span>
                      <strong>₹{rentalCostTotal}</strong>
                    </div>
                  </div>

                </div>

                {/* COLUMN 2: PAYMENTS & VALUES */}
                <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Card 3: Collection Details */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px', marginBottom: '6px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      💳 Upfront Collection
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Rental Paid:</span>
                      <strong style={{ color: 'var(--status-available)' }}>₹{bill.moneyReceived}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Pay Mode:</span>
                      <span style={{ color: 'white' }}>
                        {paymentMethod}
                        {paymentMethod === 'Mixed' && ` (Cash: ₹${mixedCash} + Online: ₹${mixedOnline})`}
                        {paymentMethod === 'UPI' && upiAmount > 0 && ` (₹${upiAmount})`}
                        {paymentMethod === 'Card' && cardAmount > 0 && ` (₹${cardAmount})`}
                        {paymentMethod === 'Cash' && cashReceived > 0 && ` (₹${cashReceived})`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0 4px 0', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Security Deposit:</span>
                      <strong style={{ color: '#60a5fa' }}>₹{bill.deposit}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Deposit Mode:</span>
                      <span style={{ color: 'white' }}>
                        {depositMethod}
                        {depositMethod === 'Mixed' && ` (Cash: ₹${depositCash} + Online: ₹${depositOnline})`}
                        {depositMethod === 'Cash' && depositCash > 0 && ` (₹${depositCash})`}
                        {depositMethod === 'Online' && depositOnline > 0 && ` (₹${depositOnline})`}
                      </span>
                    </div>
                  </div>

                  {/* Card 4: Overall Totals */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.015)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '10px' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px', marginBottom: '6px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📊 Booking Value & Status
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Booking Value Total:</span>
                      <strong style={{ color: 'var(--accent)' }}>₹{totalBookingValue}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Collected:</span>
                      <strong style={{ color: 'var(--status-available)' }}>₹{totalCollected}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0 0 0', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', fontWeight: 'bold', color: pendingCollection > 0 ? 'var(--status-reserved)' : 'var(--status-available)' }}>
                      <span>Pending Collection:</span>
                      <span>₹{pendingCollection}</span>
                    </div>
                  </div>

                </div>

              </div>

              {isScooty && includeFuel && (
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)', color: '#93c5fd' }}>
                  <span>⛽ Per KM Fuel Surcharge (Billed at return):</span>
                  <strong>₹{vehicle.pricingPlans?.hourly?.fuelChargePerKm || 2}/KM</strong>
                </div>
              )}

              {depositCollected < bill.deposit && (
                <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '0.75rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                  ⚠️ Warning: Deposit collected now (₹{depositCollected}) is less than the required Security Deposit (₹{bill.deposit}).
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 8: UPLOAD CUSTOMER DOCUMENTS */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
            onClick={() => setShowDocuments(!showDocuments)}
          >
            <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              📁 Upload Customer Documents (Optional)
            </h4>
            <span>{showDocuments ? '▲' : '▼'}</span>
          </button>

          {showDocuments && (
            <div className="animate-fade" style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Upload customer's Aadhar card (front & back), driving license, and registration form if available.
              </p>

              {/* 4 Document Grid Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { id: 'aadhaarFront', label: 'Aadhaar Card (Front)', stateVal: docAadhaarFront },
                  { id: 'aadhaarBack', label: 'Aadhaar Card (Back)', stateVal: docAadhaarBack },
                  { id: 'dl', label: 'Driving License', stateVal: docLicense },
                  { id: 'registration', label: 'Registration Form', stateVal: docRegistration }
                ].map(doc => (
                  <div key={doc.id} style={{ border: '1px solid var(--border-light)', padding: '10px', borderRadius: '6px', background: 'rgba(0,0,0,0.1)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px', color: 'white' }}>{doc.label}</div>
                    
                    {doc.stateVal ? (
                      <div style={{ position: 'relative', height: '90px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px', background: '#000' }}>
                        <img src={doc.stateVal} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <button 
                          type="button" 
                          style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                          onClick={() => saveDocImage('')}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '8px' }}>
                        No Scan Attached
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.7rem', height: '28px' }}
                        onClick={() => document.getElementById(`doc-pick-${doc.id}`).click()}
                      >
                        Choose File
                      </button>
                      <input 
                        id={`doc-pick-${doc.id}`}
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={e => handleDocFileChange(e, doc.id)} 
                      />

                      <button 
                        type="button" 
                        className="btn btn-success" 
                        style={{ flex: 1, padding: '4px 8px', fontSize: '0.7rem', height: '28px', background: 'rgba(16,185,129,0.1)', borderColor: 'var(--status-available-border)', color: 'var(--status-available)' }}
                        onClick={() => startCamera(doc.id)}
                      >
                        📷 Camera
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Webcam Popup inside upload section */}
              {cameraActive && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
                  <div className="glass-panel" style={{ width: '90%', maxWidth: '500px', padding: '16px', background: 'var(--bg-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0 }}>Document Scan: {activeDocType.toUpperCase()}</h4>
                      <button type="button" className="btn btn-secondary btn-icon" onClick={stopCamera}>✕</button>
                    </div>

                    <div style={{ background: '#000', borderRadius: '8px', overflow: 'hidden', height: '300px', position: 'relative' }}>
                      {cameraStream ? (
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', height: '100%', color: 'var(--text-muted)', padding: '20px', textAlign: 'center' }}>
                          Local simulation active. Click "Take Capture" to generate scanned document canvas drawing.
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                      <button type="button" className="btn btn-secondary" onClick={stopCamera}>Cancel</button>
                      <button type="button" className="btn btn-accent" onClick={captureDocSnapshot}>Take Capture</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SECTION 9: ADDITIONAL NOTES */}
        <div style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          <h4 style={{ color: 'var(--primary)', fontSize: '0.95rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📝 Additional Notes (Optional)
          </h4>
          <div className="form-group">
            <label>Booking Notes / Handover Comments</label>
            <textarea 
              className="form-control" 
              rows="2" 
              placeholder="Any special instructions, damages, or notes..." 
              value={bookingNotes} 
              onChange={e => setBookingNotes(e.target.value)} 
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Special Instructions</label>
            <textarea 
              className="form-control" 
              rows="2" 
              placeholder="e.g. Needs extra cleaning, return instructions" 
              value={specialInstructions} 
              onChange={e => setSpecialInstructions(e.target.value)} 
            />
          </div>
        </div>

        {/* BOTTOM FORM CONTROLS */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" style={{ background: '#334155', borderColor: '#475569' }}>
            Create Offline Booking & Handover Vehicle
          </button>
        </div>

      </form>
    </div>
  );
}
