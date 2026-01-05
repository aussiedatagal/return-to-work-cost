import { describe, it, expect } from 'vitest'
import { calculateIncomeTax, calculateAfterTaxIncome } from './taxCalculations'

describe('calculateIncomeTax', () => {
  it('returns 0 for income below tax-free threshold', () => {
    expect(calculateIncomeTax(18000)).toBe(0)
    expect(calculateIncomeTax(0)).toBe(0)
  })

  it('calculates tax for income in first bracket', () => {
    const income = 30000
    const expectedTax = ((income - 18200) * 0.16) - 700
    expect(calculateIncomeTax(income)).toBeCloseTo(expectedTax, 2)
  })

  it('calculates tax for income in second bracket', () => {
    const income = 80000
    const tax = calculateIncomeTax(income)
    expect(tax).toBeGreaterThan(0)
    expect(tax).toBeLessThan(income * 0.5)
  })

  it('calculates tax for high income', () => {
    const income = 200000
    const tax = calculateIncomeTax(income)
    expect(tax).toBeGreaterThan(50000)
  })
})

describe('calculateAfterTaxIncome', () => {
  it('returns full income for tax-free threshold', () => {
    expect(calculateAfterTaxIncome(18000)).toBe(18000)
  })

  it('returns less than gross income for taxable income', () => {
    const income = 80000
    const afterTax = calculateAfterTaxIncome(income)
    expect(afterTax).toBeLessThan(income)
    expect(afterTax).toBeGreaterThan(income * 0.5)
  })

  it('calculates correctly for $80,000 income', () => {
    const income = 80000
    const afterTax = calculateAfterTaxIncome(income)
    expect(afterTax).toBeCloseTo(65212, 0)
  })
})

