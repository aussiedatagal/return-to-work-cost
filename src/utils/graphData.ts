import { calculateTotalCosts, type Child } from './subsidyCalculations'
import { calculateAfterTaxIncome } from './taxCalculations'

export interface GraphDataPoint {
  grossIncome: number
  netIncome: number
  afterTax: number
  childcareCost: number
}

export interface BreakEvenPoint {
  income: number
  netIncome: number
}

export function calculateGraphData(
  firstParentIncome: number,
  children: Child[],
  activityHoursPerFortnight: number,
  minIncome: number = 0,
  maxIncome: number = 160000,
  step: number = 5000,
  isSingleParent: boolean = false
): GraphDataPoint[] {
  const dataPoints: GraphDataPoint[] = []
  
  for (let secondParentIncome = minIncome; secondParentIncome <= maxIncome; secondParentIncome += step) {
    // For single parent: use only their income. For two-parent: use combined income
    const incomeForSubsidy = isSingleParent ? secondParentIncome : (firstParentIncome + secondParentIncome)
    const costs = calculateTotalCosts(children, incomeForSubsidy, activityHoursPerFortnight)
    const afterTax = calculateAfterTaxIncome(secondParentIncome)
    const childcareOutOfPocketAnnual = costs.totalChildcareOutOfPocket * 26
    const netIncome = afterTax - childcareOutOfPocketAnnual
    
    dataPoints.push({
      grossIncome: secondParentIncome,
      netIncome,
      afterTax,
      childcareCost: childcareOutOfPocketAnnual,
    })
  }
  
  return dataPoints
}

export function findBreakEvenPoint(
  dataPoints: GraphDataPoint[]
): BreakEvenPoint | null {
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const current = dataPoints[i]
    const next = dataPoints[i + 1]
    
    if (current.netIncome >= 0 && next.netIncome < 0) {
      const ratio = Math.abs(current.netIncome) / (Math.abs(current.netIncome) + Math.abs(next.netIncome))
      const breakEvenIncome = current.grossIncome + (next.grossIncome - current.grossIncome) * ratio
      return {
        income: breakEvenIncome,
        netIncome: 0,
      }
    }
    
    if (current.netIncome <= 0 && next.netIncome > 0) {
      const ratio = Math.abs(current.netIncome) / (Math.abs(current.netIncome) + Math.abs(next.netIncome))
      const breakEvenIncome = current.grossIncome + (next.grossIncome - current.grossIncome) * ratio
      return {
        income: breakEvenIncome,
        netIncome: 0,
      }
    }
  }
  
  return null
}

// Australian minimum wage (2025-26): $24.95/hour for full-time workers (effective July 1, 2025)
// Source: Fair Work Commission Annual Wage Review 2024-25
// Previous rate: $23.23/hour (2024-25)
// Note: This is the national minimum wage for full-time workers
const AUSTRALIAN_MINIMUM_WAGE_PER_HOUR = 24.95
// Standard full-time working year: 260 days (52 weeks × 5 days, excluding public holidays)
// Standard full-time hours per day: 7.6 hours
// These are used for minimum wage comparison (full-time standard)
const WORKING_DAYS_PER_YEAR = 260
const HOURS_PER_DAY = 7.6
const TOTAL_WORKING_HOURS_PER_YEAR = WORKING_DAYS_PER_YEAR * HOURS_PER_DAY
const MINIMUM_WAGE_GROSS_ANNUAL = AUSTRALIAN_MINIMUM_WAGE_PER_HOUR * HOURS_PER_DAY * WORKING_DAYS_PER_YEAR
export const MINIMUM_WAGE_AFTER_TAX = calculateAfterTaxIncome(MINIMUM_WAGE_GROSS_ANNUAL)
export const MINIMUM_WAGE_POST_TAX_HOURLY_RATE = MINIMUM_WAGE_AFTER_TAX / TOTAL_WORKING_HOURS_PER_YEAR

// Calculate minimum wage after tax for specific hours worked per week
export function calculateMinimumWageAfterTaxForHours(hoursPerWeek: number): number {
  const annualHours = hoursPerWeek * 52
  const minimumWageGrossAnnual = AUSTRALIAN_MINIMUM_WAGE_PER_HOUR * annualHours
  return calculateAfterTaxIncome(minimumWageGrossAnnual)
}

export function findMinimumWageEquivalentPoint(
  dataPoints: GraphDataPoint[],
  hoursPerFortnight?: number
): BreakEvenPoint | null {
  // Calculate minimum wage equivalent based on actual hours worked
  // If hours not provided, use full-time hours (76h/fortnight = 38h/week)
  const actualHoursPerFortnight = hoursPerFortnight ?? 76
  const annualHours = actualHoursPerFortnight * 26
  const minimumWageGrossAnnual = AUSTRALIAN_MINIMUM_WAGE_PER_HOUR * annualHours
  const minimumWageAfterTaxForHours = calculateAfterTaxIncome(minimumWageGrossAnnual)
  
  if (dataPoints.length === 0) return null
  
  // Find the point where net income equals minimum wage
  // Check if minimum wage is within the range of net incomes
  const minNetIncome = dataPoints.reduce((min, d) => Math.min(min, d.netIncome), dataPoints[0]?.netIncome ?? 0)
  const maxNetIncome = dataPoints.reduce((max, d) => Math.max(max, d.netIncome), dataPoints[0]?.netIncome ?? 0)
  
  // If minimum wage is outside the range, find the closest point
  if (minimumWageAfterTaxForHours < minNetIncome) {
    // Minimum wage is below all net incomes - find the point with lowest net income
    const lowestPoint = dataPoints.reduce((prev, curr) => 
      curr.netIncome < prev.netIncome ? curr : prev
    )
    return {
      income: lowestPoint.grossIncome,
      netIncome: lowestPoint.netIncome,
    }
  }
  
  if (minimumWageAfterTaxForHours > maxNetIncome) {
    // Minimum wage is above all net incomes - find the point with highest net income
    const highestPoint = dataPoints.reduce((prev, curr) => 
      curr.netIncome > prev.netIncome ? curr : prev
    )
    return {
      income: highestPoint.grossIncome,
      netIncome: highestPoint.netIncome,
    }
  }
  
  // Minimum wage is within range - find the crossing point
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const current = dataPoints[i]
    const next = dataPoints[i + 1]
    
    if (current.netIncome <= minimumWageAfterTaxForHours && next.netIncome >= minimumWageAfterTaxForHours) {
      const ratio = (minimumWageAfterTaxForHours - current.netIncome) / (next.netIncome - current.netIncome)
      const minWageIncome = current.grossIncome + (next.grossIncome - current.grossIncome) * ratio
      return {
        income: minWageIncome,
        netIncome: minimumWageAfterTaxForHours,
      }
    }
    
    if (current.netIncome >= minimumWageAfterTaxForHours && next.netIncome <= minimumWageAfterTaxForHours) {
      const ratio = (minimumWageAfterTaxForHours - next.netIncome) / (current.netIncome - next.netIncome)
      const minWageIncome = next.grossIncome + (current.grossIncome - next.grossIncome) * ratio
      return {
        income: minWageIncome,
        netIncome: minimumWageAfterTaxForHours,
      }
    }
  }
  
  // If no crossing found but we're within range, find the closest point
  let closestPoint = dataPoints[0]
  let closestDistance = Math.abs(dataPoints[0].netIncome - minimumWageAfterTaxForHours)
  
  for (const point of dataPoints) {
    const distance = Math.abs(point.netIncome - minimumWageAfterTaxForHours)
    if (distance < closestDistance) {
      closestDistance = distance
      closestPoint = point
    }
  }
  
  return {
    income: closestPoint.grossIncome,
    netIncome: closestPoint.netIncome,
  }
}

export function findPointForIncome(
  dataPoints: GraphDataPoint[],
  targetIncome: number
): GraphDataPoint | null {
  if (dataPoints.length === 0) return null
  
  for (let i = 0; i < dataPoints.length - 1; i++) {
    const current = dataPoints[i]
    const next = dataPoints[i + 1]
    
    if (current.grossIncome <= targetIncome && next.grossIncome >= targetIncome) {
      if (current.grossIncome === targetIncome) {
        return current
      }
      if (next.grossIncome === targetIncome) {
        return next
      }
      
      const ratio = (targetIncome - current.grossIncome) / (next.grossIncome - current.grossIncome)
      const netIncome = current.netIncome + (next.netIncome - current.netIncome) * ratio
      const afterTax = current.afterTax + (next.afterTax - current.afterTax) * ratio
      const childcareCost = current.childcareCost + (next.childcareCost - current.childcareCost) * ratio
      
      return {
        grossIncome: targetIncome,
        netIncome,
        afterTax,
        childcareCost,
      }
    }
  }
  
  return null
}

