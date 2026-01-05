import { describe, it, expect } from 'vitest'
import { calculateSecondParentScenario, type SecondParentScenario } from './advocacyCalculator'

describe('calculateSecondParentScenario', () => {
  const baseScenario: SecondParentScenario = {
    firstParentIncome: 90000,
    secondParentIncome: 80000,
    activityHoursPerFortnight: 80,
    children: [
      {
        age: 'under-school',
        hoursPerDay: 8,
        daysPerWeek: 5,
        hourlyRate: 15,
        isSecondOrLater: false,
      },
      {
        age: 'under-school',
        hoursPerDay: 8,
        daysPerWeek: 5,
        hourlyRate: 15,
        isSecondOrLater: true,
      },
    ],
  }

  it('calculates after-tax income correctly', () => {
    const result = calculateSecondParentScenario(baseScenario)
    
    expect(result.secondParentAfterTax).toBeLessThan(result.secondParentGrossIncome)
    expect(result.secondParentAfterTax).toBeGreaterThan(0)
  })

  it('calculates childcare costs', () => {
    const result = calculateSecondParentScenario(baseScenario)
    
    expect(result.childcareCosts.outOfPocketAnnual).toBeGreaterThan(0)
    expect(result.childcareCosts.totalAnnual).toBeGreaterThan(result.childcareCosts.outOfPocketAnnual)
  })

  it('calculates net income after childcare', () => {
    const result = calculateSecondParentScenario(baseScenario)
    
    expect(result.netIncomeAfterChildcare).toBeLessThan(result.secondParentAfterTax)
    expect(result.netIncomeAfterChildcare).toBeGreaterThan(0)
  })

  it('calculates effective hourly rate', () => {
    const result = calculateSecondParentScenario(baseScenario)
    
    expect(result.effectiveHourlyRate).toBeGreaterThan(0)
    expect(result.effectiveHourlyRate).toBeLessThan(50)
  })

  it('calculates percentage of income lost', () => {
    const result = calculateSecondParentScenario(baseScenario)
    
    expect(result.percentageOfIncomeLost).toBeGreaterThan(0)
    expect(result.percentageOfIncomeLost).toBeLessThan(100)
  })

  it('shows significant income loss for typical scenario', () => {
    const result = calculateSecondParentScenario(baseScenario)
    
    expect(result.percentageOfIncomeLost).toBeGreaterThan(30)
  })

  it('uses income as-is for part-time work', () => {
    const partTimeScenario: SecondParentScenario = {
      ...baseScenario,
      secondParentIncome: 50000, // Total income
      secondParentHoursPerFortnight: 45, // Part-time (3 days/week)
    }
    
    const result = calculateSecondParentScenario(partTimeScenario)
    
    // Should use the income as-is (no conversion)
    expect(result.secondParentGrossIncome).toBe(50000)
  })

  it('calculates effective hourly rate using parent returning to work actual hours for part-time', () => {
    const partTimeScenario: SecondParentScenario = {
      ...baseScenario,
      secondParentIncome: 80000,
      secondParentHoursPerFortnight: 45, // Part-time
    }
    
    const result = calculateSecondParentScenario(partTimeScenario)
    
    // Effective hourly rate should be based on 45h/fortnight, not activity hours
    const annualHours = 45 * 26
    const expectedRate = result.netIncomeAfterChildcare / annualHours
    expect(result.effectiveHourlyRate).toBeCloseTo(expectedRate, 2)
  })

  it('falls back to activity hours for effective rate when parent returning to work hours not provided', () => {
    const scenario: SecondParentScenario = {
      ...baseScenario,
      // No secondParentHoursPerFortnight provided
    }
    
    const result = calculateSecondParentScenario(scenario)
    
    // Should use activityHoursPerFortnight (80) for calculation
    const annualHours = 80 * 26
    const expectedRate = result.netIncomeAfterChildcare / annualHours
    expect(result.effectiveHourlyRate).toBeCloseTo(expectedRate, 2)
  })
})


