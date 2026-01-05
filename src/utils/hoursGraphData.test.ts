import { describe, it, expect } from 'vitest'
import { calculateHoursGraphData, calculateDaysPerWeekFromHours, findBreakEvenHours, findMaxIncomePoint } from './hoursGraphData'
import type { Child } from './subsidyCalculations'

describe('hoursGraphData', () => {
  const baseChild: Child = {
    age: 'under-school',
    hoursPerDay: 10,
    daysPerWeek: 5,
    hourlyRate: 18,
    isSecondOrLater: false,
  }

  describe('calculateDaysPerWeekFromHours', () => {
    it('calculates days from hours correctly', () => {
      expect(calculateDaysPerWeekFromHours(0)).toBe(0)
      expect(calculateDaysPerWeekFromHours(7.5)).toBeCloseTo(1, 1)
      expect(calculateDaysPerWeekFromHours(15)).toBeCloseTo(2, 1)
      expect(calculateDaysPerWeekFromHours(37.5)).toBeCloseTo(5, 0)
    })
  })

  describe('calculateHoursGraphData', () => {
    it('calculates zero cost when hours are zero', () => {
      const result = calculateHoursGraphData(
        94103, // full-time income
        38, // full-time hours
        104496, // first parent income
        [baseChild],
        38, // first parent hours
        'two-parent'
      )

      const zeroHoursPoint = result.find(p => p.hoursPerWeek === 0)
      expect(zeroHoursPoint).toBeDefined()
      expect(zeroHoursPoint?.daysPerWeek).toBe(0)
      expect(zeroHoursPoint?.childcareCost).toBe(0)
      expect(zeroHoursPoint?.grossIncome).toBe(0)
      expect(zeroHoursPoint?.netIncome).toBe(0)
    })

    it('childcare cost scales with days per week', () => {
      const result = calculateHoursGraphData(
        94103,
        38,
        104496,
        [baseChild],
        38,
        'two-parent'
      )

      const halfTimePoint = result.find(p => Math.abs(p.hoursPerWeek - 19) < 0.1)
      const fullTimePoint = result.find(p => Math.abs(p.hoursPerWeek - 38) < 0.1)

      expect(halfTimePoint).toBeDefined()
      expect(fullTimePoint).toBeDefined()

      // Half-time should have roughly half the days per week
      expect(halfTimePoint?.daysPerWeek).toBeCloseTo(2.5, 0.5)
      expect(fullTimePoint?.daysPerWeek).toBeCloseTo(5, 0.5)

      // Childcare cost should scale roughly proportionally with days
      // (allowing for some variation due to tax brackets and subsidy changes)
      if (halfTimePoint && fullTimePoint && fullTimePoint.childcareCost > 0) {
        const ratio = halfTimePoint.childcareCost / fullTimePoint.childcareCost
        // Should be roughly half, but allow some variance due to subsidy/income changes
        expect(ratio).toBeGreaterThan(0.4)
        expect(ratio).toBeLessThan(0.6)
      }
    })

    it('income scales proportionally with hours', () => {
      const result = calculateHoursGraphData(
        94103,
        38,
        104496,
        [baseChild],
        38,
        'two-parent'
      )

      const halfTimePoint = result.find(p => Math.abs(p.hoursPerWeek - 19) < 0.1)
      const fullTimePoint = result.find(p => Math.abs(p.hoursPerWeek - 38) < 0.1)

      expect(halfTimePoint).toBeDefined()
      expect(fullTimePoint).toBeDefined()

      // Half-time should have roughly half the income
      if (halfTimePoint && fullTimePoint && fullTimePoint.grossIncome > 0) {
        const ratio = halfTimePoint.grossIncome / fullTimePoint.grossIncome
        expect(ratio).toBeCloseTo(0.5, 0.01)
      }
    })

    it('handles single parent scenario', () => {
      const result = calculateHoursGraphData(
        94103,
        38,
        0,
        [baseChild],
        0,
        'single-parent'
      )

      expect(result.length).toBeGreaterThan(0)
      const fullTimePoint = result.find(p => Math.abs(p.hoursPerWeek - 38) < 0.1)
      expect(fullTimePoint).toBeDefined()
      expect(fullTimePoint?.grossIncome).toBeGreaterThan(0)
    })
  })

  describe('findBreakEvenHours', () => {
    it('finds break-even point when it exists', () => {
      const result = calculateHoursGraphData(
        50000, // Lower income to make break-even more likely
        38,
        104496,
        [baseChild],
        38,
        'two-parent'
      )

      const breakEven = findBreakEvenHours(result)
      
      // Break-even might not always exist (if net income is always positive or always negative)
      // But if it does exist, verify it's correct
      if (breakEven) {
        expect(breakEven.netIncome).toBeCloseTo(0, 100) // Allow small variance
        expect(breakEven.hoursPerWeek).toBeGreaterThanOrEqual(0)
        expect(breakEven.hoursPerWeek).toBeLessThanOrEqual(38)
        expect(breakEven.daysPerWeek).toBeGreaterThanOrEqual(0)
      }
      // If breakEven is null, that's also valid - it means net income never crosses zero
    })
  })

  describe('findMaxIncomePoint', () => {
    it('finds the point with maximum net income', () => {
      const result = calculateHoursGraphData(
        94103,
        38,
        104496,
        [baseChild],
        38,
        'two-parent'
      )

      const maxPoint = findMaxIncomePoint(result)
      
      expect(maxPoint).toBeDefined()
      expect(maxPoint).not.toBeNull()
      
      if (maxPoint) {
        // Verify it's actually the maximum
        const allNetIncomes = result.map(p => p.netIncome)
        const actualMax = Math.max(...allNetIncomes)
        expect(maxPoint.netIncome).toBe(actualMax)
        
        // Verify the point has valid properties
        expect(maxPoint.hoursPerWeek).toBeGreaterThanOrEqual(0)
        expect(maxPoint.daysPerWeek).toBeGreaterThanOrEqual(0)
        expect(maxPoint.grossIncome).toBeGreaterThanOrEqual(0)
      }
    })

    it('returns null for empty array', () => {
      const maxPoint = findMaxIncomePoint([])
      expect(maxPoint).toBeNull()
    })
  })
})

