import { describe, it, expect } from 'vitest'
import { calculateGraphData, findBreakEvenPoint } from './graphData'
import type { Child } from './subsidyCalculations'

describe('calculateGraphData', () => {
  const children: Child[] = [
    { age: 'under-school', hoursPerDay: 8, daysPerWeek: 5, hourlyRate: 15, isSecondOrLater: false },
    { age: 'under-school', hoursPerDay: 8, daysPerWeek: 5, hourlyRate: 15, isSecondOrLater: true },
  ]

  it('calculates graph data for range of incomes', () => {
    const data = calculateGraphData(90000, children, 80, 50000, 100000, 10000)
    
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].grossIncome).toBe(50000)
    expect(data[data.length - 1].grossIncome).toBe(100000)
  })

  it('calculates net income correctly', () => {
    const data = calculateGraphData(90000, children, 80, 80000, 80000, 1000)
    
    expect(data.length).toBe(1)
    expect(data[0].netIncome).toBeLessThan(data[0].grossIncome)
    expect(data[0].netIncome).toBeLessThan(data[0].afterTax)
  })

  it('handles empty children array', () => {
    const data = calculateGraphData(90000, [], 80, 50000, 100000, 10000)
    
    expect(data.length).toBeGreaterThan(0)
    expect(data[0].childcareCost).toBe(0)
  })
})

describe('findBreakEvenPoint', () => {
  it('finds break-even point when crossing zero', () => {
    const dataPoints = [
      { grossIncome: 50000, netIncome: -10000, afterTax: 40000, childcareCost: 50000 },
      { grossIncome: 60000, netIncome: -5000, afterTax: 50000, childcareCost: 55000 },
      { grossIncome: 70000, netIncome: 5000, afterTax: 60000, childcareCost: 55000 },
      { grossIncome: 80000, netIncome: 15000, afterTax: 70000, childcareCost: 55000 },
    ]
    
    const breakEven = findBreakEvenPoint(dataPoints)
    
    expect(breakEven).not.toBeNull()
    expect(breakEven?.income).toBeGreaterThan(60000)
    expect(breakEven?.income).toBeLessThan(70000)
  })

  it('returns null when no break-even point exists', () => {
    const dataPoints = [
      { grossIncome: 50000, netIncome: 10000, afterTax: 40000, childcareCost: 30000 },
      { grossIncome: 60000, netIncome: 15000, afterTax: 50000, childcareCost: 35000 },
    ]
    
    const breakEven = findBreakEvenPoint(dataPoints)
    
    expect(breakEven).toBeNull()
  })
})


