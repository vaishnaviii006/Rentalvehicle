/**
 * billingEngine.js — Server-side shared billing & settlement calculations.
 *
 * ALL rental cost and settlement math must go through these functions.
 * Never calculate billing inline in route handlers.
 *
 * Rules:
 *   - rentalCost = baseFare (accumulated across all plan periods + extensions)
 *   - Extensions ADD to rentalCost — they do NOT reset it
 *   - Settlement uses snapshot fields only — never revision history
 */

/**
 * Calculate the cumulative rental base cost from a plan type, duration, and extension history.
 *
 * @param {Object} selectedPlan  — { planType, rate, kmLimit, extraKmCharge, extraHourCharge }
 * @param {number} durationHours — total booked hours (original + all extensions combined)
 * @param {number} durationDays  — total booked days (for weekly/monthly)
 * @returns {number} baseFare
 */
export function calculateBaseFare(selectedPlan, durationHours = 0, durationDays = 0) {
  if (!selectedPlan || !selectedPlan.planType) return 0;

  const rate = Number(selectedPlan.rate) || 0;
  const planType = selectedPlan.planType;

  if (planType === 'Hourly') {
    return rate * Math.ceil(durationHours);
  }

  if (planType === '12-Hour') {
    const periods = Math.ceil(durationHours / 12);
    return rate * periods;
  }

  if (planType === '24-Hour') {
    const periods = Math.ceil(durationHours / 24);
    return rate * periods;
  }

  if (planType === 'Weekly') {
    const weeks = Math.ceil(durationDays / 7);
    return rate * weeks;
  }

  if (planType === 'Monthly') {
    const months = Math.ceil(durationDays / 30);
    return rate * months;
  }

  // Fallback: treat rate as flat
  return rate;
}

/**
 * Calculate extension cost for a single extension period.
 * This returns ONLY the additional charge for the extension — not the full rental.
 *
 * @param {Object} selectedPlan      — plan with extraHourCharge
 * @param {number} extensionHours    — number of additional hours being added
 * @returns {number} extension charge
 */
export function calculateExtensionCharge(selectedPlan, extensionHours = 0) {
  if (!selectedPlan || extensionHours <= 0) return 0;

  const extraHourCharge = Number(selectedPlan.extraHourCharge) || 0;
  if (extraHourCharge > 0) {
    return extraHourCharge * Math.ceil(extensionHours);
  }

  // Fallback: use plan rate
  const rate = Number(selectedPlan.rate) || 0;
  return rate * Math.ceil(extensionHours);
}

/**
 * Calculate the full actual rental bill at drop-off time.
 *
 * Formula:
 *   actualBill = rentalCost + extraHourCharges + extraKmCharges + damageCharges + cleaningCharges + otherCharges - discounts
 *
 * @param {Object} params
 * @param {number} params.rentalCost      — snapshot: total base rental cost (incl. extensions)
 * @param {number} params.extraHourCharge — per-hour rate for overage (from selectedPlan)
 * @param {number} params.extraKmCharge   — per-km rate for overage (from selectedPlan)
 * @param {number} params.actualHours     — actual hours used (from actualPickup → actualReturn)
 * @param {number} params.bookedHours     — originally booked hours (durationHours)
 * @param {number} params.actualKm        — actual KM driven (endMeter - startMeter)
 * @param {number} params.kmLimit         — plan KM limit
 * @param {number} params.damageCharges   — damage charges from drop-off inspection
 * @param {number} params.cleaningCharges — cleaning charges
 * @param {number} params.otherCharges    — any other charges
 * @param {number} params.discount        — discount applied
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

  const actualBill =
    Number(rentalCost) +
    extraHourTotal +
    extraKmTotal +
    Number(damageCharges) +
    Number(cleaningCharges) +
    Number(otherCharges) -
    Number(discount);

  return Math.max(0, Math.round(actualBill));
}

/**
 * Calculate the complete settlement breakdown.
 *
 * Formula:
 *   netDue            = actualBill - rentalPaid
 *   depositAdjustment = min(depositHeld, max(0, netDue))
 *   finalRefund       = depositHeld - depositAdjustment
 *   finalCollection   = max(0, netDue - depositAdjustment)
 *
 * @param {Object} params
 * @param {number} params.actualBill    — from calculateActualBill()
 * @param {number} params.rentalPaid    — snapshot: total rental already paid
 * @param {number} params.depositHeld   — snapshot: security deposit held
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
 * Full settlement calculation from a booking object + drop-off details.
 * This is the canonical entry point used in the dropoff route.
 *
 * @param {Object} booking     — booking document (with snapshot fields)
 * @param {Object} dropDetails — from the drop-off form
 * @returns {{ actualBill, netDue, depositAdjustment, finalRefund, finalCollection }}
 */
export function calculateDropOffSettlement(booking, dropDetails = {}) {
  const startMeter = Number(booking.handover?.startMeter) || 0;
  const endMeter = Number(dropDetails.endMeter) || startMeter;
  const actualKm = Math.max(0, endMeter - startMeter);

  const actualPickup = booking.actualPickupDate || booking.rentalPeriod?.actualPickupDate;
  const actualReturn = new Date();
  const actualHours = actualPickup
    ? Math.max(0, (actualReturn - new Date(actualPickup)) / (1000 * 60 * 60))
    : 0;

  const plan = booking.selectedPlan || {};
  const bookedHours = Number(booking.durationHours) || 0;
  const kmLimit = Number(plan.kmLimit) || 0;

  const actualBill = calculateActualBill({
    rentalCost: Number(booking.rentalCost) || 0,
    extraHourCharge: Number(plan.extraHourCharge) || 0,
    extraKmCharge: Number(plan.extraKmCharge) || 0,
    actualHours,
    bookedHours,
    actualKm,
    kmLimit,
    damageCharges: Number(dropDetails.damageCharges) || 0,
    cleaningCharges: Number(dropDetails.cleaningCharges) || 0,
    otherCharges: Number(dropDetails.otherCharges) || 0,
    discount: Number(booking.discount) || 0,
  });

  const settlement = calculateSettlement({
    actualBill,
    rentalPaid: Number(booking.rentalPaid) || 0,
    depositHeld: Number(booking.depositHeld) || 0,
  });

  return {
    actualBill,
    extraKmDriven: actualKm,
    extraHoursUsed: Math.max(0, actualHours - bookedHours),
    ...settlement,
  };
}
