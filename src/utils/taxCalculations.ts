export function calculateIncomeTax(income: number): number {
  let tax = 0
  
  if (income <= 18200) {
    return 0
  }
  
  // 2025-26 tax rates (stage 3 revisions)
  // 0 – 18,200      : 0%
  // 18,201 – 45,000 : 16%
  // 45,001 – 135,000: 30%
  // 135,001 – 190,000: 37%
  // 190,001+        : 45%
  const firstBracket = Math.min(income - 18200, 26800)
  tax += firstBracket * 0.16

  if (income > 45000) {
    const secondBracket = Math.min(income - 45000, 90000)
    tax += secondBracket * 0.30
  }

  if (income > 135000) {
    const thirdBracket = Math.min(income - 135000, 55000)
    tax += thirdBracket * 0.37
  }

  if (income > 190000) {
    tax += (income - 190000) * 0.45
  }

  const lito = calculateLowIncomeTaxOffset(income)
  return Math.max(0, tax - lito)
}

function calculateMedicareLevy(income: number): number {
  // Medicare Levy is 2% of taxable income for 2025-26
  // Threshold for singles: $24,276 (no levy below this)
  // Shade-in range: $24,276 to $30,345 (reduces from 0% to 2%)
  // Above $30,345: full 2% levy
  const SINGLE_THRESHOLD = 24276
  const SINGLE_SHADE_IN_END = 30345
  
  if (income <= SINGLE_THRESHOLD) {
    return 0
  }
  
  if (income <= SINGLE_SHADE_IN_END) {
    // Shade-in: levy increases from 0% to 2% over the range
    const excess = income - SINGLE_THRESHOLD
    const shadeInRange = SINGLE_SHADE_IN_END - SINGLE_THRESHOLD
    const levyPercent = (excess / shadeInRange) * 0.02
    return income * levyPercent
  }
  
  // Full 2% levy for income above shade-in range
  return income * 0.02
}

export function calculateAfterTaxIncome(income: number): number {
  const incomeTax = calculateIncomeTax(income)
  const medicareLevy = calculateMedicareLevy(income)
  return income - incomeTax - medicareLevy
}

function calculateLowIncomeTaxOffset(income: number): number {
  if (income <= 37000) {
    return 700
  }
  if (income <= 45000) {
    return 700 - 0.05 * (income - 37000)
  }
  if (income <= 66667) {
    return 325 - 0.015 * (income - 45000)
  }
  return 0
}

