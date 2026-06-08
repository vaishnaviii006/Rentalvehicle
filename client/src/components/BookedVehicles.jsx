import React, { useState, useEffect } from 'react';

export default function BookedVehicles({ 
  bookings, 
  vehicles, 
  userRole, 
  currentWorker, 
  onPickup, 
  onExtend, 
  onReplace, 
  onDropOff, 
  onCancelBooking, 
  onAdminOverride 
}) {
  const isAdmin = userRole === 'admin';

  const getBookingFinancialSnapshot = (booking, baseFareOverride, depositOverride, advancePaidOverride, extensionsOverride, dropDetailsOverride, depositDetailsOverride, additionalPayment, paymentCollectionOverride) => {
    if (!booking) return {};
    const baseFare = baseFareOverride !== undefined ? baseFareOverride : (booking.baseFare || booking.settlement?.totalBill || 0);
    const discount = booking.discount || 0;
    const addonsTotal = (booking.addons?.helmetsCount || 0) * (booking.addons?.helmetsPrice || 50);
    
    const extensions = extensionsOverride !== undefined ? extensionsOverride : (booking.extensions || []);
    const extTotal = extensions.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
    
    const dropDetails = dropDetailsOverride !== undefined ? dropDetailsOverride : booking.dropDetails;
    const extra = dropDetails
      ? ((dropDetails.damageCharges || 0) + (dropDetails.lateCharges || 0) + (dropDetails.cleaningCharges || 0) + (dropDetails.otherCharges || 0))
      : 0;
      
    const originalBaseFare = Math.max(0, baseFare - extTotal);
    const rentalCost = Math.max(0, originalBaseFare + extTotal + addonsTotal + extra - discount);
    const depositHeld = depositOverride !== undefined ? depositOverride : Number(booking.securityDeposit || booking.settlement?.depositCollected || 0);
    const bookingValue = rentalCost + depositHeld;
    const rentalPaid = advancePaidOverride !== undefined ? advancePaidOverride : (booking.advancePaid || booking.settlement?.previousPaid || 0);
    const depositCollected = depositHeld;
    const outstandingRent = Math.max(0, rentalCost - rentalPaid);
    
    let rentalCash = 0;
    let rentalOnline = 0;
    let rentalCard = 0;
    const payments = paymentCollectionOverride !== undefined ? paymentCollectionOverride : (booking.paymentCollection || []);
    payments.forEach(p => {
      if (p.mode === 'Cash') rentalCash += p.amount;
      else if (['UPI', 'Online', 'Bank Transfer'].includes(p.mode)) rentalOnline += p.amount;
      else if (p.mode === 'Card') rentalCard += p.amount;
      else if (p.mode === 'Mixed') {
        const ref = p.reference || '';
        let parsed = false;
        const cashM = ref.match(/Cash:\s*(\d+)/i);
        const onlineM = ref.match(/Online:\s*(\d+)/i);
        const cardM = ref.match(/Card:\s*(\d+)/i);
        if (cashM) { rentalCash += Number(cashM[1]); parsed = true; }
        if (onlineM) { rentalOnline += Number(onlineM[1]); parsed = true; }
        if (cardM) { rentalCard += Number(cardM[1]); parsed = true; }
        if (!parsed) {
          rentalCash += Math.round(p.amount / 2);
          rentalOnline += p.amount - Math.round(p.amount / 2);
        }
      }
    });

    if (additionalPayment && additionalPayment.amount > 0) {
      const mode = additionalPayment.mode;
      const amount = additionalPayment.amount;
      if (mode === 'Cash') rentalCash += amount;
      else if (['UPI', 'Online', 'Bank Transfer', 'Card'].includes(mode)) rentalOnline += amount;
      else if (mode === 'Mixed') {
        rentalCash += Number(additionalPayment.cashAmount || 0);
        rentalOnline += Number(additionalPayment.onlineAmount || 0);
        rentalCard += Number(additionalPayment.cardAmount || 0);
      }
    }

    const depDetails = depositDetailsOverride !== undefined ? depositDetailsOverride : (booking.depositDetails || {});
    let depositCash = 0;
    let depositOnline = 0;
    let depositCard = 0;

    if (depDetails.mode === 'Cash') {
      depositCash = depositHeld;
    } else if (['Online', 'UPI', 'Card'].includes(depDetails.mode)) {
      depositOnline = depositHeld;
    } else if (depDetails.mode === 'Mixed') {
      depositCash = Number(depDetails.cashAmount || 0);
      depositOnline = Number(depDetails.onlineAmount || 0);
    } else {
      depositCash = depositHeld;
    }

    return {
      rentalCost,
      depositHeld,
      bookingValue,
      rentalPaid,
      depositCollected,
      outstandingRent,
      pendingDeposit: 0,
      originalBaseFare,
      extTotal,
      addonsTotal,
      discount,
      paymentBreakdown: {
        rentalCash,
        rentalOnline,
        rentalCard,
        depositCash,
        depositOnline,
        depositCard
      }
    };
  };

  const buildRevision = ({
    booking,
    actionType,
    description,
    reason = '',
    operator = 'System',
    overrides = {}
  }) => {
    const oldSnap = getBookingFinancialSnapshot(booking);
    const newSnap = getBookingFinancialSnapshot(
      booking,
      overrides.baseFare,
      overrides.securityDeposit,
      overrides.advancePaid,
      overrides.extensions,
      overrides.dropDetails,
      overrides.depositDetails,
      overrides.additionalPayment,
      overrides.paymentCollection
    );

    const oldRevisions = booking.revisions || [];
    const revisionNumber = oldRevisions.length + 1;

    const revisionRecord = {
      revisionNumber,
      actionType,
      description,
      operator,
      timestamp: new Date().toISOString(),
      reason: reason,
      oldValues: {
        rentalCost: oldSnap.rentalCost,
        deposit: oldSnap.depositHeld,
        bookingValue: oldSnap.bookingValue,
        rentalPaid: oldSnap.rentalPaid,
        depositCollected: oldSnap.depositCollected,
        outstandingRent: oldSnap.outstandingRent,
        pendingDeposit: oldSnap.pendingDeposit
      },
      newValues: {
        rentalCost: newSnap.rentalCost,
        deposit: newSnap.depositHeld,
        bookingValue: newSnap.bookingValue,
        rentalPaid: newSnap.rentalPaid,
        depositCollected: newSnap.depositCollected,
        outstandingRent: newSnap.outstandingRent,
        pendingDeposit: newSnap.pendingDeposit
      },
      difference: {
        rentalCost: newSnap.rentalCost - oldSnap.rentalCost,
        deposit: newSnap.depositHeld - oldSnap.depositHeld,
        bookingValue: newSnap.bookingValue - oldSnap.bookingValue,
        rentalPaid: newSnap.rentalPaid - oldSnap.rentalPaid,
        depositCollected: newSnap.depositCollected - oldSnap.depositCollected
      },
      financialSnapshotAfterChange: newSnap,
      fieldChanges: overrides.fieldChanges || [],
      collectionDetails: overrides.collectionDetails || undefined,
      depositDetails: overrides.depositDetailsObj || undefined,
      vehicleDetails: overrides.vehicleDetails || undefined,
      meterDetails: overrides.meterDetails || undefined,
      durationDetails: overrides.durationDetails || undefined
    };

    return revisionRecord;
  };

  const getFieldChanges = (oldObj, newObj, pathsToCompare) => {
    const changes = [];
    pathsToCompare.forEach(path => {
      const parts = path.split('.');
      let oldVal = oldObj;
      let newVal = newObj;
      parts.forEach(p => {
        oldVal = oldVal?.[p];
        newVal = newVal?.[p];
      });

      if (oldVal !== newVal) {
        const formatVal = (v) => {
          if (v === undefined || v === null || v === '') return 'N/A';
          if (typeof v === 'object') return JSON.stringify(v);
          if (v instanceof Date) return v.toLocaleString();
          return String(v);
        };
        changes.push({
          fieldName: parts[parts.length - 1],
          oldValue: formatVal(oldVal),
          newValue: formatVal(newVal)
        });
      }
    });
    return changes;
  };

  // Core View State
  const [viewState, setViewState] = useState('list'); // 'list' | 'view-booking' | 'drop-off'
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Resolve current active vehicle for selectedBooking
  const resolvedVehicleObj = selectedBooking ? vehicles.find(v => v.vehicleId === selectedBooking.vehicleId) : null;
  const activeVehicle = selectedBooking ? {
    name: resolvedVehicleObj?.name || selectedBooking.vehicleName || 'Unknown Vehicle',
    regNumber: resolvedVehicleObj?.regNumber || selectedBooking.vehicleRegNumber || '',
    category: resolvedVehicleObj?.category || selectedBooking.vehicleDetails?.category || 'Bike'
  } : null;
  const hasGenuineChanges = selectedBooking && selectedBooking.revisions && selectedBooking.revisions.some(r => r.actionType !== 'Create');
  const [expandedRevisions, setExpandedRevisions] = useState({});
  const [expandedFinancialAudits, setExpandedFinancialAudits] = useState({});
  const [timelineExpanded, setTimelineExpanded] = useState(true);

  // Modal Control States
  const [activeModal, setActiveModal] = useState(null); // 'pickup' | 'extend' | 'replace' | 'collect' | 'edit' | 'override' | null

  // Search & Filters Panel States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zoneFilter, setZoneFilter] = useState('All');
  const [sortFilter, setSortFilter] = useState('Latest Booking');
  const [showFilterBar, setShowFilterBar] = useState(false);

  // Starting Date Filters
  const [startFilterType, setStartFilterType] = useState('All'); // 'All' | 'Today' | 'Yesterday' | 'Custom'
  const [startCustomMin, setStartCustomMin] = useState('');
  const [startCustomMax, setStartCustomMax] = useState('');

  // Ending Date Filters
  const [endFilterType, setEndFilterType] = useState('All'); // 'All' | 'Today' | 'Yesterday' | 'Custom'
  const [endCustomMin, setEndCustomMin] = useState('');
  const [endCustomMax, setEndCustomMax] = useState('');

  // Forms Fields States
  // 1. Pickup
  const [odometerStart, setOdometerStart] = useState('');
  const [fuelLevelStart, setFuelLevelStart] = useState('100');
  const [pickupRemarks, setPickupRemarks] = useState('');

  // 2. Extension
  const [extensionPlanType, setExtensionPlanType] = useState('24-Hour'); // 'Hourly' | '12-Hour' | '24-Hour'
  const [extensionEndDate, setExtensionEndDate] = useState('');
  const [extensionExtraCharges, setExtensionExtraCharges] = useState(0);
  const [extensionRemarks, setExtensionRemarks] = useState('Customer requested more time');
  const [extensionCollectNow, setExtensionCollectNow] = useState(true);

  // 3. Replacement
  const [newVehicleId, setNewVehicleId] = useState('');
  const [replacementReason, setReplacementReason] = useState('Customer Request');
  const [oldVehicleClosingMeter, setOldVehicleClosingMeter] = useState(0);
  const [newVehicleStartingMeter, setNewVehicleStartingMeter] = useState(0);

  // 4. Standalone Collect Payment
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectMode, setCollectMode] = useState('Cash'); // 'Cash' | 'UPI' | 'Card' | 'Mixed'
  const [collectCashAmount, setCollectCashAmount] = useState(0);
  const [collectOnlineAmount, setCollectOnlineAmount] = useState(0);
  const [collectCardAmount, setCollectCardAmount] = useState(0);
  const [collectNotes, setCollectNotes] = useState('Payment collected');

  // 5. Booking Edit Form Fields
  const [editFullName, setEditFullName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAltPhone, setEditAltPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStreet, setEditStreet] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editDL, setEditDL] = useState('');
  const [editAadhaar, setEditAadhaar] = useState('');
  const [editPickupDate, setEditPickupDate] = useState('');
  const [editExpectedDropDate, setEditExpectedDropDate] = useState('');
  const [editPlanType, setEditPlanType] = useState('24-Hour');
  const [editSecurityDeposit, setEditSecurityDeposit] = useState(0);
  const [editHelmetsCount, setEditHelmetsCount] = useState(0);
  const [editNotes, setEditNotes] = useState('');
  const [editFuelIncluded, setEditFuelIncluded] = useState(false);
  const [editDiscountAmount, setEditDiscountAmount] = useState(0);
  const [editDiscountType, setEditDiscountType] = useState('₹');
  const [editBaseFare, setEditBaseFare] = useState(0);
  const [editAdvancePaid, setEditAdvancePaid] = useState(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState('Cash');
  const [editAdditionalDeposit, setEditAdditionalDeposit] = useState(0);
  const [editMixedCash, setEditMixedCash] = useState(0);
  const [editMixedOnline, setEditMixedOnline] = useState(0);
  const [editDepositPaymentMode, setEditDepositPaymentMode] = useState('Cash');
  const [editDepositMixedCash, setEditDepositMixedCash] = useState(0);
  const [editDepositMixedOnline, setEditDepositMixedOnline] = useState(0);

  const [extensionAdditionalDeposit, setExtensionAdditionalDeposit] = useState(0);
  const [extensionPaymentMode, setExtensionPaymentMode] = useState('Cash');
  const [extensionMixedCash, setExtensionMixedCash] = useState(0);
  const [extensionMixedOnline, setExtensionMixedOnline] = useState(0);

  const [applyNewPricing, setApplyNewPricing] = useState(true);
  const [replacePaymentMode, setReplacePaymentMode] = useState('Cash');
  const [replaceMixedCash, setReplaceMixedCash] = useState(0);
  const [replaceMixedOnline, setReplaceMixedOnline] = useState(0);

  const [pendingRental, setPendingRental] = useState(0);
  const [pendingDeposit, setPendingDeposit] = useState(0);
  const [collectType, setCollectType] = useState('Rental');

  // 6. Return / Drop-off 16-SECTION screen state
  const [dropReturnDate, setDropReturnDate] = useState('');
  const [dropBranch, setDropBranch] = useState('Vijay Nagar Branch');
  const [dropZone, setDropZone] = useState('Vijay Nagar');
  const [dropParkingLocation, setDropParkingLocation] = useState('Slot B-3');
  const [dropEndMeter, setDropEndMeter] = useState('');
  
  // Section 5 Fuel return
  const [dropFuelLevelReturn, setDropFuelLevelReturn] = useState('Full'); // 'Empty' | '25%' | '50%' | '75%' | 'Full'

  // Section 6 Accessories checklist return
  const [dropHelmetReturned, setDropHelmetReturned] = useState(0);
  const [dropSettlementConfirmed, setDropSettlementConfirmed] = useState(false);
  
  
  // Section 7 Vehicle condition return
  const [dropVehicleCondition, setDropVehicleCondition] = useState('Good'); // 'Excellent' | 'Good' | 'Minor Damage' | 'Major Damage' | 'Accident'
  const [dropScratchFound, setDropScratchFound] = useState(false);
  const [dropDentFoundState, setDropDentFoundState] = useState(false);
  const [dropTyreDamage, setDropTyreDamage] = useState(false);
  const [dropGlassDamage, setDropGlassDamage] = useState(false);
  const [dropMirrorDamage, setDropMirrorDamage] = useState(false);
  const [dropEngineIssue, setDropEngineIssue] = useState(false);
  const [dropConditionNotes, setDropConditionNotes] = useState('');

  // Section 8 Damage evidence return
  const [dropDamageNotes, setDropDamageNotes] = useState('');

  // Section 10 Extra dynamic charges list
  const [dropExtraChargesRows, setDropExtraChargesRows] = useState([]);
  
  // Return adjustments
  const [dropDiscountWaiver, setDropDiscountWaiver] = useState(0);
  const [dropFreeMinutes, setDropFreeMinutes] = useState(0);
  const [dropAddFreeKm, setDropAddFreeKm] = useState(0);

  // Return Deposit Refund Options
  const [dropRefundType, setDropRefundType] = useState('Full Refund'); // 'Full Refund' | 'Partial Refund' | 'No Refund'
  const [dropRefundAmount, setDropRefundAmount] = useState(0);
  const [dropRefundReason, setDropRefundReason] = useState('Returned safely in good condition');

  // Return payment collections
  const [dropPaymentMethod, setDropPaymentMethod] = useState('Cash'); // 'Cash' | 'UPI' | 'Card' | 'Mixed'
  const [dropCashReceived, setDropCashReceived] = useState(0);
  const [dropOnlineReceived, setDropOnlineReceived] = useState(0);
  const [dropCollectTxnId, setDropCollectTxnId] = useState('');
  const [dropCollectNotes, setDropCollectNotes] = useState('Collected at return handover');

  // Return confirmations
  const [dropReturnNotes, setDropReturnNotes] = useState('');
  const [isAdjustmentsExpanded, setIsAdjustmentsExpanded] = useState(false);
  const [isExtraChargesExpanded, setIsExtraChargesExpanded] = useState(false);
  const [isCollectPaymentExpanded, setIsCollectPaymentExpanded] = useState(true);
  const [isSettlementExpanded, setIsSettlementExpanded] = useState(true);
  const [dropAdditionalCharges, setDropAdditionalCharges] = useState(0);
  const [dropDamageCharges, setDropDamageCharges] = useState(0);
  const [dropCleaningCharges, setDropCleaningCharges] = useState(0);
  const [dropTowingCharges, setDropTowingCharges] = useState(0);
  const [dropCardReceived, setDropCardReceived] = useState(0);

  // 7. Admin Override Fields
  const [overrideBaseFare, setOverrideBaseFare] = useState(0);
  const [overrideDiscount, setOverrideDiscount] = useState(0);
  const [overrideAdvancePaid, setOverrideAdvancePaid] = useState(0);
  const [overrideSecurityDeposit, setOverrideSecurityDeposit] = useState(0);
  const [overrideFinalAmount, setOverrideFinalAmount] = useState(0);
  const [overridePaymentMethod, setOverridePaymentMethod] = useState('Cash');
  const [overrideStatus, setOverrideStatus] = useState('Reserved');

  // Sync state hook when parent bookings prop changes
  useEffect(() => {
    if (selectedBooking) {
      const fresh = bookings.find(b => b.bookingId === selectedBooking.bookingId);
      if (fresh) {
        setSelectedBooking(fresh);
      }
    }
  }, [bookings, selectedBooking]);

  // Reset confirmation if return inputs change
  useEffect(() => {
    if (dropSettlementConfirmed) {
      setDropSettlementConfirmed(false);
    }
  }, [
    dropReturnDate,
    dropBranch,
    dropZone,
    dropParkingLocation,
    dropEndMeter,
    dropHelmetReturned,
    dropVehicleCondition,
    dropScratchFound,
    dropDentFoundState,
    dropTyreDamage,
    dropGlassDamage,
    dropMirrorDamage,
    dropEngineIssue,
    dropConditionNotes,
    dropDamageNotes,
    dropExtraChargesRows,
    dropDiscountWaiver,
    dropFreeMinutes,
    dropAddFreeKm,
    dropRefundType,
    dropRefundAmount,
    dropRefundReason,
    dropPaymentMethod,
    dropCashReceived,
    dropOnlineReceived,
    dropCollectTxnId,
    dropCollectNotes,
    dropReturnNotes,
    dropAdditionalCharges,
    dropDamageCharges,
    dropCleaningCharges,
    dropTowingCharges
  ]);

  // Recalculation Effect for Edit Modal
  useEffect(() => {
    if (activeModal === 'edit' && selectedBooking && selectedBooking.status === 'Reserved') {
      const vehicle = vehicles.find(v => v.vehicleId === selectedBooking.vehicleId);
      if (!vehicle) return;

      const isBike = vehicle.category?.toLowerCase() === 'bike';
      const isCar = vehicle.category?.toLowerCase() === 'car';
      const isScooty = vehicle.category?.toLowerCase() === 'scooty';

      const start = new Date(editPickupDate);
      const end = new Date(editExpectedDropDate);
      const diffMs = end.getTime() - start.getTime();

      if (isNaN(diffMs) || diffMs <= 0) return;

      const hours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
      const plans = vehicle.pricingPlans || {};

      let calculatedBaseRate = 0;
      let extraHourCharge = 0;

      if (isBike) {
        if (editPlanType === 'Hourly') {
          calculatedBaseRate = plans.hourly?.rate || vehicle.perHourRate || 100;
          extraHourCharge = calculatedBaseRate;
        } else if (editPlanType === '12-Hour') {
          calculatedBaseRate = plans.twelveHour?.baseRate || 1200;
          extraHourCharge = plans.twelveHour?.extraHourCharge || plans.hourly?.rate || 100;
        } else if (editPlanType === '24-Hour') {
          calculatedBaseRate = plans.twentyFourHour?.baseRate || vehicle.perDayRate || 2400;
          extraHourCharge = plans.twentyFourHour?.extraHourCharge || plans.hourly?.rate || 100;
        }
      } else if (isCar) {
        if (editPlanType === '12-Hour') {
          calculatedBaseRate = plans.twelveHour?.baseRate || 2500;
          extraHourCharge = plans.twelveHour?.extraHourCharge || 200;
        } else if (editPlanType === '24-Hour') {
          calculatedBaseRate = plans.twentyFourHour?.baseRate || vehicle.perDayRate || 4500;
          extraHourCharge = plans.twentyFourHour?.extraHourCharge || 200;
        }
      } else {
        // Scooty
        if (editPlanType === 'Hourly') {
          const scootyRate = editFuelIncluded 
            ? (plans.hourly?.withFuel || vehicle.perHourRate || 60)
            : (plans.hourly?.rate || vehicle.perHourRate || 40);
          calculatedBaseRate = scootyRate;
          extraHourCharge = scootyRate;
        } else if (editPlanType === '12-Hour') {
          calculatedBaseRate = plans.twelveHour?.baseRate || 350;
          extraHourCharge = plans.twelveHour?.extraHourCharge || 40;
        } else if (editPlanType === '24-Hour') {
          calculatedBaseRate = plans.twentyFourHour?.baseRate || vehicle.perDayRate || 500;
          extraHourCharge = plans.twentyFourHour?.extraHourCharge || 30;
        }
      }

      let recalculatedCost = 0;
      if (editPlanType === 'Hourly') {
        if (isScooty && !editFuelIncluded) {
          // Rule: Minimum 5-hour booking charge
          recalculatedCost = Math.max(5, hours) * calculatedBaseRate;
        } else {
          recalculatedCost = hours * calculatedBaseRate;
        }
      } else if (editPlanType === '12-Hour') {
        recalculatedCost = calculatedBaseRate;
        if (hours > 12) {
          recalculatedCost += (hours - 12) * extraHourCharge;
        }
      } else if (editPlanType === '24-Hour') {
        recalculatedCost = calculatedBaseRate;
        if (hours > 24) {
          recalculatedCost += (hours - 24) * extraHourCharge;
        }
      }

      setEditBaseFare(recalculatedCost);
    }
  }, [editPickupDate, editExpectedDropDate, editPlanType, editFuelIncluded, activeModal, selectedBooking]);

  // Recalculation Effect for Extend Modal
  useEffect(() => {
    if (activeModal === 'extend' && selectedBooking) {
      const currentEnd = new Date(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate);
      const newEnd = new Date(extensionEndDate);
      const diffMs = newEnd.getTime() - currentEnd.getTime();
      
      if (isNaN(diffMs) || diffMs <= 0) {
        setExtensionExtraCharges(0);
        return;
      }

      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

      const isCar = selectedBooking.vehicleDetails?.category?.toLowerCase() === 'car';
      const isBike = selectedBooking.vehicleDetails?.category?.toLowerCase() === 'bike';
      const isScooty = selectedBooking.vehicleDetails?.category?.toLowerCase() === 'scooty';

      let calculatedCharges = 0;
      if (isCar) {
        calculatedCharges = diffHours * 200; // Car: ₹200/hr
      } else if (isBike) {
        const hourlyRate = selectedBooking.selectedPlan?.rate || selectedBooking.perHourRate || 100;
        calculatedCharges = diffHours * hourlyRate; // Bike: hourly rate
      } else if (isScooty) {
        const extraHourRate = selectedBooking.selectedPlan?.extraHourCharge || selectedBooking.perHourRate || 30;
        calculatedCharges = diffHours * extraHourRate; // Scooty: extra hour rate
      }

      setExtensionExtraCharges(calculatedCharges);
    }
  }, [extensionEndDate, activeModal, selectedBooking]);

  // Helper date conversions
  const formatLocalISO = (d) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d - tzOffset).toISOString().slice(0, 16);
  };

  const getRemainingTimeText = (expectedDropDate, status) => {
    if (status === 'Completed' || status === 'Cancelled') return { text: 'N/A', cls: 'badge-secondary', isOverdue: false };
    const now = new Date();
    const exp = new Date(expectedDropDate);
    const diffMs = exp.getTime() - now.getTime();
    if (diffMs < 0) {
      const overdueMs = Math.abs(diffMs);
      const hours = Math.floor(overdueMs / (1000 * 60 * 60));
      const mins = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
      return { text: `${hours}h ${mins}m overdue`, cls: 'badge-danger', isOverdue: true };
    } else {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return { text: `${hours}h ${mins}m remaining`, cls: 'badge-primary', isOverdue: false };
    }
  };

  // Upfront cash flow extraction for footer strips
  const getCardFlow = (b) => {
    let cashIn = 0;
    let onlineIn = 0;
    let cashOut = 0;
    let onlineOut = 0;

    // Deposit Split
    if (b.depositDetails) {
      if (b.depositDetails.mode === 'Cash') {
        cashIn += Number(b.depositDetails.cashAmount || b.securityDeposit || 0);
      } else if (b.depositDetails.mode === 'Online') {
        onlineIn += Number(b.depositDetails.onlineAmount || b.securityDeposit || 0);
      } else if (b.depositDetails.mode === 'Mixed') {
        cashIn += Number(b.depositDetails.cashAmount || 0);
        onlineIn += Number(b.depositDetails.onlineAmount || 0);
      }
    } else {
      cashIn += Number(b.securityDeposit || 0);
    }

    // Payments Split
    if (b.paymentCollection && b.paymentCollection.length > 0) {
      b.paymentCollection.forEach(p => {
        if (p.mode === 'Cash') {
          cashIn += p.amount;
        } else if (['UPI', 'Card', 'Online'].includes(p.mode)) {
          onlineIn += p.amount;
        } else if (p.mode === 'Mixed') {
          if (p.reference && p.reference.includes('Cash:')) {
            const cashPart = p.reference.match(/Cash:\s*(\d+)/);
            const onlinePart = p.reference.match(/Online:\s*(\d+)/);
            if (cashPart) cashIn += Number(cashPart[1]);
            if (onlinePart) onlineIn += Number(onlinePart[1]);
          } else {
            cashIn += p.amount / 2;
            onlineIn += p.amount / 2;
          }
        }
      });
    } else if (b.advancePaid > 0) {
      if (b.paymentMethod === 'Cash') {
        cashIn += b.advancePaid;
      } else {
        onlineIn += b.advancePaid;
      }
    }

    // Settlements/Refunds Split
    if (b.status === 'Completed' && b.settlement) {
      const refundAmt = Number(b.settlement.depositRefund || 0);
      const method = b.paymentMethod || 'Cash';
      if (refundAmt > 0) {
        if (method === 'Cash') {
          cashOut += refundAmt;
        } else {
          onlineOut += refundAmt;
        }
      }
    }

    return { cashIn, onlineIn, cashOut, onlineOut };
  };

  // Header Stats
  const getHeaderStats = () => {
    const now = new Date();
    const todayStr = now.toDateString();
    
    let overdue = 0;
    let endingSoon = 0;
    let endingToday = 0;
    let active = 0;

    bookings.forEach(b => {
      if (['Reserved', 'Ongoing', 'Extended'].includes(b.status)) {
        active++;
        
        const expDrop = new Date(b.expectedDropDate || b.rentalPeriod?.expectedEndDate);
        if (expDrop < now) {
          overdue++;
        } else {
          const diffMs = expDrop.getTime() - now.getTime();
          const diffHrs = diffMs / (1000 * 60 * 60);
          if (diffHrs > 0 && diffHrs <= 12) {
            endingSoon++;
          }
        }

        if (expDrop.toDateString() === todayStr) {
          endingToday++;
        }
      }
    });

    return { overdue, endingSoon, endingToday, active };
  };

  const stats = getHeaderStats();

  // Filters Handler
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setZoneFilter('All');
    setSortFilter('Latest Booking');
    setStartFilterType('All');
    setStartCustomMin('');
    setStartCustomMax('');
    setEndFilterType('All');
    setEndCustomMin('');
    setEndCustomMax('');
  };

  const filteredBookings = bookings.filter(b => {
    // 1. Search text
    const custName = b.customerName || b.customer?.name || '';
    const bId = b.bookingId || '';
    const vName = b.vehicleName || b.vehicleDetails?.name || '';
    const vReg = b.vehicleRegNumber || b.vehicleDetails?.regNumber || '';
    const phone = b.customerPhone || b.customer?.phone || '';
    
    const matchesSearch = 
      custName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vReg.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Booking Status
    if (statusFilter !== 'All') {
      if (statusFilter === 'Active Bookings') {
        if (!['Reserved', 'Ongoing', 'Extended'].includes(b.status)) return false;
      } else if (statusFilter === 'Extended') {
        if (b.status !== 'Extended' && (b.extensions?.length || 0) === 0) return false;
      } else {
        if (b.status !== statusFilter) return false;
      }
    }

    // 3. Zone Filter
    const bZone = b.pickupLocation || b.locationDetails?.currentZone || 'Vijay Nagar';
    if (zoneFilter !== 'All' && bZone.toLowerCase() !== zoneFilter.toLowerCase()) return false;

    // 4. Starting Date Filter
    const startDate = new Date(b.pickupDate || b.rentalPeriod?.startDate);
    const now = new Date();
    
    if (startFilterType === 'Today') {
      if (startDate.toDateString() !== now.toDateString()) return false;
    } else if (startFilterType === 'Yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (startDate.toDateString() !== yesterday.toDateString()) return false;
    } else if (startFilterType === 'Custom') {
      if (startCustomMin && startDate < new Date(startCustomMin)) return false;
      if (startCustomMax && startDate > new Date(startCustomMax)) return false;
    }

    // 5. Ending Date Filter
    const endDate = new Date(b.expectedDropDate || b.rentalPeriod?.expectedEndDate);
    if (endFilterType === 'Today') {
      if (endDate.toDateString() !== now.toDateString()) return false;
    } else if (endFilterType === 'Yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (endDate.toDateString() !== yesterday.toDateString()) return false;
    } else if (endFilterType === 'Custom') {
      if (endCustomMin && endDate < new Date(endCustomMin)) return false;
      if (endCustomMax && endDate > new Date(endCustomMax)) return false;
    }

    return true;
  });

  // Unique Zones list
  const uniqueZones = Array.from(new Set(bookings.map(b => b.pickupLocation || b.locationDetails?.currentZone || 'Vijay Nagar')));

  // Sorting
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    if (sortFilter === 'Latest Booking') {
      return new Date(b.createdAt || b.pickupDate) - new Date(a.createdAt || a.pickupDate);
    } else if (sortFilter === 'Oldest Booking') {
      return new Date(a.createdAt || a.pickupDate) - new Date(b.createdAt || b.pickupDate);
    } else if (sortFilter === 'Ending Soon') {
      const aEnd = new Date(a.expectedDropDate || a.rentalPeriod?.expectedEndDate);
      const bEnd = new Date(b.expectedDropDate || b.rentalPeriod?.expectedEndDate);
      return aEnd - bEnd;
    }
    return 0;
  });

  // Modal Open Trigger Helpers
  const openPickup = (booking) => {
    setSelectedBooking(booking);
    setOdometerStart(booking.handover?.startMeter || 0);
    setFuelLevelStart('100');
    setPickupRemarks('');
    setActiveModal('pickup');
  };

  const openExtend = (booking) => {
    setSelectedBooking(booking);
    
    const currentEnd = new Date(booking.expectedDropDate || booking.rentalPeriod?.expectedEndDate);
    currentEnd.setHours(currentEnd.getHours() + 24); // default 24h extension
    setExtensionEndDate(formatLocalISO(currentEnd));
    setExtensionPlanType('24-Hour');
    setExtensionExtraCharges(booking.perDayRate || 500);
    setExtensionRemarks('Customer requested trip extension');
    setExtensionCollectNow(true);
    setExtensionAdditionalDeposit(0);
    setExtensionPaymentMode('Cash');
    setExtensionMixedCash(0);
    setExtensionMixedOnline(0);
    setActiveModal('extend');
  };

  const handleExtensionPlanChange = (plan, booking) => {
    setExtensionPlanType(plan);
    const oldEnd = new Date(booking.expectedDropDate || booking.rentalPeriod?.expectedEndDate);
    
    let hours = 24;
    if (plan === 'Hourly') hours = 5; // default 5h min
    if (plan === '12-Hour') hours = 12;
    if (plan === '24-Hour') hours = 24;

    const targetDate = new Date(oldEnd);
    targetDate.setHours(targetDate.getHours() + hours);
    setExtensionEndDate(formatLocalISO(targetDate));

    // Calculate extra cost
    const isCar = booking.vehicleDetails?.category?.toLowerCase() === 'car';
    const isBike = booking.vehicleDetails?.category?.toLowerCase() === 'bike';
    const isScooty = booking.vehicleDetails?.category?.toLowerCase() === 'scooty';

    let rate = 0;
    if (isCar) {
      rate = hours * 200; // Car: ₹200/hr
    } else if (isBike) {
      const hourlyRate = booking.selectedPlan?.rate || booking.perHourRate || 100;
      rate = hours * hourlyRate; // Bike: hourly rate
    } else {
      // Scooty
      if (plan === 'Hourly') {
        rate = hours * (booking.selectedPlan?.extraHourCharge || booking.perHourRate || 40);
      } else if (plan === '12-Hour') {
        rate = booking.selectedPlan?.rate || 350;
      } else {
        rate = booking.perDayRate || 500;
      }
    }
    setExtensionExtraCharges(rate);
  };

  const handleExtensionDateManual = (newDateStr, booking) => {
    setExtensionEndDate(newDateStr);
    const oldEnd = new Date(booking.expectedDropDate || booking.rentalPeriod?.expectedEndDate);
    const newEnd = new Date(newDateStr);
    const diffMs = newEnd.getTime() - oldEnd.getTime();
    if (diffMs > 0) {
      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
      // Auto select plan
      let plan = '24-Hour';
      if (diffHours <= 5) plan = 'Hourly';
      else if (diffHours <= 12) plan = '12-Hour';
      setExtensionPlanType(plan);

      const isCar = booking.vehicleDetails?.category?.toLowerCase() === 'car';
      const isBike = booking.vehicleDetails?.category?.toLowerCase() === 'bike';

      let rate = 0;
      if (isCar) {
        rate = diffHours * 200;
      } else if (isBike) {
        const hourlyRate = booking.selectedPlan?.rate || booking.perHourRate || 100;
        rate = diffHours * hourlyRate;
      } else {
        const extraHourRate = booking.selectedPlan?.extraHourCharge || (plan === 'Hourly' ? (booking.perHourRate || 40) : plan === '12-Hour' ? 40 : 30);
        const units = plan === 'Hourly' ? diffHours : plan === '12-Hour' ? Math.ceil(diffHours/12) : Math.ceil(diffHours/24);
        const baseRate = plan === 'Hourly' ? extraHourRate : plan === '12-Hour' ? 350 : (booking.perDayRate || 500);
        rate = units * baseRate;
      }
      setExtensionExtraCharges(rate);
    } else {
      setExtensionExtraCharges(0);
    }
  };

  const openReplace = (booking) => {
    setSelectedBooking(booking);
    setNewVehicleId('');
    setReplacementReason('Breakdown');
    setApplyNewPricing(true);
    setReplacePaymentMode('Cash');
    setReplaceMixedCash(0);
    setReplaceMixedOnline(0);

    // Initialize odometer snapshot fields
    const oldV = vehicles.find(v => v.vehicleId === booking.vehicleId);
    setOldVehicleClosingMeter(oldV?.meterReading || booking.handover?.startMeter || 0);
    setNewVehicleStartingMeter(0);

    setActiveModal('replace');
  };

  const openCollectPayment = (booking) => {
    setSelectedBooking(booking);
    
    const extTotal = booking.extensions?.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
    const addonsTotal = (booking.addons?.helmetsCount || 0) * (booking.addons?.helmetsPrice || 50);
    const extraCharges = booking.dropDetails
      ? ((booking.dropDetails.damageCharges || 0) + (booking.dropDetails.lateCharges || 0) + (booking.dropDetails.cleaningCharges || 0) + (booking.dropDetails.otherCharges || 0))
      : 0;
    const discount = booking.discount || 0;
    const rentalCostTotal = Math.max(0, (booking.baseFare || 0) + addonsTotal + extTotal + extraCharges - discount);
    const rentalPaid = booking.advancePaid || 0;
    const pendingRentalAmt = Math.max(0, rentalCostTotal - rentalPaid);

    const depositRequired = booking.securityDeposit || 0;
    const dDetails = booking.depositDetails || {};
    const depositCollected = dDetails.mode 
      ? (Number(dDetails.cashAmount || 0) + Number(dDetails.onlineAmount || 0))
      : depositRequired;
    const pendingDepositAmt = Math.max(0, depositRequired - depositCollected);

    setPendingRental(pendingRentalAmt);
    setPendingDeposit(pendingDepositAmt);
    setCollectType('Rental');
    setCollectAmount(pendingRentalAmt);
    setCollectMode('Cash');
    setCollectCashAmount(pendingRentalAmt);
    setCollectOnlineAmount(0);
    setCollectCardAmount(0);
    setCollectNotes('Payment collected');
    setActiveModal('collect');
  };

  const handleCollectSplitChange = (type, val, total) => {
    if (type === 'Cash') {
      const newCash = Math.min(total, Math.max(0, val));
      setCollectCashAmount(newCash);
      setCollectOnlineAmount(total - newCash);
    } else if (type === 'Online') {
      const newOnline = Math.min(total, Math.max(0, val));
      setCollectOnlineAmount(newOnline);
      setCollectCashAmount(total - newOnline);
    }
  };

  const openEdit = (booking) => {
    setSelectedBooking(booking);
    
    // Customer
    const c = booking.customer || {};
    const addr = c.address || {};
    setEditFullName(booking.customerName || c.name || '');
    setEditFatherName(c.fatherName || '');
    setEditPhone(booking.customerPhone || c.phone || '');
    setEditAltPhone(c.alternatePhone || '');
    setEditEmail(c.email || '');
    
    setEditStreet(addr.street || '');
    setEditCity(addr.city || '');
    setEditState(addr.state || '');
    setEditPincode(addr.pincode || '');
    setEditDL(c.drivingLicense || '');
    setEditAadhaar(c.aadhaar || '');
    
    // Timing & Pricing & Deposit
    setEditPickupDate(booking.pickupDate || formatLocalISO(new Date(booking.rentalPeriod?.startDate)));
    setEditExpectedDropDate(booking.expectedDropDate || formatLocalISO(new Date(booking.rentalPeriod?.expectedEndDate)));
    setEditPlanType(booking.selectedPlan?.planType || '24-Hour');
    setEditSecurityDeposit(booking.securityDeposit || 0);
    setEditHelmetsCount(booking.addons?.helmetsCount || 0);
    setEditNotes(booking.addons?.otherAccessories || '');
    setEditFuelIncluded(booking.handover?.fuelIncluded || false);
    setEditDiscountAmount(booking.discount || 0);
    setEditDiscountType('₹');
    setEditBaseFare(booking.baseFare || 0);
    setEditAdvancePaid(booking.advancePaid || 0);
    setEditPaymentMethod(booking.paymentMethod || 'Cash');
    setEditAdditionalDeposit(0);
    setEditMixedCash(0);
    setEditMixedOnline(0);
    const dDetails = booking.depositDetails || {};
    setEditDepositPaymentMode(dDetails.mode || 'Cash');
    setEditDepositMixedCash(dDetails.cashAmount || (dDetails.mode === 'Cash' ? booking.securityDeposit : 0));
    setEditDepositMixedOnline(dDetails.onlineAmount || (dDetails.mode === 'Online' ? booking.securityDeposit : 0));
    setActiveModal('edit');
  };

  const openOverride = (booking) => {
    setSelectedBooking(booking);
    setOverrideBaseFare(booking.baseFare || 0);
    setOverrideDiscount(booking.discount || 0);
    setOverrideAdvancePaid(booking.advancePaid || 0);
    setOverrideSecurityDeposit(booking.securityDeposit || 0);
    setOverrideFinalAmount(booking.finalAmount || 0);
    setOverridePaymentMethod(booking.paymentMethod || 'Cash');
    setOverrideStatus(booking.status || 'Reserved');
    setActiveModal('override');
  };

  const handleOverrideValuesChange = (base, disc, adv) => {
    if (!selectedBooking) return;
    const extCharges = selectedBooking.extensions?.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
    const dropCharges = selectedBooking.dropDetails 
      ? ((selectedBooking.dropDetails.damageCharges || 0) + (selectedBooking.dropDetails.lateCharges || 0) + (selectedBooking.dropDetails.fuelCharges || 0))
      : 0;
    const finalVal = Number(base) + extCharges + dropCharges - Number(disc) - Number(adv);
    setOverrideFinalAmount(finalVal);
  };

  // Open Drop off Page with defaults representing 16 sections
  const openDropPage = (booking) => {
    setSelectedBooking(booking);
    
    // Set 16-sections defaults
    setDropReturnDate(formatLocalISO(new Date()));
    setDropBranch('Vijay Nagar Branch');
    setDropZone(booking.dropLocation || 'Vijay Nagar');
    setDropParkingLocation('Slot B-3');
    
    setDropEndMeter('');

    setDropFuelLevelReturn('Full');
    
    // Checklist Expected / Returned values
    setDropHelmetReturned(booking.addons?.helmetsCount || 0);
    setDropSettlementConfirmed(false);

    // Condition
    setDropVehicleCondition('Good');
    setDropScratchFound(false);
    setDropDentFoundState(false);
    setDropTyreDamage(false);
    setDropGlassDamage(false);
    setDropMirrorDamage(false);
    setDropEngineIssue(false);
    setDropConditionNotes('');

    // Dynamic Extra charges dynamic rows
    setDropExtraChargesRows([]);

    // Deposit refund options defaults
    const depositAmt = Number(booking.securityDeposit || 0);
    setDropRefundType('Full Refund');
    setDropRefundAmount(depositAmt);
    setDropRefundReason('Returned safely');
    
    // Collect Payment defaults
    setDropPaymentMethod('Cash');
    setDropCashReceived(0);
    setDropOnlineReceived(0);
    setDropCollectTxnId('');
    setDropCollectNotes('Collected balance on drop-off return');

    setDropReturnNotes('');

    setViewState('drop-off');
  };

  // Removed old deposit refund type effect as settlement is now auto-adjusted

  // Dynamic row additions for Section 10 Extra Charges
  const handleAddExtraChargeRow = () => {
    setDropExtraChargesRows([
      ...dropExtraChargesRows,
      { id: Date.now(), name: 'Cleaning Charge', amount: 150, notes: 'General Return Wash' }
    ]);
  };

  const handleUpdateExtraChargeRow = (id, field, val) => {
    setDropExtraChargesRows(dropExtraChargesRows.map(row => 
      row.id === id ? { ...row, [field]: val } : row
    ));
  };

  const handleRemoveExtraChargeRow = (id) => {
    setDropExtraChargesRows(dropExtraChargesRows.filter(row => row.id !== id));
  };

  // Core submit handlers
  const handlePickupSubmit = (e) => {
    e.preventDefault();
    if (!odometerStart) return alert('Odometer reading is required');
    onPickup(selectedBooking.bookingId, {
      actualTime: new Date(),
      odometerStart: Number(odometerStart),
      fuelLevelStart: Number(fuelLevelStart),
      remarks: pickupRemarks,
      workerId: currentWorker
    });
    setActiveModal(null);
  };

  const getEditDepositComparison = () => {
    if (!selectedBooking) return null;
    const oldDeposit = selectedBooking.securityDeposit || 0;
    const newDeposit = Number(editSecurityDeposit) || 0;
    const diff = newDeposit - oldDeposit;

    const oldDDetails = selectedBooking.depositDetails || {};
    const oldCash = Number(oldDDetails.cashAmount || (oldDDetails.mode === 'Cash' ? oldDeposit : 0));
    const oldOnline = Number(oldDDetails.onlineAmount || (oldDDetails.mode === 'Online' ? oldDeposit : 0));

    let newCash = 0;
    let newOnline = 0;
    let additionalCash = 0;
    let additionalOnline = 0;

    if (diff > 0) {
      if (editDepositPaymentMode === 'Cash') {
        additionalCash = diff;
        additionalOnline = 0;
      } else if (editDepositPaymentMode === 'Online') {
        additionalCash = 0;
        additionalOnline = diff;
      } else if (editDepositPaymentMode === 'Mixed') {
        additionalCash = Number(editDepositMixedCash) || 0;
        additionalOnline = Number(editDepositMixedOnline) || 0;
      }
      newCash = oldCash + additionalCash;
      newOnline = oldOnline + additionalOnline;
    } else if (diff < 0) {
      const refundAmt = Math.abs(diff);
      if (oldOnline >= refundAmt) {
        newOnline = oldOnline - refundAmt;
        newCash = oldCash;
        additionalOnline = -refundAmt;
      } else {
        newOnline = 0;
        newCash = oldCash - (refundAmt - oldOnline);
        additionalOnline = -oldOnline;
        additionalCash = -(refundAmt - oldOnline);
      }
    } else {
      newCash = oldCash;
      newOnline = oldOnline;
    }

    return {
      oldDeposit,
      newDeposit,
      diff,
      oldCash,
      oldOnline,
      newCash,
      newOnline,
      additionalCash,
      additionalOnline
    };
  };

  const getExtendDepositComparison = () => {
    if (!selectedBooking) return null;
    const oldDeposit = selectedBooking.securityDeposit || 0;
    const additionalDeposit = Number(extensionAdditionalDeposit) || 0;
    const newDeposit = oldDeposit + additionalDeposit;

    const oldDDetails = selectedBooking.depositDetails || {};
    const oldCash = Number(oldDDetails.cashAmount || (oldDDetails.mode === 'Cash' ? oldDeposit : 0));
    const oldOnline = Number(oldDDetails.onlineAmount || (oldDDetails.mode === 'Online' ? oldDeposit : 0));

    let additionalCash = 0;
    let additionalOnline = 0;
    if (extensionPaymentMode === 'Cash') {
      additionalCash = additionalDeposit;
      additionalOnline = 0;
    } else if (extensionPaymentMode === 'UPI') {
      additionalCash = 0;
      additionalOnline = additionalDeposit;
    } else if (extensionPaymentMode === 'Mixed') {
      additionalCash = Number(extensionMixedCash) || 0;
      additionalOnline = Number(extensionMixedOnline) || 0;
    }

    const newCash = oldCash + additionalCash;
    const newOnline = oldOnline + additionalOnline;

    return {
      oldDeposit,
      newDeposit,
      diff: additionalDeposit,
      oldCash,
      oldOnline,
      newCash,
      newOnline,
      additionalCash,
      additionalOnline
    };
  };

  const getReplacePricingComparison = () => {
    if (!selectedBooking || !newVehicleId) return null;
    const newVehicle = vehicles.find(v => v.vehicleId === newVehicleId);
    if (!newVehicle) return null;

    const oldBaseFare = selectedBooking.baseFare || 0;
    const oldDeposit = selectedBooking.securityDeposit || 0;

    const start = new Date(selectedBooking.pickupDate || selectedBooking.rentalPeriod?.startDate);
    const end = new Date(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate);
    const diffMs = end.getTime() - start.getTime();
    const hours = !isNaN(diffMs) && diffMs > 0 ? Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60))) : 24;

    const plans = newVehicle.pricingPlans || {};
    const planType = selectedBooking.selectedPlan?.planType || '24-Hour';

    const isBike = newVehicle.category?.toLowerCase() === 'bike';
    const isCar = newVehicle.category?.toLowerCase() === 'car';
    const isScooty = newVehicle.category?.toLowerCase() === 'scooty';

    let calculatedBaseRate = 0;
    let extraHourCharge = 0;

    if (isBike) {
      if (planType === 'Hourly') {
        calculatedBaseRate = plans.hourly?.rate || newVehicle.perHourRate || 100;
        extraHourCharge = calculatedBaseRate;
      } else if (planType === '12-Hour') {
        calculatedBaseRate = plans.twelveHour?.baseRate || 1200;
        extraHourCharge = plans.twelveHour?.extraHourCharge || plans.hourly?.rate || 100;
      } else if (planType === '24-Hour') {
        calculatedBaseRate = plans.twentyFourHour?.baseRate || newVehicle.perDayRate || 2400;
        extraHourCharge = plans.twentyFourHour?.extraHourCharge || plans.hourly?.rate || 100;
      }
    } else if (isCar) {
      if (planType === '12-Hour') {
        calculatedBaseRate = plans.twelveHour?.baseRate || 2500;
        extraHourCharge = plans.twelveHour?.extraHourCharge || 200;
      } else if (planType === '24-Hour') {
        calculatedBaseRate = plans.twentyFourHour?.baseRate || newVehicle.perDayRate || 4500;
        extraHourCharge = plans.twentyFourHour?.extraHourCharge || 200;
      }
    } else {
      // Scooty
      if (planType === 'Hourly') {
        const scootyRate = selectedBooking.handover?.fuelIncluded
          ? (plans.hourly?.withFuel || newVehicle.perHourRate || 60)
          : (plans.hourly?.rate || newVehicle.perHourRate || 40);
        calculatedBaseRate = scootyRate;
        extraHourCharge = scootyRate;
      } else if (planType === '12-Hour') {
        calculatedBaseRate = plans.twelveHour?.baseRate || 350;
        extraHourCharge = plans.twelveHour?.extraHourCharge || 40;
      } else if (planType === '24-Hour') {
        calculatedBaseRate = plans.twentyFourHour?.baseRate || newVehicle.perDayRate || 500;
        extraHourCharge = plans.twentyFourHour?.extraHourCharge || 30;
      }
    }

    let newBaseFare = 0;
    if (planType === 'Hourly') {
      if (isScooty && !selectedBooking.handover?.fuelIncluded) {
        newBaseFare = Math.max(5, hours) * calculatedBaseRate;
      } else {
        newBaseFare = hours * calculatedBaseRate;
      }
    } else if (planType === '12-Hour') {
      newBaseFare = calculatedBaseRate;
      if (hours > 12) {
        newBaseFare += (hours - 12) * extraHourCharge;
      }
    } else if (planType === '24-Hour') {
      newBaseFare = calculatedBaseRate;
      if (hours > 24) {
        newBaseFare += (hours - 24) * extraHourCharge;
      }
    }

    const newDeposit = newVehicle.depositSettings?.amount ?? (isCar ? 5000 : isBike ? 2000 : 1000);

    const rentDiff = newBaseFare - oldBaseFare;
    const depositDiff = newDeposit - oldDeposit;
    const totalDiff = rentDiff + depositDiff;

    return {
      newBaseFare,
      newDeposit,
      rentDiff,
      depositDiff,
      totalDiff,
      newVehicle
    };
  };

  const handleExtendSubmit = (e) => {
    e.preventDefault();
    const oldEnd = new Date(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate);
    const newEnd = new Date(extensionEndDate);
    if (newEnd <= oldEnd) {
      return alert('New extension return date must be after current expected drop date.');
    }

    const diffMs = newEnd.getTime() - oldEnd.getTime();
    const additionalHours = Math.ceil(diffMs / (1000 * 60 * 60));

    const oldDDetails = selectedBooking.depositDetails || {};
    const oldCash = Number(oldDDetails.cashAmount || (oldDDetails.mode === 'Cash' ? selectedBooking.securityDeposit : 0));
    const oldOnline = Number(oldDDetails.onlineAmount || (oldDDetails.mode === 'Online' ? selectedBooking.securityDeposit : 0));

    let addCash = 0;
    let addOnline = 0;
    if (Number(extensionAdditionalDeposit) > 0) {
      if (extensionPaymentMode === 'Cash') {
        addCash = Number(extensionAdditionalDeposit);
      } else if (extensionPaymentMode === 'UPI') {
        addOnline = Number(extensionAdditionalDeposit);
      } else if (extensionPaymentMode === 'Mixed') {
        const sum = Number(extensionMixedCash) + Number(extensionMixedOnline);
        if (sum !== Number(extensionAdditionalDeposit)) {
          return alert(`Mixed Extension Deposit split error: Cash (₹${extensionMixedCash}) + Online (₹${extensionMixedOnline}) must equal Additional Deposit (₹${extensionAdditionalDeposit}).`);
        }
        addCash = Number(extensionMixedCash);
        addOnline = Number(extensionMixedOnline);
      }
    }
    const newCashDeposit = oldCash + addCash;
    const newOnlineDeposit = oldOnline + addOnline;
    const newMode = (newCashDeposit > 0 && newOnlineDeposit > 0) ? 'Mixed' : newCashDeposit > 0 ? 'Cash' : 'Online';

    const oldRevisions = selectedBooking.revisions || [];
    const addPayment = extensionCollectNow && extensionExtraCharges > 0 ? {
      mode: extensionPaymentMode,
      amount: Number(extensionExtraCharges),
      cashAmount: extensionPaymentMode === 'Mixed' ? Number(extensionMixedCash) : extensionPaymentMode === 'Cash' ? Number(extensionExtraCharges) : 0,
      onlineAmount: extensionPaymentMode === 'Mixed' ? Number(extensionMixedOnline) : ['UPI', 'Online', 'Card'].includes(extensionPaymentMode) ? Number(extensionExtraCharges) : 0,
      cardAmount: 0
    } : null;

    const revisionOverrides = {
      baseFare: selectedBooking.baseFare + Number(extensionExtraCharges),
      securityDeposit: selectedBooking.securityDeposit + Number(extensionAdditionalDeposit),
      depositDetails: {
        mode: newMode,
        cashAmount: newCashDeposit,
        onlineAmount: newOnlineDeposit
      },
      advancePaid: selectedBooking.advancePaid + (extensionCollectNow ? Number(extensionExtraCharges) : 0),
      additionalPayment: addPayment,
      durationDetails: {
        oldDuration: selectedBooking.durationHours || 0,
        newDuration: (selectedBooking.durationHours || 0) + additionalHours,
        difference: additionalHours
      },
      depositDetailsObj: Number(extensionAdditionalDeposit) > 0 ? {
        oldDeposit: selectedBooking.securityDeposit,
        newDeposit: selectedBooking.securityDeposit + Number(extensionAdditionalDeposit),
        difference: Number(extensionAdditionalDeposit),
        mode: extensionPaymentMode,
        cashAmount: newCashDeposit,
        onlineAmount: newOnlineDeposit
      } : undefined
    };

    if (addPayment) {
      revisionOverrides.collectionDetails = {
        amount: addPayment.amount,
        mode: addPayment.mode,
        cashSplit: addPayment.cashAmount,
        onlineSplit: addPayment.onlineAmount,
        cardSplit: 0,
        remarks: `Extension payment upfront`
      };
    }

    const extendRevision = buildRevision({
      booking: selectedBooking,
      actionType: 'Extend',
      description: `Extended +${additionalHours} Hours. Additional Rental Cost: ₹${extensionExtraCharges}. New return date: ${extensionEndDate}.${Number(extensionAdditionalDeposit) > 0 ? ` Additional Deposit: ₹${extensionAdditionalDeposit}.` : ''}`,
      operator: currentWorker || 'System',
      reason: extensionRemarks,
      overrides: revisionOverrides
    });

    const updatedRevisions = [...oldRevisions, extendRevision];

    const oldKmLimit = selectedBooking.selectedPlan?.kmLimit || 0;
    const kmPerHour = oldKmLimit / (selectedBooking.durationHours || 24);
    const additionalKmGranted = Math.round(kmPerHour * additionalHours) || 0;
    const newKmLimit = oldKmLimit + additionalKmGranted;

    const payload = {
      newEndDateTime: extensionEndDate,
      extraCharges: Number(extensionExtraCharges),
      remarks: `${extensionRemarks} (${extensionPlanType} extension)`,
      workerId: currentWorker,
      // extra override fields
      baseFare: selectedBooking.baseFare + Number(extensionExtraCharges),
      securityDeposit: selectedBooking.securityDeposit + Number(extensionAdditionalDeposit),
      depositDetails: {
        mode: newMode,
        cashAmount: newCashDeposit,
        onlineAmount: newOnlineDeposit
      },
      advancePaid: selectedBooking.advancePaid + (extensionCollectNow ? Number(extensionExtraCharges) : 0),
      paymentCollection: extensionCollectNow && extensionExtraCharges > 0 ? {
        mode: extensionPaymentMode,
        amount: Number(extensionExtraCharges),
        transactionId: `TXN-EXT-${Math.floor(100000 + Math.random() * 900000)}`,
        reference: extensionPaymentMode === 'Mixed' ? `Extension Cash: ${extensionMixedCash}, Online: ${extensionMixedOnline}` : `Extension upfront`,
        timestamp: new Date().toISOString()
      } : undefined,
      revisions: updatedRevisions,
      durationHours: (selectedBooking.durationHours || 0) + additionalHours,
      durationDays: Math.ceil(((selectedBooking.durationHours || 0) + additionalHours) / 24),
      selectedPlan: {
        ...selectedBooking.selectedPlan,
        kmLimit: newKmLimit
      }
    };

    onExtend(selectedBooking.bookingId, payload);
    setActiveModal(null);
  };

  const handleReplaceSubmit = (e) => {
    e.preventDefault();
    if (!newVehicleId) return alert('Please select a replacement vehicle.');
    
    const newVehicle = vehicles.find(v => v.vehicleId === newVehicleId);
    if (!newVehicle) return alert('New vehicle not found.');

    const startMeter = selectedBooking.handover?.startMeter || 0;
    if (Number(oldVehicleClosingMeter) < startMeter) {
      return alert(`Closing meter (${oldVehicleClosingMeter} KM) cannot be less than starting meter (${startMeter} KM) of current vehicle.`);
    }

    const comp = getReplacePricingComparison();
    
    // Compute rates for new vehicle
    const isCar = newVehicle.category?.toLowerCase() === 'car';
    const isBike = newVehicle.category?.toLowerCase() === 'bike';
    const activePlanType = selectedBooking.selectedPlan?.planType || '24-Hour';
    const activePlanKey = activePlanType === 'Hourly' ? 'hourly' : activePlanType === '12-Hour' ? 'twelveHour' : 'twentyFourHour';
    const newVehiclePlan = newVehicle.pricingPlans?.[activePlanKey] || {};

    const resolvedExtraHourRate = newVehiclePlan.extraHourCharge || (isCar ? 200 : isBike ? 100 : 30);
    const resolvedExtraKmRate = newVehiclePlan.extraKmCharge || (isCar ? 12 : isBike ? 8 : 5);

    const newKmLimit = newVehicle.pricingPlans?.[activePlanKey]?.kmLimit || 120;
    const newRate = newVehicle.pricingPlans?.[activePlanKey]?.baseRate || newVehicle.perDayRate || 500;

    const resolvedDeposit = newVehicle.depositSettings?.amount ?? (isCar ? 5000 : isBike ? 2000 : 1000);

    let payload = {
      newVehicleId,
      reason: replacementReason,
      workerId: currentWorker,
      oldVehicleClosingMeter: Number(oldVehicleClosingMeter),
      newVehicleStartingMeter: Number(newVehicleStartingMeter),
      applyNewPricing: applyNewPricing,
      // Always update and persist these active state fields representing the new vehicle:
      securityDeposit: resolvedDeposit,
      depositHeld: resolvedDeposit,
      selectedPlan: {
        ...selectedBooking.selectedPlan,
        rate: newRate,
        kmLimit: newKmLimit,
        extraHourCharge: resolvedExtraHourRate,
        extraKmCharge: resolvedExtraKmRate
      }
    };

    if (applyNewPricing && comp) {
      const oldDDetails = selectedBooking.depositDetails || {};
      const oldCash = Number(oldDDetails.cashAmount || (oldDDetails.mode === 'Cash' ? selectedBooking.securityDeposit : 0));
      const oldOnline = Number(oldDDetails.onlineAmount || (oldDDetails.mode === 'Online' ? selectedBooking.securityDeposit : 0));

      let depCashAdd = 0;
      let depOnlineAdd = 0;
      if (comp.depositDiff > 0) {
        if (replacePaymentMode === 'Cash') {
          depCashAdd = comp.depositDiff;
        } else if (replacePaymentMode === 'UPI') {
          depOnlineAdd = comp.depositDiff;
        } else if (replacePaymentMode === 'Mixed') {
          const sum = Number(replaceMixedCash) + Number(replaceMixedOnline);
          if (sum !== Number(comp.depositDiff)) {
            return alert(`Mixed Replace Deposit split error: Cash (₹${replaceMixedCash}) + Online (₹${replaceMixedOnline}) must equal Deposit difference (₹${comp.depositDiff}).`);
          }
          depCashAdd = Number(replaceMixedCash);
          depOnlineAdd = Number(replaceMixedOnline);
        }
      }
      let newCashDeposit = oldCash + depCashAdd;
      let newOnlineDeposit = oldOnline + depOnlineAdd;
      if (comp.depositDiff < 0) {
        const refundAmt = Math.abs(comp.depositDiff);
        if (newOnlineDeposit >= refundAmt) {
          newOnlineDeposit -= refundAmt;
        } else {
          newCashDeposit -= (refundAmt - newOnlineDeposit);
          newOnlineDeposit = 0;
        }
      }
      const newMode = (newCashDeposit > 0 && newOnlineDeposit > 0) ? 'Mixed' : newCashDeposit > 0 ? 'Cash' : 'Online';

      let finalPayments = [...(selectedBooking.paymentCollection || [])];
      let newAdvancePaid = selectedBooking.advancePaid;
      if (comp.rentDiff > 0) {
        newAdvancePaid += comp.rentDiff;
        finalPayments.push({
          mode: replacePaymentMode,
          amount: comp.rentDiff,
          transactionId: `TXN-REP-${Math.floor(100000 + Math.random() * 900000)}`,
          reference: `Replacement Rent Difference Upfront`,
          timestamp: new Date().toISOString()
        });
      }

      const helmetsTotal = selectedBooking.addons?.helmetsCount > 1 ? (selectedBooking.addons?.helmetsCount - 1) * 50 : 0;
      const extensionsTotal = selectedBooking.extensions?.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
      const newTotal = comp.newBaseFare + helmetsTotal + extensionsTotal;

      payload = {
        ...payload,
        baseFare: comp.newBaseFare,
        depositDetails: {
          mode: newMode,
          cashAmount: newCashDeposit,
          onlineAmount: newOnlineDeposit
        },
        advancePaid: newAdvancePaid,
        paymentCollection: finalPayments,
        settlement: {
          totalBill: newTotal,
          actualBill: newTotal,
          previousPaid: newAdvancePaid,
          depositCollected: comp.newDeposit,
          depositRefund: 0,
          depositRefundMode: '',
          depositRefundReason: '',
          remainingToPay: Math.max(0, newTotal - newAdvancePaid)
        }
      };
    }

    const oldVehicleName = selectedBooking.vehicleDetails?.name || selectedBooking.vehicleName || 'Old Vehicle';
    const oldVehicleReg = selectedBooking.vehicleDetails?.regNumber || selectedBooking.vehicleRegNumber || '';
    const newVehicleReg = newVehicle.regNumber || '';

    const revisionOverrides = {
      vehicleDetails: {
        oldVehicleId: selectedBooking.vehicleId,
        oldVehicleName: oldVehicleName,
        oldVehicleReg: oldVehicleReg,
        newVehicleId: newVehicleId,
        newVehicleName: newVehicle.name,
        newVehicleReg: newVehicleReg,
        oldPricing: selectedBooking.baseFare || 0,
        newPricing: (applyNewPricing && comp) ? comp.newBaseFare : (selectedBooking.baseFare || 0),
        oldDeposit: selectedBooking.securityDeposit || 0,
        newDeposit: (applyNewPricing && comp) ? comp.newDeposit : (selectedBooking.securityDeposit || 0),
        additionalCollection: (applyNewPricing && comp && comp.rentDiff > 0) ? comp.rentDiff : 0,
        refundDifference: (applyNewPricing && comp && comp.depositDiff < 0) ? Math.abs(comp.depositDiff) : 0
      },
      meterDetails: {
        oldVehicleClosingMeter: Number(oldVehicleClosingMeter),
        newVehicleStartingMeter: Number(newVehicleStartingMeter)
      }
    };

    if (applyNewPricing && comp) {
      revisionOverrides.baseFare = comp.newBaseFare;
      revisionOverrides.securityDeposit = comp.newDeposit;
      revisionOverrides.depositDetails = {
        mode: payload.depositDetails.mode,
        cashAmount: payload.depositDetails.cashAmount,
        onlineAmount: payload.depositDetails.onlineAmount
      };
      revisionOverrides.advancePaid = payload.advancePaid;

      if (comp.rentDiff > 0) {
        revisionOverrides.additionalPayment = {
          mode: replacePaymentMode,
          amount: comp.rentDiff
        };
        revisionOverrides.collectionDetails = {
          amount: comp.rentDiff,
          mode: replacePaymentMode,
          cashSplit: replacePaymentMode === 'Cash' ? comp.rentDiff : 0,
          onlineSplit: ['UPI', 'Online', 'Card'].includes(replacePaymentMode) ? comp.rentDiff : 0,
          cardSplit: 0,
          remarks: `Replacement Rent Difference Upfront`
        };
      }

      revisionOverrides.depositDetailsObj = {
        oldDeposit: selectedBooking.securityDeposit,
        newDeposit: comp.newDeposit,
        difference: comp.depositDiff,
        mode: replacePaymentMode,
        cashAmount: payload.depositDetails.cashAmount,
        onlineAmount: payload.depositDetails.onlineAmount
      };
    }

    const replaceRevision = buildRevision({
      booking: selectedBooking,
      actionType: 'Replace',
      description: `Vehicle Replaced: ${oldVehicleName} [${oldVehicleReg}] ➔ ${newVehicle.name} [${newVehicleReg}]. Closing Meter: ${oldVehicleClosingMeter} KM. Starting Meter: ${newVehicleStartingMeter} KM. Reason: ${replacementReason}.`,
      operator: currentWorker || 'System',
      reason: replacementReason,
      overrides: revisionOverrides
    });

    payload.revisions = [...(selectedBooking.revisions || []), replaceRevision];

    onReplace(selectedBooking.bookingId, payload);
    setActiveModal(null);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editFullName.trim()) return alert('Name is required');
    
    const isCar = selectedBooking.vehicleDetails?.category?.toLowerCase() === 'car';
    const start = new Date(editPickupDate);
    const end = new Date(editExpectedDropDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return alert("Please enter valid pickup and expected return dates.");
    }
    if (end <= start) {
      return alert("Expected Return Date & Time must be after pickup Date & Time.");
    }
    const durationHours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
    if (isCar && durationHours < 12) {
      return alert("Minimum booking duration for Car is 12 hours.");
    }

    if (editDepositPaymentMode === 'Mixed') {
      const sum = Number(editDepositMixedCash) + Number(editDepositMixedOnline);
      if (sum !== Number(editSecurityDeposit)) {
        return alert(`Mixed Deposit Error: Cash (₹${editDepositMixedCash}) + Online (₹${editDepositMixedOnline}) must equal Required Deposit (₹${editSecurityDeposit}).`);
      }
    }

    const newCashDeposit = editDepositPaymentMode === 'Cash' 
      ? Number(editSecurityDeposit) 
      : editDepositPaymentMode === 'Online'
        ? 0 
        : Number(editDepositMixedCash);
    const newOnlineDeposit = editDepositPaymentMode === 'Online' 
      ? Number(editSecurityDeposit) 
      : editDepositPaymentMode === 'Cash'
        ? 0 
        : Number(editDepositMixedOnline);

    const pathsCustomer = [
      'customer.name', 'customer.fatherName', 'customer.phone', 'customer.alternatePhone',
      'customer.email', 'customer.drivingLicense', 'customer.aadhaar',
      'customer.address.street', 'customer.address.city', 'customer.address.state', 'customer.address.pincode'
    ];
    const pathsBooking = [
      'pickupDate', 'expectedDropDate', 'selectedPlan.planType', 'addons.helmetsCount', 'addons.otherAccessories'
    ];
    const pathsPricing = ['baseFare', 'discount'];
    const pathsDeposit = ['securityDeposit'];
    const activeVehicleObj = vehicles.find(v => v.vehicleId === selectedBooking.vehicleId);
    const plans = activeVehicleObj?.pricingPlans || {};
    const editPlanKey = editPlanType === 'Hourly' ? 'hourly' : editPlanType === '12-Hour' ? 'twelveHour' : 'twentyFourHour';
    
    const resolvedRate = editPlanType === 'Hourly' 
      ? (plans.hourly?.rate || activeVehicleObj?.perHourRate || 100) 
      : editPlanType === '12-Hour' 
        ? (plans.twelveHour?.baseRate || 1200) 
        : (plans.twentyFourHour?.baseRate || activeVehicleObj?.perDayRate || 2400);

    const resolvedKmLimit = plans[editPlanKey]?.kmLimit || 120;
    const resolvedExtraHourCharge = plans[editPlanKey]?.extraHourCharge || (activeVehicleObj?.category?.toLowerCase() === 'car' ? 200 : activeVehicleObj?.category?.toLowerCase() === 'bike' ? 100 : 30);
    const resolvedExtraKmCharge = plans[editPlanKey]?.extraKmCharge || (activeVehicleObj?.category?.toLowerCase() === 'car' ? 12 : activeVehicleObj?.category?.toLowerCase() === 'bike' ? 8 : 5);

    const newTargetObj = {
      customer: {
        name: editFullName,
        fatherName: editFatherName,
        phone: editPhone,
        alternatePhone: editAltPhone,
        email: editEmail,
        drivingLicense: editDL,
        aadhaar: editAadhaar,
        address: { street: editStreet, city: editCity, state: editState, pincode: editPincode }
      },
      pickupDate: editPickupDate,
      expectedDropDate: editExpectedDropDate,
      selectedPlan: {
        ...selectedBooking.selectedPlan,
        planType: editPlanType,
        rate: resolvedRate,
        kmLimit: resolvedKmLimit,
        extraHourCharge: resolvedExtraHourCharge,
        extraKmCharge: resolvedExtraKmCharge
      },
      addons: {
        helmetsCount: Number(editHelmetsCount),
        otherAccessories: editNotes
      },
      baseFare: Number(editBaseFare),
      discount: Number(editDiscountAmount),
      securityDeposit: Number(editSecurityDeposit),
      advancePaid: Number(editAdvancePaid),
      depositDetails: {
        mode: editDepositPaymentMode,
        cashAmount: newCashDeposit,
        onlineAmount: newOnlineDeposit
      }
    };

    const customerChanges = getFieldChanges(selectedBooking, newTargetObj, pathsCustomer);
    const bookingChanges = getFieldChanges(selectedBooking, newTargetObj, pathsBooking);
    const pricingChanges = getFieldChanges(selectedBooking, newTargetObj, pathsPricing);
    const depositChanges = getFieldChanges(selectedBooking, newTargetObj, pathsDeposit);

    let updatedPaymentCollection = [...(selectedBooking.paymentCollection || [])];
    const upfrontPaymentRef = editPaymentMethod === 'Mixed'
      ? `Cash: ${editMixedCash}, Online: ${editMixedOnline}`
      : 'Advance Collection';
    
    if (updatedPaymentCollection.length > 0) {
      updatedPaymentCollection[0] = {
        ...updatedPaymentCollection[0],
        amount: Number(editAdvancePaid),
        mode: editPaymentMethod,
        reference: upfrontPaymentRef
      };
    } else {
      updatedPaymentCollection = [{
        amount: Number(editAdvancePaid),
        mode: editPaymentMethod,
        date: new Date().toISOString(),
        reference: upfrontPaymentRef
      }];
    }

    let updatedRevisions = [...(selectedBooking.revisions || [])];
    const oldRevisionCount = updatedRevisions.length;

    let currentTempBooking = { ...selectedBooking };

    if (customerChanges.length > 0) {
      const rev = buildRevision({
        booking: currentTempBooking,
        actionType: 'CustomerDetailsUpdated',
        description: `Customer details updated:\n` + customerChanges.map(c => `• ${c.fieldName}: ${c.oldValue} ➔ ${c.newValue}`).join('\n'),
        operator: currentWorker || 'System',
        reason: 'Profile Correction',
        overrides: {
          fieldChanges: customerChanges
        }
      });
      rev.revisionNumber = oldRevisionCount + 1 + (updatedRevisions.length - oldRevisionCount);
      updatedRevisions.push(rev);
    }

    if (bookingChanges.length > 0) {
      const rev = buildRevision({
        booking: currentTempBooking,
        actionType: 'BookingDetailsUpdated',
        description: `Booking parameters updated:\n` + bookingChanges.map(c => `• ${c.fieldName}: ${c.oldValue} ➔ ${c.newValue}`).join('\n'),
        operator: currentWorker || 'System',
        reason: 'Details Correction',
        overrides: {
          fieldChanges: bookingChanges,
          baseFare: Number(editBaseFare),
          securityDeposit: Number(editSecurityDeposit),
          advancePaid: Number(editAdvancePaid),
          depositDetails: {
            mode: editDepositPaymentMode,
            cashAmount: newCashDeposit,
            onlineAmount: newOnlineDeposit
          },
          paymentCollection: updatedPaymentCollection
        }
      });
      rev.revisionNumber = oldRevisionCount + 1 + (updatedRevisions.length - oldRevisionCount);
      updatedRevisions.push(rev);
    }

    if (pricingChanges.length > 0) {
      const rev = buildRevision({
        booking: currentTempBooking,
        actionType: 'RentalCostChanged',
        description: `Rental Cost/Discount details updated:\n` + pricingChanges.map(c => `• ${c.fieldName}: ${c.oldValue} ➔ ${c.newValue}`).join('\n'),
        operator: currentWorker || 'System',
        reason: 'Price Override',
        overrides: {
          fieldChanges: pricingChanges,
          baseFare: Number(editBaseFare),
          discount: Number(editDiscountAmount),
          securityDeposit: Number(editSecurityDeposit),
          advancePaid: Number(editAdvancePaid),
          depositDetails: {
            mode: editDepositPaymentMode,
            cashAmount: newCashDeposit,
            onlineAmount: newOnlineDeposit
          },
          paymentCollection: updatedPaymentCollection
        }
      });
      rev.revisionNumber = oldRevisionCount + 1 + (updatedRevisions.length - oldRevisionCount);
      updatedRevisions.push(rev);
    }

    if (depositChanges.length > 0) {
      const rev = buildRevision({
        booking: currentTempBooking,
        actionType: 'DepositChanged',
        description: `Security Deposit details updated from ₹${selectedBooking.securityDeposit} to ₹${editSecurityDeposit}. Mode: ${editDepositPaymentMode}`,
        operator: currentWorker || 'System',
        reason: 'Deposit Level Update',
        overrides: {
          fieldChanges: depositChanges,
          baseFare: Number(editBaseFare),
          securityDeposit: Number(editSecurityDeposit),
          advancePaid: Number(editAdvancePaid),
          depositDetails: {
            mode: editDepositPaymentMode,
            cashAmount: newCashDeposit,
            onlineAmount: newOnlineDeposit
          },
          depositDetailsObj: {
            oldDeposit: selectedBooking.securityDeposit,
            newDeposit: Number(editSecurityDeposit),
            difference: Number(editSecurityDeposit) - selectedBooking.securityDeposit,
            mode: editDepositPaymentMode,
            cashAmount: newCashDeposit,
            onlineAmount: newOnlineDeposit
          },
          paymentCollection: updatedPaymentCollection
        }
      });
      rev.revisionNumber = oldRevisionCount + 1 + (updatedRevisions.length - oldRevisionCount);
      updatedRevisions.push(rev);
    }

    if (updatedRevisions.length === oldRevisionCount) {
      const rev = buildRevision({
        booking: selectedBooking,
        actionType: 'Edit',
        description: `Edited booking profile notes/details.`,
        operator: currentWorker || 'System',
        reason: 'General Update',
        overrides: {
          baseFare: Number(editBaseFare),
          securityDeposit: Number(editSecurityDeposit),
          advancePaid: Number(editAdvancePaid),
          depositDetails: {
            mode: editDepositPaymentMode,
            cashAmount: newCashDeposit,
            onlineAmount: newOnlineDeposit
          },
          paymentCollection: updatedPaymentCollection
        }
      });
      rev.revisionNumber = oldRevisionCount + 1;
      updatedRevisions.push(rev);
    }

    const payload = {
      customerName: editFullName,
      customerPhone: editPhone,
      pickupDate: editPickupDate,
      expectedDropDate: editExpectedDropDate,
      expectedEndDate: new Date(editExpectedDropDate),
      baseFare: Number(editBaseFare),
      discount: Number(editDiscountAmount),
      advancePaid: Number(editAdvancePaid),
      rentalPaid: Number(editAdvancePaid),
      depositHeld: Number(editSecurityDeposit),
      outstandingRent: Math.max(0, (Number(editBaseFare) + (Number(editHelmetsCount) * 50) - Number(editDiscountAmount)) - Number(editAdvancePaid)),
      paymentMethod: editPaymentMethod,
      paymentMode: editPaymentMethod,
      paymentCollection: updatedPaymentCollection,
      securityDeposit: Number(editSecurityDeposit),
      customer: {
        name: editFullName,
        fatherName: editFatherName,
        phone: editPhone,
        alternatePhone: editAltPhone,
        email: editEmail,
        drivingLicense: editDL,
        aadhaar: editAadhaar,
        address: { street: editStreet, city: editCity, state: editState, pincode: editPincode }
      },
      selectedPlan: newTargetObj.selectedPlan,
      addons: {
        helmetsCount: Number(editHelmetsCount),
        helmetsPrice: 50,
        otherAccessories: editNotes
      },
      depositDetails: {
        mode: editDepositPaymentMode,
        cashAmount: newCashDeposit,
        onlineAmount: newOnlineDeposit
      },
      revisions: updatedRevisions,
      durationHours: durationHours,
      durationDays: Math.ceil(durationHours / 24),
      // Sync variables inside settlement to prevent pre-save hooks override
      settlement: {
        ...selectedBooking.settlement,
        totalBill: Number(editBaseFare) + (Number(editHelmetsCount) * 50),
        actualBill: Number(editBaseFare) + (Number(editHelmetsCount) * 50),
        previousPaid: Number(editAdvancePaid),
        depositCollected: Number(editSecurityDeposit),
        remainingToPay: Math.max(0, (Number(editBaseFare) + (Number(editHelmetsCount) * 50) - Number(editDiscountAmount)) - Number(editAdvancePaid))
      }
    };

    onAdminOverride(selectedBooking.bookingId, payload);
    setActiveModal(null);
    alert('Booking details updated successfully!');
  };

  const handleStandaloneCollectSubmit = async (e) => {
    e.preventDefault();
    
    let mixedDetails = '';
    if (collectMode === 'Mixed') {
      const sum = Number(collectCashAmount) + Number(collectOnlineAmount) + Number(collectCardAmount);
      if (sum !== Number(collectAmount)) {
        return alert(`Payment Collection error: Sum of Cash (₹${collectCashAmount}) + Online (₹${collectOnlineAmount}) + Card (₹${collectCardAmount}) must equal total (₹${collectAmount}).`);
      }
      mixedDetails = `Cash: ${collectCashAmount}, Online: ${collectOnlineAmount}, Card: ${collectCardAmount}`;
    }

    let rentalPart = 0;
    let depositPart = 0;

    if (collectType === 'Rental') {
      rentalPart = Number(collectAmount);
    } else if (collectType === 'Deposit') {
      depositPart = Number(collectAmount);
    } else if (collectType === 'Both') {
      if (Number(collectAmount) <= pendingRental) {
        rentalPart = Number(collectAmount);
      } else {
        rentalPart = pendingRental;
        depositPart = Number(collectAmount) - pendingRental;
      }
    }

    const newAdvancePaid = selectedBooking.advancePaid + rentalPart;
    
    const oldDDetails = selectedBooking.depositDetails || {};
    const oldCash = Number(oldDDetails.cashAmount || (oldDDetails.mode === 'Cash' ? selectedBooking.securityDeposit : 0));
    const oldOnline = Number(oldDDetails.onlineAmount || (oldDDetails.mode === 'Online' ? selectedBooking.securityDeposit : 0));

    let depCashAdd = 0;
    let depOnlineAdd = 0;
    if (depositPart > 0) {
      if (collectMode === 'Cash') {
        depCashAdd = depositPart;
      } else if (['UPI', 'Online', 'Card'].includes(collectMode)) {
        depOnlineAdd = depositPart;
      } else if (collectMode === 'Mixed') {
        const cashShare = (Number(collectCashAmount) / Number(collectAmount)) * depositPart;
        depCashAdd = Math.round(cashShare);
        depOnlineAdd = depositPart - depCashAdd;
      }
    }

    const newCashDeposit = oldCash + depCashAdd;
    const newOnlineDeposit = oldOnline + depOnlineAdd;
    const newMode = (newCashDeposit > 0 && newOnlineDeposit > 0) ? 'Mixed' : newCashDeposit > 0 ? 'Cash' : 'Online';

    const newPayment = {
      mode: collectMode,
      amount: Number(collectAmount),
      transactionId: `TXN-COL-${Math.floor(100000 + Math.random() * 900000)}`,
      reference: collectMode === 'Mixed' ? mixedDetails : collectNotes,
      timestamp: new Date().toISOString()
    };

    let updatedRevisions = [...(selectedBooking.revisions || [])];
    const oldRevisionCount = updatedRevisions.length;

    if (rentalPart > 0) {
      const rentPaymentObj = {
        mode: collectMode,
        amount: rentalPart,
        cashAmount: collectMode === 'Mixed' ? Number(collectCashAmount) : collectMode === 'Cash' ? rentalPart : 0,
        onlineAmount: collectMode === 'Mixed' ? Number(collectOnlineAmount) : ['UPI', 'Online', 'Bank Transfer'].includes(collectMode) ? rentalPart : 0,
        cardAmount: collectMode === 'Mixed' ? Number(collectCardAmount) : collectMode === 'Card' ? rentalPart : 0
      };

      const overrides = {
        advancePaid: selectedBooking.advancePaid + rentalPart,
        additionalPayment: rentPaymentObj,
        collectionDetails: {
          amount: rentalPart,
          mode: collectMode,
          cashSplit: Math.round(rentPaymentObj.cashAmount),
          onlineSplit: Math.round(rentPaymentObj.onlineAmount),
          cardSplit: Math.round(rentPaymentObj.cardAmount),
          remarks: `${collectNotes} (Rental Part)`
        }
      };

      const rev = buildRevision({
        booking: selectedBooking,
        actionType: 'PaymentCollected',
        description: `Rental Payment Collected: ₹${rentalPart}. Mode: ${collectMode}.`,
        operator: currentWorker || 'System',
        reason: collectNotes,
        overrides: overrides
      });
      rev.revisionNumber = oldRevisionCount + 1 + (updatedRevisions.length - oldRevisionCount);
      updatedRevisions.push(rev);
    }

    if (depositPart > 0) {
      const overrides = {
        securityDeposit: selectedBooking.securityDeposit + depositPart,
        depositDetails: {
          mode: newMode,
          cashAmount: newCashDeposit,
          onlineAmount: newOnlineDeposit
        },
        depositDetailsObj: {
          oldDeposit: selectedBooking.securityDeposit,
          newDeposit: selectedBooking.securityDeposit + depositPart,
          difference: depositPart,
          mode: collectMode,
          cashAmount: newCashDeposit,
          onlineAmount: newOnlineDeposit
        },
        collectionDetails: {
          amount: depositPart,
          mode: collectMode,
          cashSplit: Math.round(depCashAdd),
          onlineSplit: Math.round(depOnlineAdd),
          cardSplit: 0,
          remarks: `${collectNotes} (Deposit Part)`
        }
      };

      const tempBookingWithRent = {
        ...selectedBooking,
        advancePaid: selectedBooking.advancePaid + rentalPart,
        paymentCollection: [...(selectedBooking.paymentCollection || []), newPayment]
      };

      const rev = buildRevision({
        booking: tempBookingWithRent,
        actionType: 'DepositChange',
        description: `Deposit Payment Collected: ₹${depositPart}. Mode: ${collectMode}.`,
        operator: currentWorker || 'System',
        reason: collectNotes,
        overrides: overrides
      });
      rev.revisionNumber = oldRevisionCount + 1 + (updatedRevisions.length - oldRevisionCount);
      updatedRevisions.push(rev);
    }

    const payload = {
      payment: newPayment,
      securityDeposit: selectedBooking.securityDeposit + depositPart,
      depositHeld: selectedBooking.securityDeposit + depositPart,
      depositDetails: {
        mode: newMode,
        cashAmount: newCashDeposit,
        onlineAmount: newOnlineDeposit
      },
      advancePaid: newAdvancePaid,
      rentalPaid: newAdvancePaid,
      outstandingRent: Math.max(0, (selectedBooking.settlement?.actualBill || selectedBooking.settlement?.totalBill || selectedBooking.baseFare || 0) - newAdvancePaid),
      paymentMode: collectMode,
      cashAmount: collectMode === 'Mixed' ? Number(collectCashAmount) : collectMode === 'Cash' ? Number(collectAmount) : 0,
      onlineAmount: collectMode === 'Mixed' ? Number(collectOnlineAmount) : ['UPI', 'Online', 'Bank Transfer'].includes(collectMode) ? Number(collectAmount) : 0,
      cardAmount: collectMode === 'Mixed' ? Number(collectCardAmount) : collectMode === 'Card' ? Number(collectAmount) : 0,
      revisions: updatedRevisions
    };

    if (isAdmin || backendActive) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ''}/api/bookings/${selectedBooking.bookingId}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          bookings.forEach(b => {
            if (b.bookingId === selectedBooking.bookingId) {
              b.paymentCollection = updated.paymentCollection;
              b.settlement = updated.settlement;
              b.depositDetails = updated.depositDetails;
              b.securityDeposit = updated.securityDeposit;
              b.advancePaid = updated.advancePaid;
              b.revisions = updated.revisions;
              b.finalAmount = updated.settlement?.remainingToPay || 0;
            }
          });
          alert('Payment recorded successfully!');
        } else {
          alert('Server failed to record payment.');
        }
      } catch (err) {
        console.error(err);
        alert('Network error connecting to backend.');
      }
    }
    setActiveModal(null);
  };

  const handleAdminOverrideSubmit = (e) => {
    e.preventDefault();
    onAdminOverride(selectedBooking.bookingId, {
      baseFare: Number(overrideBaseFare),
      discount: Number(overrideDiscount),
      advancePaid: Number(overrideAdvancePaid),
      securityDeposit: Number(overrideSecurityDeposit),
      finalAmount: Number(overrideFinalAmount),
      paymentMethod: overridePaymentMethod,
      status: overrideStatus
    });
    setActiveModal(null);
  };

  // PRINT DETAILS HTML GENERATOR
  const triggerPrintDetails = (booking) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    const flow = getCardFlow(booking);
    
    const resolvedVObj = vehicles.find(v => v.vehicleId === booking.vehicleId);
    const resolvedV = {
      name: resolvedVObj?.name || booking.vehicleName || 'Unknown Vehicle',
      regNumber: resolvedVObj?.regNumber || booking.vehicleRegNumber || '',
      category: resolvedVObj?.category || booking.vehicleDetails?.category || 'Bike'
    };
    
    printWindow.document.write(`
      <html>
        <head>
          <title>VELORENT Rental Bill - Invoice #${booking.bookingId}</title>
          <style>
            body { font-family: 'Inter', sans-serif; color: #333; margin: 30px; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: bold; font-size: 1.1rem; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 10px; text-transform: uppercase; color: #555; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total-box { margin-top: 20px; padding: 12px; background-color: #f9f9f9; border: 1px solid #e2e8f0; border-radius: 6px; text-align: right; font-size: 1.1rem; font-weight: bold; }
            .footer { margin-top: 40px; text-align: center; font-size: 0.8rem; color: #888; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="header">
            <div>
              <h2 style="margin: 0; color: #4f46e5;">VELORENT RENTALS</h2>
              <span style="font-size: 0.85rem; color: #666;">Indore Branch Office</span>
            </div>
            <div style="text-align: right;">
              <h3 style="margin: 0;">INVOICE #${booking.bookingId}</h3>
              <span style="font-size: 0.85rem; color: #666;">Date: ${new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div class="section grid">
            <div>
              <div class="section-title">Customer Information</div>
              <p><strong>Name:</strong> ${booking.customerName}</p>
              <p><strong>Phone:</strong> ${booking.customerPhone}</p>
              <p><strong>Email:</strong> ${booking.customer?.email || 'N/A'}</p>
            </div>
            <div>
              <div class="section-title">Vehicle Information</div>
              <p><strong>Name:</strong> ${resolvedV.name}</p>
              <p><strong>Reg Number:</strong> ${resolvedV.regNumber}</p>
              <p><strong>Plan Details:</strong> ${booking.selectedPlan?.planType || '24-Hour'}</p>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for choosing Velorent Rentals. For help, contact +91 98765 43210.</p>
            <p>Authorized Handover Operator: ${booking.workerId || 'Ramesh Kumar'}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 16-SECTION return settlement engine matching mockup
  // 11-SECTION return settlement engine matching user Master Plan
  const calculateReturnSettlement = () => {
    if (!selectedBooking) return {};

    const snapshot = getBookingFinancialSnapshot(selectedBooking);
    const originalBaseFare = snapshot.originalBaseFare || 0;
    const extTotal = snapshot.extTotal || 0;
    const addonsTotal = snapshot.addonsTotal || 0;
    const discount = snapshot.discount || 0;
    const currentRentalCost = snapshot.rentalCost || 0;
    const depositHeld = (selectedBooking.depositHeld !== undefined && selectedBooking.depositHeld !== null) ? selectedBooking.depositHeld : (snapshot.depositCollected || 0);
    const rentalPaid = (selectedBooking.rentalPaid !== undefined && selectedBooking.rentalPaid !== null) ? selectedBooking.rentalPaid : (snapshot.rentalPaid || 0);

    const startMeter = selectedBooking.pickupDetails?.odometerStart || selectedBooking.handover?.startMeter || 0;
    
    // Meter reading computations
    const endMeter = Number(dropEndMeter) || startMeter;
    const totalKmUsed = Math.max(0, endMeter - startMeter);
    
    // Custom rounding rule: decimal <= 0.5 -> round down, decimal > 0.5 -> round up
    const customRoundKm = (val) => {
      const decimalPart = val - Math.floor(val);
      return decimalPart <= 0.5 ? Math.floor(val) : Math.ceil(val);
    };

    const totalKmUsedRounded = customRoundKm(totalKmUsed);
    
    // Category checks
    const resolvedVehicle = vehicles.find(v => v.vehicleId === selectedBooking.vehicleId) || {
      name: selectedBooking.vehicleName || 'Unknown Vehicle',
      regNumber: selectedBooking.vehicleRegNumber || '',
      category: selectedBooking.vehicleDetails?.category || 'Bike'
    };

    const resolvedCategory = resolvedVehicle.category?.toLowerCase() || '';
    const isCar = resolvedCategory === 'car';
    const isBike = resolvedCategory === 'bike';
    const isScooty = resolvedCategory === 'scooty';
    const isScootyFuel = isScooty && selectedBooking.handover?.fuelIncluded;

    // Time calculations
    const startPickup = new Date(
      selectedBooking.pickupDetails?.actualTime || 
      selectedBooking.rentalPeriod?.actualPickupDate || 
      selectedBooking.pickupDate || 
      selectedBooking.rentalPeriod?.startDate
    );
    const returnTimeActual = dropReturnDate ? new Date(dropReturnDate) : new Date();
    const diffMs = returnTimeActual.getTime() - startPickup.getTime();
    
    // Formatted durations helper
    const formatDuration = (ms) => {
      if (ms <= 0) return '0 hrs 0 mins';
      const totalMins = Math.floor(ms / (1000 * 60));
      const hrs = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      return `${hrs} hrs ${mins} mins`;
    };

    // 1. Duration (Primary: persisted durationHours. Fallback: dynamic calculate from expected dates)
    const expectedReturn = new Date(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate);
    const dynamicDurationHours = Math.max(1, Math.ceil((expectedReturn - startPickup) / (1000 * 60 * 60)));
    const bookedDurationHours = selectedBooking.durationHours || dynamicDurationHours || 24;

    const actualDurationStr = formatDuration(diffMs);
    const actualHoursDecimal = Math.max(0, diffMs) / (1000 * 60 * 60);
    
    // Extra time minute-based billing computations
    const actualMinsTotal = Math.max(0, Math.floor(diffMs / (1000 * 60)));
    const bookedMins = bookedDurationHours * 60;
    const extraMinsRaw = Math.max(0, actualMinsTotal - bookedMins);
    const netExtraMins = Math.max(0, extraMinsRaw - Number(dropFreeMinutes || 0));
    
    const chargeableMins = netExtraMins;
    const chargeableHrs = Math.floor(chargeableMins / 60);
    const chargeableMinsPart = chargeableMins % 60;
    const chargeableHours = chargeableMins / 60;

    const extraHoursDecimal = Math.max(0, actualHoursDecimal - bookedDurationHours);
    const extraHoursStr = extraHoursDecimal > 0 ? formatDuration(diffMs - bookedDurationHours * 3600 * 1000) : '0 hrs 0 mins';
    const chargeableHoursStr = `${chargeableHrs} hrs ${chargeableMinsPart} mins`;
    
    // 2. Extra Hour Rate (Primary: persisted extraHourCharge. Fallback: resolve from active vehicle pricing plans)
    const activePlanType = selectedBooking.selectedPlan?.planType || '24-Hour';
    const activePlanKey = activePlanType === 'Hourly' ? 'hourly' : activePlanType === '12-Hour' ? 'twelveHour' : 'twentyFourHour';
    const activeVehiclePlan = resolvedVehicle.pricingPlans?.[activePlanKey] || {};
    const fallbackExtraHourRate = activeVehiclePlan.extraHourCharge || (isCar ? 200 : isBike ? 100 : 30);
    const extraHourRate = selectedBooking.selectedPlan?.extraHourCharge || fallbackExtraHourRate;
        
    // Minute-based extra hour billing calculation
    const extraHourCharge = (chargeableHrs * extraHourRate) + (chargeableMinsPart * (extraHourRate / 60));

    // 3. Extra KM Rate (Primary: persisted extraKmCharge. Fallback: resolve from active vehicle pricing plans)
    const fallbackExtraKmRate = activeVehiclePlan.extraKmCharge || (isCar ? 12 : isBike ? 8 : isScootyFuel ? 2 : 5);
    const extraKmRate = selectedBooking.selectedPlan?.extraKmCharge || fallbackExtraKmRate;

    // 4. KM Limit (Primary: persisted kmLimit. Fallback: dynamic scale based on duration)
    let freeKmLimit = selectedBooking.selectedPlan?.kmLimit;
    if (!freeKmLimit) {
      const baseKmLimit = 120;
      freeKmLimit = Math.round(baseKmLimit * (bookedDurationHours / 24));
    }

    let allowedKmLimit = 0;
    let allowedKmLimitRounded = 0;
    let freeKmLimitTotal = 0;
    let extraKm = 0;
    let extraKmRounded = 0;
    let extraKmCharge = 0;
    let distanceCharge = 0;

    if (isScootyFuel) {
      // Scooty with fuel logic: No Allowed KM / Extra KM / Extra KM charges.
      // Every km is chargeable, billed based on rounded distance used
      distanceCharge = totalKmUsedRounded * extraKmRate;
    } else {
      allowedKmLimit = Math.max(freeKmLimit, actualHoursDecimal * 10);
      allowedKmLimitRounded = customRoundKm(allowedKmLimit);
      freeKmLimitTotal = allowedKmLimit + Number(dropAddFreeKm || 0);
      extraKm = Math.max(0, totalKmUsed - freeKmLimitTotal);
      extraKmRounded = customRoundKm(extraKm);
      extraKmCharge = extraKmRounded * extraKmRate;
    }

    // Accessories Checklist computations (Toolkit, First Aid, Spare Tyre, EV Charger logic REMOVED)
    const helmetExpected = selectedBooking.addons?.helmetsCount || 0;
    const helmetReturnedVal = Number(dropHelmetReturned);
    const helmetMissing = Math.max(0, helmetExpected - helmetReturnedVal);
    const calculatedHelmetCharge = helmetMissing * 500; // ₹500 penalty per missing helmet

    const accessoryChargeTotal = calculatedHelmetCharge;

    // Dynamic Extra Charges (Manual returns)
    const damageChargeSum = Number(dropDamageCharges) || 0;
    const cleaningChargeSum = Number(dropCleaningCharges) || 0;
    const towingChargeSum = Number(dropTowingCharges) || 0;
    const otherChargesSum = Number(dropAdditionalCharges) || 0;
    const manualChargesTotal = damageChargeSum + cleaningChargeSum + towingChargeSum + otherChargesSum;

    // Return adjustments waiver
    const waiverDiscount = Number(dropDiscountWaiver) || 0;

    // Actual Rental Bill calculation
    let actualRentalBill = 0;
    let baseHourlyCost = 0;
    if (isScootyFuel) {
      // Scooty with Fuel: actual hours * hourly rate + actual KM * fuel rate + damages + accessories + other - discount
      const baseHourlyRate = selectedBooking.selectedPlan?.rate || 40;
      baseHourlyCost = actualHoursDecimal * baseHourlyRate;
      
      actualRentalBill = baseHourlyCost + distanceCharge + manualChargesTotal + accessoryChargeTotal - waiverDiscount;
    } else {
      // Standard Formula: currentRentalCost + extra time + extra km + damages + accessories + other - discount
      actualRentalBill = currentRentalCost + extraHourCharge + extraKmCharge + manualChargesTotal + accessoryChargeTotal - waiverDiscount;
    }
    actualRentalBill = Math.max(0, actualRentalBill);

    // Settlement Logic (Corrections Section 1)
    const rentalDue = actualRentalBill - rentalPaid;
    const depositAdjustment = Math.max(0, Math.min(depositHeld, rentalDue));
    const remainingCollection = Math.max(0, rentalDue - depositAdjustment);
    const depositRefund = depositHeld - depositAdjustment + Math.max(0, -rentalDue);

    let settlementStatus = 'Settled';
    if (remainingCollection > 0) settlementStatus = 'Collect';
    else if (depositRefund > 0) settlementStatus = 'Refund';

    return {
      startMeter,
      endMeter,
      totalKmUsed,
      totalKmUsedRounded,
      freeKmLimit,
      allowedKmLimit,
      allowedKmLimitRounded,
      freeKmLimitTotal,
      extraKm,
      extraKmRounded,
      extraKmCharge,
      distanceCharge,
      helmetExpected,
      helmetReturnedVal,
      helmetMissing,
      calculatedHelmetCharge,
      calculatedToolkitCharge: 0,
      calculatedFirstAidCharge: 0,
      calculatedSpareTyreCharge: 0,
      calculatedChargerCharge: 0,
      accessoryChargeTotal,
      bookedDurationHours,
      actualDurationStr,
      extraHoursStr,
      chargeableHours,
      chargeableHoursStr,
      extraHourCharge,
      cleaningChargeSum,
      damageChargeSum,
      towingChargeSum,
      otherChargesSum,
      manualChargesTotal,
      waiverDiscount,
      actualRentalBill,
      rentalPaid,
      depositHeld,
      rentalDue,
      depositAdjustment,
      remainingCollection,
      depositRefund,
      settlementStatus,
      baseHourlyCost,
      isScootyFuel,
      currentRentalCost,
      originalBaseFare,
      extTotal,
      addonsTotal,
      discount
    };
  };

  const calc = calculateReturnSettlement();

  // Helper to parse booking modifications
  const getBookingImpactingChanges = (revisions) => {
    if (!revisions) return [];
    const impacting = [];
    revisions.forEach(rev => {
      if (['CustomerDetailsUpdated', 'BookingDetailsUpdated', 'RentalCostChanged', 'DepositChanged', 'Edit'].includes(rev.actionType)) {
        if (rev.fieldChanges && rev.fieldChanges.length > 0) {
          let addressChanges = [];
          rev.fieldChanges.forEach(change => {
            const name = change.fieldName;
            if (name === 'helmetsCount') {
              impacting.push({
                title: 'Helmet Count',
                detail: `${change.oldValue} ➔ ${change.newValue}`
              });
            } else if (name === 'discount') {
              impacting.push({
                title: 'Discount',
                detail: `₹${change.oldValue} ➔ ₹${change.newValue}`
              });
            } else if (name === 'securityDeposit') {
              impacting.push({
                title: 'Security Deposit',
                detail: `₹${change.oldValue} ➔ ₹${change.newValue}`
              });
            } else if (name === 'phone') {
              impacting.push({
                title: 'Customer Phone Updated',
                detail: `${change.oldValue} ➔ ${change.newValue}`
              });
            } else if (['street', 'city', 'state', 'pincode'].includes(name)) {
              addressChanges.push(`${name}: ${change.oldValue} ➔ ${change.newValue}`);
            } else if (name === 'baseFare') {
              impacting.push({
                title: 'Base Fare',
                detail: `₹${change.oldValue} ➔ ₹${change.newValue}`
              });
            } else if (name === 'planType') {
              impacting.push({
                title: 'Plan Type',
                detail: `${change.oldValue} ➔ ${change.newValue}`
              });
            } else if (name === 'pickupDate') {
              impacting.push({
                title: 'Pickup Time',
                detail: `${new Date(change.oldValue).toLocaleString()} ➔ ${new Date(change.newValue).toLocaleString()}`
              });
            } else if (name === 'expectedDropDate') {
              impacting.push({
                title: 'Expected Return Time',
                detail: `${new Date(change.oldValue).toLocaleString()} ➔ ${new Date(change.newValue).toLocaleString()}`
              });
            }
          });
          if (addressChanges.length > 0) {
            impacting.push({
              title: 'Address Updated',
              detail: addressChanges.join(', ')
            });
          }
        }
      }
    });
    return impacting;
  };

  const bookingImpactingEdits = selectedBooking ? getBookingImpactingChanges(selectedBooking.revisions) : [];
  const hasEdits = bookingImpactingEdits.length > 0;

  // Extensions Calculations
  const extendRevisions = selectedBooking?.revisions?.filter(r => r.actionType === 'Extend') || [];
  const totalExtendedHours = extendRevisions.reduce((sum, r) => sum + (r.durationDetails?.difference || 0), 0);
  const originalDuration = selectedBooking ? (selectedBooking.durationHours || 0) - totalExtendedHours : 0;
  const pickupTime = selectedBooking ? new Date(
    selectedBooking.pickupDetails?.actualTime || 
    selectedBooking.rentalPeriod?.actualPickupDate || 
    selectedBooking.pickupDate
  ) : null;
  const originalReturnTime = pickupTime ? new Date(pickupTime.getTime() + originalDuration * 60 * 60 * 1000) : null;
  const currentReturnTime = selectedBooking ? new Date(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate) : null;
  const hasExtensions = extendRevisions.length > 0 || (selectedBooking?.extensions?.length || 0) > 0;

  // Replacements Calculations
  const replaceRevisions = selectedBooking?.revisions?.filter(r => r.actionType === 'Replace') || [];
  const hasSwaps = replaceRevisions.length > 0;

  // Payment Timeline items
  const payments = selectedBooking?.paymentCollection || [];
  let runningTotalPaid = 0;
  const paymentTimelineItems = payments.map((p, idx) => {
    runningTotalPaid += p.amount;
    let label = 'Booking Created';
    if (idx > 0) {
      const ref = (p.reference || '').toLowerCase();
      if (ref.includes('ext') || ref.includes('extension')) {
        label = 'Extension';
      } else if (ref.includes('replace') || ref.includes('swap') || ref.includes('replacement')) {
        label = 'Vehicle Replacement';
      } else {
        label = 'Collect Money';
      }
    }
    return {
      label,
      amount: p.amount,
      mode: p.mode,
      timestamp: p.timestamp
    };
  });

  // Fallback for initial collection display if paymentTimelineItems is empty
  if (selectedBooking && paymentTimelineItems.length === 0) {
    paymentTimelineItems.push({
      label: 'Booking Created',
      amount: selectedBooking.advancePaid || 0,
      mode: selectedBooking.paymentMethod || 'UPI'
    });
    runningTotalPaid = selectedBooking.advancePaid || 0;
  }

  // Deposit Timeline items
  const depositTimelineItems = [];
  let runningDeposit = 0;
  if (selectedBooking) {
    const chronologicalRevisions = selectedBooking.revisions?.slice().sort((a, b) => (a.revisionNumber || 0) - (b.revisionNumber || 0)) || [];
    const createRev = chronologicalRevisions.find(r => r.actionType === 'Create');
    const firstDepDetails = chronologicalRevisions.find(r => r.depositDetails || r.overrides?.depositDetails)?.depositDetails;
    
    let initialDepAmount = 0;
    let initialDepMode = 'Cash';

    if (createRev) {
      initialDepAmount = createRev.newValues?.deposit || 0;
    } else if (chronologicalRevisions.length > 0) {
      initialDepAmount = chronologicalRevisions[0].oldValues?.deposit || 0;
    } else {
      initialDepAmount = selectedBooking.securityDeposit || 0;
    }

    if (firstDepDetails) {
      initialDepMode = firstDepDetails.mode || 'Cash';
    } else if (selectedBooking.depositDetails?.mode) {
      initialDepMode = selectedBooking.depositDetails.mode;
    }

    depositTimelineItems.push({
      label: 'Initial Deposit',
      amount: initialDepAmount,
      mode: initialDepMode
    });
    runningDeposit = initialDepAmount;

    chronologicalRevisions.forEach(rev => {
      if (rev.actionType !== 'Create' && rev.depositDetails) {
        const diff = rev.depositDetails.difference;
        if (diff !== 0) {
          runningDeposit += diff;
          depositTimelineItems.push({
            label: diff > 0 ? 'Additional Deposit' : 'Deposit Reduced',
            amount: diff,
            mode: rev.depositDetails.mode || 'Cash'
          });
        }
      }
    });
  }
  const totalDepositHeld = selectedBooking?.securityDeposit || 0;

  // Sync payment amounts with net settlement when netSettlement changes or payment method changes
  useEffect(() => {
    if (selectedBooking && viewState === 'drop-off') {
      const isRefund = calc.depositRefund > 0;
      const reqVal = isRefund ? calc.depositRefund : calc.remainingCollection;
      if (reqVal > 0) {
        if (dropPaymentMethod === 'UPI' || dropPaymentMethod === 'Online' || dropPaymentMethod === 'UPI Refund' || dropPaymentMethod === 'Online Refund') {
          setDropOnlineReceived(reqVal);
          setDropCashReceived(0);
        } else if (dropPaymentMethod === 'Mixed' || dropPaymentMethod === 'Mixed Refund') {
          const sum = Number(dropCashReceived) + Number(dropOnlineReceived);
          if (Math.abs(sum - reqVal) > 0.01) {
            setDropCashReceived(reqVal);
            setDropOnlineReceived(0);
            setDropPaymentMethod(isRefund ? 'Cash Refund' : 'Cash');
          }
        } else {
          setDropCashReceived(reqVal);
          setDropOnlineReceived(0);
          setDropPaymentMethod(isRefund ? 'Cash Refund' : 'Cash');
        }
      } else {
        setDropCashReceived(0);
        setDropOnlineReceived(0);
      }
    }
  }, [calc.remainingCollection, calc.depositRefund, selectedBooking, viewState]);

  const handleDropCompleteSubmit = (e) => {
    e.preventDefault();
    if (!dropReturnDate || !dropEndMeter) {
      return alert('Please enter Actual Return Time and End Meter Reading before completing the return.');
    }
    
    const startOdo = selectedBooking.pickupDetails?.odometerStart || selectedBooking.handover?.startMeter || 0;
    if (Number(dropEndMeter) < Number(startOdo)) {
      return alert(`Odometer at return (${dropEndMeter} KM) cannot be less than pickup odometer (${startOdo} KM).`);
    }

    if (!dropSettlementConfirmed) {
      return alert('Please confirm the settlement before completing the return.');
    }

    const isRefund = calc.depositRefund > 0;
    const reqVal = isRefund ? calc.depositRefund : calc.remainingCollection;

    // Mixed split details
    let mixedDetails = '';
    if (dropPaymentMethod === 'Mixed' || dropPaymentMethod === 'Mixed Refund') {
      const sum = Number(dropCashReceived) + Number(dropOnlineReceived);
      if (Math.abs(sum - reqVal) > 0.01) {
        return alert(`Mixed Split error: Cash Amount (₹${dropCashReceived}) + Online Amount (₹${dropOnlineReceived}) must equal ${isRefund ? 'refund' : 'collect'} amount (₹${reqVal.toFixed(2)}).`);
      }
      mixedDetails = `Cash: ${dropCashReceived}, Online: ${dropOnlineReceived}`;
    }

    const addPayment = (!isRefund && reqVal > 0) ? {
      mode: dropPaymentMethod === 'Mixed' ? 'Mixed' : dropPaymentMethod,
      amount: reqVal,
      cashAmount: dropPaymentMethod === 'Mixed' ? Number(dropCashReceived) : dropPaymentMethod === 'Cash' ? reqVal : 0,
      onlineAmount: dropPaymentMethod === 'Mixed' ? Number(dropOnlineReceived) : ['UPI', 'Online', 'Card'].includes(dropPaymentMethod) ? reqVal : 0,
      cardAmount: 0,
      transactionId: dropCollectTxnId || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      reference: dropPaymentMethod === 'Mixed' ? mixedDetails : dropCollectNotes,
      timestamp: new Date().toISOString()
    } : null;

    const refundDetailsObj = isRefund ? {
      amount: reqVal,
      status: 'Completed',
      method: dropPaymentMethod === 'Mixed Refund' ? 'Mixed' : (dropPaymentMethod === 'UPI Refund' ? 'UPI' : 'Cash'),
      notes: dropPaymentMethod === 'Mixed Refund' ? mixedDetails : (dropRefundReason || 'Refund processed')
    } : {
      amount: 0,
      status: '',
      method: 'Cash',
      notes: 'No refund'
    };

    const newPaymentCollection = addPayment 
      ? [...(selectedBooking.paymentCollection || []), addPayment]
      : (selectedBooking.paymentCollection || []);

    const newDepositHeld = Math.max(0, calc.depositHeld - calc.depositAdjustment);

    const revisionOverrides = {
      dropDetails: {
        actualTime: new Date(dropReturnDate),
        endMeter: Number(dropEndMeter),
        endFuelLevel: dropFuelLevelReturn,
        vehicleCondition: dropVehicleCondition,
        damageNotes: `${dropConditionNotes || 'None'} | Notes: ${dropDamageNotes || 'None'}`,
        damageCharges: calc.damageChargeSum,
        cleaningCharges: calc.cleaningChargeSum,
        otherCharges: calc.otherChargesSum + calc.towingChargeSum,
        photos: [],
        operator: currentWorker || 'System'
      },
      advancePaid: selectedBooking.advancePaid + (isRefund ? 0 : reqVal),
      securityDeposit: newDepositHeld,
      additionalPayment: addPayment,
      paymentCollection: newPaymentCollection,
      depositDetails: {
        mode: selectedBooking.depositDetails?.mode || 'Cash',
        cashAmount: 0,
        onlineAmount: 0
      }
    };

    const dropRevision = buildRevision({
      booking: selectedBooking,
      actionType: 'DropOff',
      description: `Drop-Off Completed. End Odometer: ${dropEndMeter} KM. Settlement: ${isRefund ? `Refunded ₹${reqVal}` : `Collected ₹${reqVal}`}.`,
      operator: currentWorker || 'System',
      reason: dropRefundReason || 'Return Checklist Closed',
      overrides: revisionOverrides
    });

    if (isRefund) {
      dropRevision.refundDetails = refundDetailsObj;
    } else if (reqVal > 0) {
      dropRevision.collectionDetails = {
        amount: reqVal,
        mode: dropPaymentMethod === 'Mixed' ? 'Mixed' : dropPaymentMethod,
        cashSplit: dropPaymentMethod === 'Mixed' ? Number(dropCashReceived) : dropPaymentMethod === 'Cash' ? reqVal : 0,
        onlineSplit: dropPaymentMethod === 'Mixed' ? Number(dropOnlineReceived) : ['UPI', 'Online', 'Card'].includes(dropPaymentMethod) ? reqVal : 0,
        cardSplit: 0,
        remarks: dropCollectNotes || 'Dropoff Collection'
      };
    }

    const payload = {
      dropDetails: {
        actualTime: new Date(dropReturnDate),
        endMeter: Number(dropEndMeter),
        endFuelLevel: dropFuelLevelReturn,
        vehicleCondition: dropVehicleCondition,
        damageNotes: `${dropConditionNotes || 'None'} | Notes: ${dropDamageNotes || 'None'}`,
        damageCharges: calc.damageChargeSum,
        cleaningCharges: calc.cleaningChargeSum,
        otherCharges: calc.otherChargesSum + calc.towingChargeSum,
        photos: [],
        operator: currentWorker || 'System'
      },
      paymentCollection: addPayment,
      refundDetails: refundDetailsObj,
      settlement: {
        actualBill: calc.actualRentalBill,
        rentalPaid: calc.rentalPaid,
        rentalDue: calc.rentalDue,
        depositHeld: calc.depositHeld,
        depositAdjustment: calc.depositAdjustment,
        depositRefunded: calc.depositRefund,
        collectAmount: calc.remainingCollection,
        refundAmount: calc.depositRefund,
        settlementStatus: calc.settlementStatus
      },
      workerId: currentWorker || 'System',
      revisions: [...(selectedBooking.revisions || []), dropRevision]
    };

    onDropOff(selectedBooking.bookingId, payload);
    setViewState('list');
    setSelectedBooking(null);
    alert('Vehicle return checklist closed successfully!');
  };

  return (
    <div className="animate-slide-up">
      
      {/* ====================================================================
         1. BOOKED VEHICLES LIST VIEW (CARD LAYOUT - MOCKUP COMPLIANT)
         ==================================================================== */}
      {viewState === 'list' && (
        <>
          {/* Header section with Stats widgets */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Booked Vehicles
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>View and manage current active vehicle rentals</p>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <span className="badge badge-primary" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                {stats.active} Active Bookings
              </span>
              <button 
                className="btn btn-secondary" 
                onClick={() => handleClearFilters()}
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Stats Widgets Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '16px' }}>
            {/* Widget 1: Overdue */}
            <div style={{ 
              background: 'rgba(244, 63, 94, 0.05)', 
              border: '1px solid rgba(244, 63, 94, 0.15)', 
              borderRadius: '8px', 
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '85px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f43f5e' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>⚠️ Overdue</span>
                <span style={{ fontSize: '1.25rem' }}>🚨</span>
              </div>
              <strong style={{ fontSize: '1.5rem', color: 'white', lineHeight: 1 }}>{stats.overdue}</strong>
              <span style={{ fontSize: '0.7rem', color: '#f43f5e' }}>Contact customer now</span>
            </div>

            {/* Widget 2: Soon */}
            <div style={{ 
              background: 'rgba(245, 158, 11, 0.05)', 
              border: '1px solid rgba(245, 158, 11, 0.15)', 
              borderRadius: '8px', 
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '85px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>⏱️ Soon</span>
                <span style={{ fontSize: '1.25rem' }}>⏳</span>
              </div>
              <strong style={{ fontSize: '1.5rem', color: 'white', lineHeight: 1 }}>{stats.endingSoon}</strong>
              <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>Ending in 12 hours</span>
            </div>

            {/* Widget 3: Today */}
            <div style={{ 
              background: 'rgba(99, 102, 241, 0.05)', 
              border: '1px solid rgba(99, 102, 241, 0.15)', 
              borderRadius: '8px', 
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '85px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#818cf8' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>📅 Today</span>
                <span style={{ fontSize: '1.25rem' }}>🏁</span>
              </div>
              <strong style={{ fontSize: '1.5rem', color: 'white', lineHeight: 1 }}>{stats.endingToday}</strong>
              <span style={{ fontSize: '0.7rem', color: '#818cf8' }}>Ending by end of day</span>
            </div>

            {/* Widget 4: Active */}
            <div style={{ 
              background: 'rgba(16, 185, 129, 0.05)', 
              border: '1px solid rgba(16, 185, 129, 0.15)', 
              borderRadius: '8px', 
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '85px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>✅ Active</span>
                <span style={{ fontSize: '1.25rem' }}>🛵</span>
              </div>
              <strong style={{ fontSize: '1.5rem', color: 'white', lineHeight: 1 }}>{stats.active}</strong>
              <span style={{ fontSize: '0.7rem', color: '#10b981' }}>Currently active rentals</span>
            </div>
          </div>

          {/* Search Box & Expandable Filters Toggler */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search by vehicle, booking ID, customer name/phone..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '32px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-secondary)' }}>🔍</span>
            </div>
            
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowFilterBar(!showFilterBar)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px', justifyContent: 'center' }}
            >
              <span>⚙️ {showFilterBar ? 'Hide Filters' : 'Show Filters'}</span>
              <span>{showFilterBar ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* Expandable Filter Parameters */}
          {showFilterBar && (
            <div className="glass-panel animate-fade" style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {/* 1. Status Filter */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Booking Status Filter</label>
                  <select className="form-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="All">All Bookings</option>
                    <option value="Active Bookings">Active Bookings</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Extended">Extended</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                {/* 2. Zone Filter */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Zone Filter</label>
                  <select className="form-control" value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}>
                    <option value="All">All Zones</option>
                    {uniqueZones.map(z => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Sort Filter */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Sort Filter</label>
                  <select className="form-control" value={sortFilter} onChange={e => setSortFilter(e.target.value)}>
                    <option value="Latest Booking">Latest Booking</option>
                    <option value="Oldest Booking">Oldest Booking</option>
                    <option value="Ending Soon">Ending Soon</option>
                  </select>
                </div>
              </div>

              {/* Date Filters Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                {/* Starting Dates Filter */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Bookings Starting Filter</label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    {['All', 'Today', 'Yesterday', 'Custom'].map(type => (
                      <button 
                        key={type} 
                        type="button" 
                        className={`btn ${startFilterType === type ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}
                        onClick={() => setStartFilterType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {startFilterType === 'Custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }} className="animate-fade">
                      <input type="datetime-local" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem' }} value={startCustomMin} onChange={e => setStartCustomMin(e.target.value)} />
                      <input type="datetime-local" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem' }} value={startCustomMax} onChange={e => setStartCustomMax(e.target.value)} />
                    </div>
                  )}
                </div>

                {/* Ending Dates Filter */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Bookings Ending Filter</label>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    {['All', 'Today', 'Yesterday', 'Custom'].map(type => (
                      <button 
                        key={type} 
                        type="button" 
                        className={`btn ${endFilterType === type ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', flex: 1 }}
                        onClick={() => setEndFilterType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {endFilterType === 'Custom' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }} className="animate-fade">
                      <input type="datetime-local" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem' }} value={endCustomMin} onChange={e => setEndCustomMin(e.target.value)} />
                      <input type="datetime-local" className="form-control" style={{ padding: '4px 8px', fontSize: '0.75rem' }} value={endCustomMax} onChange={e => setEndCustomMax(e.target.value)} />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                <button className="btn btn-secondary" style={{ padding: '6px 16px', fontSize: '0.8rem' }} onClick={handleClearFilters}>
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {/* Cards Grid List matching Mockup 3 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {sortedBookings.map(b => {
              const flow = getCardFlow(b);
              const totalExt = b.extensions?.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
              const extraCharges = b.dropDetails
                ? ((b.dropDetails.damageCharges || 0) + (b.dropDetails.lateCharges || 0) + (b.dropDetails.fuelCharges || 0))
                : 0;
              const originalBaseFare = Math.max(0, (b.baseFare || 0) - totalExt);
              const grossTotal = originalBaseFare + totalExt + extraCharges - (b.discount || 0);
              const due = b.status === 'Completed' ? 0 : Math.max(0, grossTotal - b.advancePaid);
              const remainingTime = getRemainingTimeText(b.expectedDropDate || b.rentalPeriod?.expectedEndDate, b.status);

              let sideColor = 'var(--status-ongoing-border)';
              if (remainingTime.isOverdue) sideColor = '#f43f5e';
              else if (b.status === 'Reserved') sideColor = 'var(--status-reserved-border)';
              else if (b.status === 'Completed') sideColor = 'var(--status-completed-border)';
              else if (b.status === 'Cancelled') sideColor = 'var(--status-cancelled-border)';

              return (
                <div 
                  key={b.bookingId} 
                  className="glass-panel" 
                  style={{ 
                    padding: 0, 
                    overflow: 'hidden', 
                    borderLeft: `5px solid ${sideColor}`,
                    position: 'relative'
                  }}
                >
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Left side matching Mockup 3 layout */}
                    <div style={{ display: 'flex', gap: '14px', flex: 2, alignItems: 'center' }}>
                      <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '8px', 
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '1.8rem',
                        border: '1px solid var(--border-light)'
                      }}>
                        {b.vehicleDetails?.category?.toLowerCase() === 'car' ? '🚗' : '🛵'}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          
                          {/* Status and Time badges */}
                          <span className={`badge ${remainingTime.isOverdue ? 'badge-danger' : 'badge-' + b.status.toLowerCase()}`} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px' }}>
                            {remainingTime.isOverdue ? 'OVERDUE' : b.status.toUpperCase()}
                          </span>

                          {['Ongoing', 'Reserved', 'Extended'].includes(b.status) && (
                            <span className={`badge ${remainingTime.isOverdue ? 'badge-danger' : 'badge-active'}`} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '12px' }}>
                              {remainingTime.text}
                            </span>
                          )}

                          {/* Customer Name, Phone, and Zone Location in strip */}
                          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white', marginLeft: '6px' }}>
                            👤 {b.customerName}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            📞 {b.customerPhone}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontSize: '0.8rem', color: '#f87171' }}>
                            📍 {b.pickupLocation || 'Vijay Nagar'}
                          </span>
                        </div>

                        {/* Timing details with Calendar icon */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📅</span>
                          <span>
                            {(() => {
                              const pDate = new Date(b.pickupDate || b.rentalPeriod?.startDate);
                              return isNaN(pDate.getTime()) ? 'N/A' : pDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                            })()}
                            &nbsp;➔&nbsp;
                            {(() => {
                              const dDate = new Date(b.expectedDropDate || b.rentalPeriod?.expectedEndDate);
                              return isNaN(dDate.getTime()) ? 'N/A' : dDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle Right: Financial Indicators */}
                    <div style={{ flex: 1, padding: '0 20px', borderLeft: '1px solid rgba(255,255,255,0.04)', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Total combined: <strong style={{ color: 'white' }}>₹{grossTotal}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--status-available)' }}>
                        Paid upfront: <strong>₹{b.advancePaid}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: due > 0 ? '#f59e0b' : 'var(--text-muted)' }}>
                        Owed on Return: <strong>₹{due}</strong>
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', color: due === 0 ? 'var(--status-available)' : 'var(--status-reserved)' }}>
                        {due === 0 ? 'PAID' : 'UNPAID'}
                      </div>
                    </div>

                    {/* Right side buttons mapping Mockup 3 */}
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => { setSelectedBooking(b); setViewState('view-booking'); }}
                        style={{ padding: '6px 14px', fontSize: '0.8rem', border: '1px solid var(--border-light)' }}
                      >
                        View
                      </button>
                      
                      {['Reserved', 'Ongoing', 'Extended'].includes(b.status) && (
                        <>
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => openEdit(b)}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent' }}
                          >
                            Edit
                          </button>
                          
                          <button 
                            className="btn btn-primary" 
                            onClick={() => openDropPage(b)}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'var(--primary)', borderColor: 'var(--primary)', color: 'white' }}
                          >
                            Dropoff
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom Strip Cash flow matching mockup 3 */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)', 
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ padding: '6px', color: 'var(--status-available)' }}>
                      💵 Cash In: <strong>₹{flow.cashIn}</strong>
                    </div>
                    <div style={{ padding: '6px', color: 'var(--status-ongoing)' }}>
                      💻 Online In: <strong>₹{flow.onlineIn}</strong>
                    </div>
                    <div style={{ padding: '6px', color: '#f59e0b' }}>
                      💸 Cash Out: <strong>₹{flow.cashOut}</strong>
                    </div>
                    <div style={{ padding: '6px', color: '#a78bfa' }}>
                      💳 Online Out: <strong>₹{flow.onlineOut}</strong>
                    </div>
                  </div>
                </div>
              );
            })}

            {sortedBookings.length === 0 && (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active rentals found matching filters.
              </div>
            )}
          </div>
        </>
      )}

      {/* ====================================================================
         2. BOOKING DETAILS PAGE (MOCKUP 1 LAYOUT - 12 SECTIONS PROFILE)
         ==================================================================== */}
      {viewState === 'view-booking' && selectedBooking && (
        <div style={{ padding: '24px', background: '#f8fafc', color: '#1e293b', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          {/* Header Section matching mockup 1 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderBottom: '1px solid #cbd5e1', 
            paddingBottom: '14px', 
            marginBottom: '20px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                type="button" 
                className="btn" 
                onClick={() => { setViewState('list'); setSelectedBooking(null); }}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#475569', 
                  fontSize: '1.5rem', 
                  cursor: 'pointer',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                ←
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a', fontFamily: 'var(--font-title)' }}>
                  Booking Details
                </h2>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontFamily: 'var(--font-body)' }}>
                  #{selectedBooking.bookingId}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                type="button"
                className="btn" 
                onClick={() => openEdit(selectedBooking)} 
                style={{ 
                  fontSize: '0.8rem', 
                  padding: '8px 14px', 
                  border: '1px solid #f97316', 
                  color: '#f97316', 
                  background: '#ffffff',
                  borderRadius: '6px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📝 Edit Details
              </button>
              <button 
                type="button"
                className="btn" 
                onClick={() => openExtend(selectedBooking)} 
                style={{ 
                  fontSize: '0.8rem', 
                  padding: '8px 14px', 
                  border: '1px solid #3b82f6', 
                  color: '#3b82f6', 
                  background: '#ffffff',
                  borderRadius: '6px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🕒 Extend Booking
              </button>
              <span style={{ 
                borderRadius: '20px', 
                padding: '6px 14px', 
                fontSize: '0.8rem', 
                fontWeight: '600',
                background: '#eff6ff', 
                color: '#1e40af', 
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }}></span>
                {selectedBooking.status}
              </span>
            </div>
          </div>

          {/* Double Column layout exactly as Mockup 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '20px' }}>
            
            {/* Left Column Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Card 1: Vehicle Information */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '12px' 
                }}>
                  Vehicle Information
                </h4>
                <div style={{ marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {activeVehicle?.name}
                  </h3>
                  <code style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '500' }}>
                    {activeVehicle?.regNumber}
                  </code>
                </div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '16px', 
                  fontSize: '0.85rem', 
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '14px'
                }}>
                  {(() => {
                    const vehicleObj = vehicles?.find(v => v.vehicleId === selectedBooking.vehicleId) || {
                      name: selectedBooking.vehicleName || 'Unknown Vehicle',
                      regNumber: selectedBooking.vehicleRegNumber || '',
                      category: selectedBooking.vehicleDetails?.category || 'Bike',
                      fuelType: 'Petrol',
                      color: 'Black',
                      mileage: 40,
                      fuelCapacity: 5,
                      meterReading: selectedBooking.handover?.startMeter || selectedBooking.pickupDetails?.odometerStart || 0
                    };
                    return (
                      <>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Category:</span>
                          <strong style={{ color: '#1e293b' }}>{vehicleObj?.category || selectedBooking.vehicleDetails?.category || 'Bike'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Fuel Type:</span>
                          <strong style={{ color: '#1e293b' }}>{vehicleObj?.fuelType || 'Petrol'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Color:</span>
                          <strong style={{ color: '#1e293b' }}>{vehicleObj?.color || 'Black'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Mileage:</span>
                          <strong style={{ color: '#1e293b' }}>{vehicleObj?.mileage ? `${vehicleObj.mileage} km/l` : '40 km/l'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Fuel Capacity:</span>
                          <strong style={{ color: '#1e293b' }}>{vehicleObj?.fuelCapacity ? `${vehicleObj.fuelCapacity} L` : '5 L'}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Meter Reading:</span>
                          <strong style={{ color: '#1e293b' }}>{vehicleObj?.meterReading ? `${vehicleObj.meterReading} km` : `${selectedBooking.handover?.startMeter || selectedBooking.pickupDetails?.odometerStart || 0} km`}</strong>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Card 2: Customer Information */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px' 
                }}>
                  Customer Information
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '20px'
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem', color: '#64748b' }}>👤</span>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block' }}>
                        {selectedBooking.customerName || selectedBooking.customer?.name || 'N/A'}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Customer</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem', color: '#64748b' }}>📞</span>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block' }}>
                        {selectedBooking.customerPhone || selectedBooking.customer?.phone || 'N/A'}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Phone</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.5rem', color: '#64748b' }}>✉️</span>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '0.95rem', display: 'block' }}>
                        {selectedBooking.customer?.email || 'N/A'}
                      </strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Email</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Timing & Duration Details */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px' 
                }}>
                  Timing & Duration Details
                </h4>
                {(() => {
                  const formatDate = (dateStr) => {
                    if (!dateStr) return 'N/A';
                    const d = new Date(dateStr);
                    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                  };
                  return (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '14px' }}>
                        
                        {/* Left Scheduled Box */}
                        <div style={{ 
                          border: '1px solid #bfdbfe', 
                          background: '#eff6ff', 
                          padding: '16px', 
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          color: '#1e40af',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <strong style={{ color: '#1d4ed8', borderBottom: '1px solid #bfdbfe', paddingBottom: '6px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                            📅 Scheduled Booking Time
                          </strong>
                          <div>Scheduled Start Time: <strong style={{ color: '#1e3a8a', marginLeft: '4px' }}>{formatDate(selectedBooking.pickupDate || selectedBooking.rentalPeriod?.startDate)}</strong></div>
                          <div>Scheduled End Time: <strong style={{ color: '#1e3a8a', marginLeft: '4px' }}>{formatDate(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate)}</strong></div>
                          <div>Booked Duration: <strong style={{ color: '#1e3a8a', marginLeft: '4px' }}>{selectedBooking.durationHours || 12} hours</strong></div>
                          <div>Rate Plan Type: <strong style={{ color: '#1e3a8a', marginLeft: '4px' }}>{selectedBooking.selectedPlan?.planType || 'Hourly'}</strong></div>
                        </div>

                        {/* Right Actual details / Handover Box */}
                        <div style={{ 
                          border: '1px solid #e2e8f0', 
                          background: '#f8fafc', 
                          padding: '16px', 
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          color: '#475569',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center'
                        }}>
                          {selectedBooking.pickupDetails || selectedBooking.handover?.startMeter ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', textAlign: 'left' }}>
                              <strong style={{ color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '4px', fontSize: '0.9rem' }}>Actual Pickup Information</strong>
                              <div>Pickup Completed: <strong style={{ color: '#16a34a' }}>Yes</strong></div>
                              <div>Pickup Time: <strong style={{ color: '#1e293b' }}>{formatDate(selectedBooking.pickupDetails?.actualTime || selectedBooking.rentalPeriod?.actualPickupDate)}</strong></div>
                              <div>Odometer Reading: <strong style={{ color: '#1e293b' }}>{selectedBooking.pickupDetails?.odometerStart || selectedBooking.handover?.startMeter || 0} km</strong></div>
                            </div>
                          ) : (
                            <>
                              <span style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</span>
                              <strong style={{ color: '#334155', display: 'block', marginBottom: '4px' }}>Pickup not completed yet</strong>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Actual timings will appear after vehicle handover</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                        Booking Created At: <strong style={{ color: '#334155', marginLeft: '4px' }}>{selectedBooking.createdAt && !isNaN(new Date(selectedBooking.createdAt).getTime()) ? new Date(selectedBooking.createdAt).toLocaleString() : 'N/A'}</strong>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Card 4: Location Details */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px' 
                }}>
                  Location Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#10b981', fontSize: '1.3rem' }}>📍</span>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '0.9rem', display: 'block' }}>Pickup Location</strong>
                      <div style={{ color: '#334155', fontSize: '0.85rem', fontWeight: '500' }}>{selectedBooking.pickupLocation || 'Bhawarkua'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Center Pickup</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#dc2626', fontSize: '1.3rem' }}>📍</span>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '0.9rem', display: 'block' }}>Drop Location</strong>
                      <div style={{ color: '#334155', fontSize: '0.85rem', fontWeight: '500' }}>{selectedBooking.dropLocation || 'Bhawarkua'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Center Drop</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ color: '#3b82f6', fontSize: '1.3rem' }}>📍</span>
                    <div>
                      <strong style={{ color: '#0f172a', fontSize: '0.9rem', display: 'block' }}>Zone</strong>
                      <div style={{ color: '#334155', fontSize: '0.85rem', fontWeight: '500' }}>{selectedBooking.pickupLocation || 'Bhawarkua'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedBooking.pickupLocation || 'Bhawarkua'} Zone</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Documents & Address Card */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px' 
                }}>
                  📁 Customer Address & Documents
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Address:</span>
                    <strong style={{ color: '#1e293b' }}>
                      {selectedBooking.customer?.address?.street || 'N/A'}, {selectedBooking.customer?.address?.city || 'N/A'}, {selectedBooking.customer?.address?.state || 'N/A'} - {selectedBooking.customer?.address?.pincode || 'N/A'}
                    </strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>DL Number:</span>
                      <strong style={{ color: '#1e293b' }}>{selectedBooking.customer?.drivingLicense || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', marginBottom: '2px' }}>Aadhaar Number:</span>
                      <strong style={{ color: '#1e293b' }}>{selectedBooking.customer?.aadhaar || 'N/A'}</strong>
                    </div>
                  </div>
                  {/* Thumbnails */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
                    {[
                      { id: 'Front', img: selectedBooking.customer?.docAadhaarFront, label: 'Aadhaar F' },
                      { id: 'Back', img: selectedBooking.customer?.docAadhaarBack, label: 'Aadhaar B' },
                      { id: 'DL', img: selectedBooking.customer?.docLicense, label: 'DL' },
                      { id: 'Reg', img: selectedBooking.customer?.docRegistration, label: 'Reg Form' }
                    ].map(doc => doc.img ? (
                      <div key={doc.id} style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', height: '60px', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={doc.img} alt={doc.label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    ) : (
                      <div key={doc.id} style={{ border: '1px dashed #cbd5e1', borderRadius: '4px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#64748b', textAlign: 'center', background: '#f8fafc' }}>
                        {doc.label} Empty
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 6: Rate Plan & Add-ons */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px' 
                }}>
                  Rate Plan & Add-ons
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', fontSize: '0.85rem' }}>
                  {/* Left Column Rate Plan Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#475569' }}>
                    <strong style={{ color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '6px', fontSize: '0.9rem' }}>Rate Plan Details</strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Rate Type:</span>
                      <strong style={{ color: '#1e293b' }}>{selectedBooking.selectedPlan?.planType || 'Hourly'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Base Rate:</span>
                      <strong style={{ color: '#1e293b' }}>₹{selectedBooking.selectedPlan?.rate || 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>KM Limit:</span>
                      <strong style={{ color: '#1e293b' }}>{selectedBooking.selectedPlan?.kmLimit || 0} km</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Extra KM Charge:</span>
                      <strong style={{ color: '#1e293b' }}>₹{selectedBooking.selectedPlan?.extraKmCharge || 0}/km</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Extra Hour Charge:</span>
                      <strong style={{ color: '#1e293b' }}>₹{selectedBooking.selectedPlan?.extraHourCharge || 0}/hr</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Grace Period:</span>
                      <strong style={{ color: '#1e293b' }}>15 mins</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Includes Fuel:</span>
                      <strong style={{ color: '#1e293b' }}>{selectedBooking.handover?.fuelIncluded ? 'Yes' : 'No'}</strong>
                    </div>
                  </div>

                  {/* Right Column Addons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: '#475569' }}>
                    <strong style={{ color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px', marginBottom: '6px', fontSize: '0.9rem' }}>Add-ons & Extras</strong>
                    <div style={{ border: '1px solid #cbd5e1', padding: '14px', borderRadius: '8px', background: '#f8fafc' }}>
                      <strong style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>Extra Helmet</strong>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px' }}>Quantity: {selectedBooking.addons?.helmetsCount || 0}</div>
                      <div style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '1.1rem' }}>₹{(selectedBooking.addons?.helmetsCount || 0) * (selectedBooking.addons?.helmetsPrice || 50)}</div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>₹{selectedBooking.addons?.helmetsPrice || 50} each</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Revision History dot-timeline */}
              {hasGenuineChanges && (
                <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px',
                  borderBottom: '1px solid #e2e8f0',
                  paddingBottom: '8px'
                }}>
                  📜 Booking Revision History
                </h4>
                {selectedBooking.revisions && selectedBooking.revisions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '20px', borderLeft: '2px solid #cbd5e1', marginLeft: '10px' }}>
                    {selectedBooking.revisions.slice().sort((a, b) => (a.revisionNumber || 0) - (b.revisionNumber || 0)).map((rev, index) => {
                      const isExpanded = !!expandedRevisions[index];
                      const toggleExpand = () => {
                        setExpandedRevisions(prev => ({
                          ...prev,
                          [index]: !prev[index]
                        }));
                      };
                      const isAuditExpanded = !!expandedFinancialAudits[index];
                      const toggleAuditExpand = (e) => {
                        e.stopPropagation();
                        setExpandedFinancialAudits(prev => ({
                          ...prev,
                          [index]: !prev[index]
                        }));
                      };

                      let badgeBg = '#f1f5f9';
                      let badgeText = '#475569';
                      if (rev.actionType === 'Create') { badgeBg = '#ecfdf5'; badgeText = '#065f46'; }
                      else if (rev.actionType === 'Extend') { badgeBg = '#eff6ff'; badgeText = '#1e40af'; }
                      else if (rev.actionType === 'Replace') { badgeBg = '#faf5ff'; badgeText = '#581c87'; }
                      else if (['PaymentCollected', 'DepositChange'].includes(rev.actionType)) { badgeBg = '#fef3c7'; badgeText = '#92400e'; }
                      else if (rev.actionType === 'DropOff') { badgeBg = '#fdf2f8'; badgeText = '#9d174d'; }
                      else if (rev.actionType === 'CustomerDetailsUpdated' || rev.actionType === 'BookingDetailsUpdated') { badgeBg = '#f8fafc'; badgeText = '#334155'; }

                      return (
                        <div key={index} style={{ 
                          position: 'relative', 
                          background: isExpanded ? '#f8fafc' : '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '12px',
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: isExpanded ? '0 4px 6px -1px rgba(0, 0, 0, 0.05)' : 'none'
                        }}>
                          {/* Timeline dot */}
                          <div style={{ 
                            position: 'absolute', 
                            left: '-27px', 
                            top: '16px', 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            background: rev.actionType === 'Create' ? '#10b981' : rev.actionType === 'Replace' ? '#a855f7' : rev.actionType === 'Extend' ? '#3b82f6' : '#f97316',
                            border: '2px solid #ffffff',
                            boxShadow: '0 0 0 2px #cbd5e1'
                          }}></div>

                          {/* Card Header (Clickable to toggle) */}
                          <div 
                            onClick={toggleExpand} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              cursor: 'pointer',
                              userSelect: 'none'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>
                                  Revision #{rev.revisionNumber || (index + 1)}
                                </span>
                                <span style={{ 
                                  fontSize: '0.7rem', 
                                  fontWeight: 'bold', 
                                  background: badgeBg, 
                                  color: badgeText, 
                                  padding: '2px 8px', 
                                  borderRadius: '12px',
                                  textTransform: 'uppercase'
                                }}>
                                  {rev.actionType}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {rev.timestamp ? new Date(rev.timestamp).toLocaleString() : 'N/A'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '500', color: '#1e293b', marginTop: '2px' }}>
                                {rev.description.split('\n')[0]}
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#64748b', fontStyle: 'italic' }}>
                                Operator: {rev.operator || 'System'}
                              </span>
                              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </div>
                          </div>

                          {/* Expanded Content Details */}
                          {isExpanded && (
                            <div style={{ 
                              marginTop: '12px', 
                              borderTop: '1px solid #e2e8f0', 
                              paddingTop: '12px', 
                              fontSize: '0.8rem', 
                              color: '#334155',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}>
                              
                              {/* Consolidated Action Details Box */}
                              <div style={{
                                border: '1px solid #e2e8f0',
                                borderLeft: `3px solid ${rev.actionType === 'Create' ? '#10b981' : rev.actionType === 'Replace' ? '#a855f7' : rev.actionType === 'Extend' ? '#3b82f6' : '#f97316'}`,
                                borderRadius: '8px',
                                background: '#f8fafc',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px'
                              }}>
                                {/* Reason/Notes */}
                                {rev.reason && (
                                  <div style={{ fontStyle: 'italic', borderBottom: '1px dashed #e2e8f0', paddingBottom: '6px', color: '#64748b' }}>
                                    <strong>Notes:</strong> "{rev.reason}"
                                  </div>
                                )}
                                
                                {/* Parameter Fields based on action type */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  
                                  {/* For Customer/Booking Edits */}
                                  {rev.fieldChanges && rev.fieldChanges.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Changed Fields:</div>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px' }}>
                                        {rev.fieldChanges.map((change, cIdx) => (
                                          <div key={cIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: cIdx < rev.fieldChanges.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: '4px', marginBottom: '2px' }}>
                                            <span style={{ fontWeight: '500', color: '#475569' }}>{change.fieldName}</span>
                                            <span style={{ color: '#0f172a' }}>
                                              <span style={{ color: '#dc2626', textDecoration: 'line-through', marginRight: '6px' }}>{change.oldValue || 'None'}</span>
                                              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>→ {change.newValue || 'None'}</span>
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* For Vehicle Swaps */}
                                  {rev.vehicleDetails && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                                      <div style={{ fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Swap Logistics:</div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px' }}>
                                        <div>
                                          <span style={{ color: '#64748b', display: 'block' }}>From Old Vehicle:</span>
                                          <strong>{rev.vehicleDetails.oldVehicleName}</strong> <span style={{fontSize:'0.75rem',color:'#64748b'}}>({rev.vehicleDetails.oldVehicleReg})</span>
                                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Closing Odo: {rev.meterDetails?.oldVehicleClosingMeter || 0} KM</span>
                                        </div>
                                        <div>
                                          <span style={{ color: '#64748b', display: 'block' }}>To New Vehicle:</span>
                                          <strong>{rev.vehicleDetails.newVehicleName}</strong> <span style={{fontSize:'0.75rem',color:'#64748b'}}>({rev.vehicleDetails.newVehicleReg})</span>
                                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Starting Odo: {rev.meterDetails?.newVehicleStartingMeter || 0} KM</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* For Extensions */}
                                  {rev.durationDetails && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                                      <div style={{ fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Extension Logistics:</div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px' }}>
                                        <div>
                                          <span style={{ color: '#64748b', display: 'block' }}>Duration Extended:</span>
                                          <strong>{rev.durationDetails.oldDuration} hrs → {rev.durationDetails.newDuration} hrs</strong>
                                          <span style={{ color: '#1e40af', fontSize: '0.75rem', fontWeight: 'bold', display: 'block' }}>+{rev.durationDetails.difference} hrs added</span>
                                        </div>
                                        {rev.collectionDetails && (
                                          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '8px' }}>
                                            <span style={{ color: '#64748b', display: 'block' }}>Extension Charges Paid:</span>
                                            <strong>₹{rev.collectionDetails.amount}</strong> via <span style={{ textTransform: 'capitalize' }}>{rev.collectionDetails.mode}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* For Payments / Deposit changes */}
                                  {!rev.durationDetails && !rev.vehicleDetails && (rev.collectionDetails || rev.depositDetails) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
                                      <div style={{ fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Transaction details:</div>
                                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {rev.collectionDetails && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Amount Collected:</span>
                                            <strong>₹{rev.collectionDetails.amount} ({rev.collectionDetails.mode})</strong>
                                          </div>
                                        )}
                                        {rev.depositDetails && (
                                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Deposit Held:</span>
                                            <strong>₹{rev.depositDetails.oldDeposit} → ₹{rev.depositDetails.newDeposit} (<span style={{ color: rev.depositDetails.difference >= 0 ? '#16a34a' : '#dc2626' }}>{rev.depositDetails.difference >= 0 ? `+₹${rev.depositDetails.difference}` : `-₹${Math.abs(rev.depositDetails.difference)}`}</span>)</strong>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* For initial creation */}
                                  {rev.actionType === 'Create' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                                      <div style={{ fontWeight: '600', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>Initial Booking Stats:</div>
                                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                          <span style={{ color: '#64748b', display: 'block' }}>Initial Rental Cost:</span>
                                          <strong>₹{rev.newValues?.rentalCost}</strong>
                                        </div>
                                        <div>
                                          <span style={{ color: '#64748b', display: 'block' }}>Upfront Paid:</span>
                                          <strong>₹{rev.newValues?.rentalPaid}</strong>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                </div>
                              </div>

                              {/* Advanced Financial Audit Dropdown link */}
                              {rev.oldValues && rev.newValues && (
                                <div style={{ marginTop: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={toggleAuditExpand}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#2563eb',
                                      fontSize: '0.75rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      padding: '0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      outline: 'none'
                                    }}
                                  >
                                    <span>{isAuditExpanded ? '▼ Hide' : '▶ Show'} Advanced Financial Ledger Audit</span>
                                  </button>
                                  
                                  {isAuditExpanded && (
                                    <div style={{ 
                                      marginTop: '10px', 
                                      padding: '12px',
                                      background: '#f8fafc',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '8px',
                                      display: 'flex', 
                                      flexDirection: 'column', 
                                      gap: '12px'
                                    }}>
                                      
                                      {/* Financial Changes (Old vs New) */}
                                      <div>
                                        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#475569', fontSize: '0.75rem' }}>Financial Changes (Old vs New):</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                                          <thead>
                                            <tr style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                                              <th style={{ padding: '6px', textAlign: 'left', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Category</th>
                                              <th style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>Old</th>
                                              <th style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>New</th>
                                              <th style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>Diff</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                                              <td style={{ padding: '6px', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>Rental Cost</td>
                                              <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>₹{rev.oldValues.rentalCost}</td>
                                              <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>₹{rev.newValues.rentalCost}</td>
                                              <td style={{ padding: '6px', textAlign: 'right', fontWeight: '500', color: (rev.difference?.rentalCost || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                                                {(rev.difference?.rentalCost || 0) >= 0 ? `+₹${rev.difference.rentalCost}` : `-₹${Math.abs(rev.difference.rentalCost)}`}
                                              </td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                                              <td style={{ padding: '6px', borderRight: '1px solid #e2e8f0', fontWeight: '500' }}>Deposit Held</td>
                                              <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>₹{rev.oldValues.deposit}</td>
                                              <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>₹{rev.newValues.deposit}</td>
                                              <td style={{ padding: '6px', textAlign: 'right', fontWeight: '500', color: (rev.difference?.deposit || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                                                {(rev.difference?.deposit || 0) >= 0 ? `+₹${rev.difference.deposit}` : `-₹${Math.abs(rev.difference.deposit)}`}
                                              </td>
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff', fontWeight: 'bold' }}>
                                              <td style={{ padding: '6px', borderRight: '1px solid #e2e8f0' }}>Booking Value</td>
                                              <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>₹{rev.oldValues.bookingValue}</td>
                                              <td style={{ padding: '6px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>₹{rev.newValues.bookingValue}</td>
                                              <td style={{ padding: '6px', textAlign: 'right', color: (rev.difference?.bookingValue || 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                                                {(rev.difference?.bookingValue || 0) >= 0 ? `+₹${rev.difference.bookingValue}` : `-₹${Math.abs(rev.difference.bookingValue)}`}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Visual Ledger Box Snapshot */}
                                      {rev.financialSnapshotAfterChange && (
                                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', fontSize: '0.75rem' }}>
                                          <div style={{ fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                            📊 Ledger Snapshot After Change
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Rental Cost:</span>
                                                <strong>₹{rev.financialSnapshotAfterChange.rentalCost}</strong>
                                              </div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Deposit Held:</span>
                                                <strong>₹{rev.financialSnapshotAfterChange.depositHeld}</strong>
                                              </div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontWeight: '500' }}>
                                                <span>Booking Value:</span>
                                                <strong>₹{rev.financialSnapshotAfterChange.bookingValue}</strong>
                                              </div>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '1px solid #e2e8f0', paddingLeft: '12px' }}>
                                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Rental Paid:</span>
                                                <strong style={{ color: '#16a34a' }}>₹{rev.financialSnapshotAfterChange.rentalPaid}</strong>
                                              </div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Deposit Collected:</span>
                                                <strong style={{ color: '#2563eb' }}>₹{rev.financialSnapshotAfterChange.depositCollected}</strong>
                                              </div>
                                              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c', fontWeight: '500' }}>
                                                <span>Outstanding Rent:</span>
                                                <strong>₹{rev.financialSnapshotAfterChange.outstandingRent}</strong>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Cumulative Payment Splits */}
                                          {rev.financialSnapshotAfterChange.paymentBreakdown && (
                                            <div style={{ borderTop: '1px dashed #e2e8f0', marginTop: '8px', paddingTop: '6px', fontSize: '0.7rem' }}>
                                              <div style={{ fontWeight: '600', color: '#64748b', marginBottom: '2px' }}>Cumulative Payment Splits:</div>
                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                <div>
                                                  <span style={{ color: '#94a3b8' }}>Rent Paid:</span>
                                                  <div>
                                                    Cash: ₹{rev.financialSnapshotAfterChange.paymentBreakdown.rentalCash || 0} | UPI: ₹{rev.financialSnapshotAfterChange.paymentBreakdown.rentalOnline || 0}
                                                  </div>
                                                </div>
                                                <div>
                                                  <span style={{ color: '#94a3b8' }}>Deposit Held:</span>
                                                  <div>
                                                    Cash: ₹{rev.financialSnapshotAfterChange.paymentBreakdown.depositCash || 0} | UPI: ₹{rev.financialSnapshotAfterChange.paymentBreakdown.depositOnline || 0}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                    </div>
                                  )}
                                </div>
                              )}

                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}

            </div>

            {/* Right Column Cards matching Mockup 1 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Card 8a: Old Bill Summary */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px',
                  borderBottom: '1px solid #cbd5e1',
                  paddingBottom: '8px'
                }}>
                  📊 Bill Summary
                </h4>
                {(() => {
                  const sortedRevisions = selectedBooking.revisions?.slice().sort((a, b) => (a.revisionNumber || 0) - (b.revisionNumber || 0)) || [];
                  const firstRevision = sortedRevisions[0];
                  
                  let origBaseFare = selectedBooking.baseFare || 0;
                  let origAddonsTotal = (selectedBooking.addons?.helmetsCount || 0) * (selectedBooking.addons?.helmetsPrice || 50);
                  let origDiscount = selectedBooking.discount || 0;
                  let origRentalCostTotal = 0;
                  let origDepositCollected = Number(selectedBooking.securityDeposit || 0);
                  let origRentalPaid = selectedBooking.advancePaid || 0;
                  let origPendingCollection = 0;

                  let origRentalCash = 0;
                  let origRentalOnline = 0;
                  let origRentalCard = 0;

                  if (firstRevision) {
                    const useNewValues = firstRevision.actionType === 'Create';
                    const snapshot = useNewValues ? firstRevision.newValues : firstRevision.oldValues;
                    
                    origRentalCostTotal = snapshot?.rentalCost !== undefined ? snapshot.rentalCost : 0;
                    origDepositCollected = snapshot?.deposit !== undefined ? snapshot.deposit : 0;
                    origRentalPaid = snapshot?.rentalPaid !== undefined ? snapshot.rentalPaid : 0;
                    
                    const breakdown = firstRevision.financialSnapshotAfterChange?.paymentBreakdown;
                    origRentalCash = breakdown?.rentalCash || 0;
                    origRentalOnline = breakdown?.rentalOnline || 0;
                    origRentalCard = breakdown?.rentalCard || 0;

                    const createHelmetsCount = firstRevision.fieldChanges?.find(c => c.fieldName === 'helmetsCount')?.oldValue || selectedBooking.addons?.helmetsCount || 0;
                    origAddonsTotal = Number(createHelmetsCount) * (selectedBooking.addons?.helmetsPrice || 50);
                    origDiscount = Number(firstRevision.fieldChanges?.find(c => c.fieldName === 'discount')?.oldValue || selectedBooking.discount || 0);
                    origBaseFare = Math.max(0, origRentalCostTotal - origAddonsTotal + origDiscount);
                    origPendingCollection = Math.max(0, (origRentalCostTotal + origDepositCollected) - (origRentalPaid + origDepositCollected));
                  } else {
                    const extTotal = selectedBooking.extensions?.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
                    origBaseFare = Math.max(0, (selectedBooking.baseFare || 0) - extTotal);
                    origRentalCostTotal = Math.max(0, origBaseFare + origAddonsTotal - origDiscount);
                    origPendingCollection = Math.max(0, (origRentalCostTotal + origDepositCollected) - (origRentalPaid + origDepositCollected));
                    
                    const pMethod = selectedBooking.paymentMethod || 'Cash';
                    const adv = selectedBooking.advancePaid || 0;
                    if (pMethod === 'Cash') origRentalCash = adv;
                    else if (['UPI', 'Online', 'Bank Transfer'].includes(pMethod)) origRentalOnline = adv;
                    else if (pMethod === 'Card') origRentalCard = adv;
                    else if (pMethod === 'Mixed') {
                      const firstPayment = selectedBooking.paymentCollection?.[0];
                      if (firstPayment && firstPayment.reference) {
                        const cashM = firstPayment.reference.match(/Cash:\s*(\d+)/i);
                        const onlineM = firstPayment.reference.match(/Online:\s*(\d+)/i);
                        const cardM = firstPayment.reference.match(/Card:\s*(\d+)/i);
                        if (cashM) origRentalCash = Number(cashM[1]);
                        if (onlineM) origRentalOnline = Number(onlineM[1]);
                        if (cardM) origRentalCard = Number(cardM[1]);
                      }
                      if (!origRentalCash && !origRentalOnline && !origRentalCard) {
                        origRentalCash = Math.round(adv / 2);
                        origRentalOnline = adv - origRentalCash;
                      }
                    }
                  }
                  
                  const origTotalBookingValue = origRentalCostTotal + origDepositCollected;
                  const origTotalPaidCollected = origRentalPaid + origDepositCollected;
                  const origDepositMode = firstRevision?.depositDetails?.mode || selectedBooking.depositDetails?.mode || 'Cash';

                  return (
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '14px', color: '#475569' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        
                        {/* Left Column: Rental Cost */}
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontWeight: 'bold', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            📋 Old Rental Summary
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Base Rental:</span>
                            <strong>₹{origBaseFare}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Add-ons:</span>
                            <strong>₹{origAddonsTotal}</strong>
                          </div>
                          {origDiscount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: '#16a34a' }}>
                              <span>Discount:</span>
                              <strong>-₹{origDiscount}</strong>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0 0 0', borderTop: '1px solid #cbd5e1', paddingTop: '6px', fontWeight: 'bold', color: '#0f172a' }}>
                            <span>Total Rental:</span>
                            <span>₹{origRentalCostTotal}</span>
                          </div>
                        </div>
                        
                        {/* Right Column: Collection splits */}
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontWeight: 'bold', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            💳 Upfront Paid
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Rental Paid:</span>
                            <strong style={{ color: '#16a34a' }}>₹{origRentalPaid}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0 4px 0', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px dashed #cbd5e1', paddingBottom: '6px' }}>
                            <span>Rental Mode:</span>
                            <span>
                              {origRentalCash > 0 && `Cash: ₹${origRentalCash}`}
                              {origRentalOnline > 0 && ` ${origRentalCash > 0 ? '| ' : ''}Online: ₹${origRentalOnline}`}
                              {origRentalCard > 0 && ` ${(origRentalCash > 0 || origRentalOnline > 0) ? '| ' : ''}Card: ₹${origRentalCard}`}
                              {origRentalCash === 0 && origRentalOnline === 0 && origRentalCard === 0 && 'N/A'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Deposit:</span>
                            <strong style={{ color: '#2563eb' }}>₹{origDepositCollected}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '0.75rem', color: '#64748b' }}>
                            <span>Deposit Mode:</span>
                            <span>{origDepositMode}</span>
                          </div>
                          {origDepositMode === 'Mixed' && (() => {
                            let depCash = 0;
                            let depOnline = 0;
                            if (firstRevision?.depositDetails) {
                              depCash = firstRevision.depositDetails.cashAmount || 0;
                              depOnline = firstRevision.depositDetails.onlineAmount || 0;
                            } else {
                              const depDetailsObj = firstRevision?.financialSnapshotAfterChange?.paymentBreakdown;
                              depCash = depDetailsObj?.depositCash || 0;
                              depOnline = depDetailsObj?.depositOnline || 0;
                            }
                            if (!depCash && !depOnline) {
                              depCash = selectedBooking.depositDetails?.cashAmount || 0;
                              depOnline = selectedBooking.depositDetails?.onlineAmount || 0;
                            }
                            return (
                              <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: '0.7rem', color: '#64748b', paddingLeft: '8px' }}>
                                <span>C: ₹{depCash} / O: ₹{depOnline}</span>
                              </div>
                            );
                          })()}
                        </div>
                        
                      </div>

                      {/* Grand totals */}
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                          <span style={{ fontWeight: 'bold', color: '#1e293b' }}>Total Booking Value:</span>
                          <strong style={{ color: '#2563eb', fontSize: '1rem' }}>₹{origTotalBookingValue}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                          <span style={{ fontWeight: 'bold', color: '#1e293b' }}>Total Paid:</span>
                          <strong style={{ color: '#16a34a', fontSize: '1rem' }}>₹{origTotalPaidCollected}</strong>
                        </div>
                        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '6px 0', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', color: origPendingCollection > 0 ? '#b91c1c' : '#16a34a', fontWeight: 'bold' }}>
                          <span>Pending Collection:</span>
                          <span>₹{origPendingCollection}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Card 8b: Extended Bill Summary */}
              {hasGenuineChanges && (
                <div style={{ 
                  background: '#ffffff', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '12px', 
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <h4 style={{ 
                    color: '#475569', 
                    fontSize: '0.9rem', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '16px',
                    borderBottom: '1px solid #cbd5e1',
                    paddingBottom: '8px'
                  }}>
                    📊 Extended Bill Summary
                  </h4>
                {(() => {
                  const extTotal = selectedBooking.extensions?.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
                  const originalBaseFare = Math.max(0, (selectedBooking.baseFare || 0) - extTotal);
                  const addonsTotal = (selectedBooking.addons?.helmetsCount || 0) * (selectedBooking.addons?.helmetsPrice || 50);
                  const extra = selectedBooking.dropDetails
                    ? ((selectedBooking.dropDetails.damageCharges || 0) + (selectedBooking.dropDetails.lateCharges || 0) + (selectedBooking.dropDetails.cleaningCharges || 0) + (selectedBooking.dropDetails.otherCharges || 0))
                    : 0;
                  
                  const discount = selectedBooking.discount || 0;
                  const rentalCostTotal = Math.max(0, originalBaseFare + extTotal + addonsTotal + extra - discount);
                  const depositCollected = Number(selectedBooking.securityDeposit || 0);
                  const totalBookingValue = rentalCostTotal + depositCollected;
                  
                  const rentalPaid = selectedBooking.advancePaid || 0;
                  const totalPaidCollected = rentalPaid + depositCollected;
                  const pendingCollection = Math.max(0, totalBookingValue - totalPaidCollected);

                  const activeSnap = getBookingFinancialSnapshot(selectedBooking);
                  const activeRentalCash = activeSnap.paymentBreakdown?.rentalCash || 0;
                  const activeRentalOnline = activeSnap.paymentBreakdown?.rentalOnline || 0;
                  const activeRentalCard = activeSnap.paymentBreakdown?.rentalCard || 0;
                  
                  return (
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '14px', color: '#475569' }}>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        
                        {/* Left Column: Rental Cost */}
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontWeight: 'bold', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            📋 New Rental Summary
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Base Rental:</span>
                            <strong>₹{originalBaseFare}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Add-ons:</span>
                            <strong>₹{addonsTotal}</strong>
                          </div>
                          {extTotal > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                              <span>Extensions:</span>
                              <strong>₹{extTotal}</strong>
                            </div>
                          )}
                          {extra > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                              <span>Dropoff:</span>
                              <strong>₹{extra}</strong>
                            </div>
                          )}
                          {discount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', color: '#16a34a' }}>
                              <span>Discount:</span>
                              <strong>-₹{discount}</strong>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0 0 0', borderTop: '1px solid #cbd5e1', paddingTop: '6px', fontWeight: 'bold', color: '#0f172a' }}>
                            <span>Total Rental:</span>
                            <span>₹{rentalCostTotal}</span>
                          </div>
                        </div>
                        
                        {/* Right Column: Collection splits */}
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ fontWeight: 'bold', color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            💳 Upfront Paid
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Rental Paid:</span>
                            <strong style={{ color: '#16a34a' }}>₹{rentalPaid}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0 4px 0', fontSize: '0.75rem', color: '#64748b', borderBottom: '1px dashed #cbd5e1', paddingBottom: '6px' }}>
                            <span>Rental Mode:</span>
                            <span>
                              {activeRentalCash > 0 && `Cash: ₹${activeRentalCash}`}
                              {activeRentalOnline > 0 && ` ${activeRentalCash > 0 ? '| ' : ''}Online: ₹${activeRentalOnline}`}
                              {activeRentalCard > 0 && ` ${(activeRentalCash > 0 || activeRentalOnline > 0) ? '| ' : ''}Card: ₹${activeRentalCard}`}
                              {activeRentalCash === 0 && activeRentalOnline === 0 && activeRentalCard === 0 && 'N/A'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                            <span>Deposit:</span>
                            <strong style={{ color: '#2563eb' }}>₹{depositCollected}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0', fontSize: '0.75rem', color: '#64748b' }}>
                            <span>Deposit Mode:</span>
                            <span>{selectedBooking.depositDetails?.mode || 'Cash'}</span>
                          </div>
                          {selectedBooking.depositDetails?.mode === 'Mixed' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: '0.7rem', color: '#64748b', paddingLeft: '8px' }}>
                              <span>C: ₹{selectedBooking.depositDetails.cashAmount} / O: ₹{selectedBooking.depositDetails.onlineAmount}</span>
                            </div>
                          )}
                        </div>
                        
                      </div>

                      {/* Grand totals */}
                      <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                          <span style={{ fontWeight: 'bold', color: '#1e293b' }}>Total Booking Value:</span>
                          <strong style={{ color: '#2563eb', fontSize: '1rem' }}>₹{totalBookingValue}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                          <span style={{ fontWeight: 'bold', color: '#1e293b' }}>Total Paid:</span>
                          <strong style={{ color: '#16a34a', fontSize: '1rem' }}>₹{totalPaidCollected}</strong>
                        </div>
                        <div style={{ borderTop: '1px dashed #cbd5e1', margin: '6px 0', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', color: pendingCollection > 0 ? '#b91c1c' : '#16a34a', fontWeight: 'bold' }}>
                          <span>Pending Collection:</span>
                          <span>₹{pendingCollection}</span>
                        </div>
                      </div>

                      {pendingCollection > 0 && (
                        <div style={{ 
                          border: '1px solid #fca5a5', 
                          background: '#fef2f2', 
                          padding: '12px', 
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <strong style={{ color: '#b91c1c', fontSize: '0.9rem', display: 'block', marginBottom: '2px' }}>Amount to be Paid</strong>
                            <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Customer needs to pay this amount</span>
                          </div>
                          <strong style={{ color: '#b91c1c', fontSize: '1.2rem', fontWeight: 'bold' }}>₹{pendingCollection}.00</strong>
                        </div>
                      )}
                      
                    </div>
                  );
                })()}
                </div>
              )}

              {/* Card 10: Settlement Outcomes Banner */}
              {(() => {
                const isCompleted = selectedBooking.status === 'Completed';
                
                if (!isCompleted) {
                  return null;
                }
                
                const extTotal = selectedBooking.extensions?.reduce((sum, ext) => sum + ext.extraCharges, 0) || 0;
                const originalBaseFare = Math.max(0, (selectedBooking.baseFare || 0) - extTotal);
                const addonsTotal = (selectedBooking.addons?.helmetsCount || 0) * (selectedBooking.addons?.helmetsPrice || 50);
                const extra = selectedBooking.dropDetails
                  ? ((selectedBooking.dropDetails.damageCharges || 0) + (selectedBooking.dropDetails.lateCharges || 0) + (selectedBooking.dropDetails.cleaningCharges || 0) + (selectedBooking.dropDetails.otherCharges || 0))
                  : 0;
                const discount = selectedBooking.discount || 0;
                
                const finalBill = Math.max(0, originalBaseFare + extTotal + addonsTotal + extra - discount);
                const rentalPaid = selectedBooking.advancePaid || 0;
                const remainingToPay = finalBill - rentalPaid;
                
                const depositCollected = Number(selectedBooking.securityDeposit || 0);
                const netSettlement = remainingToPay - depositCollected;
                const refundAmount = selectedBooking.refundDetails?.amount || (netSettlement < 0 ? Math.abs(netSettlement) : 0);
                
                return (
                  <div style={{ 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '12px', 
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <h4 style={{ 
                      color: '#475569', 
                      fontSize: '0.9rem', 
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '16px',
                      borderBottom: '1px solid #cbd5e1',
                      paddingBottom: '8px'
                    }}>
                      🎁 Settlement Outcomes
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#475569' }}>
                      
                      {netSettlement < 0 ? (
                        <div style={{ 
                          background: '#f0fdf4', 
                          border: '1px solid #bbf7d0', 
                          color: '#166534', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '1.1rem'
                        }}>
                          💸 Refund Customer: ₹{refundAmount.toFixed(2)}
                        </div>
                      ) : netSettlement > 0 ? (
                        <div style={{ 
                          background: '#fff7ed', 
                          border: '1px solid #fed7aa', 
                          color: '#c2410c', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '1.1rem'
                        }}>
                          💵 Collect More Money: Collect ₹{netSettlement.toFixed(2)}
                        </div>
                      ) : (
                        <div style={{ 
                          background: '#eff6ff', 
                          border: '1px solid #bfdbfe', 
                          color: '#1e40af', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '1.1rem'
                        }}>
                          ✅ Fully Settled (No payment needed / No refund)
                        </div>
                      )}

                      <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', color: '#334155', fontWeight: '500', fontSize: '0.85rem' }}>
                        <span>Refund Method</span>
                        <span>{selectedBooking.refundDetails?.method || 'N/A'}</span>
                      </div>

                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                        Reason: {selectedBooking.settlement?.depositRefundReason || selectedBooking.refundDetails?.notes || 'N/A'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Card 11: Actions Panel */}
              <div style={{ 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '12px', 
                padding: '20px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <h4 style={{ 
                  color: '#475569', 
                  fontSize: '0.9rem', 
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '16px',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '8px'
                }}>
                  Actions
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  
                  {['Ongoing', 'Extended', 'Reserved', 'Overdue'].includes(selectedBooking.status) && (
                    <>
                      <button 
                        type="button"
                        className="btn" 
                        onClick={() => openDropPage(selectedBooking)} 
                        style={{ 
                          width: '100%', 
                          fontSize: '0.85rem', 
                          padding: '10px',
                          background: '#10b981', 
                          border: 'none', 
                          color: '#ffffff', 
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px' 
                        }}
                      >
                        🚗 Vehicle Return / Drop-off
                      </button>
                      <button 
                        type="button"
                        className="btn" 
                        onClick={() => openReplace(selectedBooking)} 
                        style={{ 
                          width: '100%', 
                          fontSize: '0.85rem', 
                          padding: '10px',
                          background: '#a855f7', 
                          border: 'none', 
                          color: '#ffffff', 
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px' 
                        }}
                      >
                        🚚 Replace Vehicle
                      </button>
                      <button 
                        type="button"
                        className="btn" 
                        onClick={() => openExtend(selectedBooking)} 
                        style={{ 
                          width: '100%', 
                          fontSize: '0.85rem', 
                          padding: '10px',
                          background: '#3b82f6', 
                          border: 'none', 
                          color: '#ffffff', 
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '8px' 
                        }}
                      >
                        🕒 Extend Booking
                      </button>
                    </>
                  )}

                  {selectedBooking.status !== 'Completed' && (
                    <button 
                      type="button"
                      className="btn" 
                      onClick={() => openCollectPayment(selectedBooking)} 
                      style={{ 
                        width: '100%', 
                        fontSize: '0.85rem', 
                        padding: '10px',
                        background: '#0d9488', 
                        border: 'none', 
                        color: '#ffffff', 
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px' 
                      }}
                    >
                      ₹ Collect Money
                    </button>
                  )}

                  <button 
                    type="button"
                    className="btn" 
                    onClick={() => triggerPrintDetails(selectedBooking)} 
                    style={{ 
                      width: '100%', 
                      fontSize: '0.85rem', 
                      padding: '10px',
                      background: '#64748b', 
                      border: 'none', 
                      color: '#ffffff', 
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px' 
                    }}
                  >
                    🖨️ Print Details
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ====================================================================
         3. RETURN / DROP-OFF DASHBOARD (16 SECTIONS DUAL-COLUMN FORMAT)
         ==================================================================== */}
      {viewState === 'drop-off' && selectedBooking && (
        <div className="glass-panel animate-slide-up" style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* Header Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-icon"
                onClick={() => { setViewState('list'); setSelectedBooking(null); }}
                style={{ width: '36px', height: '36px', borderRadius: '50%' }}
              >
                ←
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text-primary)' }}>
                  Vehicle Return / Drop-Off
                </h2>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Booking ID: <strong style={{ color: 'var(--primary)' }}>{selectedBooking.bookingId}</strong>
                </span>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Active Vehicle</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                {activeVehicle?.name} ({activeVehicle?.regNumber})
              </strong>
            </div>
          </div>

          <form onSubmit={handleDropCompleteSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Section 1 – Booking Snapshot (Read Only) */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📄</span> Booking Information
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Booking ID</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.bookingId}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Customer Name</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.customerName || 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Active Vehicle</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{activeVehicle?.name} ({activeVehicle?.regNumber})</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Vehicle Category</span>
                      <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{activeVehicle?.category || 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Booking Status</span>
                      <span className={`badge badge-${(selectedBooking.status || '').toLowerCase()}`}>{selectedBooking.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Pickup Time</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {new Date(
                          selectedBooking.pickupDetails?.actualTime || 
                          selectedBooking.rentalPeriod?.actualPickupDate || 
                          selectedBooking.pickupDate
                        ).toLocaleString()}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Expected Return Time</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {new Date(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Section 2 – Current Booking Financial Snapshot (Read Only) */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>💳</span> Booking Financial Details
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Current Plan</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.selectedPlan?.planType || 'N/A'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Fuel Policy</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {selectedBooking.handover?.fuelIncluded ? 'Fuel Included (Chargeable KM)' : "Customer's Fuel"}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>KM Limit</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        {calc.isScootyFuel ? 'N/A - Every KM Chargeable' : `${calc.freeKmLimit} km`}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {calc.isScootyFuel ? 'Fuel Rate' : 'Extra KM Rate'}
                      </span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        ₹{selectedBooking.selectedPlan?.extraKmCharge || (calc.isScootyFuel ? 2 : 5)} / km
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Extra Hour Rate</span>
                      <strong style={{ color: 'var(--text-primary)' }}>
                        ₹{selectedBooking.selectedPlan?.extraHourCharge || 30} / hr
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Base Rental</span>
                      <strong style={{ color: 'var(--text-primary)' }}>₹{calc.originalBaseFare || 0}</strong>
                    </div>
                    {calc.extTotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Extensions</span>
                        <strong style={{ color: 'var(--text-primary)' }}>₹{calc.extTotal || 0}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Current Rental Cost</span>
                      <strong style={{ color: 'var(--text-primary)' }}>₹{calc.currentRentalCost || 0}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Deposit Held (Collected)</span>
                      <strong style={{ color: 'var(--status-available)' }}>₹{calc.depositHeld || 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Booking Journey & Modification Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '1px solid var(--border-light)', paddingTop: '20px', marginTop: '10px', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '0.85rem', margin: '0', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🛣️</span> Booking Journey & Modification Summary
                  </h4>

                  {/* Card 1: Booking Modifications */}
                  {hasEdits && (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                      <h3 style={{ fontSize: '0.9rem', margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚙️</span> Booking Modifications
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {bookingImpactingEdits.map((edit, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', borderBottom: idx < bookingImpactingEdits.length - 1 ? '1px solid var(--border-light)' : 'none', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{edit.title}</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{edit.detail}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Card 2: Duration & Extension Summary */}
                  {hasExtensions && (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                      <h3 style={{ fontSize: '0.9rem', margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⏱️</span> Duration & Extension Summary
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Original Duration</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{originalDuration} Hours</strong>
                        </div>
                        
                        {extendRevisions.map((rev, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: 'var(--status-ongoing)' }}>➕</span> Extension Added
                            </span>
                            <strong style={{ color: 'var(--status-ongoing)' }}>+{rev.durationDetails?.difference || 0} Hours</strong>
                          </div>
                        ))}

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Final Active Duration</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.durationHours} Hours</strong>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Original Return Time</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{originalReturnTime?.toLocaleString()}</strong>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Current Return Time</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{currentReturnTime?.toLocaleString()}</strong>
                        </div>

                        {/* Subsection: Current Active Booking Rules */}
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-light)' }}>
                          <h4 style={{ fontSize: '0.8rem', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.03em' }}>
                            Current Active Booking Rules
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Current Active Duration</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{selectedBooking.durationHours || 0} Hours</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Current Active KM Limit</span>
                              <strong style={{ color: 'var(--text-primary)' }}>
                                {calc.isScootyFuel ? 'N/A - Every KM Chargeable' : `${calc.freeKmLimit} km`}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Current Active Rental Cost</span>
                              <strong style={{ color: 'var(--text-primary)' }}>₹{calc.currentRentalCost || 0}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Current Active Security Deposit</span>
                              <strong style={{ color: 'var(--status-available)' }}>₹{calc.depositHeld || 0}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card 3: Vehicle Replacement Summary */}
                  {hasSwaps && (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                      <h3 style={{ fontSize: '0.9rem', margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🔄</span> Vehicle Replacement History
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                        {replaceRevisions.map((rev, idx) => {
                          const details = rev.vehicleDetails || {};
                          const depDiff = rev.depositDetailsObj?.difference || rev.depositDetails?.difference || 0;
                          return (
                            <div key={idx} style={{ borderBottom: idx < replaceRevisions.length - 1 ? '1px solid var(--border-light)' : 'none', paddingBottom: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From Old Vehicle</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>{details.oldVehicleName || 'Unknown'}</strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({details.oldVehicleReg || 'N/A'})</span>
                                </div>
                                <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>➔</span>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>To New Vehicle</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>{details.newVehicleName || 'Unknown'}</strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({details.newVehicleReg || 'N/A'})</span>
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Replacement Reason:</span>
                                  <span style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>{rev.reason || 'Not Specified'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Additional Deposit:</span>
                                  <strong style={{ color: depDiff >= 0 ? 'var(--status-available)' : 'var(--status-cancelled)' }}>
                                    {depDiff >= 0 ? `+₹${depDiff}` : `-₹${Math.abs(depDiff)}`}
                                  </strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Rental Difference:</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>₹{details.additionalCollection || 0}</strong>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Card 4: Payment & Deposit Timeline */}
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 16px 0' }}>
                      <h3 style={{ fontSize: '0.9rem', margin: 0, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>💰</span> Payment & Deposit Timeline
                      </h3>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setTimelineExpanded(!timelineExpanded)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto', borderRadius: '6px' }}
                      >
                        {timelineExpanded ? 'Hide' : 'Expand'}
                      </button>
                    </div>
                    
                    {timelineExpanded && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Rental Payments Timeline column */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                            Rental Payments
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                            {paymentTimelineItems.map((item, idx) => (
                              <React.Fragment key={idx}>
                                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{item.label}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>₹{item.amount}</strong>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>{item.mode}</span>
                                  </div>
                                </div>
                                {idx < paymentTimelineItems.length - 1 && (
                                  <div style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: '1rem', margin: '2px 0' }}>↓</div>
                                )}
                              </React.Fragment>
                            ))}
                            <div style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: '1rem', margin: '2px 0' }}>↓</div>
                            <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px dashed var(--primary)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Total Rental Paid</span>
                              <strong style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>₹{runningTotalPaid}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Security Deposit Timeline column */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                            Deposit Timeline
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {depositTimelineItems.map((item, idx) => (
                              <React.Fragment key={idx}>
                                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{item.label}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                                    <strong style={{ color: item.amount >= 0 ? 'var(--text-primary)' : 'var(--status-cancelled)', fontSize: '0.85rem' }}>
                                      {item.amount >= 0 ? `₹${item.amount}` : `-₹${Math.abs(item.amount)}`}
                                    </strong>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: '600' }}>{item.mode}</span>
                                  </div>
                                </div>
                                {idx < depositTimelineItems.length - 1 && (
                                  <div style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: '1rem', margin: '2px 0' }}>↓</div>
                                )}
                              </React.Fragment>
                            ))}
                            <div style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: '1rem', margin: '2px 0' }}>↓</div>
                            <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px dashed var(--secondary)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Total Deposit Held</span>
                              <strong style={{ color: 'var(--secondary)', fontSize: '0.9rem' }}>₹{totalDepositHeld}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3 – Return Details */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🔄</span> Vehicle Return Details
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Drop-Off Date & Time *</label>
                      <input 
                        type="datetime-local" 
                        className="form-control"
                        value={dropReturnDate} 
                        onChange={e => setDropReturnDate(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Return Odometer Reading (km) *</label>
                      <input 
                        type="number" 
                        className="form-control"
                        value={dropEndMeter} 
                        onChange={e => setDropEndMeter(e.target.value)} 
                        placeholder={`Start Meter: ${calc.startMeter} km`}
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4 – Accessories & Damage (Checklist & Fines) */}
                {(() => {
                  const isEV = selectedBooking.vehicleDetails?.category?.toLowerCase() === 'ev';
                  return (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                      <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🛠️</span> Vehicle Inspection & Damage Report
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {calc.helmetExpected > 0 && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Helmets Returned (Expected: {calc.helmetExpected}) *</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={dropHelmetReturned}
                              min={0}
                              max={calc.helmetExpected}
                              onChange={e => setDropHelmetReturned(Math.min(calc.helmetExpected, Math.max(0, Number(e.target.value))))}
                              required
                            />
                            {calc.helmetMissing > 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--status-maintenance)', marginTop: '4px', display: 'block' }}>
                                ⚠️ {calc.helmetMissing} missing helmet(s). Penalty: ₹{calc.calculatedHelmetCharge}
                              </span>
                            )}
                          </div>
                        )}



                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Vehicle Physical Condition *</label>
                          <select 
                            className="form-control"
                            value={dropVehicleCondition}
                            onChange={e => setDropVehicleCondition(e.target.value)}
                            required
                          >
                            <option value="Excellent">Excellent</option>
                            <option value="Good">Good</option>
                            <option value="Minor Damage">Minor Damage</option>
                            <option value="Major Damage">Major Damage</option>
                            <option value="Accident">Accident</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                            Condition Markers
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={dropScratchFound} onChange={e => setDropScratchFound(e.target.checked)} />
                              Scratch Found
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={dropDentFoundState} onChange={e => setDropDentFoundState(e.target.checked)} />
                              Dent Found
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={dropTyreDamage} onChange={e => setDropTyreDamage(e.target.checked)} />
                              Tyre Damage
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={dropGlassDamage} onChange={e => setDropGlassDamage(e.target.checked)} />
                              Glass Damage
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={dropMirrorDamage} onChange={e => setDropMirrorDamage(e.target.checked)} />
                              Mirror Damage
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={dropEngineIssue} onChange={e => setDropEngineIssue(e.target.checked)} />
                              Engine Issue
                            </label>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Damage Recovery (₹)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={dropDamageCharges}
                              onChange={e => setDropDamageCharges(Number(e.target.value))}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Cleaning Fee (₹)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={dropCleaningCharges}
                              onChange={e => setDropCleaningCharges(Number(e.target.value))}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Towing Fee (₹)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={dropTowingCharges}
                              onChange={e => setDropTowingCharges(Number(e.target.value))}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Other Return Charges (₹)</label>
                            <input 
                              type="number" 
                              className="form-control"
                              value={dropAdditionalCharges}
                              onChange={e => setDropAdditionalCharges(Number(e.target.value))}
                            />
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Condition Notes</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            placeholder="e.g. Scratches on left side panel" 
                            value={dropConditionNotes}
                            onChange={e => setDropConditionNotes(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Section 5 – Adjustments (Editable) */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚖️</span> Adjustments & Waivers
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Free Minutes Waiver (reduce from extra time)</label>
                      <input 
                        type="number" 
                        className="form-control"
                        value={dropFreeMinutes}
                        onChange={e => setDropFreeMinutes(Number(e.target.value))}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Minutes to waive from extra hours calculations</span>
                    </div>

                    {!calc.isScootyFuel && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Additional Free KM Waiver</label>
                        <input 
                          type="number" 
                          className="form-control"
                          value={dropAddFreeKm}
                          onChange={e => setDropAddFreeKm(Number(e.target.value))}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Extra free kilometers allowed for return</span>
                      </div>
                    )}

                    {calc.isScootyFuel && (
                      <div style={{ background: 'rgba(239, 149, 0, 0.1)', border: '1px solid rgba(239, 149, 0, 0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--primary)' }}>
                        ℹ️ Scooty with Fuel has no KM Limit. All distance is chargeable; additional free KM waiver is disabled.
                      </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Discount / Waiver Amount (₹)</label>
                      <input 
                        type="number" 
                        className="form-control"
                        value={dropDiscountWaiver}
                        onChange={e => setDropDiscountWaiver(Number(e.target.value))}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Deduct directly from the grand total bill</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* Section 6 – Usage Summary (Auto Calculated) */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📊</span> Trip Usage Summary
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Original Duration</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{originalDuration} hrs</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Extension Added</span>
                      <strong style={{ color: 'var(--status-available)' }}>+{totalExtendedHours || 0} hrs</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Final Active Duration</span>
                      <strong style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{calc.bookedDurationHours} hrs</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Actual Duration</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{calc.actualDurationStr}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Extra Time</span>
                      <strong style={{ color: calc.chargeableHours > 0 ? 'var(--status-maintenance)' : 'var(--text-primary)' }}>
                        {calc.extraHoursStr} {calc.chargeableHours > 0 && `(Chargeable: ${calc.chargeableHoursStr})`}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Distance Used</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{calc.totalKmUsedRounded} KM</strong>
                    </div>

                    {calc.isScootyFuel ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Billed Distance</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{calc.totalKmUsedRounded} KM (Every KM Billed)</strong>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Original KM Limit</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {calc.bookedDurationHours > 0 ? Math.round(calc.allowedKmLimitRounded * (originalDuration / calc.bookedDurationHours)) : calc.allowedKmLimitRounded} KM
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Additional KM from Extension</span>
                          <strong style={{ color: 'var(--status-available)' }}>
                            +{calc.bookedDurationHours > 0 ? (calc.allowedKmLimitRounded - Math.round(calc.allowedKmLimitRounded * (originalDuration / calc.bookedDurationHours))) : 0} KM
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Final Active KM Limit</span>
                          <strong style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{calc.allowedKmLimitRounded} KM</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Waiver KM Added</span>
                          <strong style={{ color: 'var(--status-available)' }}>+{dropAddFreeKm} KM</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Extra Chargeable KM</span>
                          <strong style={{ color: calc.extraKm > 0 ? 'var(--status-maintenance)' : 'var(--text-primary)' }}>
                            {calc.extraKmRounded} KM
                          </strong>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section 7 – Charges Breakdown (Auto Calculated) */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>🧾</span> Rental Charges Breakdown
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    {calc.isScootyFuel ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Base Hourly Rent ({calc.actualDurationStr})</span>
                          <strong style={{ color: 'var(--text-primary)' }}>₹{calc.baseHourlyCost?.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Distance Fuel Charge ({calc.totalKmUsedRounded} KM)</span>
                          <strong style={{ color: 'var(--text-primary)' }}>₹{calc.distanceCharge?.toFixed(2)}</strong>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Base Rental</span>
                          <strong style={{ color: 'var(--text-primary)' }}>₹{calc.originalBaseFare?.toFixed(2)}</strong>
                        </div>
                        {calc.extTotal > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Extensions</span>
                            <strong style={{ color: 'var(--text-primary)' }}>₹{calc.extTotal?.toFixed(2)}</strong>
                          </div>
                        )}
                        {calc.addonsTotal > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Add-ons (Helmets)</span>
                            <strong style={{ color: 'var(--text-primary)' }}>₹{calc.addonsTotal?.toFixed(2)}</strong>
                          </div>
                        )}
                        {calc.discount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', color: 'var(--status-available)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
                            <strong style={{ color: 'var(--status-available)' }}>-₹{calc.discount?.toFixed(2)}</strong>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Extra Hour Charge ({calc.chargeableHoursStr})</span>
                          <strong style={{ color: 'var(--text-primary)' }}>₹{calc.extraHourCharge?.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Extra KM Charge ({calc.extraKmRounded} KM)</span>
                          <strong style={{ color: 'var(--text-primary)' }}>₹{calc.extraKmCharge?.toFixed(2)}</strong>
                        </div>
                      </>
                    )}

                    {calc.accessoryChargeTotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', color: 'var(--status-maintenance)' }}>
                        <span>Accessories Penalty</span>
                        <strong>₹{calc.accessoryChargeTotal?.toFixed(2)}</strong>
                      </div>
                    )}

                    {calc.damageChargeSum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', color: 'var(--status-maintenance)' }}>
                        <span>Damage Recovery</span>
                        <strong>₹{calc.damageChargeSum?.toFixed(2)}</strong>
                      </div>
                    )}

                    {calc.cleaningChargeSum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Cleaning Fee</span>
                        <strong style={{ color: 'var(--text-primary)' }}>₹{calc.cleaningChargeSum?.toFixed(2)}</strong>
                      </div>
                    )}

                    {calc.towingChargeSum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Towing Fee</span>
                        <strong style={{ color: 'var(--text-primary)' }}>₹{calc.towingChargeSum?.toFixed(2)}</strong>
                      </div>
                    )}

                    {calc.otherChargesSum > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Other Fees</span>
                        <strong style={{ color: 'var(--text-primary)' }}>₹{calc.otherChargesSum?.toFixed(2)}</strong>
                      </div>
                    )}

                    {calc.waiverDiscount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', color: 'var(--status-available)' }}>
                        <span>Discount / Waiver</span>
                        <strong>-₹{calc.waiverDiscount?.toFixed(2)}</strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-light)', paddingTop: '10px', fontSize: '1rem', marginTop: '4px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Actual Rental Bill</span>
                      <strong style={{ color: 'var(--primary)', fontWeight: 'bold' }}>₹{calc.actualRentalBill?.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {/* Section 8 – Already Collected Summary (Read Only) */}
                {(() => {
                  const snapshot = getBookingFinancialSnapshot(selectedBooking);
                  return (
                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                      <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>💰</span> Payment & Deposit Summary
                      </h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.85rem' }}>
                        <div>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', marginBottom: '8px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Rental Payments
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block' }}>Cash</span>
                              <strong style={{ color: 'var(--text-primary)' }}>₹{(snapshot.paymentBreakdown?.rentalCash || 0).toFixed(2)}</strong>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block' }}>Online</span>
                              <strong style={{ color: 'var(--text-primary)' }}>₹{((snapshot.paymentBreakdown?.rentalOnline || 0) + (snapshot.paymentBreakdown?.rentalCard || 0)).toFixed(2)}</strong>
                            </div>
                            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-light)' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block' }}>Total Paid</span>
                              <strong style={{ color: 'var(--primary)' }}>₹{(calc.rentalPaid || 0).toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'block', marginBottom: '8px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Security Deposit Held
                          </span>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block' }}>Cash</span>
                              <strong style={{ color: 'var(--text-primary)' }}>₹{(snapshot.paymentBreakdown?.depositCash || 0).toFixed(2)}</strong>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block' }}>Online</span>
                              <strong style={{ color: 'var(--text-primary)' }}>₹{(snapshot.paymentBreakdown?.depositOnline || 0).toFixed(2)}</strong>
                            </div>
                            <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-light)' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'block' }}>Total Deposit</span>
                              <strong style={{ color: 'var(--status-available)' }}>₹{(calc.depositHeld || 0).toFixed(2)}</strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}



                {/* Section 11 – Final Settlement Summary */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📋</span> Final Settlement Ledger
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Actual Rental Bill</span>
                      <strong style={{ color: 'var(--text-primary)' }}>₹{calc.actualRentalBill?.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', color: 'var(--status-maintenance)' }}>
                      <span>Rental Cost Already Paid</span>
                      <strong>-₹{calc.rentalPaid?.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', fontWeight: 'bold' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Net Rental Due</span>
                      <strong style={{ color: calc.rentalDue >= 0 ? 'var(--text-primary)' : 'var(--status-available)' }}>
                        {calc.rentalDue >= 0 ? `₹${calc.rentalDue.toFixed(2)}` : `-₹${Math.abs(calc.rentalDue).toFixed(2)}`}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Security Deposit Held</span>
                      <strong style={{ color: 'var(--status-available)' }}>₹{calc.depositHeld?.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px', color: 'var(--status-maintenance)' }}>
                      <span>Security Deposit Adjusted</span>
                      <strong>-₹{calc.depositAdjustment?.toFixed(2)}</strong>
                    </div>
                    
                    <div style={{ borderTop: '2px solid var(--border-light)', paddingTop: '10px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {calc.remainingCollection > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold', color: '#f87171' }}>
                          <span>Net Collection:</span>
                          <span>₹{calc.remainingCollection?.toFixed(2)}</span>
                        </div>
                      )}
                      {calc.depositRefund > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold', color: '#34d399' }}>
                          <span>Net Refund:</span>
                          <span>₹{calc.depositRefund?.toFixed(2)}</span>
                        </div>
                      )}
                      {calc.remainingCollection === 0 && calc.depositRefund === 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', fontWeight: 'bold', color: '#60a5fa' }}>
                          <span>Net Settleable Dues:</span>
                          <span>₹0.00 (Fully Settled)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Unified Final Settlement Center */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 16px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚖️</span> Final Settlement
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '0.85rem' }}>
                    
                    {/* Part A – Settlement Outcome */}
                    <div>
                      {calc.settlementStatus === 'Collect' ? (
                        <div style={{ 
                          background: 'rgba(239, 68, 68, 0.15)', 
                          border: '1px solid rgba(239, 68, 68, 0.3)', 
                          color: '#f87171', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          fontSize: '1.05rem' 
                        }}>
                          💵 Collect More Money: ₹{calc.remainingCollection.toFixed(2)}
                        </div>
                      ) : calc.settlementStatus === 'Refund' ? (
                        <div style={{ 
                          background: 'rgba(16, 185, 129, 0.15)', 
                          border: '1px solid rgba(16, 185, 129, 0.3)', 
                          color: '#34d399', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          fontSize: '1.05rem' 
                        }}>
                          💸 Refund Customer: ₹{calc.depositRefund.toFixed(2)}
                        </div>
                      ) : (
                        <div style={{ 
                          background: 'rgba(59, 130, 246, 0.15)', 
                          border: '1px solid rgba(59, 130, 246, 0.3)', 
                          color: '#60a5fa', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          textAlign: 'center', 
                          fontWeight: 'bold', 
                          fontSize: '1.05rem' 
                        }}>
                          ✅ Fully Settled (No payment needed / No refund)
                        </div>
                      )}
                    </div>

                    {/* Part B – Settlement Action */}
                    {calc.settlementStatus === 'Collect' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Amount To Collect</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={`₹${calc.remainingCollection.toFixed(2)}`} 
                            readOnly 
                            disabled 
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Payment Mode *</label>
                          <select 
                            className="form-control"
                            value={['Mixed Refund', 'Cash Refund', 'UPI Refund'].includes(dropPaymentMethod) ? 'Cash' : dropPaymentMethod}
                            onChange={e => setDropPaymentMethod(e.target.value)}
                            required
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Mixed">Mixed</option>
                          </select>
                        </div>

                        {dropPaymentMethod === 'Mixed' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Cash Received (₹) *</label>
                              <input 
                                type="number" 
                                className="form-control"
                                value={dropCashReceived} 
                                onChange={e => setDropCashReceived(Number(e.target.value))} 
                                required 
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Online Received (₹) *</label>
                              <input 
                                type="number" 
                                className="form-control"
                                value={dropOnlineReceived} 
                                onChange={e => setDropOnlineReceived(Number(e.target.value))} 
                                required 
                              />
                            </div>
                            <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', textAlign: 'center', color: Math.abs(Number(dropCashReceived) + Number(dropOnlineReceived) - calc.remainingCollection) > 0.01 ? 'var(--status-maintenance)' : 'var(--status-available)' }}>
                              Total Split: ₹{(Number(dropCashReceived) + Number(dropOnlineReceived)).toFixed(2)} / Required: ₹{calc.remainingCollection.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Transaction ID (Optional)</label>
                              <input 
                                type="text" 
                                className="form-control"
                                placeholder="e.g. UPI Ref Number"
                                value={dropCollectTxnId}
                                onChange={e => setDropCollectTxnId(e.target.value)}
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Payment Remarks</label>
                              <input 
                                type="text" 
                                className="form-control"
                                value={dropCollectNotes}
                                onChange={e => setDropCollectNotes(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {calc.settlementStatus === 'Refund' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                        {(() => {
                          const snapshot = getBookingFinancialSnapshot(selectedBooking);
                          return (
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-light)', fontSize: '0.8rem' }}>
                              ℹ️ <strong>Original Deposit Details:</strong> Held Cash: ₹{snapshot.paymentBreakdown?.depositCash?.toFixed(2)}, Held Online: ₹{snapshot.paymentBreakdown?.depositOnline?.toFixed(2)}
                            </div>
                          );
                        })()}
                        
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Amount To Refund</label>
                          <input 
                            type="text" 
                            className="form-control" 
                            value={`₹${calc.depositRefund.toFixed(2)}`} 
                            readOnly 
                            disabled 
                          />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Refund Mode *</label>
                          <select 
                            className="form-control"
                            value={['Mixed Refund', 'Cash Refund', 'UPI Refund'].includes(dropPaymentMethod) ? dropPaymentMethod : 'Cash Refund'}
                            onChange={e => setDropPaymentMethod(e.target.value)}
                            required
                          >
                            <option value="Cash Refund">Cash</option>
                            <option value="UPI Refund">UPI</option>
                            <option value="Mixed Refund">Mixed</option>
                          </select>
                        </div>

                        {dropPaymentMethod === 'Mixed Refund' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Cash Refunded (₹) *</label>
                              <input 
                                type="number" 
                                className="form-control"
                                value={dropCashReceived} 
                                onChange={e => setDropCashReceived(Number(e.target.value))} 
                                required 
                              />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label>Online Refunded (₹) *</label>
                              <input 
                                type="number" 
                                className="form-control"
                                value={dropOnlineReceived} 
                                onChange={e => setDropOnlineReceived(Number(e.target.value))} 
                                required 
                              />
                            </div>
                            <div style={{ gridColumn: 'span 2', fontSize: '0.75rem', textAlign: 'center', color: Math.abs(Number(dropCashReceived) + Number(dropOnlineReceived) - calc.depositRefund) > 0.01 ? 'var(--status-maintenance)' : 'var(--status-available)' }}>
                              Total Refund Split: ₹{(Number(dropCashReceived) + Number(dropOnlineReceived)).toFixed(2)} / Required: ₹{calc.depositRefund.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Refund Remarks / Reason *</label>
                            <input 
                              type="text" 
                              className="form-control"
                              placeholder="Reason for refund..."
                              value={dropRefundReason}
                              onChange={e => setDropRefundReason(e.target.value)}
                              required
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {calc.settlementStatus === 'Settled' && (
                      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', textAlign: 'center', border: '1px dashed var(--border-light)' }}>
                        No payment collection or refund splits required for this return. Dues are fully adjusted.
                      </div>
                    )}

                    {/* Part C – Confirmation Flow */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                      {calc.settlementStatus === 'Collect' && (
                        <button
                          type="button"
                          onClick={() => setDropSettlementConfirmed(true)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: dropSettlementConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: dropSettlementConfirmed ? '1px solid #10b981' : '1px solid var(--border-light)',
                            borderRadius: '8px',
                            color: dropSettlementConfirmed ? '#34d399' : 'var(--text-primary)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          {dropSettlementConfirmed ? '✓ Collection Confirmed' : `Confirm Collection ₹${calc.remainingCollection.toFixed(2)}`}
                        </button>
                      )}

                      {calc.settlementStatus === 'Refund' && (
                        <button
                          type="button"
                          onClick={() => setDropSettlementConfirmed(true)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: dropSettlementConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            border: dropSettlementConfirmed ? '1px solid #10b981' : '1px solid var(--border-light)',
                            borderRadius: '8px',
                            color: dropSettlementConfirmed ? '#34d399' : 'var(--text-primary)',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          {dropSettlementConfirmed ? '✓ Refund Confirmed' : `Confirm Refund ₹${calc.depositRefund.toFixed(2)}`}
                        </button>
                      )}

                      {calc.settlementStatus === 'Settled' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Settlement Remarks *</label>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="e.g. Returned with no additional dues..."
                              value={dropReturnNotes}
                              onChange={e => setDropReturnNotes(e.target.value)}
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setDropSettlementConfirmed(true)}
                            style={{
                              width: '100%',
                              padding: '12px',
                              background: dropSettlementConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              border: dropSettlementConfirmed ? '1px solid #10b981' : '1px solid var(--border-light)',
                              borderRadius: '8px',
                              color: dropSettlementConfirmed ? '#34d399' : 'var(--text-primary)',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              transition: 'all 0.2s'
                            }}
                          >
                            {dropSettlementConfirmed ? '✓ Settlement Confirmed' : 'Confirm Settlement'}
                          </button>
                        </div>
                      )}

                      {dropSettlementConfirmed && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#34d399', fontSize: '0.8rem', fontWeight: '500' }}>
                          <span>🛡️</span> Settlement ready to finalize. Click below to submit.
                        </div>
                      )}
                    </div>

                    {/* Part D – Final Action */}
                    <button 
                      type="submit" 
                      style={{ 
                        width: '100%', 
                        padding: '14px', 
                        fontSize: '0.95rem', 
                        fontWeight: 'bold', 
                        border: 'none', 
                        color: '#ffffff', 
                        background: calc.settlementStatus === 'Refund' ? 'var(--status-available)' : 'var(--primary)',
                        borderRadius: '8px', 
                        cursor: (!dropReturnDate || !dropEndMeter) ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
                        transition: 'all 0.2s',
                        marginTop: '8px',
                        opacity: (dropSettlementConfirmed && dropReturnDate && dropEndMeter) ? 1 : 0.65
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                    >
                      {calc.settlementStatus === 'Refund' ? 'Complete Return & Process Refund' : 'Complete Return & Settle'}
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </form>

        </div>
      )}

      {/* ====================================================================
         MODAL POPUPS OVERLAYS
         ==================================================================== */}

      {/* A. PICKUP MODAL */}
      {activeModal === 'pickup' && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Vehicle Handover Pickup - {selectedBooking.bookingId}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handlePickupSubmit}>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Verify vehicle details before handover. Confirm start metrics.
                </p>
                <div className="form-group">
                  <label>Odometer Reading (Start)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    placeholder="e.g. 15450"
                    value={odometerStart}
                    onChange={(e) => setOdometerStart(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fuel Level (%)</label>
                  <select 
                    className="form-control"
                    value={fuelLevelStart}
                    onChange={(e) => setFuelLevelStart(e.target.value)}
                  >
                    <option value="100">100% (Full)</option>
                    <option value="90">90%</option>
                    <option value="80">80%</option>
                    <option value="70">70%</option>
                    <option value="50">50% (Half)</option>
                    <option value="30">30%</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Pickup Remarks / Damage Notes</label>
                  <textarea 
                    className="form-control" 
                    placeholder="e.g. No scratches, clean interior"
                    value={pickupRemarks}
                    onChange={(e) => setPickupRemarks(e.target.value)}
                    rows="3"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Complete Pickup</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* B. EXTEND BOOKING MODAL */}
      {activeModal === 'extend' && selectedBooking && (() => {
        const currentEnd = new Date(selectedBooking.expectedDropDate || selectedBooking.rentalPeriod?.expectedEndDate);
        const newEnd = new Date(extensionEndDate);
        const diffMs = newEnd.getTime() - currentEnd.getTime();
        const additionalHours = !isNaN(diffMs) && diffMs > 0 ? Math.ceil(diffMs / (1000 * 60 * 60)) : 0;
        const comp = getExtendDepositComparison();

        return (
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>Extend Rental Period - {selectedBooking.bookingId}</h2>
                <button className="btn btn-secondary btn-icon" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <form onSubmit={handleExtendSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label>Current Duration</label>
                      <input type="text" className="form-control" value={`${selectedBooking.durationHours || 24} hours`} disabled />
                    </div>
                    <div className="form-group">
                      <label>Current Expected Return</label>
                      <input type="text" className="form-control" value={isNaN(currentEnd.getTime()) ? 'N/A' : currentEnd.toLocaleString()} disabled />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label>New Return Date & Time</label>
                      <input 
                        type="datetime-local" 
                        className="form-control" 
                        value={extensionEndDate}
                        onChange={(e) => handleExtensionDateManual(e.target.value, selectedBooking)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Additional Hours</label>
                      <input type="text" className="form-control" value={`${additionalHours} Hour(s)`} disabled />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Reason for Extension *</label>
                    <select 
                      className="form-control"
                      value={extensionRemarks}
                      onChange={e => setExtensionRemarks(e.target.value)}
                      required
                    >
                      <option value="Customer requested more time">Customer Request</option>
                      <option value="Breakdown swap extensions">Breakdown / Maintenance</option>
                      <option value="Flight delayed">Flight / Travel Delay</option>
                      <option value="Other extension reason">Other</option>
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group">
                      <label>Additional Rental Cost (₹) *</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={extensionExtraCharges}
                        onChange={(e) => setExtensionExtraCharges(Number(e.target.value))}
                        min="0"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Additional Deposit (₹)</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={extensionAdditionalDeposit}
                        onChange={(e) => setExtensionAdditionalDeposit(Number(e.target.value))}
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select 
                      className="form-control"
                      value={extensionPaymentMode}
                      onChange={e => setExtensionPaymentMode(e.target.value)}
                      required
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / Online</option>
                      <option value="Mixed">Mixed Split</option>
                    </select>
                  </div>

                  {extensionPaymentMode === 'Mixed' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }} className="animate-fade">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Cash Portion (₹)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={extensionMixedCash} 
                          onChange={e => setExtensionMixedCash(Number(e.target.value))} 
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.75rem' }}>Online Portion (₹)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={extensionMixedOnline} 
                          onChange={e => setExtensionMixedOnline(Number(e.target.value))} 
                        />
                      </div>
                    </div>
                  )}

                  {/* Extension Upfront checkbox */}
                  {extensionExtraCharges > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                      <input 
                        type="checkbox" 
                        checked={extensionCollectNow} 
                        onChange={e => setExtensionCollectNow(e.target.checked)} 
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} 
                      />
                      <span style={{ fontSize: '0.85rem' }}>Collect Rental Charges Upfront Now</span>
                    </div>
                  )}

                  {/* Extension Preview Section */}
                  {(() => {
                    const oldDuration = selectedBooking.durationHours || 24;
                    const newDuration = oldDuration + additionalHours;
                    
                    const oldRentalCost = selectedBooking.baseFare || 0;
                    const newRentalCost = oldRentalCost + Number(extensionExtraCharges);
                    
                    const oldKmLimit = selectedBooking.selectedPlan?.kmLimit || 0;
                    const kmPerHour = oldKmLimit / oldDuration;
                    const additionalKmGranted = Math.round(kmPerHour * additionalHours) || 0;
                    const newKmLimit = oldKmLimit + additionalKmGranted;

                    const oldDeposit = selectedBooking.securityDeposit || 0;
                    const newDeposit = oldDeposit + Number(extensionAdditionalDeposit);

                    return (
                      <div style={{ 
                        background: 'rgba(59,130,246,0.05)', 
                        border: '1px solid rgba(59,130,246,0.2)', 
                        padding: '16px', 
                        borderRadius: '10px', 
                        fontSize: '0.85rem',
                        marginTop: '10px'
                      }} className="animate-fade">
                        <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '12px', fontSize: '0.9rem' }}>
                          🕒 Extension Preview Details
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Duration row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
                            <span>
                              <strong>{oldDuration} hrs</strong> ➔ <strong>{newDuration} hrs</strong> 
                              <span style={{ color: '#10b981', marginLeft: '6px' }}>({additionalHours} hrs granted)</span>
                            </span>
                          </div>
                          {/* Rental Cost row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Rental Cost:</span>
                            <span>
                              <strong>₹{oldRentalCost}</strong> ➔ <strong>₹{newRentalCost}</strong>
                              <span style={{ color: '#10b981', marginLeft: '6px' }}>(+₹{extensionExtraCharges})</span>
                            </span>
                          </div>
                          {/* KM Limit row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>KM Limit:</span>
                            <span>
                              <strong>{oldKmLimit} KM</strong> ➔ <strong>{newKmLimit} KM</strong>
                              <span style={{ color: '#10b981', marginLeft: '6px' }}>(+{additionalKmGranted} KM)</span>
                            </span>
                          </div>
                          {/* Deposit row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Security Deposit Held:</span>
                            <span>
                              <strong>₹{oldDeposit}</strong> ➔ <strong>₹{newDeposit}</strong>
                              {Number(extensionAdditionalDeposit) > 0 && (
                                <span style={{ color: '#ea580c', marginLeft: '6px' }}>(+₹{extensionAdditionalDeposit} required)</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Extension</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* C. REPLACE VEHICLE SWAP MODAL */}
      {activeModal === 'replace' && selectedBooking && (() => {
        const comp = getReplacePricingComparison();
        return (
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>Swap / Replace Vehicle - {selectedBooking.bookingId}</h2>
                <button className="btn btn-secondary btn-icon" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <form onSubmit={handleReplaceSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <strong>Current Vehicle:</strong> {activeVehicle?.name} (<code>{activeVehicle?.regNumber}</code>)
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current Vehicle Closing Meter (KM) *</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={oldVehicleClosingMeter} 
                        onChange={e => setOldVehicleClosingMeter(Number(e.target.value))} 
                        min={selectedBooking.handover?.startMeter || 0}
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Reason for Replacement *</label>
                    <select className="form-control" value={replacementReason} onChange={e => setReplacementReason(e.target.value)} required>
                      <option value="Breakdown">Breakdown</option>
                      <option value="Customer Request">Customer Request</option>
                      <option value="Upgrade">Upgrade</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Select Available Replacement Vehicle *</label>
                    <select 
                      className="form-control"
                      value={newVehicleId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewVehicleId(val);
                        const targetV = vehicles.find(v => v.vehicleId === val);
                        setNewVehicleStartingMeter(targetV?.meterReading || 0);
                      }}
                      required
                    >
                      <option value="">-- Choose Replacement Vehicle --</option>
                      {vehicles.filter(v => (v.status === 'Available' || v.status === 'Active') && v.vehicleId !== selectedBooking.vehicleId).map(v => {
                        const rate = v.pricingPlans?.twentyFourHour?.baseRate || v.perDayRate || 500;
                        return (
                          <option key={v.vehicleId} value={v.vehicleId}>
                            {v.name} ({v.regNumber}) - ₹{rate}/day - Zone: {v.locationDetails?.currentZone || 'Vijay Nagar'}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {newVehicleId && comp && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="animate-fade">
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                        <strong style={{ display: 'block', marginBottom: '6px' }}>📋 Replacement Vehicle Specs:</strong>
                        <div>Category: <strong>{comp.newVehicle.category}</strong></div>
                        <div>Reg Number: <code>{comp.newVehicle.regNumber}</code></div>
                        <div>Rate/Day: ₹{comp.newVehicle.perDayRate || comp.newVehicle.pricingPlans?.twentyFourHour?.baseRate}</div>
                        <div>Deposit: ₹{comp.newVehicle.depositSettings?.amount || comp.newVehicle.securityDeposit}</div>
                        <div>Extra KM Rate: ₹{comp.newVehicle.pricingPlans?.twentyFourHour?.extraKmCharge}/km</div>
                        <div>Extra Hour Rate: ₹{comp.newVehicle.pricingPlans?.twentyFourHour?.extraHourCharge || comp.newVehicle.pricingPlans?.hourly?.rate}/hr</div>
                      </div>
                      
                      <div className="form-group">
                        <label>Replacement Vehicle Starting Meter (KM) *</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={newVehicleStartingMeter} 
                          onChange={e => setNewVehicleStartingMeter(Number(e.target.value))} 
                          min="0"
                          required 
                        />
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                    <input 
                      type="checkbox" 
                      checked={applyNewPricing} 
                      onChange={e => setApplyNewPricing(e.target.checked)} 
                      style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} 
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Apply New Vehicle Pricing Plans</span>
                  </div>

                  {newVehicleId && comp && applyNewPricing && (
                    <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', padding: '16px', borderRadius: '10px', fontSize: '0.85rem' }} className="animate-fade">
                      <strong style={{ color: '#10b981', display: 'block', marginBottom: '12px', fontSize: '0.9rem' }}>💰 Pricing Swap Comparison</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        
                        {/* Rental Cost Section */}
                        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 'bold', color: '#10b981', display: 'block', marginBottom: '4px' }}>Rental Costs</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Old Rent:</span>
                            <span><strong>₹{selectedBooking.baseFare}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>New Rent:</span>
                            <span><strong>₹{comp.newBaseFare}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: comp.rentDiff > 0 ? '#ea580c' : '#10b981' }}>
                            <span>Rent Difference:</span>
                            <span>{comp.rentDiff >= 0 ? '+' : ''}₹{comp.rentDiff}</span>
                          </div>
                        </div>

                        {/* Deposit Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <span style={{ fontWeight: 'bold', color: '#10b981', display: 'block' }}>Security Deposits</span>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Old Deposit Held:</span>
                            <span><strong>₹{selectedBooking.securityDeposit}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>New Deposit Requirement:</span>
                            <span><strong>₹{comp.newDeposit}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Difference:</span>
                            <span><strong>₹{Math.abs(comp.depositDiff)}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: comp.depositDiff > 0 ? '#ea580c' : '#10b981' }}>
                            <span>Direction:</span>
                            <span>{comp.depositDiff > 0 ? 'Additional Deposit Required' : 'Refund Difference'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', fontWeight: 'bold' }}>
                            <span style={{ color: 'var(--text-primary)' }}>Final Deposit Held:</span>
                            <span style={{ color: 'var(--status-available)' }}>₹{comp.newDeposit}</span>
                          </div>
                        </div>

                        {/* Grand Total Settle Outcomes */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '6px', fontWeight: 'bold' }}>
                          {comp.totalDiff > 0 ? (
                            <span style={{ color: '#ea580c' }}>⚠️ Collect Extra Settlement Amount: ₹{comp.totalDiff}</span>
                          ) : comp.totalDiff < 0 ? (
                            <span style={{ color: '#10b981' }}>💸 Settle Refund Difference Amount: ₹{Math.abs(comp.totalDiff)}</span>
                          ) : (
                            <span>Fully Symmetrical Settle (No price difference)</span>
                          )}
                        </div>

                      </div>

                      {comp.totalDiff !== 0 && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontWeight: 'bold' }}>Payment Mode for Settle</label>
                          <select 
                            className="form-control"
                            value={replacePaymentMode}
                            onChange={e => setReplacePaymentMode(e.target.value)}
                            style={{ padding: '6px' }}
                          >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI / Online</option>
                            <option value="Mixed">Mixed Split</option>
                          </select>

                          {replacePaymentMode === 'Mixed' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.7rem' }}>Cash portion (₹)</label>
                                <input type="number" className="form-control" value={replaceMixedCash} onChange={e => setReplaceMixedCash(Number(e.target.value))} />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.7rem' }}>Online portion (₹)</label>
                                <input type="number" className="form-control" value={replaceMixedOnline} onChange={e => setReplaceMixedOnline(Number(e.target.value))} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Confirm Replacement</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* D. EDIT BOOKING MODAL */}
      {activeModal === 'edit' && selectedBooking && (() => {
        const comp = getEditDepositComparison();
        return (
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>Edit Booking Info - {selectedBooking.bookingId}</h2>
                <button className="btn btn-secondary btn-icon" onClick={() => setActiveModal(null)}>✕</button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Section 1: Customer */}
                  <div>
                    <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>Customer Profiles</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Full Name</label>
                        <input type="text" className="form-control" value={editFullName} onChange={e => setEditFullName(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label>Father's Name</label>
                        <input type="text" className="form-control" value={editFatherName} onChange={e => setEditFatherName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Phone Number</label>
                        <input type="tel" className="form-control" value={editPhone} onChange={e => setEditPhone(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label>Alternate Number</label>
                        <input type="tel" className="form-control" value={editAltPhone} onChange={e => setEditAltPhone(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Email Address</label>
                        <input type="email" className="form-control" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Street Address</label>
                        <input type="text" className="form-control" value={editStreet} onChange={e => setEditStreet(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>City</label>
                        <input type="text" className="form-control" value={editCity} onChange={e => setEditCity(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Pincode</label>
                        <input type="text" className="form-control" value={editPincode} onChange={e => setEditPincode(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Driving License number</label>
                        <input type="text" className="form-control" value={editDL} onChange={e => setEditDL(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Aadhaar ID number</label>
                        <input type="text" className="form-control" value={editAadhaar} onChange={e => setEditAadhaar(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Rental Specifications */}
                  <div>
                    <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>Rental Plan Dates</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Start pickup Date {selectedBooking.status !== 'Reserved' && <span style={{fontSize:'0.7rem', color:'#f43f5e'}}>(Locked - Ongoing)</span>}</label>
                        <input type="datetime-local" className="form-control" value={editPickupDate} onChange={e => setEditPickupDate(e.target.value)} disabled={selectedBooking.status !== 'Reserved'} required />
                      </div>
                      <div className="form-group">
                        <label>Expected return date {selectedBooking.status !== 'Reserved' && <span style={{fontSize:'0.7rem', color:'#f43f5e'}}>(Locked - Use Extend)</span>}</label>
                        <input type="datetime-local" className="form-control" value={editExpectedDropDate} onChange={e => setEditExpectedDropDate(e.target.value)} disabled={selectedBooking.status !== 'Reserved'} required />
                      </div>
                      <div className="form-group">
                        <label>Rental pricing plan {selectedBooking.status !== 'Reserved' && <span style={{fontSize:'0.7rem', color:'#f43f5e'}}>(Locked)</span>}</label>
                        <select className="form-control" value={editPlanType} onChange={e => setEditPlanType(e.target.value)} disabled={selectedBooking.status !== 'Reserved'}>
                          <option value="Hourly">Hourly plan</option>
                          <option value="12-Hour">12-Hour plan</option>
                          <option value="24-Hour">24-Hour plan</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Helmet Counts {selectedBooking.status !== 'Reserved' && <span style={{fontSize:'0.7rem', color:'#f43f5e'}}>(Locked)</span>}</label>
                        <input type="number" className="form-control" value={editHelmetsCount} onChange={e => setEditHelmetsCount(Number(e.target.value))} disabled={selectedBooking.status !== 'Reserved'} />
                      </div>
                      <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Additional Accessories Notes</label>
                        <input type="text" className="form-control" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="e.g. Extra key, phone mount" />
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Financial Details */}
                  <div>
                    <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>Billing & Payments</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Rental Cost (Base Fare) (₹) * {selectedBooking.status !== 'Reserved' && <span style={{fontSize:'0.7rem', color:'#f43f5e'}}>(Locked)</span>}</label>
                        <input type="number" className="form-control" value={editBaseFare} onChange={e => setEditBaseFare(Number(e.target.value))} disabled={selectedBooking.status !== 'Reserved'} required />
                      </div>
                      <div className="form-group">
                        <label>Discount Amount (₹) {selectedBooking.status !== 'Reserved' && <span style={{fontSize:'0.7rem', color:'#f43f5e'}}>(Locked)</span>}</label>
                        <input type="number" className="form-control" value={editDiscountAmount} onChange={e => setEditDiscountAmount(Number(e.target.value))} disabled={selectedBooking.status !== 'Reserved'} />
                      </div>
                      <div className="form-group">
                        <label>Paid Amount (Advance Paid) (₹) *</label>
                        <input type="number" className="form-control" value={editAdvancePaid} onChange={e => setEditAdvancePaid(Number(e.target.value))} required />
                      </div>
                      <div className="form-group">
                        <label>Rental Payment Method</label>
                        <select className="form-control" value={editPaymentMethod} onChange={e => setEditPaymentMethod(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI / Online</option>
                          <option value="Mixed">Mixed Split</option>
                        </select>
                      </div>
                    </div>

                    {editPaymentMethod === 'Mixed' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }} className="animate-fade">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Rental Cash Portion (₹)</label>
                          <input type="number" className="form-control" value={editMixedCash} onChange={e => setEditMixedCash(Number(e.target.value))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Rental Online Portion (₹)</label>
                          <input type="number" className="form-control" value={editMixedOnline} onChange={e => setEditMixedOnline(Number(e.target.value))} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section 4: Deposit Details */}
                  <div>
                    <h4 style={{ color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '8px' }}>Security Deposit</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Required Deposit (₹) *</label>
                        <input type="number" className="form-control" value={editSecurityDeposit} onChange={e => setEditSecurityDeposit(Number(e.target.value))} required />
                      </div>
                      <div className="form-group">
                        <label>Deposit Payment Mode</label>
                        <select className="form-control" value={editDepositPaymentMode} onChange={e => setEditDepositPaymentMode(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="Online">Online</option>
                          <option value="Mixed">Mixed Split</option>
                        </select>
                      </div>
                    </div>

                    {editDepositPaymentMode === 'Mixed' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }} className="animate-fade">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Deposit Cash Portion (₹)</label>
                          <input type="number" className="form-control" value={editDepositMixedCash} onChange={e => setEditDepositMixedCash(Number(e.target.value))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Deposit Online Portion (₹)</label>
                          <input type="number" className="form-control" value={editDepositMixedOnline} onChange={e => setEditDepositMixedOnline(Number(e.target.value))} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Deposit Comparison Card */}
                  {comp && comp.diff !== 0 && (
                    <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)', padding: '16px', borderRadius: '10px', fontSize: '0.85rem' }} className="animate-fade">
                      <strong style={{ color: '#3b82f6', display: 'block', marginBottom: '10px', fontSize: '0.9rem' }}>🛡️ Security Deposit Summary</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Old Deposit Held:</span>
                          <strong style={{ color: 'white' }}>₹{comp.oldDeposit}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>New Deposit Requirement:</span>
                          <strong style={{ color: 'white' }}>₹{comp.newDeposit}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Difference:</span>
                          <strong style={{ color: 'white' }}>₹{Math.abs(comp.diff)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: comp.diff > 0 ? '#ea580c' : '#10b981', fontWeight: 'bold' }}>
                          <span>Direction:</span>
                          <span>{comp.diff > 0 ? 'Additional Deposit Required' : 'Refund Difference'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px', fontWeight: 'bold' }}>
                          <span style={{ color: 'var(--text-primary)' }}>Final Deposit Held:</span>
                          <strong style={{ color: 'var(--status-available)' }}>₹{comp.newDeposit}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Details</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* E. COLLECT MONEY STANDALONE POPUP */}
      {activeModal === 'collect' && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Collect Money Payment - {selectedBooking.bookingId}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleStandaloneCollectSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Financial Snapshot */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem' }}>
                  <strong style={{ display: 'block', marginBottom: '6px' }}>📊 Booking Financial Snapshot:</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>Rental Cost Total: <strong>₹{pendingRental + selectedBooking.advancePaid}</strong></div>
                    <div>Rental Paid Till Now: <strong style={{ color: '#10b981' }}>₹{selectedBooking.advancePaid}</strong></div>
                    <div style={{ gridColumn: 'span 2', color: '#ea580c', fontWeight: 'bold' }}>Pending Rental Due: ₹{pendingRental}</div>
                    <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', gridColumn: 'span 2', margin: '4px 0' }}></div>
                    <div>Deposit Required: <strong>₹{selectedBooking.securityDeposit}</strong></div>
                    <div>Deposit Collected: <strong style={{ color: '#10b981' }}>₹{selectedBooking.securityDeposit - pendingDeposit}</strong></div>
                    <div style={{ gridColumn: 'span 2', color: '#ea580c', fontWeight: 'bold' }}>Pending Deposit Due: ₹{pendingDeposit}</div>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 'bold' }}>Select Collection Type *</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="collectType" 
                        value="Rental" 
                        checked={collectType === 'Rental'} 
                        onChange={() => {
                          setCollectType('Rental');
                          setCollectAmount(pendingRental);
                          setCollectCashAmount(pendingRental);
                          setCollectOnlineAmount(0);
                        }}
                      />
                      <span>Rental Due (₹{pendingRental})</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="collectType" 
                        value="Deposit" 
                        checked={collectType === 'Deposit'} 
                        onChange={() => {
                          setCollectType('Deposit');
                          setCollectAmount(pendingDeposit);
                          setCollectCashAmount(pendingDeposit);
                          setCollectOnlineAmount(0);
                        }}
                      />
                      <span>Deposit Due (₹{pendingDeposit})</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="collectType" 
                        value="Both" 
                        checked={collectType === 'Both'} 
                        onChange={() => {
                          setCollectType('Both');
                          const total = pendingRental + pendingDeposit;
                          setCollectAmount(total);
                          setCollectCashAmount(total);
                          setCollectOnlineAmount(0);
                        }}
                      />
                      <span>Both (₹{pendingRental + pendingDeposit})</span>
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Amount to Collect (₹) *</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={collectAmount} 
                    onChange={e => {
                      const val = Number(e.target.value);
                      const maxVal = collectType === 'Rental' ? pendingRental : collectType === 'Deposit' ? pendingDeposit : (pendingRental + pendingDeposit);
                      const finalVal = Math.min(maxVal, val);
                      setCollectAmount(finalVal);
                      setCollectCashAmount(finalVal);
                      setCollectOnlineAmount(0);
                    }} 
                    max={collectType === 'Rental' ? pendingRental : collectType === 'Deposit' ? pendingDeposit : (pendingRental + pendingDeposit)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Payment Collection Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {['Cash', 'UPI', 'Card', 'Mixed'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        className={`btn ${collectMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px', fontSize: '0.75rem' }}
                        onClick={() => setCollectMode(mode)}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {collectMode === 'Mixed' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} className="animate-fade">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>Cash portion (₹)</label>
                      <input type="number" className="form-control" value={collectCashAmount} onChange={e => handleCollectSplitChange('Cash', Number(e.target.value), collectAmount)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.65rem' }}>Online portion (₹)</label>
                      <input type="number" className="form-control" value={collectOnlineAmount} onChange={e => handleCollectSplitChange('Online', Number(e.target.value), collectAmount)} />
                    </div>
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Collection Notes / Remarks</label>
                    <input type="text" className="form-control" value={collectNotes} onChange={e => setCollectNotes(e.target.value)} />
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success">Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* F. ADMIN OVERRIDE MODAL */}
      {activeModal === 'override' && selectedBooking && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h2 style={{ color: 'var(--secondary)' }}>🔧 Admin Override Pricing - {selectedBooking.bookingId}</h2>
              <button className="btn btn-secondary btn-icon" onClick={() => setActiveModal(null)}>✕</button>
            </div>
            <form onSubmit={handleAdminOverrideSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Base Fare (₹)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={overrideBaseFare}
                      onChange={(e) => {
                        setOverrideBaseFare(e.target.value);
                        handleOverrideValuesChange(e.target.value, overrideDiscount, overrideAdvancePaid);
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Discount Applied (₹)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={overrideDiscount}
                      onChange={(e) => {
                        setOverrideDiscount(e.target.value);
                        handleOverrideValuesChange(overrideBaseFare, e.target.value, overrideAdvancePaid);
                      }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Advance Paid (₹)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={overrideAdvancePaid}
                      onChange={(e) => {
                        setOverrideAdvancePaid(e.target.value);
                        handleOverrideValuesChange(overrideBaseFare, overrideDiscount, e.target.value);
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Security Deposit (₹)</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={overrideSecurityDeposit}
                      onChange={(e) => setOverrideSecurityDeposit(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label>Payment Method Override</label>
                    <select 
                      className="form-control"
                      value={overridePaymentMethod}
                      onChange={(e) => setOverridePaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                      <option value="Unpaid">Unpaid / Deferred</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Force Booking Status</label>
                    <select 
                      className="form-control"
                      value={overrideStatus}
                      onChange={(e) => setOverrideStatus(e.target.value)}
                    >
                      <option value="Reserved">Reserved</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Extended">Extended</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Override Final Outstanding Amount (₹)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={overrideFinalAmount}
                    onChange={(e) => setOverrideFinalAmount(Number(e.target.value))}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Negative value represents refund owed to user.</small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--secondary)' }}>Apply Overrides</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
