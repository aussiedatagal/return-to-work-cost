import { calculateChildSubsidy, type Child, MIN_SUBSIDISED_HOURS, MAX_SUBSIDISED_HOURS } from './subsidyCalculations'
import { calculateAfterTaxIncome } from './taxCalculations'

export interface HoursGraphDataPoint {
  hoursPerWeek: number
  daysPerWeek: number
  netIncome: number
  grossIncome: number
  afterTax: number
  childcareCost: number
}

// Calculate days per week from hours per week (assuming 7.6 hours per work day)
export function calculateDaysPerWeekFromHours(hoursPerWeek: number): number {
  const hoursPerDay = 7.6
  return Math.round((hoursPerWeek / hoursPerDay) * 10) / 10 // Round to 1 decimal
}

// Calculate total costs with work-day-based subsidised hours
// 1 day of work (7.6h) = 11 hours of subsidised care per week = 22 hours per fortnight
export function calculateTotalCostsWithWorkDays(
  children: Child[],
  income: number,
  subsidisedHoursPerFortnight: number
) {
  let totalChildcareSubsidy = 0
  let totalChildcareCost = 0
  const childDetails = children.map(child => {
    const details = calculateChildSubsidy(child, income, 0) // Activity hours not used for work-day-based calculation
    // Calculate hours per fortnight: hours per day × days per week × 2 weeks per fortnight
    const hoursPerFortnight = child.hoursPerDay * child.daysPerWeek * 2
    // Subsidised hours are based on work days (already calculated), but limited by child's actual hours
    const subsidisedHours = Math.min(hoursPerFortnight, subsidisedHoursPerFortnight)
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

export function calculateHoursGraphData(
  fullTimeIncome: number,
  fullTimeHoursPerWeek: number,
  firstParentIncome: number,
  children: Child[],
  _firstParentHoursPerWeek: number,
  familyType: 'two-parent' | 'single-parent',
  maxHours?: number
): HoursGraphDataPoint[] {
  const dataPoints: HoursGraphDataPoint[] = []
  
  // Calculate hourly rate from full-time income and hours
  const hourlyRate = fullTimeHoursPerWeek > 0 ? fullTimeIncome / (fullTimeHoursPerWeek * 52) : 0
  
  // Determine max hours: use provided maxHours, or default to 38
  // Round up to nearest 0.5 hour increment for cleaner graph bounds
  const maxHoursForGraph = maxHours ? Math.ceil(maxHours / 0.5) * 0.5 : 38
  
  // Generate data points from 0 to maxHoursForGraph hours per week
  // Use 0.5 hour increments for smoother curve
  for (let hoursPerWeek = 0; hoursPerWeek <= maxHoursForGraph; hoursPerWeek += 0.5) {
    // Calculate pro-rated annual income based on hours worked
    const grossIncome = hourlyRate * hoursPerWeek * 52
    
    // Calculate days per week from hours (assuming 7.6 hours per work day)
    // This determines how many days per week children need childcare
    const daysPerWeek = calculateDaysPerWeekFromHours(hoursPerWeek)
    
    // Update children's days per week for this scenario
    // Childcare costs scale with days per week (charged per day, not per hour)
    // When parent works fewer hours → fewer days → lower childcare cost
    const childrenForScenario = children.map(child => ({
      ...child,
      daysPerWeek: daysPerWeek
    }))
    
    // Calculate income for subsidy calculation
    // For single parent: use only their income. For two-parent: use combined income
    const incomeForSubsidy = familyType === 'single-parent' 
      ? grossIncome 
      : (firstParentIncome + grossIncome)
    
    // IMPORTANT: Subsidised hours are based on work days, not just activity hours
    // 1 day of work (7.6h) = 11 hours of subsidised care per week = 22 hours per fortnight
    // So subsidised hours per fortnight = work days × 22
    // But we still need to respect the activity test thresholds (72h minimum, 100h max)
    const subsidisedHoursPerFortnightFromWorkDays = Math.min(Math.max(daysPerWeek * 22, MIN_SUBSIDISED_HOURS), MAX_SUBSIDISED_HOURS)
    
    // Calculate childcare costs with work-day-based subsidised hours
    const costs = calculateTotalCostsWithWorkDays(
      childrenForScenario, 
      incomeForSubsidy, 
      subsidisedHoursPerFortnightFromWorkDays
    )
    const afterTax = calculateAfterTaxIncome(grossIncome)
    const childcareOutOfPocketAnnual = costs.totalChildcareOutOfPocket * 26
    const netIncome = afterTax - childcareOutOfPocketAnnual
    
    dataPoints.push({
      hoursPerWeek,
      daysPerWeek,
      netIncome,
      grossIncome,
      afterTax,
      childcareCost: childcareOutOfPocketAnnual,
    })
  }
  
  return dataPoints
}

export function findBreakEvenHours(
  dataPoints: HoursGraphDataPoint[]
): HoursGraphDataPoint | null {
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const current = dataPoints[i]
    const next = dataPoints[i + 1]
    
    if (current.netIncome <= 0 && next.netIncome > 0) {
      // Linear interpolation to find exact break-even point
      const ratio = Math.abs(current.netIncome) / (Math.abs(current.netIncome) + next.netIncome)
      const breakEvenHours = current.hoursPerWeek + (next.hoursPerWeek - current.hoursPerWeek) * ratio
      
      // Only return if break-even is at a meaningful point (not at 0 hours)
      // If break-even is very close to 0, it's not meaningful to show
      if (breakEvenHours < 0.5) {
        return null
      }
      
      const breakEvenDays = calculateDaysPerWeekFromHours(breakEvenHours)
      
      return {
        hoursPerWeek: breakEvenHours,
        daysPerWeek: breakEvenDays,
        netIncome: 0,
        grossIncome: current.grossIncome + (next.grossIncome - current.grossIncome) * ratio,
        afterTax: current.afterTax + (next.afterTax - current.afterTax) * ratio,
        childcareCost: current.childcareCost + (next.childcareCost - current.childcareCost) * ratio,
      }
    }
  }
  
  return null
}

export function findPointForHours(
  dataPoints: HoursGraphDataPoint[],
  targetHours: number
): HoursGraphDataPoint | null {
  if (dataPoints.length === 0) return null
  
  // Find the closest data points
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const current = dataPoints[i]
    const next = dataPoints[i + 1]
    
    if (current.hoursPerWeek <= targetHours && next.hoursPerWeek >= targetHours) {
      if (current.hoursPerWeek === targetHours) {
        return current
      }
      if (next.hoursPerWeek === targetHours) {
        return next
      }
      
      // Linear interpolation
      const ratio = (targetHours - current.hoursPerWeek) / (next.hoursPerWeek - current.hoursPerWeek)
      return {
        hoursPerWeek: targetHours,
        daysPerWeek: calculateDaysPerWeekFromHours(targetHours),
        netIncome: current.netIncome + (next.netIncome - current.netIncome) * ratio,
        grossIncome: current.grossIncome + (next.grossIncome - current.grossIncome) * ratio,
        afterTax: current.afterTax + (next.afterTax - current.afterTax) * ratio,
        childcareCost: current.childcareCost + (next.childcareCost - current.childcareCost) * ratio,
      }
    }
  }
  
  return null
}

export interface MinimumWageIntersection {
  hoursPerWeek: number
  daysPerWeek: number
  netIncome: number
}

export function findMinimumWageIntersection(
  dataPoints: HoursGraphDataPoint[],
  calculateMinWageForHours: (hours: number) => number
): MinimumWageIntersection | null {
  if (dataPoints.length === 0) return null
  
  // Find where net income line crosses minimum wage line
  // Skip the first point (0 hours) to avoid the origin intersection
  for (let i = 1; i < dataPoints.length - 1; i++) {
    const current = dataPoints[i]
    const next = dataPoints[i + 1]
    
    const currentMinWage = calculateMinWageForHours(current.hoursPerWeek)
    const nextMinWage = calculateMinWageForHours(next.hoursPerWeek)
    
    // Check if lines cross between these two points
    const netIncomeDiff = next.netIncome - current.netIncome
    const minWageDiff = nextMinWage - currentMinWage
    
    // If net income is above min wage at current point and below at next point (or vice versa)
    const currentAbove = current.netIncome > currentMinWage
    const nextAbove = next.netIncome > nextMinWage
    
    if (currentAbove !== nextAbove) {
      // Lines cross - find intersection point using linear interpolation
      // Solve: current.netIncome + t * netIncomeDiff = currentMinWage + t * minWageDiff
      // t * (netIncomeDiff - minWageDiff) = currentMinWage - current.netIncome
      const denominator = netIncomeDiff - minWageDiff
      
      if (Math.abs(denominator) > 0.001) {
        const t = (currentMinWage - current.netIncome) / denominator
        const intersectionHours = current.hoursPerWeek + t * (next.hoursPerWeek - current.hoursPerWeek)
        
        // Only return if within valid range and not at origin (0 hours)
        if (intersectionHours > 0.1 && intersectionHours <= 50) {
          const intersectionNetIncome = current.netIncome + t * netIncomeDiff
          
          return {
            hoursPerWeek: intersectionHours,
            daysPerWeek: calculateDaysPerWeekFromHours(intersectionHours),
            netIncome: intersectionNetIncome,
          }
        }
      }
    }
  }
  
  return null
}

export function findMaxIncomePoint(
  dataPoints: HoursGraphDataPoint[]
): HoursGraphDataPoint | null {
  if (dataPoints.length === 0) return null
  
  // Find the point with the maximum net income
  return dataPoints.reduce((max, current) => 
    current.netIncome > max.netIncome ? current : max
  )
}
