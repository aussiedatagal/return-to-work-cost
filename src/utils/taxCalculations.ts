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

export function calculateAfterTaxIncome(income: number): number {
  return income - calculateIncomeTax(income)
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

