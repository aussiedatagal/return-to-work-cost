// Child Care Subsidy rates for 2025-26 (effective July 7, 2025)
// Source: Department of Education - Child Care Subsidy
// https://www.education.gov.au/early-childhood/announcements/child-care-subsidy-hourly-rate-caps-are-changing-soon-0
// Source: Services Australia - Your number of children in care can affect your higher Child Care Subsidy
// https://www.servicesaustralia.gov.au/your-number-children-care-can-affect-your-higher-child-care-subsidy?context=41186
// 
// First child (standard rate):
// - Up to $85,279 = 90% subsidy, decreases 1% per $5,000, $535,279+ = 0% subsidy
//
// Second+ children (higher rate):
// - Up to $143,273 = 95% subsidy
// - $143,273 to $188,273 = decreases 1% per $3,000 (from 95% to 80%)
// - $188,273 to $267,563 = 80% subsidy
// - $267,563 to $357,563 = decreases 1% per $3,000 (from 80% to 50%)
// - $357,563+ = 50% subsidy (does not go to 0%)
export const BASE_INCOME = 85279  // Income threshold for maximum subsidy for first child (families earning up to this receive 90% subsidy)
export const BASE_SUBSIDY_PERCENT = 90  // Maximum subsidy percentage for first child

// Second+ child (higher rate) income thresholds
export const SECOND_CHILD_BASE_INCOME = 143273  // Income threshold for maximum subsidy for second+ child (95% up to this)
export const SECOND_CHILD_SUBSIDY_PERCENT = 95  // Maximum subsidy percentage for second+ child
export const SECOND_CHILD_INCOME_STEP = 3000  // Subsidy decreases by 1% for every $3,000 above SECOND_CHILD_BASE_INCOME
export const SECOND_CHILD_FIRST_BRACKET_END = 188273  // End of first decreasing bracket (reaches 80% here)
export const SECOND_CHILD_FLAT_80_END = 267563  // End of flat 80% bracket
export const SECOND_CHILD_SECOND_BRACKET_END = 357563  // End of second decreasing bracket (reaches 50% here)
export const SECOND_CHILD_MIN_SUBSIDY_PERCENT = 50  // Minimum subsidy for second+ children (does not go below 50%)

// First child income thresholds
export const INCOME_STEP = 5000  // Subsidy decreases by 1% for every $5,000 above BASE_INCOME
export const SUBSIDY_DECREASE_PER_STEP = 1
export const MAX_INCOME = 535279  // Income threshold where subsidy reaches 0% for first child (families earning this or more receive no subsidy)

// Hourly rate caps for 2025-26 (effective July 7, 2025) - Centre-Based Day Care
// Source: Department of Education - Child Care Subsidy hourly rate caps
// https://www.education.gov.au/early-childhood/announcements/child-care-subsidy-hourly-rate-caps-are-changing-soon-0
export const HOURLY_RATE_CAP_UNDER_SCHOOL_AGE = 14.63  // Per hour cap for children under school age (Centre-Based Day Care)
export const HOURLY_RATE_CAP_SCHOOL_AGE = 12.81  // Per hour cap for school-age children (Centre-Based Day Care)

// Activity test thresholds for 2025-26
// 3 Day Guarantee (effective January 5, 2026): All CCS-eligible families receive minimum 72 hours per fortnight
// Source: Department of Education - 3 Day Guarantee
// https://www.education.gov.au/early-childhood/providers/child-care-subsidy/3-day-guarantee
// Additional source: Services Australia - How many hours of Child Care Subsidy you can get
export const MIN_SUBSIDISED_HOURS = 72  // Minimum hours per fortnight (3 Day Guarantee - all CCS-eligible families)
export const MAX_SUBSIDISED_HOURS = 100  // Maximum hours per fortnight for activity >= 48 hours or special circumstances
export const ACTIVITY_THRESHOLD_FOR_MAX_HOURS = 48  // Activity hours per fortnight threshold (based on parent with lowest hours)

export interface Child {
  age: 'under-school' | 'school-age'
  hoursPerDay: number
  daysPerWeek: number
  hourlyRate: number
  isSecondOrLater: boolean
}

export function calculateSubsidyPercent(income: number, isSecondOrLater: boolean): number {
  if (isSecondOrLater) {
    // Second+ children (higher rate) calculation with multiple brackets
    if (income <= SECOND_CHILD_BASE_INCOME) {
      // Up to $143,273: 95% subsidy
      return SECOND_CHILD_SUBSIDY_PERCENT
    }
    
    if (income <= SECOND_CHILD_FIRST_BRACKET_END) {
      // $143,273 to $188,273: decreases 1% per $3,000 (from 95% to 80%)
      const incomeOverBase = income - SECOND_CHILD_BASE_INCOME
      const steps = Math.floor(incomeOverBase / SECOND_CHILD_INCOME_STEP)
      const subsidyPercent = SECOND_CHILD_SUBSIDY_PERCENT - (steps * SUBSIDY_DECREASE_PER_STEP)
      return Math.max(80, subsidyPercent)  // Minimum 80% in this bracket
    }
    
    if (income <= SECOND_CHILD_FLAT_80_END) {
      // $188,273 to $267,563: flat 80% subsidy
      return 80
    }
    
    if (income <= SECOND_CHILD_SECOND_BRACKET_END) {
      // $267,563 to $357,563: decreases 1% per $3,000 (from 80% to 50%)
      const incomeOverBase = income - SECOND_CHILD_FLAT_80_END
      const steps = Math.floor(incomeOverBase / SECOND_CHILD_INCOME_STEP)
      const subsidyPercent = 80 - (steps * SUBSIDY_DECREASE_PER_STEP)
      return Math.max(SECOND_CHILD_MIN_SUBSIDY_PERCENT, subsidyPercent)  // Minimum 50%
    }
    
    // $357,563+: 50% subsidy (does not go to 0%)
    return SECOND_CHILD_MIN_SUBSIDY_PERCENT
  } else {
    // First child (standard rate) calculation
    if (income <= BASE_INCOME) {
      return BASE_SUBSIDY_PERCENT
    }
    if (income >= MAX_INCOME) {
      return 0
    }
    
    const incomeOverBase = income - BASE_INCOME
    const steps = Math.floor(incomeOverBase / INCOME_STEP)
    const subsidyPercent = BASE_SUBSIDY_PERCENT - (steps * SUBSIDY_DECREASE_PER_STEP)
    
    return Math.max(0, subsidyPercent)
  }
}

// 3 Day Guarantee: All CCS-eligible families receive minimum 72 hours per fortnight regardless of activity
// Families with 48+ hours of activity per fortnight (or special circumstances) receive up to 100 hours
export function calculateSubsidisedHours(activityHoursPerFortnight: number): number {
  if (activityHoursPerFortnight >= ACTIVITY_THRESHOLD_FOR_MAX_HOURS) {
    return MAX_SUBSIDISED_HOURS
  }
  return MIN_SUBSIDISED_HOURS  // 3 Day Guarantee minimum
}

export function calculateChildSubsidy(
  child: Child,
  income: number,
  activityHoursPerFortnight: number
): {
  subsidyPercent: number
  hourlyRateCap: number
  subsidisedHoursPerFortnight: number
  subsidyPerHour: number
  hoursPerDay: number
  daysPerWeek: number
} {
  const subsidyPercent = calculateSubsidyPercent(income, child.isSecondOrLater)
  const hourlyRateCap = child.age === 'under-school' 
    ? HOURLY_RATE_CAP_UNDER_SCHOOL_AGE 
    : HOURLY_RATE_CAP_SCHOOL_AGE
  
  const subsidisedHoursPerFortnight = calculateSubsidisedHours(activityHoursPerFortnight)
  
  const rateForSubsidy = Math.min(child.hourlyRate, hourlyRateCap)
  const subsidyPerHour = rateForSubsidy * (subsidyPercent / 100)
  
  return {
    subsidyPercent,
    hourlyRateCap,
    subsidisedHoursPerFortnight,
    subsidyPerHour,
    hoursPerDay: child.hoursPerDay,
    daysPerWeek: child.daysPerWeek
  }
}

export function calculateTotalCosts(
  children: Child[],
  income: number,
  activityHoursPerFortnight: number
) {
  let totalChildcareSubsidy = 0
  let totalChildcareCost = 0
  const childDetails = children.map(child => {
    const details = calculateChildSubsidy(child, income, activityHoursPerFortnight)
    // Calculate hours per fortnight: hours per day × days per week × 2 weeks per fortnight
    const hoursPerFortnight = child.hoursPerDay * child.daysPerWeek * 2
    // Subsidised hours are limited by both the child's hours and the activity test threshold
    const subsidisedHours = Math.min(hoursPerFortnight, details.subsidisedHoursPerFortnight)
    const unsubsidisedHours = Math.max(0, hoursPerFortnight - subsidisedHours)
    
    const subsidyAmount = subsidisedHours * details.subsidyPerHour
    const totalCost = hoursPerFortnight * child.hourlyRate
    const outOfPocket = totalCost - subsidyAmount
    
    totalChildcareSubsidy += subsidyAmount
    totalChildcareCost += totalCost
    
    return {
      ...details,
      subsidyAmount,
      totalCost,
      outOfPocket,
      subsidisedHours,
      unsubsidisedHours
    }
  })
  
  const totalChildcareOutOfPocket = totalChildcareCost - totalChildcareSubsidy
  // Calculate per-day cost: average across all children
  // Sum of (days per week × 2) for all children, then divide total out-of-pocket by that
  const totalDaysPerFortnight = children.reduce((sum, child) => sum + (child.daysPerWeek * 2), 0)
  const childcarePerDay = totalDaysPerFortnight > 0 ? totalChildcareOutOfPocket / totalDaysPerFortnight : 0
  
  return {
    childDetails,
    totalChildcareSubsidy,
    totalChildcareCost,
    totalChildcareOutOfPocket,
    childcarePerDay
  }
}

