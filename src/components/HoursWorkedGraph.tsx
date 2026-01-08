import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import SourceModal from './SourceModal'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ChartData
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { 
  calculateHoursGraphData, 
  findBreakEvenHours,
  findPointForHours,
  findMinimumWageIntersection,
  findMaxIncomePoint,
  calculateDaysPerWeekFromHours,
  calculateTotalCostsWithWorkDays,
  type HoursGraphDataPoint
} from '../utils/hoursGraphData'
import { calculateMinimumWageAfterTaxForHours } from '../utils/graphData'
import { MIN_SUBSIDISED_HOURS, MAX_SUBSIDISED_HOURS } from '../utils/subsidyCalculations'
import type { Child } from '../utils/subsidyCalculations'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface HoursWorkedGraphProps {
  secondParentIncome: number
  secondParentHoursPerWeek: number
  firstParentIncome: number
  firstParentHoursPerWeek: number
  children: Child[]
  familyType: 'two-parent' | 'single-parent'
  onConfigureSecondParentIncome?: () => void
  onConfigureChildren?: () => void
}

export default function HoursWorkedGraph({ 
  secondParentIncome,
  secondParentHoursPerWeek,
  firstParentIncome,
  firstParentHoursPerWeek,
  children,
  familyType,
  onConfigureSecondParentIncome,
  onConfigureChildren
}: HoursWorkedGraphProps) {
  const chartRef = useRef<ChartJS<'line'>>(null)
  const [selectedDayForBreakdown, setSelectedDayForBreakdown] = useState<number | null>(null)
  
  // Calculate max hours for graph:
  // - Always show at least 38 hours
  // - If working more than 38 hours, extend to 1 day past their hours (7.6 hours = 1 day)
  // - Cap at 7 days (53.2 hours)
  const maxHoursForGraph = useMemo(() => {
    const hoursPerDay = 7.6
    const maxDays = 7
    const maxHoursCap = maxDays * hoursPerDay // 53.2 hours
    
    if (secondParentHoursPerWeek <= 38) {
      return 38
    }
    
    // Extend to 1 day past their hours, but cap at 7 days
    const extendedHours = secondParentHoursPerWeek + hoursPerDay
    return Math.min(extendedHours, maxHoursCap)
  }, [secondParentHoursPerWeek])

  const graphData = useMemo(() => {
    return calculateHoursGraphData(
      secondParentIncome,
      secondParentHoursPerWeek,
      firstParentIncome,
      children,
      firstParentHoursPerWeek,
      familyType,
      maxHoursForGraph
    )
  }, [secondParentIncome, secondParentHoursPerWeek, firstParentIncome, firstParentHoursPerWeek, children, familyType, maxHoursForGraph])
  
  const breakEven = useMemo(() => {
    return findBreakEvenHours(graphData)
  }, [graphData])

  const currentHoursPoint = useMemo(() => {
    return findPointForHours(graphData, secondParentHoursPerWeek)
  }, [graphData, secondParentHoursPerWeek])

  const minWageIntersection = useMemo(() => {
    return findMinimumWageIntersection(graphData, calculateMinimumWageAfterTaxForHours)
  }, [graphData])

  const maxIncomePoint = useMemo(() => {
    return findMaxIncomePoint(graphData)
  }, [graphData])

  // Calculate breakdown for selected day (showing changes from previous day, or from 0 for day 1)
  const dayBreakdown = useMemo(() => {
    if (selectedDayForBreakdown === null) return null
    
    const hoursPerDay = 7.6
    const currentHours = selectedDayForBreakdown * hoursPerDay
    const currentPoint = findPointForHours(graphData, currentHours)
    
    if (!currentPoint) return null
    
    // For day 1, compare to 0 (no work). For other days, compare to previous day
    const isDayOne = selectedDayForBreakdown === 1
    const prevHours = isDayOne ? 0 : (selectedDayForBreakdown - 1) * hoursPerDay
    const prevPoint = isDayOne ? { grossIncome: 0, afterTax: 0, netIncome: 0, childcareCost: 0 } : findPointForHours(graphData, prevHours)
    
    if (!prevPoint && !isDayOne) return null
    
    // TypeScript guard: prevPoint is guaranteed to be non-null after the check above
    const safePrevPoint = prevPoint!
    
    // Calculate hourly rate
    const hourlyRate = secondParentHoursPerWeek > 0 ? secondParentIncome / (secondParentHoursPerWeek * 52) : 0
    const additionalGrossIncome = isDayOne ? currentPoint.grossIncome : (hourlyRate * hoursPerDay * 52)
    
    // Calculate tax change
    const currentTax = currentPoint.grossIncome - currentPoint.afterTax
    const prevTax = safePrevPoint.grossIncome - safePrevPoint.afterTax
    const additionalTax = currentTax - prevTax
    
    // Calculate days for previous day
    const prevDays = isDayOne ? 0 : calculateDaysPerWeekFromHours(prevHours)
    
    const currentIncomeForSubsidy = familyType === 'single-parent'
      ? currentPoint.grossIncome
      : (firstParentIncome + currentPoint.grossIncome)
    const prevIncomeForSubsidy = isDayOne ? (familyType === 'single-parent' ? 0 : firstParentIncome) : (familyType === 'single-parent' ? safePrevPoint.grossIncome : (firstParentIncome + safePrevPoint.grossIncome))
    
    // Calculate hours info first to determine actual subsidised hours
    const childHoursPerDay = children[0]?.hoursPerDay || 11
    const totalHoursPerDay = childHoursPerDay * children.length
    
    // Calculate actual subsidised hours for this specific day
    // Previous days used: prevDays * 11 hours per child * number of children
    const prevSubsidisedHoursUsed = prevDays * childHoursPerDay * children.length
    const remainingSubsidisedHours = Math.max(0, MAX_SUBSIDISED_HOURS - prevSubsidisedHoursUsed)
    const currentSubsidisedHoursPerDayTotal = Math.min(remainingSubsidisedHours, totalHoursPerDay)
    
    // Calculate subsidised hours per fortnight for cost calculation
    // The original approach calculates for full fortnight scenarios, but we need to account for cap
    const currentDays = calculateDaysPerWeekFromHours(currentHours)
    // Total subsidised hours available for current scenario (capped at 100)
    const currentSubsidisedHoursPerFortnight = Math.min(Math.max(currentDays * 22, MIN_SUBSIDISED_HOURS), MAX_SUBSIDISED_HOURS)
    // For previous scenario
    const prevSubsidisedHoursPerFortnight = isDayOne ? 0 : Math.min(Math.max(prevDays * 22, MIN_SUBSIDISED_HOURS), MAX_SUBSIDISED_HOURS)
    
    const currentChildren = children.map(child => ({ ...child, daysPerWeek: currentDays }))
    const prevChildren = isDayOne ? children.map(child => ({ ...child, daysPerWeek: 0 })) : children.map(child => ({ ...child, daysPerWeek: prevDays }))
    
    const currentCosts = calculateTotalCostsWithWorkDays(currentChildren, currentIncomeForSubsidy, currentSubsidisedHoursPerFortnight)
    const prevCosts = isDayOne ? { totalChildcareCost: 0, totalChildcareSubsidy: 0, childDetails: [] } : calculateTotalCostsWithWorkDays(prevChildren, prevIncomeForSubsidy, prevSubsidisedHoursPerFortnight)
    
    const additionalChildcare = (currentCosts.totalChildcareCost - (prevCosts.totalChildcareCost || 0)) * 26
    const subsidyChange = (currentCosts.totalChildcareSubsidy - (prevCosts.totalChildcareSubsidy || 0)) * 26
    
    const prevSubsidisedHoursUsedForPrevDay = Math.max(0, (prevDays - 1) * childHoursPerDay * children.length)
    const remainingSubsidisedHoursForPrevDay = Math.max(0, MAX_SUBSIDISED_HOURS - prevSubsidisedHoursUsedForPrevDay)
    const prevSubsidisedHoursPerDayTotal = isDayOne ? 0 : Math.min(remainingSubsidisedHoursForPrevDay, totalHoursPerDay)
    const subsidisedHoursChange = currentSubsidisedHoursPerDayTotal - prevSubsidisedHoursPerDayTotal
    
    const isAtSubsidyCap = remainingSubsidisedHours < totalHoursPerDay && prevSubsidisedHoursPerDayTotal >= totalHoursPerDay && (!isDayOne)
    const isPartiallySubsidised = remainingSubsidisedHours < totalHoursPerDay
    
    const subsidyPercent = currentCosts.childDetails[0]?.subsidyPercent || 0
    
    return {
      day: selectedDayForBreakdown,
      additionalIncome: additionalGrossIncome,
      additionalTax,
      additionalChildcare,
      subsidyChange,
      netChange: currentPoint.netIncome - safePrevPoint.netIncome,
      isAtSubsidyCap,
      isPartiallySubsidised,
      subsidisedHoursChange,
      subsidyPercent,
      currentSubsidisedHoursPerDay: currentSubsidisedHoursPerDayTotal,
      totalHoursPerDay
    }
  }, [selectedDayForBreakdown, graphData, children, familyType, firstParentIncome, secondParentIncome, secondParentHoursPerWeek])

  // Calculate actual childcare costs for current hours (using work-day-based subsidised hours to match graph)
  const childcareCosts = useMemo(() => {
    const daysPerWeek = calculateDaysPerWeekFromHours(secondParentHoursPerWeek)
    const childrenForCalculation = children.map(child => ({
      ...child,
      daysPerWeek: daysPerWeek
    }))
    
    // Calculate income for subsidy (combined for two-parent, single for single-parent)
    const incomeForSubsidy = familyType === 'single-parent'
      ? secondParentIncome
      : (firstParentIncome + secondParentIncome)
    
    // Calculate subsidised hours based on work days (same logic as graph)
    // 1 day of work (7.6h) = 11 hours of subsidised care per week = 22 hours per fortnight
    const subsidisedHoursPerFortnightFromWorkDays = Math.min(Math.max(daysPerWeek * 22, MIN_SUBSIDISED_HOURS), MAX_SUBSIDISED_HOURS)
    
    const costs = calculateTotalCostsWithWorkDays(childrenForCalculation, incomeForSubsidy, subsidisedHoursPerFortnightFromWorkDays)
    
    return {
      daysPerWeek,
      totalAnnualCost: Math.round(costs.totalChildcareCost * 26),
      totalAnnualOutOfPocket: Math.round(costs.totalChildcareOutOfPocket * 26),
      totalAnnualSubsidy: Math.round(costs.totalChildcareSubsidy * 26),
      children: childrenForCalculation
    }
  }, [secondParentHoursPerWeek, children, familyType, firstParentIncome, secondParentIncome, firstParentHoursPerWeek])

  // Calculate minimum wage line data (needed for y-axis range calculation)
  const minimumWageData = useMemo(() => {
    return graphData.map(d => {
      const minWageForHours = calculateMinimumWageAfterTaxForHours(d.hoursPerWeek)
      return { x: d.hoursPerWeek, y: minWageForHours }
    })
  }, [graphData])
  
  // Detect mobile view
  const [isMobile, setIsMobile] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  if (graphData.length === 0) {
    return null
  }
  
  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`
    }
    return `$${value.toFixed(0)}`
  }
  
  // Calculate min/max across all three lines: net income, after tax (without childcare), and minimum wage
  const minNet = graphData.reduce((min, d) => Math.min(min, d.netIncome), graphData[0]?.netIncome ?? 0)
  const maxNet = graphData.reduce((max, d) => Math.max(max, d.netIncome), graphData[0]?.netIncome ?? 0)
  
  const minAfterTax = graphData.reduce((min, d) => Math.min(min, d.afterTax), graphData[0]?.afterTax ?? 0)
  const maxAfterTax = graphData.reduce((max, d) => Math.max(max, d.afterTax), graphData[0]?.afterTax ?? 0)
  
  const minWageValues = minimumWageData.map(d => d.y)
  const minMinWage = Math.min(...minWageValues)
  const maxMinWage = Math.max(...minWageValues)
  
  // Find overall min and max across all datasets
  const overallMin = Math.min(minNet, minAfterTax, minMinWage)
  const overallMax = Math.max(maxNet, maxAfterTax, maxMinWage)
  
  const roundToNearest = (value: number, nearest: number) => {
    return Math.floor(value / nearest) * nearest
  }
  
  const roundUpToNearest = (value: number, nearest: number) => {
    return Math.ceil(value / nearest) * nearest
  }
  
  const range = Math.max(0, overallMax) - Math.min(0, overallMin)
  const tickInterval = range <= 20000 ? 5000 : range <= 50000 ? 10000 : 20000
  
  const yMin = roundToNearest(Math.min(0, overallMin) * 1.1, tickInterval)
  const yMax = roundUpToNearest(Math.max(0, overallMax) * 1.1, tickInterval)

  const chartData: ChartData<'line'> = {
    datasets: [
      {
        label: 'Net Income',
        data: graphData.map(d => ({ x: d.hoursPerWeek, y: d.netIncome })),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        pointHoverBorderWidth: 0,
        pointHoverBorderColor: '#ffffff',
        pointHoverBackgroundColor: '#3b82f6',
        parsing: false,
      },
      {
        label: 'Income without childcare (after tax)',
        data: graphData.map(d => ({ x: d.hoursPerWeek, y: d.afterTax })),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [3, 3],
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        parsing: false,
      },
      {
        label: 'Minimum Wage (after tax)',
        data: minimumWageData,
        borderColor: '#ef4444',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
        parsing: false,
      }
    ]
  }

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        left: isMobile ? 0 : 5,
        right: isMobile ? 0 : 5,
        top: 5,
        bottom: 5,
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
    events: ['click', 'mousemove', 'mouseout', 'mouseleave'],
    onClick: (event, _elements, chart) => {
      const nativeEvent = (event as any)?.native ?? event
      const nearest = chart.getElementsAtEventForMode(nativeEvent, 'nearest', { intersect: false }, true)
      if (!nearest.length) return
      const { index } = nearest[0]
      const point = graphData[index]
      const x = chart.scales.x.getPixelForValue(point.hoursPerWeek)
      const y = chart.scales.y.getPixelForValue(point.netIncome)
      const note = point.netIncome < 0 ? 'Childcare costs more than families earn.' : undefined
      const { takeHome, lines } = buildLinesFromPoint(point)
      setSelectedTooltip({
        x,
        y,
        title: `${point.hoursPerWeek.toFixed(1)} hours/week (${point.daysPerWeek.toFixed(1)} days/week)`,
        takeHome,
        lines,
        note,
        color: 'neutral'
      })
    },
    plugins: {
      legend: {
        display: false, // We show legend manually below the chart
      },
      tooltip: {
        enabled: false,
      },
    },
    onHover: (event, activeElements) => {
      const target = event.native?.target as HTMLElement
      if (target) {
        target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default'
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Hours per week',
          font: {
            size: 12,
          },
          color: '#6b7280',
          padding: { top: 10, bottom: 0 },
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 0,
          stepSize: 7.6, // 1 work day
          callback: function(value) {
            const numValue = typeof value === 'number' ? value : parseFloat(value.toString())
            // Only show ticks at multiples of 7.6 (1 work day)
            const remainder = Math.abs(numValue % 7.6)
            if (remainder < 0.1 || remainder > 7.5) {
              const days = Math.round(numValue / 7.6)
              if (days === 0) {
                return '0h'
              }
              // Return array for multi-line label (Chart.js supports this)
              return [`${numValue.toFixed(1)}h`, `${days} ${days === 1 ? 'day' : 'days'}`]
            }
            return ''
          },
        },
        min: 0,
        max: maxHoursForGraph,
        grid: {
          color: '#e5e7eb',
          display: true,
        },
      },
      y: {
        title: {
          display: true,
          text: 'Net income',
          font: {
            size: isMobile ? 11 : 12,
          },
          color: '#6b7280',
          padding: isMobile ? { top: 0, bottom: 5 } : { top: 0, bottom: 10 },
        },
        ticks: {
          color: '#6b7280',
          font: {
            size: isMobile ? 10 : 11,
          },
          padding: isMobile ? 2 : 8,
          callback: function(value) {
            const numValue = typeof value === 'number' ? value : parseFloat(value.toString())
            return formatCurrency(numValue)
          },
        },
        min: yMin,
        max: yMax,
        grid: {
          color: '#e5e7eb',
          display: true,
        },
      },
    },
  }

  const [markerPositions, setMarkerPositions] = useState<{
    breakEven?: { x: number; y: number }
    current?: { x: number; y: number }
    minWageIntersection?: { x: number; y: number }
    maxIncome?: { x: number; y: number }
    chartArea?: { left: number; right: number; top: number; bottom: number }
    breakEvenLineY?: number
  }>({})
  
  type TooltipData = {
    x: number
    y: number
    title: string
    takeHome: string
    lines: string[]
    note?: string
    color: 'amber' | 'red' | 'blue' | 'green' | 'purple' | 'neutral'
  }
  const [selectedTooltip, setSelectedTooltip] = useState<TooltipData | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number; hours: number; netIncome: number } | null>(null)
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [negativeIncreaseModalOpen, setNegativeIncreaseModalOpen] = useState(false)
  const [howToReadModalOpen, setHowToReadModalOpen] = useState(false)

  const buildLinesFromPoint = useCallback((point: HoursGraphDataPoint) => {
    const netIncomeVal = Math.round(point.netIncome)
    const taxVal = Math.round(point.grossIncome - point.afterTax)
    const childcareVal = Math.round(point.childcareCost)
    const netIncome = netIncomeVal >= 0
      ? `$${netIncomeVal.toLocaleString()}`
      : `-$${Math.abs(netIncomeVal).toLocaleString()}`
    return {
      takeHome: `Net income: ${netIncome}`,
      lines: [
        `Tax: $${taxVal.toLocaleString()}`,
        `Childcare: $${childcareVal.toLocaleString()}`,
      ]
    }
  }, [])

  const recalcMarkerPositions = useCallback(() => {
    if (!chartRef.current) return
    const chart = chartRef.current
    const chartArea = chart.chartArea
    if (!chartArea || !chart.scales.x || !chart.scales.y) return

    const xScale = chart.scales.x
    const yScale = chart.scales.y

    const positions: typeof markerPositions = {
      chartArea: {
        left: chartArea.left,
        right: chartArea.right,
        top: chartArea.top,
        bottom: chartArea.bottom,
      },
    }

    if (breakEven) {
      positions.breakEven = {
        x: xScale.getPixelForValue(breakEven.hoursPerWeek),
        y: yScale.getPixelForValue(0),
      }
      positions.breakEvenLineY = yScale.getPixelForValue(0)
    }

    if (currentHoursPoint) {
      positions.current = {
        x: xScale.getPixelForValue(currentHoursPoint.hoursPerWeek),
        y: yScale.getPixelForValue(currentHoursPoint.netIncome),
      }
    }

    if (minWageIntersection) {
      positions.minWageIntersection = {
        x: xScale.getPixelForValue(minWageIntersection.hoursPerWeek),
        y: yScale.getPixelForValue(minWageIntersection.netIncome),
      }
    }

    if (maxIncomePoint) {
      positions.maxIncome = {
        x: xScale.getPixelForValue(maxIncomePoint.hoursPerWeek),
        y: yScale.getPixelForValue(maxIncomePoint.netIncome),
      }
    }

    setMarkerPositions(positions)
  }, [breakEven, currentHoursPoint, minWageIntersection, maxIncomePoint])

  useEffect(() => {
    recalcMarkerPositions()
    const timer = setTimeout(recalcMarkerPositions, 50)
    window.addEventListener('resize', recalcMarkerPositions)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', recalcMarkerPositions)
    }
  }, [recalcMarkerPositions, graphData])

  // Handle mouse move for hover marker
  useEffect(() => {
    if (!chartRef.current) return
    
    const chart = chartRef.current
    const canvas = chart.canvas
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!chart.chartArea || !chart.scales.x || !chart.scales.y) {
        setHoverPosition(null)
        return
      }
      
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left
      const xValue = chart.scales.x.getValueForPixel(x)
      
      if (xValue === undefined || xValue === null ||
          xValue < 0 || xValue > maxHoursForGraph || 
          x < chart.chartArea.left || 
          x > chart.chartArea.right) {
        setHoverPosition(null)
        return
      }
      
      const closestPoint = graphData.reduce((prev, curr) => {
        return Math.abs(curr.hoursPerWeek - xValue) < Math.abs(prev.hoursPerWeek - xValue) ? curr : prev
      })
      
      const y = chart.scales.y.getPixelForValue(closestPoint.netIncome)
      
      setHoverPosition({
        x: x,
        y: y,
        hours: xValue,
        netIncome: closestPoint.netIncome
      })
    }
    
    const handleMouseLeave = () => {
      setHoverPosition(null)
    }
    
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [chartRef, graphData, maxHoursForGraph])

  useEffect(() => {
    const frame1 = requestAnimationFrame(recalcMarkerPositions)
    const frame2 = requestAnimationFrame(recalcMarkerPositions)
    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
    }
  }, [recalcMarkerPositions, graphData])

  useEffect(() => {
    if (!selectedTooltip) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('button[aria-label*="point"]') || target.closest('.tooltip-container')) {
        return
      }
      setSelectedTooltip(null)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedTooltip])
  
  return (
    <div className="bg-white rounded-lg p-2 md:p-6 border border-gray-200">
      {/* Incremental Income Table */}
      <div className="mb-4 md:mb-6">
        <h4 className="text-sm md:text-base font-semibold text-gray-900 mb-3 text-center">Net Household Income Increase Per Additional Day Worked</h4>
        <div className="overflow-x-auto -mx-2 md:mx-0 px-2 md:px-0">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-2 px-1 md:px-2 font-semibold text-gray-700">Days</th>
                <th className="text-left py-2 px-1 md:px-2 font-semibold text-gray-700 hidden sm:table-cell">Hours</th>
                <th className="text-right py-2 px-1 md:px-2 font-semibold text-gray-700">
                  <div className="flex items-center justify-end gap-1">
                    <span className="hidden md:inline">Net Household Income Increase</span>
                    <span className="md:hidden">Income Increase</span>
                    <button
                      type="button"
                      onClick={() => setInfoModalOpen(true)}
                      className="text-blue-600 hover:text-blue-800 w-3 h-3 md:w-4 md:h-4 flex items-center justify-center flex-shrink-0"
                      title="Info about net income calculation"
                      aria-label="Info about net income calculation"
                    >
                      <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </th>
                <th className="text-right py-2 px-1 md:px-2 font-semibold text-gray-700">
                  <span className="hidden md:inline">Daily change</span>
                  <span className="md:hidden">Change</span>
                </th>
                <th className="text-center py-2 px-1 md:px-2 font-semibold text-gray-700">View</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Get data points for each day (multiples of 7.6 hours)
                // Include up to 7 days if graph extends that far
                const hoursPerDay = 7.6
                const maxDays = maxHoursForGraph >= 53.2 ? 7 : (maxHoursForGraph >= 45.6 ? 6 : 5)
                const dayPoints: Array<{ 
                  days: number
                  hours: number
                  point: HoursGraphDataPoint | null
                  increase: number | null
                }> = []
                
                for (let days = 1; days <= maxDays; days++) {
                  const hours = days * hoursPerDay
                  const point = findPointForHours(graphData, hours)
                  let increase: number | null = null
                  
                  if (point && days > 1) {
                    const prevPoint = findPointForHours(graphData, (days - 1) * hoursPerDay)
                    if (prevPoint) {
                      increase = point.netIncome - prevPoint.netIncome
                    }
                  }
                  // First day (days === 1) doesn't show an increase since there's no previous day to compare to
                  
                  dayPoints.push({ 
                    days, 
                    hours, 
                    point, 
                    increase
                  })
                }
                
                return dayPoints.map(({ days, hours, point, increase }) => (
                  <tr key={days} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-2 px-1 md:px-2 text-gray-900 font-medium">{days}</td>
                    <td className="py-2 px-1 md:px-2 text-gray-700 hidden sm:table-cell">{hours.toFixed(1)}h</td>
                    <td className="py-2 px-1 md:px-2 text-right text-gray-900 font-medium">
                      {point ? `$${Math.round(point.netIncome).toLocaleString()}` : '-'}
                    </td>
                    <td className={`py-2 px-1 md:px-2 text-right font-medium ${
                      increase !== null && increase < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {increase !== null 
                        ? `${increase >= 0 ? '+' : ''}$${Math.round(increase).toLocaleString()}`
                        : ''
                      }
                    </td>
                    <td className="py-2 px-1 md:px-2 text-center">
                      {point ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDayForBreakdown(days)
                            setNegativeIncreaseModalOpen(true)
                          }}
                          className="text-blue-600 hover:text-blue-800 underline text-xs"
                          title="View breakdown"
                          aria-label={`View breakdown for day ${days}`}
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-500 mt-3">
          <p className="mb-2">Why the drop? Two reasons:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Higher family income lowers your subsidy percentage for every day of care, not just the new one</li>
            <li>The 100-hour cap means that often the final hours of a full-time fortnight are completely unsubsidised</li>
          </ul>
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-2 mb-2 md:mb-4">
        <h3 className="text-sm md:text-xl font-semibold text-gray-900 px-1 md:px-0 text-center">
          Net Household Income Increase by Hours Worked Per Week
        </h3>
        <button
          type="button"
          onClick={() => setHowToReadModalOpen(true)}
          className="text-blue-600 hover:text-blue-800 w-4 h-4 md:w-5 md:h-5 flex items-center justify-center flex-shrink-0"
          title="How to read this graph"
          aria-label="How to read this graph"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
      
      <div className="w-full relative md:h-[420px] h-[400px] min-h-[400px]">
        <div 
          className="relative z-10 h-full"
          onMouseLeave={() => setHoverPosition(null)}
        >
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </div>
        
        {/* Hover Markers */}
        {hoverPosition && markerPositions.chartArea && (
          <>
            <div 
              className="absolute z-15 pointer-events-none"
              style={{
                left: `${hoverPosition.x}px`,
                top: `${markerPositions.chartArea.top}px`,
                width: '2px',
                height: `${markerPositions.chartArea.bottom - markerPositions.chartArea.top}px`,
              }}
            >
              <div className="w-full h-full bg-gray-400 opacity-50" />
            </div>
            <div 
              className="absolute z-15 pointer-events-none"
              style={{
                left: `${markerPositions.chartArea.left}px`,
                top: `${hoverPosition.y}px`,
                width: `${markerPositions.chartArea.right - markerPositions.chartArea.left}px`,
                height: '2px',
              }}
            >
              <div className="w-full h-full bg-gray-400 opacity-50" />
            </div>
          </>
        )}
        
        {/* Horizontal Lines */}
        {markerPositions.chartArea && (
          <>
            {/* Break Even Horizontal Line */}
            {breakEven && markerPositions.breakEvenLineY !== undefined && (
              <div 
                className="absolute z-20 pointer-events-auto cursor-pointer touch-manipulation"
                style={{
                  left: `${markerPositions.chartArea.left}px`,
                  top: `${markerPositions.breakEvenLineY - 1}px`,
                  width: `${markerPositions.chartArea.right - markerPositions.chartArea.left}px`,
                  height: '2px',
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (breakEven) {
                    const { takeHome, lines } = buildLinesFromPoint(breakEven)
                    setSelectedTooltip({
                      x: markerPositions.breakEven!.x,
                      y: markerPositions.breakEvenLineY!,
                      title: `${breakEven.hoursPerWeek.toFixed(1)} hours/week (${breakEven.daysPerWeek.toFixed(1)} days/week)`,
                      takeHome,
                      lines,
                      note: 'Household net income does not increase.',
                      color: 'amber'
                    })
                  }
                }}
                aria-label="Break-even point (no net income gain)"
              >
                <div className="w-full h-full bg-amber-500" />
              </div>
            )}
            
          </>
        )}

        {/* Clickable Markers */}
        {markerPositions.chartArea && (
          <div className="absolute inset-0 z-20 pointer-events-none">

            {/* Current Hours Marker */}
            {currentHoursPoint && markerPositions.current && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (currentHoursPoint) {
                    const minimumWageForHours = calculateMinimumWageAfterTaxForHours(currentHoursPoint.hoursPerWeek)
                    let note: string | undefined
                    if (currentHoursPoint.netIncome < 0) {
                      note = 'Families are losing money by working.'
                    } else if (currentHoursPoint.netIncome === 0) {
                      note = 'Household net income does not increase.'
                    } else if (currentHoursPoint.netIncome < minimumWageForHours) {
                      note = 'Families are earning less than minimum wage.'
                    }
                    const { takeHome, lines } = buildLinesFromPoint(currentHoursPoint)
                    setSelectedTooltip({
                      x: markerPositions.current!.x,
                      y: markerPositions.current!.y,
                      title: `${currentHoursPoint.hoursPerWeek.toFixed(1)} hours/week (${currentHoursPoint.daysPerWeek.toFixed(1)} days/week)`,
                      takeHome,
                      lines,
                      note,
                      color: 'blue'
                    })
                  }
                }}
                className="absolute cursor-pointer touch-manipulation pointer-events-auto"
                style={{
                  left: `${markerPositions.current.x - (isMobile ? 5 : 8)}px`,
                  top: `${markerPositions.current.y - (isMobile ? 5 : 8)}px`,
                  width: isMobile ? '10px' : '16px',
                  height: isMobile ? '10px' : '16px',
                }}
                aria-label="Current hours point"
              >
                <div className={`${isMobile ? 'w-2.5 h-2.5 border' : 'w-4 h-4 border-2'} rounded-full bg-blue-500 border-white shadow-lg hover:scale-125 transition-transform`} />
              </button>
            )}


            {/* Minimum Wage Intersection Marker */}
            {minWageIntersection && markerPositions.minWageIntersection && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (minWageIntersection) {
                    const intersectionPoint = findPointForHours(graphData, minWageIntersection.hoursPerWeek)
                    if (intersectionPoint) {
                      const { takeHome, lines } = buildLinesFromPoint(intersectionPoint)
                      const note = `At this point, net income (after tax and childcare) equals minimum wage (after tax without childcare) for the hours worked.`
                      setSelectedTooltip({
                        x: markerPositions.minWageIntersection!.x,
                        y: markerPositions.minWageIntersection!.y,
                        title: `${minWageIntersection.hoursPerWeek.toFixed(1)} hours/week (${minWageIntersection.daysPerWeek.toFixed(1)} days/week)`,
                        takeHome,
                        lines,
                        note,
                        color: 'red'
                      })
                    }
                  }
                }}
                className="absolute cursor-pointer touch-manipulation pointer-events-auto"
                style={{
                  left: `${markerPositions.minWageIntersection.x - (isMobile ? 5 : 8)}px`,
                  top: `${markerPositions.minWageIntersection.y - (isMobile ? 5 : 8)}px`,
                  width: isMobile ? '10px' : '16px',
                  height: isMobile ? '10px' : '16px',
                }}
                aria-label="Minimum wage intersection point"
              >
                <div className={`${isMobile ? 'w-2.5 h-2.5 border' : 'w-4 h-4 border-2'} rounded-full bg-red-500 border-white shadow-lg hover:scale-125 transition-transform`} />
              </button>
            )}

            {/* Maximum Income Marker */}
            {maxIncomePoint && markerPositions.maxIncome && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (maxIncomePoint) {
                    const { takeHome, lines } = buildLinesFromPoint(maxIncomePoint)
                    const hoursText = maxIncomePoint.hoursPerWeek.toFixed(1)
                    const daysText = maxIncomePoint.daysPerWeek.toFixed(1)
                    const note = 'This is the point where household income increase is highest. Working more hours beyond this point results in lower household income increase.'
                    setSelectedTooltip({
                      x: markerPositions.maxIncome!.x,
                      y: markerPositions.maxIncome!.y,
                      title: `${hoursText} hours/week\n(${daysText} days/week)`,
                      takeHome,
                      lines,
                      note,
                      color: 'purple'
                    })
                  }
                }}
                className="absolute cursor-pointer touch-manipulation pointer-events-auto"
                style={{
                  left: `${markerPositions.maxIncome.x - (isMobile ? 5 : 8)}px`,
                  top: `${markerPositions.maxIncome.y - (isMobile ? 5 : 8)}px`,
                  width: isMobile ? '10px' : '16px',
                  height: isMobile ? '10px' : '16px',
                }}
                aria-label="Maximum income point"
              >
                <div className={`${isMobile ? 'w-2.5 h-2.5 border' : 'w-4 h-4 border-2'} rounded-full bg-purple-500 border-white shadow-lg hover:scale-125 transition-transform`} />
              </button>
            )}
          </div>
        )}

        {/* Tooltip/Popup */}
        {selectedTooltip && markerPositions.chartArea && (
          <>
            {(() => {
              const pos = selectedTooltip
              const chartArea = markerPositions.chartArea!
              const tooltipWidth = 180
              const tooltipHeight = 90

              let tooltipLeft = pos.x + 12
              let tooltipTop = pos.y - tooltipHeight / 2

              if (tooltipLeft + tooltipWidth > chartArea.right) {
                tooltipLeft = pos.x - tooltipWidth - 12
              }
              if (tooltipTop + tooltipHeight > chartArea.bottom) {
                tooltipTop = chartArea.bottom - tooltipHeight - 8
              }
              if (tooltipTop < chartArea.top) {
                tooltipTop = chartArea.top + 8
              }
              if (tooltipLeft < chartArea.left) {
                tooltipLeft = chartArea.left + 8
              }

              const bgColorClass = pos.color === 'amber' ? 'bg-amber-500 border-amber-600' 
                : pos.color === 'red' ? 'bg-red-500 border-red-600'
                : pos.color === 'blue' ? 'bg-blue-500 border-blue-600'
                : pos.color === 'green' ? 'bg-green-500 border-green-600'
                : pos.color === 'purple' ? 'bg-purple-500 border-purple-600'
                : 'bg-gray-900 border-gray-700'

              return (
                <div
                  className={`absolute z-40 tooltip-container ${bgColorClass} text-white rounded-lg shadow-xl p-3 text-xs border-2`}
                  style={{
                    left: `${tooltipLeft}px`,
                    top: `${tooltipTop}px`,
                    width: `${tooltipWidth}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-xs whitespace-pre-line">{pos.title}</div>
                    <button
                      type="button"
                      onClick={() => setSelectedTooltip(null)}
                      className="text-white hover:text-gray-200 font-bold text-base leading-none"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>
                  <div className="font-semibold text-xs mb-2">{pos.takeHome}</div>
                  {pos.lines.map((line, idx) => (
                    <div key={idx} className="text-xs">{line}</div>
                  ))}
                  {pos.note && (
                    <div className="mt-2 text-xs font-semibold">{pos.note}</div>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>
      
      <div className="mt-3 md:mt-4 space-y-3 text-xs md:text-sm text-gray-600 px-2 md:px-0">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-blue-500 flex-shrink-0"></div>
            <span>Net household income increase after tax and childcare</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 border-t-2 border-green-500 border-dashed flex-shrink-0"></div>
            <span>Income without childcare (after tax)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 border-t-2 border-red-500 border-dashed flex-shrink-0"></div>
            <span>Minimum wage (after tax, without childcare) for hours worked</span>
          </div>
          {currentHoursPoint && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span>Current hours: {secondParentHoursPerWeek}h/week ({currentHoursPoint.daysPerWeek.toFixed(1)} days/week)</span>
            </div>
          )}
          {breakEven && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-amber-500 flex-shrink-0"></div>
              <span>Break-even point (net income = $0) at {breakEven.hoursPerWeek.toFixed(1)}h/week ({breakEven.daysPerWeek.toFixed(1)} days/week)</span>
            </div>
          )}
          {minWageIntersection && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0"></div>
              <span>Net income (after tax and childcare) equals minimum wage (after tax without childcare) at {minWageIntersection.hoursPerWeek.toFixed(1)}h/week ({minWageIntersection.daysPerWeek.toFixed(1)} days/week)</span>
            </div>
          )}
          {maxIncomePoint && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-purple-500 flex-shrink-0"></div>
              <span>
                Maximum net income at {maxIncomePoint.hoursPerWeek.toFixed(1)}h/week ({maxIncomePoint.daysPerWeek.toFixed(1)} days/week)
              </span>
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <p className="font-medium text-gray-700 mb-1">Based on:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Full-time income: ${secondParentIncome.toLocaleString()}/year at {secondParentHoursPerWeek}h/week (pro-rated based on hours worked)</li>
            {familyType === 'two-parent' && (
              <li>Other parent income: ${firstParentIncome.toLocaleString()}/year at {firstParentHoursPerWeek}h/week</li>
            )}
            <li>{children.length} {children.length === 1 ? 'child' : 'children'} in childcare (days per week match work days per week, calculated from work hours assuming ~7.6 hours of work = 1 day of care)</li>
          </ul>
        </div>
      </div>
      
      <SourceModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        title="Net Household Income Increase Calculation"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>Income:</strong> ${secondParentIncome.toLocaleString()} p.a. as configured earlier{' '}
            {onConfigureSecondParentIncome && (
              <button
                type="button"
                onClick={() => {
                  setInfoModalOpen(false)
                  onConfigureSecondParentIncome()
                }}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                (Change)
              </button>
            )}
          </p>
          <p className="text-gray-700">
            <strong>Childcare costs:</strong> {childcareCosts.children.length} {childcareCosts.children.length === 1 ? 'child' : 'children'} at ${childcareCosts.children[0]?.hourlyRate.toFixed(2)}/hr{childcareCosts.children.length > 1 && childcareCosts.children.some(c => c.hourlyRate !== childcareCosts.children[0]?.hourlyRate) ? ' (varies by child)' : ''}, {childcareCosts.daysPerWeek.toFixed(1)} days/week. Out of pocket: ${childcareCosts.totalAnnualOutOfPocket.toLocaleString()} p.a. (subsidy: ${childcareCosts.totalAnnualSubsidy.toLocaleString()}, total: ${childcareCosts.totalAnnualCost.toLocaleString()}){' '}
            {onConfigureChildren && (
              <button
                type="button"
                onClick={() => {
                  setInfoModalOpen(false)
                  onConfigureChildren()
                }}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                (Change)
              </button>
            )}
          </p>
          <p className="text-sm text-gray-600">
            As families work more hours per week, the number of childcare days increases proportionally (assuming 7.6 hours per work day). This affects both the total childcare cost and the subsidy received.
          </p>
        </div>
      </SourceModal>
      
      <SourceModal
        isOpen={negativeIncreaseModalOpen}
        onClose={() => {
          setNegativeIncreaseModalOpen(false)
          setSelectedDayForBreakdown(null)
        }}
        title={`Day ${selectedDayForBreakdown} Breakdown`}
      >
        {dayBreakdown ? (
          <div className="space-y-4">
            <div className="py-2 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-1">
                <div className="text-sm text-gray-600">Gross income increase</div>
                <div className="text-sm text-green-600">${Math.round(dayBreakdown.additionalIncome).toLocaleString()}</div>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-2">
                <div className="text-sm text-gray-600">Less tax</div>
                <div className="text-sm text-red-600">-${Math.round(dayBreakdown.additionalTax).toLocaleString()}</div>
              </div>
              <div className="border-t border-gray-300 pt-2 mt-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <div className="font-medium text-gray-900">Income increase</div>
                  <div className="font-semibold text-green-600">${Math.round(dayBreakdown.additionalIncome - dayBreakdown.additionalTax).toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className="py-2 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 mb-1">
                <div className="flex-1">
                  <div className="text-sm text-gray-600">Gross childcare cost</div>
                </div>
                <div className="text-sm text-red-600">-${Math.round(dayBreakdown.additionalChildcare).toLocaleString()}</div>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 mb-2">
                <div className="text-sm text-gray-600 ml-0 sm:ml-4">
                  {(() => {
                    const subsidisedHours = Math.round(dayBreakdown.currentSubsidisedHoursPerDay)
                    const unsubsidisedHours = Math.round(dayBreakdown.totalHoursPerDay - dayBreakdown.currentSubsidisedHoursPerDay)
                    if (unsubsidisedHours > 0) {
                      return `Plus subsidy (${subsidisedHours}h at ${dayBreakdown.subsidyPercent.toFixed(0)}% subsidised, ${unsubsidisedHours}h at full rate)`
                    } else {
                      return `Plus subsidy (${dayBreakdown.subsidyPercent.toFixed(0)}%)`
                    }
                  })()}
                </div>
                <div className="text-sm text-green-600">
                  +${Math.round(dayBreakdown.subsidyChange).toLocaleString()}
                </div>
              </div>
              <div className="border-t border-gray-300 pt-2 mt-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Childcare</div>
                  </div>
                  <div className="font-semibold text-red-600">-${Math.round(dayBreakdown.additionalChildcare - dayBreakdown.subsidyChange).toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 pt-3 border-t-2 border-gray-300 gap-1">
              <div className="font-bold text-gray-900">Net change</div>
              <div className={`font-bold ${dayBreakdown.netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dayBreakdown.netChange >= 0 ? '+' : ''}${Math.round(dayBreakdown.netChange).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-700">
              Click "View" for any day to see the breakdown of changes from the previous day.
            </p>
          </div>
        )}
      </SourceModal>
      
      <SourceModal
        isOpen={howToReadModalOpen}
        onClose={() => setHowToReadModalOpen(false)}
        title="How to read this graph"
      >
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Axes</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>X-axis (horizontal):</strong> Shows hours worked per week. Each tick mark represents one work day (7.6 hours).</li>
              <li><strong>Y-axis (vertical):</strong> Shows the net income after tax and childcare costs.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">The lines</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>Blue solid line:</strong> Household income increase after tax and childcare costs.</li>
              <li><strong>Green dashed line:</strong> Household income increase after tax only (without childcare costs). This shows what families would earn if childcare were free.</li>
              <li><strong>Red dashed line:</strong> Minimum wage (after tax, without childcare) for the hours worked. This is a reference point to compare earnings, showing what someone would earn at minimum wage without childcare costs.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Markers and Reference Lines</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>Amber horizontal line:</strong> The break-even point where household income increase equals $0 (household net income does not increase).</li>
              <li><strong>Blue dot:</strong> Current hours worked per week.</li>
              <li><strong>Red dot:</strong> The point where net income (after tax and childcare) equals minimum wage (after tax without childcare) for the hours worked.</li>
              <li><strong>Purple dot:</strong> The point where household income increase is highest. Working more hours beyond this point results in lower household income increase.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Interacting with the graph</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>Hover:</strong> Move your mouse over the graph to see a crosshair showing values at that number of hours.</li>
              <li><strong>Click:</strong> Click anywhere on the blue line to see a detailed breakdown of tax, childcare costs, and net income for that number of hours.</li>
              <li><strong>Click markers:</strong> Click the colored dots to see detailed information about those specific points.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Understanding the results</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li>The gap between the green and blue lines shows how much childcare costs reduce household income increase.</li>
              <li>If the blue line goes below $0, childcare costs more than the household income increase at those hours.</li>
              <li>The slope of the blue line shows how much household income increase changes for each additional hour worked. Notice how it can flatten or even decrease as hours increase due to subsidy changes.</li>
              <li>When the blue line crosses below the red line, families are earning less than minimum wage (after accounting for childcare costs).</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Why returns diminish</h3>
            <p className="text-gray-700 ml-2">
              As families work more hours, household income increase per additional hour can decrease because:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
              <li>The childcare subsidy percentage decreases as combined family income rises.</li>
              <li>Once families hit the 100 hours per fortnight subsidy cap, additional hours of childcare are not subsidised, so they pay the full rate.</li>
            </ul>
          </div>
        </div>
      </SourceModal>
    </div>
  )
}

