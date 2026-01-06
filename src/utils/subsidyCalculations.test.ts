import { describe, it, expect } from 'vitest'
import {
  calculateSubsidyPercent,
  calculateSubsidisedHours,
  calculateChildSubsidy,
  calculateTotalCosts,
  BASE_INCOME,
  MAX_INCOME,
  SECOND_CHILD_BASE_INCOME,
  HOURLY_RATE_CAP_UNDER_SCHOOL_AGE,
  HOURLY_RATE_CAP_SCHOOL_AGE,
  MIN_SUBSIDISED_HOURS,
  MAX_SUBSIDISED_HOURS,
  ACTIVITY_THRESHOLD_FOR_MAX_HOURS,
  type Child,
} from './subsidyCalculations'

describe('calculateSubsidyPercent', () => {
  it('returns 90% for income at or below base income for first child', () => {
    expect(calculateSubsidyPercent(BASE_INCOME, false)).toBe(90)
    expect(calculateSubsidyPercent(50000, false)).toBe(90)
  })

  it('returns 95% for income at or below second child base income ($143,273)', () => {
    expect(calculateSubsidyPercent(SECOND_CHILD_BASE_INCOME, true)).toBe(95)
    expect(calculateSubsidyPercent(50000, true)).toBe(95)
    expect(calculateSubsidyPercent(100000, true)).toBe(95)
    expect(calculateSubsidyPercent(143273, true)).toBe(95)
  })

  it('returns 0% for income at or above max income', () => {
    expect(calculateSubsidyPercent(MAX_INCOME, false)).toBe(0)
    expect(calculateSubsidyPercent(600000, false)).toBe(0)
  })

  it('decreases by 1% for every $5,000 above base income', () => {
    expect(calculateSubsidyPercent(BASE_INCOME + 5000, false)).toBe(89)
    expect(calculateSubsidyPercent(BASE_INCOME + 10000, false)).toBe(88)
    expect(calculateSubsidyPercent(BASE_INCOME + 20000, false)).toBe(86)
  })

  it('handles break-even calculation: $285,279 should give 50% for first child', () => {
    const income = 285279
    const percent = calculateSubsidyPercent(income, false)
    expect(percent).toBe(50)
  })

  describe('second child (higher rate) income brackets', () => {
    // Based on Services Australia examples and thresholds
    // Source: https://www.servicesaustralia.gov.au/your-number-children-care-can-affect-your-higher-child-care-subsidy?context=41186
    
    it('maintains 95% up to $143,273', () => {
      expect(calculateSubsidyPercent(0, true)).toBe(95)
      expect(calculateSubsidyPercent(50000, true)).toBe(95)
      expect(calculateSubsidyPercent(100000, true)).toBe(95)
      expect(calculateSubsidyPercent(143273, true)).toBe(95)
    })

    it('decreases by 1% per $3,000 between $143,273 and $188,273', () => {
      // At $146,273 (exactly $3,000 over): 94%
      expect(calculateSubsidyPercent(146273, true)).toBe(94)
      // At $149,273 (exactly $6,000 over): 93%
      expect(calculateSubsidyPercent(149273, true)).toBe(93)
      // At $152,273 (exactly $9,000 over): 92%
      expect(calculateSubsidyPercent(152273, true)).toBe(92)
      // At $188,273: should be 80%
      expect(calculateSubsidyPercent(188273, true)).toBe(80)
    })

    it('maintains 80% between $188,273 and $267,563', () => {
      expect(calculateSubsidyPercent(188273, true)).toBe(80)
      expect(calculateSubsidyPercent(200000, true)).toBe(80)
      expect(calculateSubsidyPercent(250000, true)).toBe(80)
      expect(calculateSubsidyPercent(267563, true)).toBe(80)
    })

    it('decreases by 1% per $3,000 between $267,563 and $357,563', () => {
      // At $270,563 (exactly $3,000 over): 79%
      expect(calculateSubsidyPercent(270563, true)).toBe(79)
      // At $273,563 (exactly $6,000 over): 78%
      expect(calculateSubsidyPercent(273563, true)).toBe(78)
      // At $300,000: should be around 69% (300000 - 267563 = 32437, 32437 / 3000 = 10.8 steps, so 80 - 10 = 70%)
      // Actually: (300000 - 267563) / 3000 = 10.8, floor = 10, so 80 - 10 = 70%
      expect(calculateSubsidyPercent(300000, true)).toBe(70)
      // At $357,563: should be 50%
      expect(calculateSubsidyPercent(357563, true)).toBe(50)
    })

    it('maintains 50% minimum for income above $357,563', () => {
      expect(calculateSubsidyPercent(357563, true)).toBe(50)
      expect(calculateSubsidyPercent(400000, true)).toBe(50)
      expect(calculateSubsidyPercent(500000, true)).toBe(50)
      expect(calculateSubsidyPercent(600000, true)).toBe(50)
      // Second+ children never go to 0%, they stay at 50%
    })

    it('handles worked example: income $150,000 for second child', () => {
      // Income: $150,000
      // Over $143,273: $150,000 - $143,273 = $6,727
      // Steps: $6,727 / $3,000 = 2.24, floor = 2
      // Subsidy: 95% - 2% = 93%
      expect(calculateSubsidyPercent(150000, true)).toBe(93)
    })

    it('handles worked example: income $200,000 for second child', () => {
      // Income: $200,000
      // This is in the flat 80% bracket ($188,273 to $267,563)
      expect(calculateSubsidyPercent(200000, true)).toBe(80)
    })

    it('handles worked example: income $300,000 for second child', () => {
      // Income: $300,000
      // Over $267,563: $300,000 - $267,563 = $32,437
      // Steps: $32,437 / $3,000 = 10.8, floor = 10
      // Subsidy: 80% - 10% = 70%
      expect(calculateSubsidyPercent(300000, true)).toBe(70)
    })
  })
})

describe('calculateSubsidisedHours', () => {
  it('returns minimum hours for activity below threshold', () => {
    expect(calculateSubsidisedHours(0)).toBe(MIN_SUBSIDISED_HOURS)
    expect(calculateSubsidisedHours(ACTIVITY_THRESHOLD_FOR_MAX_HOURS - 1)).toBe(MIN_SUBSIDISED_HOURS)
  })

  it('returns maximum hours for activity at or above threshold', () => {
    expect(calculateSubsidisedHours(ACTIVITY_THRESHOLD_FOR_MAX_HOURS)).toBe(MAX_SUBSIDISED_HOURS)
    expect(calculateSubsidisedHours(100)).toBe(MAX_SUBSIDISED_HOURS)
  })
})

describe('calculateChildSubsidy', () => {
  const baseChild: Child = {
    age: 'under-school',
    hoursPerDay: 8,
    daysPerWeek: 5,
    hourlyRate: 15,
    isSecondOrLater: false,
  }

  it('calculates subsidy for child under school age', () => {
    const result = calculateChildSubsidy(baseChild, BASE_INCOME, 80)
    expect(result.subsidyPercent).toBe(90)
    expect(result.hourlyRateCap).toBe(HOURLY_RATE_CAP_UNDER_SCHOOL_AGE)
    expect(result.subsidisedHoursPerFortnight).toBe(MAX_SUBSIDISED_HOURS)
  })

  it('calculates subsidy for school age child', () => {
    const child: Child = { ...baseChild, age: 'school-age' }
    const result = calculateChildSubsidy(child, BASE_INCOME, 80)
    expect(result.hourlyRateCap).toBe(HOURLY_RATE_CAP_SCHOOL_AGE)
  })

  it('applies hourly rate cap correctly', () => {
    const child: Child = { ...baseChild, hourlyRate: 20 }
    const result = calculateChildSubsidy(child, BASE_INCOME, 80)
    const expectedSubsidyPerHour = HOURLY_RATE_CAP_UNDER_SCHOOL_AGE * 0.9
    expect(result.subsidyPerHour).toBeCloseTo(expectedSubsidyPerHour, 2)
  })

  it('gives higher subsidy for second child at low income', () => {
    const firstChild: Child = { ...baseChild, isSecondOrLater: false }
    const secondChild: Child = { ...baseChild, isSecondOrLater: true }
    
    const firstResult = calculateChildSubsidy(firstChild, BASE_INCOME, 80)
    const secondResult = calculateChildSubsidy(secondChild, BASE_INCOME, 80)
    
    expect(secondResult.subsidyPercent).toBeGreaterThan(firstResult.subsidyPercent)
    expect(secondResult.subsidyPercent).toBe(95)
  })

  it('gives higher subsidy for second child at income between thresholds', () => {
    // At $100,000: first child gets reduced subsidy, second child still gets 95%
    const income = 100000
    const firstChild: Child = { ...baseChild, isSecondOrLater: false }
    const secondChild: Child = { ...baseChild, isSecondOrLater: true }
    
    const firstResult = calculateChildSubsidy(firstChild, income, 80)
    const secondResult = calculateChildSubsidy(secondChild, income, 80)
    
    // First child: $100,000 - $85,279 = $14,721, steps = 2, so 90% - 2% = 88%
    expect(firstResult.subsidyPercent).toBe(88)
    // Second child: still below $143,273, so 95%
    expect(secondResult.subsidyPercent).toBe(95)
    expect(secondResult.subsidyPercent).toBeGreaterThan(firstResult.subsidyPercent)
  })
})

describe('calculateTotalCosts', () => {
  const baseChild: Child = {
    age: 'under-school',
    hoursPerDay: 8,
    daysPerWeek: 5,
    hourlyRate: 15,
    isSecondOrLater: false,
  }

  it('calculates costs for single child', () => {
    const result = calculateTotalCosts(
      [baseChild],
      BASE_INCOME,
      80
    )
    
    expect(result.childDetails).toHaveLength(1)
    expect(result.totalChildcareCost).toBeGreaterThan(0)
    expect(result.totalChildcareSubsidy).toBeGreaterThan(0)
    expect(result.totalChildcareOutOfPocket).toBeLessThan(result.totalChildcareCost)
    expect(result.childcarePerDay).toBeGreaterThan(0)
  })

  it('calculates costs for multiple children', () => {
    const secondChild: Child = {
      ...baseChild,
      isSecondOrLater: true,
    }
    
    const result = calculateTotalCosts(
      [baseChild, secondChild],
      BASE_INCOME,
      80
    )
    
    expect(result.childDetails).toHaveLength(2)
    expect(result.totalChildcareCost).toBeGreaterThan(0)
    expect(result.totalChildcareSubsidy).toBeGreaterThan(0)
  })

  it('handles hours exceeding subsidised limit', () => {
    const child: Child = {
      ...baseChild,
      hoursPerDay: 12,
    }
    
    const result = calculateTotalCosts(
      [child],
      BASE_INCOME,
      30
    )
    
    const childDetail = result.childDetails[0]
    expect(childDetail.subsidisedHours).toBeLessThanOrEqual(MIN_SUBSIDISED_HOURS)
    expect(childDetail.unsubsidisedHours).toBeGreaterThan(0)
  })

  it('calculates childcare costs at 50% subsidy rate', () => {
    const hourlyRate = 15
    const hoursPerDay = 8
    const child: Child = {
      age: 'under-school',
      hoursPerDay,
      daysPerWeek: 5,
      hourlyRate,
      isSecondOrLater: false,
    }
    
    const income = 285279
    const result = calculateTotalCosts(
      [child],
      income,
      80
    )
    
    expect(result.childcarePerDay).toBeGreaterThan(50)
    expect(result.childcarePerDay).toBeLessThan(70)
  })
})

