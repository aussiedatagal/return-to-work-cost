import {
  calculateTotalCosts,
  type Child,
} from './subsidyCalculations'
import { calculateAfterTaxIncome } from './taxCalculations'

export interface SecondParentScenario {
  secondParentIncome: number
  firstParentIncome: number
  children: Child[]
  activityHoursPerFortnight: number
  secondParentHoursPerFortnight?: number // Actual hours worked by parent returning to work (for effective hourly rate calculation)
}

export interface FinancialBreakdown {
  secondParentGrossIncome: number
  secondParentAfterTax: number
  childcareCosts: {
    totalAnnual: number
    totalSubsidy: number
    outOfPocketAnnual: number
    outOfPocketPerDay: number
    childDetails: Array<{
      subsidyPercent: number
      subsidyAmount: number
      totalCost: number
      outOfPocket: number
      isSecondOrLater: boolean
      subsidisedHours: number
      unsubsidisedHours: number
      hoursPerDay: number
      daysPerWeek: number
    }>
  }
  netIncomeAfterChildcare: number
  effectiveHourlyRate: number
  percentageOfIncomeLost: number
}

export function calculateSecondParentScenario(
  scenario: SecondParentScenario
): FinancialBreakdown {
  const combinedIncome = scenario.firstParentIncome + scenario.secondParentIncome
  
  const costs = calculateTotalCosts(
    scenario.children,
    combinedIncome,
    scenario.activityHoursPerFortnight
  )
  
  const secondParentAfterTax = calculateAfterTaxIncome(scenario.secondParentIncome)
  
  // Convert fortnightly costs to annual: 26 fortnights = 52 weeks
  const childcareOutOfPocketAnnual = costs.totalChildcareOutOfPocket * 26
  
  const netIncomeAfterChildcare = secondParentAfterTax - childcareOutOfPocketAnnual
  
  // Calculate effective hourly rate based on parent returning to work's actual hours worked
  // Use secondParentHoursPerFortnight if provided, otherwise fall back to activityHoursPerFortnight
  const hoursPerFortnightForRate = scenario.secondParentHoursPerFortnight ?? scenario.activityHoursPerFortnight
  const annualWorkingHours = hoursPerFortnightForRate * 26
  const effectiveHourlyRate = annualWorkingHours > 0 
    ? netIncomeAfterChildcare / annualWorkingHours 
    : 0
  
  const percentageOfIncomeLost = ((scenario.secondParentIncome - netIncomeAfterChildcare) / scenario.secondParentIncome) * 100
  
  return {
    secondParentGrossIncome: scenario.secondParentIncome,
    secondParentAfterTax,
    childcareCosts: {
      // Convert fortnightly to annual (26 fortnights = 52 weeks)
      totalAnnual: costs.totalChildcareCost * 26,
      totalSubsidy: costs.totalChildcareSubsidy * 26,
      outOfPocketAnnual: childcareOutOfPocketAnnual,
      outOfPocketPerDay: costs.childcarePerDay,
      childDetails: costs.childDetails.map((detail, index) => ({
        subsidyPercent: detail.subsidyPercent,
        subsidyAmount: detail.subsidyAmount * 26,
        totalCost: detail.totalCost * 26,
        outOfPocket: detail.outOfPocket * 26,
        isSecondOrLater: scenario.children[index]?.isSecondOrLater || false,
        subsidisedHours: detail.subsidisedHours,
        unsubsidisedHours: detail.unsubsidisedHours,
        hoursPerDay: detail.hoursPerDay,
        daysPerWeek: detail.daysPerWeek,
      })),
    },
    netIncomeAfterChildcare,
    effectiveHourlyRate,
    percentageOfIncomeLost,
  }
}

