import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import IncomeGraph from './IncomeGraph'
import type { Child } from '../utils/subsidyCalculations'

// Mock Chart.js since it uses canvas which doesn't work in jsdom
vi.mock('react-chartjs-2', () => ({
  Line: vi.fn().mockImplementation(({ data }: any) => {
    return (
      <div
        data-testid="mock-chartjs-chart"
        data-chart-data={JSON.stringify(data)}
      >
        <canvas data-testid="mock-canvas" width="500" height="400" />
      </div>
    )
  }),
}))

describe('IncomeGraph', () => {
  const mockChildren: Child[] = [
    { age: 'under-school', hoursPerDay: 10, daysPerWeek: 5, hourlyRate: 18, isSecondOrLater: false },
    { age: 'under-school', hoursPerDay: 10, daysPerWeek: 5, hourlyRate: 18, isSecondOrLater: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the graph with title', () => {
    render(
      <IncomeGraph
        firstParentIncome={115024}
        children={mockChildren}
        activityHoursPerFortnight={80}
      />
    )
    
    expect(screen.getByText("Net Household Income Increase After Tax & Childcare")).toBeInTheDocument()
  })

  it('displays working for free point in legend when break-even exists', async () => {
    render(
      <IncomeGraph
        firstParentIncome={115024}
        children={mockChildren}
        activityHoursPerFortnight={80}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText(/Working for free/i)).toBeInTheDocument()
    })
  })

  it('shows "Based on" section with already working parent income', () => {
    render(
      <IncomeGraph
        firstParentIncome={115024}
        children={mockChildren}
        activityHoursPerFortnight={80}
      />
    )
    
    expect(screen.getByText(/Based on:/i)).toBeInTheDocument()
    expect(screen.getByText(/First parent income: \$115,024/i)).toBeInTheDocument()
  })

  it('displays children information', () => {
    render(
      <IncomeGraph
        firstParentIncome={115024}
        children={mockChildren}
        activityHoursPerFortnight={80}
      />
    )
    
    expect(screen.getByText(/2 children in care/i)).toBeInTheDocument()
  })

  it('renders without crashing with empty children array', () => {
    render(
      <IncomeGraph
        firstParentIncome={115024}
        children={[]}
        activityHoursPerFortnight={80}
      />
    )
    
    expect(screen.getByText("Net Household Income Increase After Tax & Childcare")).toBeInTheDocument()
  })

  it('renders chart component', async () => {
    render(
      <IncomeGraph
        firstParentIncome={115024}
        children={mockChildren}
        activityHoursPerFortnight={80}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByTestId('mock-chartjs-chart')).toBeInTheDocument()
    })
  })
})
