import { describe, it, expect } from 'vitest'
import {
  calculateSubsidyPercent,
  calculateSubsidisedHours,
  calculateChildSubsidy,
  calculateTotalCosts,
  BASE_INCOME,
  MAX_INCOME,
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

  it('returns 95% for income at or below base income for second child', () => {
    expect(calculateSubsidyPercent(BASE_INCOME, true)).toBe(95)
    expect(calculateSubsidyPercent(50000, true)).toBe(95)
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

  it('gives higher subsidy for second child', () => {
    const firstChild: Child = { ...baseChild, isSecondOrLater: false }
    const secondChild: Child = { ...baseChild, isSecondOrLater: true }
    
    const firstResult = calculateChildSubsidy(firstChild, BASE_INCOME, 80)
    const secondResult = calculateChildSubsidy(secondChild, BASE_INCOME, 80)
    
    expect(secondResult.subsidyPercent).toBeGreaterThan(firstResult.subsidyPercent)
    expect(secondResult.subsidyPercent).toBe(95)
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

