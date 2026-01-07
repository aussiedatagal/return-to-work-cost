import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
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
  calculateGraphData, 
  findBreakEvenPoint, 
  findMinimumWageEquivalentPoint,
  findPointForIncome,
  MINIMUM_WAGE_POST_TAX_HOURLY_RATE,
  MINIMUM_WAGE_AFTER_TAX
} from '../utils/graphData'
import { calculateAfterTaxIncome } from '../utils/taxCalculations'
import type { Child } from '../utils/subsidyCalculations'
import type { GraphDataPoint } from '../utils/graphData'
import SourceModal from './SourceModal'

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

interface IncomeGraphProps {
  firstParentIncome: number
  children: Child[]
  activityHoursPerFortnight: number
  secondParentHoursPerFortnight?: number
  onConfigureFirstParentIncome?: () => void
  onConfigureChildren?: () => void
  onConfigureSecondParentIncome?: () => void
  defaultFirstParentIncome?: number
  selectedSecondParentIncome?: number
  defaultSecondParentIncome?: number
  onOpenSourceModal?: (type: 'secondParentIncome' | 'firstParentIncome' | 'childcareRate') => void
  familyType?: 'two-parent' | 'single-parent'
}

export default function IncomeGraph(props: IncomeGraphProps) {
  const {
    firstParentIncome, 
    children, 
    activityHoursPerFortnight,
    secondParentHoursPerFortnight,
    selectedSecondParentIncome,
    defaultSecondParentIncome = 94103,
    onOpenSourceModal,
    familyType = 'two-parent'
  } = props
  // Props not used in this component but part of API for consistency:
  // onConfigureFirstParentIncome, onConfigureChildren, onConfigureSecondParentIncome, defaultFirstParentIncome
  const chartRef = useRef<ChartJS<'line'>>(null)
  const targetSecondParentIncome = selectedSecondParentIncome ?? defaultSecondParentIncome
  const xMaxIncome = useMemo(() => {
    // Based on ABS Characteristics of Employment (Aug 2024):
    // 70th percentile: ~$114,000, 80th: ~$129,000, 90th: ~$149,000
    // Set to $160,000 to cover above 90th percentile while keeping "up by 20" markers consistent
    const baseMax = 160000
    if (targetSecondParentIncome <= baseMax) return baseMax
    const padded = targetSecondParentIncome + 25000
    return Math.ceil(padded / 50000) * 50000
  }, [targetSecondParentIncome])

  // Calculate adaptive step size to keep data points reasonable (~160 points max)
  // For larger ranges, use larger steps to maintain performance
  const stepSize = useMemo(() => {
    const range = xMaxIncome
    const targetPoints = 160
    const calculatedStep = Math.ceil(range / targetPoints)
    // Round to nice numbers: 1000, 5000, 10000, 50000, etc.
    if (calculatedStep <= 1000) return 1000
    if (calculatedStep <= 5000) return 5000
    if (calculatedStep <= 10000) return 10000
    if (calculatedStep <= 50000) return 50000
    return Math.ceil(calculatedStep / 50000) * 50000
  }, [xMaxIncome])

  const graphData = useMemo(() => {
    return calculateGraphData(firstParentIncome, children, activityHoursPerFortnight, 0, xMaxIncome, stepSize, familyType === 'single-parent')
  }, [firstParentIncome, children, activityHoursPerFortnight, xMaxIncome, stepSize, familyType])
  
  const breakEven = useMemo(() => {
    return findBreakEvenPoint(graphData)
  }, [graphData])

  const minWageEquivalent = useMemo(() => {
    return findMinimumWageEquivalentPoint(graphData, secondParentHoursPerFortnight)
  }, [graphData, secondParentHoursPerFortnight])

  const averageIncomePoint = useMemo(() => {
    const targetIncome = selectedSecondParentIncome ?? defaultSecondParentIncome
    return findPointForIncome(graphData, targetIncome)
  }, [graphData, selectedSecondParentIncome, defaultSecondParentIncome])
  
  // Calculate minimum wage equivalent for actual hours worked
  const minimumWageForHours = useMemo(() => {
    if (!secondParentHoursPerFortnight) return MINIMUM_WAGE_AFTER_TAX
    const annualHours = secondParentHoursPerFortnight * 26
    const AUSTRALIAN_MINIMUM_WAGE_PER_HOUR = 24.95
    const minimumWageGrossAnnual = AUSTRALIAN_MINIMUM_WAGE_PER_HOUR * annualHours
    return calculateAfterTaxIncome(minimumWageGrossAnnual)
  }, [secondParentHoursPerFortnight])

  const isUsingDefaultIncome = !selectedSecondParentIncome || selectedSecondParentIncome === defaultSecondParentIncome
  
  // Detect mobile view with state that updates on resize
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
  
  const minNet = graphData.reduce((min, d) => Math.min(min, d.netIncome), graphData[0]?.netIncome ?? 0)
  const maxNet = graphData.reduce((max, d) => Math.max(max, d.netIncome), graphData[0]?.netIncome ?? 0)
  
  const roundToNearest = (value: number, nearest: number) => {
    return Math.floor(value / nearest) * nearest
  }
  
  const roundUpToNearest = (value: number, nearest: number) => {
    return Math.ceil(value / nearest) * nearest
  }
  
  const range = Math.max(0, maxNet) - Math.min(0, minNet)
  const tickInterval = range <= 20000 ? 5000 : range <= 50000 ? 10000 : 20000
  
  const yMin = roundToNearest(Math.min(0, minNet) * 1.1, tickInterval)
  const yMax = roundUpToNearest(Math.max(0, maxNet) * 1.1, tickInterval)
  
  const chartData: ChartData<'line'> = {
    datasets: [
      {
        label: 'Net Income',
        data: graphData.map(d => ({ x: d.grossIncome, y: d.netIncome })),
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
      const x = chart.scales.x.getPixelForValue(point.grossIncome)
      const y = chart.scales.y.getPixelForValue(point.netIncome)
      const note = point.netIncome < 0 ? 'Childcare costs more than families earn.' : undefined
      const { takeHome, lines } = buildLinesFromPoint(point)
      setSelectedTooltip({
        x,
        y,
        title: `Gross income: $${Math.round(point.grossIncome).toLocaleString()}`,
        takeHome,
        lines,
        note,
        color: 'neutral'
      })
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: false, // we use our own click-to-open tooltip overlay
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
        text: familyType === 'single-parent' ? "Gross income" : "Gross income",
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
          callback: function(value) {
            const numValue = typeof value === 'number' ? value : parseFloat(value.toString())
            return formatCurrency(numValue)
          },
      },
      min: 0,
        max: xMaxIncome,
        grid: {
          color: '#e5e7eb',
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
        },
      },
    },
  }

  const formatChildrenInfo = () => {
    if (children.length === 0) return 'no children'
    
    const firstChild = children[0]
    const allSame = children.every(child => 
      child.hourlyRate === firstChild.hourlyRate && 
      child.hoursPerDay === firstChild.hoursPerDay
    )
    
    if (allSame) {
      const dailyRate = firstChild.hourlyRate * firstChild.hoursPerDay
      return `${children.length} ${children.length === 1 ? 'child' : 'children'} in care at $${dailyRate.toFixed(2)}/day`
    }
    
    return `${children.length} ${children.length === 1 ? 'child' : 'children'} in care`
  }
  
  const [markerPositions, setMarkerPositions] = useState<{
    breakEven?: { x: number; y: number }
    minWage?: { x: number; y: number }
    average?: { x: number; y: number }
    chartArea?: { left: number; right: number; top: number; bottom: number }
  }>({})
  type TooltipData = {
    x: number
    y: number
    title: string
    takeHome: string
    lines: string[]
    note?: string
    color: 'amber' | 'red' | 'blue' | 'neutral'
  }
  const [selectedTooltip, setSelectedTooltip] = useState<TooltipData | null>(null)
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number; income: number; netIncome: number } | null>(null)
  const [howToReadModalOpen, setHowToReadModalOpen] = useState(false)

  const buildLinesFromPoint = useCallback((point: GraphDataPoint) => {
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
        x: xScale.getPixelForValue(breakEven.income),
        y: yScale.getPixelForValue(0),
      }
    }

    if (minWageEquivalent) {
      positions.minWage = {
        x: xScale.getPixelForValue(minWageEquivalent.income),
        y: yScale.getPixelForValue(minWageEquivalent.netIncome),
      }
    }

    if (averageIncomePoint) {
      const avgIncome = selectedSecondParentIncome ?? defaultSecondParentIncome
      positions.average = {
        x: xScale.getPixelForValue(avgIncome),
        y: yScale.getPixelForValue(averageIncomePoint.netIncome),
      }
    }

    setMarkerPositions(positions)
  }, [breakEven, minWageEquivalent, averageIncomePoint, selectedSecondParentIncome, defaultSecondParentIncome])

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
      
      // Only show marker if within chart bounds and xValue is valid
      if (xValue === undefined || xValue === null ||
          xValue < 0 || xValue > xMaxIncome || 
          x < chart.chartArea.left || 
          x > chart.chartArea.right) {
        setHoverPosition(null)
        return
      }
      
      // Find the closest point on the graph for this income value
      const closestPoint = graphData.reduce((prev, curr) => {
        return Math.abs(curr.grossIncome - xValue) < Math.abs(prev.grossIncome - xValue) ? curr : prev
      })
      
      // Calculate Y position for the graph line at this income
      const y = chart.scales.y.getPixelForValue(closestPoint.netIncome)
      
      setHoverPosition({
        x: x,
        y: y,
        income: xValue,
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
  }, [chartRef, xMaxIncome, graphData])

  // Extra pass after paint to make sure chart area is ready
  useEffect(() => {
    const frame1 = requestAnimationFrame(recalcMarkerPositions)
    const frame2 = requestAnimationFrame(recalcMarkerPositions)
    return () => {
      cancelAnimationFrame(frame1)
      cancelAnimationFrame(frame2)
    }
  }, [recalcMarkerPositions, graphData])

  // Close tooltip when clicking outside
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
      <div className="flex items-center justify-center gap-2 mb-2 md:mb-4">
        <h3 className="text-sm md:text-xl font-semibold text-gray-900 px-1 md:px-0 text-center">
          {familyType === 'single-parent' ? "Net Income After Tax & Childcare" : "Net Household Income Increase After Tax & Childcare"}
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
      
      <div className="w-full relative md:h-[420px] h-[340px] min-h-[340px]">
        <div 
          className="relative z-10 h-full"
          onMouseLeave={() => setHoverPosition(null)}
        >
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        </div>
        
        {/* Hover Markers */}
        {hoverPosition && markerPositions.chartArea && (
          <>
            {/* Vertical Line */}
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
            {/* Horizontal Line */}
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
        
        {/* Clickable Markers */}
        {markerPositions.chartArea && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {/* Break Even Marker */}
            {breakEven && markerPositions.breakEven && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (breakEven) {
                    const point = findPointForIncome(graphData, breakEven.income)
                    if (point && chartRef.current?.scales.x && chartRef.current?.scales.y) {
                      const { takeHome, lines } = buildLinesFromPoint(point)
                      setSelectedTooltip({
                        x: chartRef.current.scales.x.getPixelForValue(breakEven.income),
                        y: chartRef.current.scales.y.getPixelForValue(point.netIncome),
                        title: `Gross income: $${Math.round(point.grossIncome).toLocaleString()}`,
                        takeHome,
                        lines,
                        note: 'Household net income does not increase.',
                        color: 'amber'
                      })
                    }
                  }
                }}
                className="absolute cursor-pointer touch-manipulation pointer-events-auto"
                style={{
                  left: `${markerPositions.breakEven.x - 8}px`,
                  top: `${markerPositions.breakEven.y - 8}px`,
                  width: '16px',
                  height: '16px',
                }}
                aria-label="Break-even point (no net income gain)"
              >
                <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-lg hover:scale-125 transition-transform" />
              </button>
            )}

            {/* Minimum Wage Equivalent Marker */}
            {minWageEquivalent && markerPositions.minWage && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (minWageEquivalent) {
                    const point = findPointForIncome(graphData, minWageEquivalent.income)
                    if (point && chartRef.current?.scales.x && chartRef.current?.scales.y) {
                      const { takeHome, lines } = buildLinesFromPoint(point)
                      setSelectedTooltip({
                        x: chartRef.current.scales.x.getPixelForValue(minWageEquivalent.income),
                        y: chartRef.current.scales.y.getPixelForValue(point.netIncome),
                        title: `Gross income: $${Math.round(point.grossIncome).toLocaleString()}`,
                        takeHome,
                        lines,
                        note: 'Families are working at minimum wage.',
                        color: 'red'
                      })
                    }
                  }
                }}
                className="absolute cursor-pointer touch-manipulation pointer-events-auto"
                style={{
                  left: `${markerPositions.minWage.x - 8}px`,
                  top: `${markerPositions.minWage.y - 8}px`,
                  width: '16px',
                  height: '16px',
                }}
                aria-label="Minimum wage equivalent point"
              >
                <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-lg hover:scale-125 transition-transform" />
              </button>
            )}

            {/* Average Income / Current Income Marker */}
            {averageIncomePoint && markerPositions.average && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (averageIncomePoint) {
                    const avgIncome = selectedSecondParentIncome ?? defaultSecondParentIncome
                    const point = findPointForIncome(graphData, avgIncome)
                    if (point && chartRef.current?.scales.x && chartRef.current?.scales.y) {
                      let note: string | undefined
                      if (point.netIncome < 0) {
                        note = 'Families are losing money by working.'
                      } else if (point.netIncome === 0) {
                        note = 'Household net income does not increase.'
                      } else if (Math.abs(point.netIncome - minimumWageForHours) < 1) {
                        note = 'Families are working at minimum wage.'
                      } else if (point.netIncome < minimumWageForHours) {
                        note = 'Families are earning less than minimum wage.'
                      }
                      const { takeHome, lines } = buildLinesFromPoint(point)
                      setSelectedTooltip({
                        x: chartRef.current.scales.x.getPixelForValue(avgIncome),
                        y: chartRef.current.scales.y.getPixelForValue(point.netIncome),
                        title: `Gross income: $${Math.round(point.grossIncome).toLocaleString()}`,
                        takeHome,
                        lines,
                        note,
                        color: 'blue'
                      })
                    }
                  }
                }}
                className="absolute cursor-pointer touch-manipulation pointer-events-auto"
                style={{
                  left: `${markerPositions.average.x - 8}px`,
                  top: `${markerPositions.average.y - 8}px`,
                  width: '16px',
                  height: '16px',
                }}
                aria-label={isUsingDefaultIncome ? 'Average income point' : 'Current income point'}
              >
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg hover:scale-125 transition-transform" />
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
                    <div className="font-semibold text-xs">{pos.title}</div>
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
            <span>{familyType === 'single-parent' ? 'Net income after tax and childcare' : 'Net household income increase after tax and childcare'}</span>
          </div>
          {averageIncomePoint && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span className="flex items-center flex-wrap gap-x-1">
                {isUsingDefaultIncome ? (
                  <>
                    Median income for a woman in Sydney
                    {onOpenSourceModal && (
                      <button
                        type="button"
                        onClick={() => onOpenSourceModal('secondParentIncome')}
                        className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center flex-shrink-0"
                        title="Why this income?"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                  </>
                ) : (
                  <>Second Parent Income</>
                )}
              </span>
            </div>
          )}
          {minWageEquivalent && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0"></div>
              <span>Minimum wage equivalent (${MINIMUM_WAGE_POST_TAX_HOURLY_RATE.toFixed(2)}/hr after tax, excluding any childcare costs)</span>
            </div>
          )}
          {breakEven && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 rounded-full bg-amber-500 flex-shrink-0"></div>
              <span>Break-even point (net income = $0)</span>
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 pt-3 space-y-1">
          <p className="font-medium text-gray-700 mb-1">Based on:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            {familyType === 'two-parent' && (
              <li className="flex items-center gap-1.5">
                <span>First parent income: ${firstParentIncome.toLocaleString()}</span>
                {onOpenSourceModal && (
                  <button
                    type="button"
                    onClick={() => onOpenSourceModal('firstParentIncome')}
                    className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center flex-shrink-0"
                    title="Why this income?"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                )}
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <span>{formatChildrenInfo()}</span>
              {onOpenSourceModal && (
                <button
                  type="button"
                  onClick={() => onOpenSourceModal('childcareRate')}
                  className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center flex-shrink-0"
                  title="Why this rate?"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              )}
            </li>
          </ul>
        </div>

      </div>
      
      <SourceModal
        isOpen={howToReadModalOpen}
        onClose={() => setHowToReadModalOpen(false)}
        title="How to read this graph"
      >
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Axes</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>X-axis (horizontal):</strong> Shows the gross income {familyType === 'single-parent' ? '' : 'of the second parent'}.</li>
              <li><strong>Y-axis (vertical):</strong> Shows the net income after tax and childcare costs.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">The blue line</h3>
            <p className="text-gray-700 ml-2">
              This shows how net income changes as gross income increases. The line accounts for:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
              <li>Income tax (which increases as income rises)</li>
              <li>Childcare costs (which change based on income due to subsidy percentage changes)</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Markers</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>Amber dot:</strong> The break-even point where net income equals $0 (household net income does not increase).</li>
              <li><strong>Red dot:</strong> The point where household income increase equals minimum wage (after tax).</li>
              <li><strong>Blue dot:</strong> {isUsingDefaultIncome ? 'The median income for a woman in Sydney.' : 'The current income level.'}</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Interacting with the graph</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li><strong>Hover:</strong> Move your mouse over the graph to see a crosshair showing values at that income level.</li>
              <li><strong>Click:</strong> Click anywhere on the blue line to see a detailed breakdown of tax, childcare costs, and net income for that income level.</li>
              <li><strong>Click markers:</strong> Click the colored dots to see detailed information about those specific points.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Understanding the results</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-700 ml-2">
              <li>If the line goes below $0, childcare costs more than families earn at that income level.</li>
              <li>The slope of the line shows how much net income increases for each additional dollar of gross income.</li>
              <li>As income increases, the subsidy percentage decreases, which can make the line less steep.</li>
            </ul>
          </div>
        </div>
      </SourceModal>
    </div>
  )
}
