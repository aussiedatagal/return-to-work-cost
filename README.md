# The Real Cost of Returning to Work

**Interactive calculator showing how much a parent returning to work (often the mother) actually takes home after tax and childcare costs.**

[🌐 Live Site](https://aussiedatagal.github.io/return-to-work-cost/)

![Screenshot of the calculator showing net income graph](https://aussiedatagal.github.io/return-to-work-cost/screenshot.png)

## About

This calculator helps Australian families understand the real financial impact of a parent returning to work. It calculates net income after accounting for:

- Income tax (based on combined family income)
- Child Care Subsidy (CCS) based on family income
- Out-of-pocket childcare costs
- Activity test hours (determines subsidised hours)

The interactive graph shows how net income changes as the parent returning to work's income increases, revealing the break-even point and minimum wage equivalent.

## Features

- **Interactive Income Graph**: Visualize net income after tax and childcare costs
- **Break-even Point**: See exactly when returning to work becomes financially viable
- **Minimum Wage Equivalent**: Compare net income to minimum wage after deductions
- **Comprehensive CCS Calculation**: 
  - Family income-based subsidy percentage (0-90%)
  - Activity test hours (determines subsidised hours per fortnight)
  - Multiple children support (higher subsidy for second+ child)
  - Age-based hourly rate caps
  - Customizable childcare hours and rates
- **Detailed Breakdown**: See exactly where your money goes
- **Mobile-first Design**: Optimized for mobile devices

## How It Works

The calculator uses official Australian Government rates for 2025-26:

- **Child Care Subsidy**: Based on combined family income
  - **First child (standard rate)**:
    - Up to $85,279: 90% subsidy
    - $85,279 to $535,279: Subsidy decreases by 1% per $5,000
    - $535,279+: 0% subsidy
  - **Second+ children (higher rate)**:
    - Up to $143,273: 95% subsidy
    - $143,273 to $188,273: Subsidy decreases by 1% per $3,000 (from 95% to 80%)
    - $188,273 to $267,563: 80% subsidy
    - $267,563 to $357,563: Subsidy decreases by 1% per $3,000 (from 80% to 50%)
    - $357,563+: 50% subsidy (does not go to 0%)
- **Tax Rates**: Based on ATO individual income tax brackets
- **Activity Test & 3 Day Guarantee**: 
  - All CCS-eligible families receive minimum 72 hours per fortnight (3 Day Guarantee, effective January 5, 2026)
  - Families with 48+ activity hours per fortnight receive up to 100 hours per fortnight

## Development

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Testing

```bash
npm test -- --run
```

## Deployment

This project is deployed to GitHub Pages using GitHub Actions. The workflow automatically builds and deploys on push to the `main` branch.

## Sources

- [Services Australia - Child Care Subsidy](https://www.servicesaustralia.gov.au/child-care-subsidy)
- [Services Australia - Your number of children in care can affect your higher Child Care Subsidy](https://www.servicesaustralia.gov.au/your-number-children-care-can-affect-your-higher-child-care-subsidy?context=41186)
- [ATO - Individual Income Tax Rates](https://www.ato.gov.au/rates/individual-income-tax-rates)
- [Department of Education - Child Care Subsidy Hourly Rate Caps](https://www.education.gov.au/early-childhood/announcements/child-care-subsidy-hourly-rate-caps-are-changing-soon-0)
- [Department of Education - 3 Day Guarantee](https://www.education.gov.au/early-childhood/providers/child-care-subsidy/3-day-guarantee)

## License

This project is open source and available for educational purposes.

