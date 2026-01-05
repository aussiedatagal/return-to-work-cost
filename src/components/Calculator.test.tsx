import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Calculator from './Calculator'

describe('Calculator', () => {
  it('renders the main heading', () => {
    render(<Calculator />)
    
    expect(screen.getByText(/the real cost of returning to work/i)).toBeInTheDocument()
  })

  it('renders income display sections', () => {
    render(<Calculator />)
    
    expect(screen.getAllByText(/already working parent/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/detailed breakdown/i)).toBeInTheDocument()
  })

  it('displays financial breakdown when expanded', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    const expandButton = screen.getByText(/detailed breakdown/i)
    await user.click(expandButton)
    
    expect(screen.getAllByText(/gross income/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/after tax/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/net income after childcare/i)).toBeInTheDocument()
  })

  it('displays childcare costs breakdown', () => {
    render(<Calculator />)
    
    expect(screen.getAllByText(/childcare costs/i).length).toBeGreaterThan(0)
  })

  it('allows changing parent returning to work income when modal is opened', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    // Find and click the configure button for parent returning to work
    const configureButtons = screen.getAllByTitle(/configure/i)
    const secondParentButton = configureButtons.find(btn => 
      btn.closest('[class*="bg-blue-50"]') !== null
    ) || configureButtons[1] // Fallback to second configure button
    
    if (secondParentButton) {
      await user.click(secondParentButton)
      
      const incomeInput = screen.getByLabelText(/parent returning to work income/i) as HTMLInputElement
      await user.clear(incomeInput)
      await user.type(incomeInput, '100000')
      
      expect(incomeInput.value).toBe('100000')
    }
  })

  it('allows adding a child when childcare modal is opened', async () => {
    const user = userEvent.setup()
    render(<Calculator />)
    
    // Find and click the configure button for childcare
    const configureButtons = screen.getAllByTitle(/configure/i)
    const childcareButton = configureButtons.find(btn => 
      btn.closest('[class*="bg-orange-50"]') !== null
    ) || configureButtons[2] // Fallback to third configure button (childcare)
    
    if (childcareButton) {
      await user.click(childcareButton)
      
      const addButton = screen.getByText(/add child/i)
      await user.click(addButton)
      
      expect(screen.getAllByText(/child \d/i).length).toBeGreaterThan(2)
    }
  })

})
