/**
 * billingEngine.js — Frontend mirror of server billing calculations.
 *
 * IMPORTANT: Keep this file in sync with server/utils/billingEngine.js
 * Both must use identical formulas so UI previews match server computations.
 */

/**
 * Calculate extension charge for additional hours.
 * Returns ONLY the delta cost for the extension period.
 *
 * @param {Object} selectedPlan   — { extraHourCharge, rate }
 * @param {number} extensionHours — additional hours being added
 * @returns {number}
 */
export function calculateExtensionCharge(selectedPlan, extensionHours = 0) {
  if (!selectedPlan || extensionHours <= 0) return 0;
  const extraHourCharge = Number(selectedPlan.extraHourCharge) || 0;
  if (extraHourCharge > 0) return extraHourCharge * Math.ceil(extensionHours);
  return (Number(selectedPlan.rate) || 0) * Math.ceil(extensionHours);
}

/**
 * Calculate the actual rental bill at drop-off.
 *
 * Formula:
 *   actualBill = rentalCost + extraHourCharges + extraKmCharges + damageCharges + cleaningCharges + otherCharges - discount
 *
 * @param {Object} params
 * @returns {number} actualBill
 */
export function calculateActualBill({
  rentalCost = 0,
  extraHourCharge = 0,
  extraKmCharge = 0,
  actualHours = 0,
  bookedHours = 0,
  actualKm = 0,
  kmLimit = 0,
  damageCharges = 0,
  cleaningCharges = 0,
  otherCharges = 0,
  discount = 0,
} = {}) {
  const overHours = Math.max(0, actualHours - bookedHours);
  const overKm = Math.max(0, actualKm - kmLimit);

  const extraHourTotal = extraHourCharge > 0 ? extraHourCharge * Math.ceil(overHours) : 0;
  const extraKmTotal = extraKmCharge > 0 ? extraKmCharge * Math.ceil(overKm) : 0;

  return Math.max(
    0,
    Math.round(
      Number(rentalCost) +
        extraHourTotal +
        extraKmTotal +
        Number(damageCharges) +
        Number(cleaningCharges) +
        Number(otherCharges) -
        Number(discount)
    )
  );
}

/**
 * Calculate complete settlement from billing inputs.
 *
 * Formula:
 *   netDue            = actualBill - rentalPaid
 *   depositAdjustment = min(depositHeld, max(0, netDue))
 *   finalRefund       = depositHeld - depositAdjustment
 *   finalCollection   = max(0, netDue - depositAdjustment)
 *
 * @param {Object} params
 * @returns {{ netDue, depositAdjustment, finalRefund, finalCollection }}
 */
export function calculateSettlement({ actualBill = 0, rentalPaid = 0, depositHeld = 0 } = {}) {
  const netDue = Number(actualBill) - Number(rentalPaid);
  const depositAdjustment = Math.min(Number(depositHeld), Math.max(0, netDue));
  const finalRefund = Math.max(0, Number(depositHeld) - depositAdjustment);
  const finalCollection = Math.max(0, netDue - depositAdjustment);

  return {
    netDue: Math.round(netDue),
    depositAdjustment: Math.round(depositAdjustment),
    finalRefund: Math.round(finalRefund),
    finalCollection: Math.round(finalCollection),
  };
}

/**
 * Full settlement preview for the drop-off form.
 * Call this in the UI whenever the operator enters drop-off details.
 *
 * @param {Object} booking     — live booking object from API
 * @param {Object} dropDetails — form values (endMeter, damageCharges, etc.)
 * @returns {{ actualBill, netDue, depositAdjustment, finalRefund, finalCollection, extraKmDriven, extraHoursUsed }}
 */
export function calculateDropOffSettlement(booking, dropDetails = {}) {
  const startMeter = Number(booking?.handover?.startMeter) || 0;
  const endMeter = Number(dropDetails.endMeter) || startMeter;
  const actualKm = Math.max(0, endMeter - startMeter);

  const actualPickup =
    booking?.actualPickupDate || booking?.rentalPeriod?.actualPickupDate;
  const actualReturnTime = dropDetails.actualTime ? new Date(dropDetails.actualTime) : new Date();
  const actualHours = actualPickup
    ? Math.max(0, (actualReturnTime - new Date(actualPickup)) / (1000 * 60 * 60))
    : 0;

  const plan = booking?.selectedPlan || {};
  const bookedHours = Number(booking?.durationHours) || 0;
  const kmLimit = Number(plan.kmLimit) || 0;

  const actualBill = calculateActualBill({
    rentalCost: Number(booking?.rentalCost) || 0,
    extraHourCharge: Number(plan.extraHourCharge) || 0,
    extraKmCharge: Number(plan.extraKmCharge) || 0,
    actualHours,
    bookedHours,
    actualKm,
    kmLimit,
    damageCharges: Number(dropDetails.damageCharges) || 0,
    cleaningCharges: Number(dropDetails.cleaningCharges) || 0,
    otherCharges: Number(dropDetails.otherCharges) || 0,
    discount: Number(booking?.discount) || 0,
  });

  const settlement = calculateSettlement({
    actualBill,
    rentalPaid: Number(booking?.rentalPaid) || 0,
    depositHeld: Number(booking?.depositHeld) || 0,
  });

  return {
    actualBill,
    extraKmDriven: actualKm,
    extraHoursUsed: Math.max(0, actualHours - bookedHours),
    ...settlement,
  };
}

/**
 * Format currency for display.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}
