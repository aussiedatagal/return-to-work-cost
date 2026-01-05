import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock Chart.js since it uses canvas which doesn't work in jsdom
vi.mock('react-chartjs-2', () => ({
  Line: vi.fn().mockImplementation(() => {
    return React.createElement('div', { 'data-testid': 'mock-chartjs-chart' })
  }),
}))

