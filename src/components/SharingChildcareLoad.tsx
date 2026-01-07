import { useState, useMemo, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { calculateAfterTaxIncome, calculateIncomeTax } from '../utils/taxCalculations'
import { calculateTotalCosts, type Child } from '../utils/subsidyCalculations'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

// Plugin to add labels over stacked bar segments
const stackedBarLabelsPlugin = {
  id: 'stackedBarLabels',
  afterDatasetsDraw(chart: any) {
    const { ctx, chartArea } = chart
    
    if (!chartArea) return
    
    const isMobile = chart.width < 600
    
    // Get family support info from chart data if available
    const familySupportInfo = (chart.data as any).familySupportInfo
    
    chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
      const meta = chart.getDatasetMeta(datasetIndex)
      
      meta.data.forEach((bar: any, index: number) => {
        const value = dataset.data[index]
        if (value === 0 || value === null || value === undefined) return
        
        // Calculate the center position of this segment in the stacked bar
        // In Chart.js v3+, bar.x is the center of the category
        // bar.width is the width of the bar
        // So the horizontal center is at bar.x
        const xPosition = bar.x
        const yPosition = bar.y + (bar.height / 2)
        
        ctx.save()
        
        // Set font and text properties BEFORE measuring
        ctx.font = isMobile ? 'bold 10px sans-serif' : 'bold 11px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.miterLimit = 2
        
        // Format label with dataset name and value
        let labelText = `${dataset.label}: $${Math.round(value).toLocaleString()}`
        
        // Add family support info to Net Income label
        if (dataset.label === 'Net Income' && familySupportInfo) {
          const supportAmount = index === 0 ? familySupportInfo.fullTime : familySupportInfo.partTime
          if (supportAmount && supportAmount > 0) {
            labelText += `\n(Saved $${Math.round(supportAmount).toLocaleString()} from family support)`
          }
        }
        
        // Draw with black outline for contrast, then white fill
        // Handle multi-line text
        const lines = labelText.split('\n')
        const lineHeight = isMobile ? 12 : 13
        const startY = yPosition - ((lines.length - 1) * lineHeight) / 2
        
        lines.forEach((line: string, lineIndex: number) => {
          const y = startY + (lineIndex * lineHeight)
          ctx.strokeText(line, xPosition, y)
          ctx.fillText(line, xPosition, y)
        })
        
        ctx.restore()
      })
    })
  }
}

// Register the plugin
ChartJS.register(stackedBarLabelsPlugin)

interface SharingChildcareLoadProps {
  firstParentIncome: number
  firstParentHoursPerWeek: number
  secondParentIncome: number
  secondParentHoursPerWeek: number
  children: Child[]
  familyType: 'two-parent' | 'single-parent'
}

export default function SharingChildcareLoad({
  firstParentIncome,
  firstParentHoursPerWeek,
  secondParentIncome,
  secondParentHoursPerWeek,
  children
}: SharingChildcareLoadProps) {
  // Calculate full-time equivalent (FTE) income for each parent
  // Assuming 38 hours/week is full-time
  const FULL_TIME_HOURS = 38
  const HOURS_PER_DAY = 7.6
  
  const firstParentFTEIncome = firstParentHoursPerWeek > 0 
    ? (firstParentIncome / firstParentHoursPerWeek) * FULL_TIME_HOURS
    : firstParentIncome
  
  const secondParentFTEIncome = secondParentHoursPerWeek > 0
    ? (secondParentIncome / secondParentHoursPerWeek) * FULL_TIME_HOURS
    : secondParentIncome
  
  // State for days worked by each parent
  // Default to 4 days for both parents to show the sharing scenario
  const [firstParentDays, setFirstParentDays] = useState(() => {
    const calculatedDays = Math.round(firstParentHoursPerWeek / HOURS_PER_DAY)
    return calculatedDays === 5 ? 4 : calculatedDays
  })
  const [secondParentDays, setSecondParentDays] = useState(() => {
    const calculatedDays = Math.round(secondParentHoursPerWeek / HOURS_PER_DAY)
    return calculatedDays === 5 ? 4 : calculatedDays
  })
  
  // State for days covered by non-parents (grandparents/family) for free
  const [daysCoveredByNonParents, setDaysCoveredByNonParents] = useState(0)
  
  // Calculate pro-rata income based on days worked
  const firstParentProRataIncome = useMemo(() => {
    const daysRatio = firstParentDays / 5 // Assuming 5 days is full-time
    return firstParentFTEIncome * daysRatio
  }, [firstParentDays, firstParentFTEIncome])
  
  const secondParentProRataIncome = useMemo(() => {
    const daysRatio = secondParentDays / 5
    return secondParentFTEIncome * daysRatio
  }, [secondParentDays, secondParentFTEIncome])
  
  // Calculate childcare days needed
  // Total 5 days per week, minus days parents can cover, minus days covered by non-parents
  const totalDaysNeeded = 5
  const daysCoveredByParents = firstParentDays < 5 ? (5 - firstParentDays) : 0
  const daysCoveredBySecondParent = secondParentDays < 5 ? (5 - secondParentDays) : 0
  // Each parent can cover days they're not working
  const totalDaysCoveredByParents = Math.min(daysCoveredByParents + daysCoveredBySecondParent, totalDaysNeeded)
  // Total days covered includes both parents and non-parents (grandparents/family)
  const totalDaysCovered = Math.min(totalDaysCoveredByParents + daysCoveredByNonParents, totalDaysNeeded)
  const childcareDaysNeeded = Math.max(0, totalDaysNeeded - totalDaysCovered)
  
  // Calculate hours per week for activity test
  // Activity test uses the minimum of both parents' hours (for two-parent families)
  const firstParentHoursPerWeekFromDays = firstParentDays * HOURS_PER_DAY
  const secondParentHoursPerWeekFromDays = secondParentDays * HOURS_PER_DAY
  const minHoursForActivity = Math.min(firstParentHoursPerWeekFromDays, secondParentHoursPerWeekFromDays)
  const activityHoursPerFortnight = minHoursForActivity * 2
  
  // Calculate childcare costs for part-time scenario
  const partTimeCombinedIncome = firstParentProRataIncome + secondParentProRataIncome
  const partTimeChildren = children.map(child => ({
    ...child,
    daysPerWeek: childcareDaysNeeded
  }))
  const partTimeCosts = calculateTotalCosts(
    partTimeChildren,
    partTimeCombinedIncome,
    activityHoursPerFortnight
  )
  
  // Calculate childcare costs for full-time scenario (both parents full-time)
  // Use the same family support days as the part-time scenario for fair comparison
  const fullTimeCombinedIncome = firstParentFTEIncome + secondParentFTEIncome
  const fullTimeChildcareDaysNeeded = Math.max(0, 5 - daysCoveredByNonParents)
  const fullTimeChildren = children.map(child => ({
    ...child,
    daysPerWeek: fullTimeChildcareDaysNeeded
  }))
  const fullTimeActivityHours = FULL_TIME_HOURS * 2 // 76 hours per fortnight
  const fullTimeCosts = calculateTotalCosts(
    fullTimeChildren,
    fullTimeCombinedIncome,
    fullTimeActivityHours
  )
  
  // Calculate net income for both scenarios
  const partTimeFirstParentAfterTax = calculateAfterTaxIncome(firstParentProRataIncome)
  const partTimeSecondParentAfterTax = calculateAfterTaxIncome(secondParentProRataIncome)
  const partTimeCombinedAfterTax = partTimeFirstParentAfterTax + partTimeSecondParentAfterTax
  const partTimeChildcareOutOfPocket = partTimeCosts.totalChildcareOutOfPocket * 26 // Convert to annual
  const partTimeNetIncome = partTimeCombinedAfterTax - partTimeChildcareOutOfPocket
  
  const fullTimeFirstParentAfterTax = calculateAfterTaxIncome(firstParentFTEIncome)
  const fullTimeSecondParentAfterTax = calculateAfterTaxIncome(secondParentFTEIncome)
  const fullTimeCombinedAfterTax = fullTimeFirstParentAfterTax + fullTimeSecondParentAfterTax
  const fullTimeChildcareOutOfPocket = fullTimeCosts.totalChildcareOutOfPocket * 26
  const fullTimeNetIncome = fullTimeCombinedAfterTax - fullTimeChildcareOutOfPocket
  
  // Calculate net income without family support to show the benefit
  // Calculate what childcare costs would be without family support (more days needed)
  // childcareDaysNeeded already accounts for family support, so add it back
  const partTimeChildcareDaysWithoutSupport = Math.min(childcareDaysNeeded + daysCoveredByNonParents, 5)
  const partTimeChildrenWithoutSupport = children.map(child => ({
    ...child,
    daysPerWeek: partTimeChildcareDaysWithoutSupport
  }))
  const partTimeCostsWithoutSupport = calculateTotalCosts(
    partTimeChildrenWithoutSupport,
    partTimeCombinedIncome,
    activityHoursPerFortnight
  )
  const partTimeChildcareOutOfPocketWithoutSupport = partTimeCostsWithoutSupport.totalChildcareOutOfPocket * 26
  const partTimeNetIncomeWithoutSupport = partTimeCombinedAfterTax - partTimeChildcareOutOfPocketWithoutSupport
  const partTimeFamilySupportBenefit = partTimeNetIncome - partTimeNetIncomeWithoutSupport
  
  // For full-time, without support would be 5 days (full childcare)
  const fullTimeChildcareDaysWithoutSupport = 5
  const fullTimeChildrenWithoutSupport = children.map(child => ({
    ...child,
    daysPerWeek: fullTimeChildcareDaysWithoutSupport
  }))
  const fullTimeCostsWithoutSupport = calculateTotalCosts(
    fullTimeChildrenWithoutSupport,
    fullTimeCombinedIncome,
    fullTimeActivityHours
  )
  const fullTimeChildcareOutOfPocketWithoutSupport = fullTimeCostsWithoutSupport.totalChildcareOutOfPocket * 26
  const fullTimeNetIncomeWithoutSupport = fullTimeCombinedAfterTax - fullTimeChildcareOutOfPocketWithoutSupport
  const fullTimeFamilySupportBenefit = fullTimeNetIncome - fullTimeNetIncomeWithoutSupport
  
  // Check if both parents are full-time (5 days each)
  const bothFullTime = firstParentDays === 5 && secondParentDays === 5
  
  // Calculate tax amounts for stacking
  const fullTimeTax = fullTimeCombinedIncome - fullTimeCombinedAfterTax
  const partTimeTax = partTimeCombinedIncome - partTimeCombinedAfterTax
  
  // Calculate breakdown for each parent
  // Total childcare savings from full-time to part-time scenario
  const totalChildcareSavings = fullTimeChildcareOutOfPocket - partTimeChildcareOutOfPocket
  
  // Parent 1 breakdown
  // daysCoveredByParents is already calculated above (line 151)
  const firstParentLostIncomeGross = firstParentFTEIncome - firstParentProRataIncome
  const firstParentTaxFullTime = calculateIncomeTax(firstParentFTEIncome)
  const firstParentTaxPartTime = calculateIncomeTax(firstParentProRataIncome)
  const firstParentTaxSaved = firstParentTaxFullTime - firstParentTaxPartTime
  const firstParentLostIncomeAfterTax = calculateAfterTaxIncome(firstParentFTEIncome) - calculateAfterTaxIncome(firstParentProRataIncome)
  
  // Allocate childcare savings proportionally based on days each parent covers
  // If both parents cover days, split savings proportionally
  const totalParentDaysCovering = daysCoveredByParents + daysCoveredBySecondParent
  const firstParentSavedChildcare = totalParentDaysCovering > 0 
    ? (daysCoveredByParents / totalParentDaysCovering) * totalChildcareSavings
    : 0
  const firstParentNetCost = firstParentLostIncomeAfterTax - firstParentSavedChildcare
  
  // Parent 2 breakdown
  // daysCoveredBySecondParent is already calculated above (line 152)
  const secondParentLostIncomeGross = secondParentFTEIncome - secondParentProRataIncome
  const secondParentTaxFullTime = calculateIncomeTax(secondParentFTEIncome)
  const secondParentTaxPartTime = calculateIncomeTax(secondParentProRataIncome)
  const secondParentTaxSaved = secondParentTaxFullTime - secondParentTaxPartTime
  const secondParentLostIncomeAfterTax = calculateAfterTaxIncome(secondParentFTEIncome) - calculateAfterTaxIncome(secondParentProRataIncome)
  
  // Allocate childcare savings proportionally
  const secondParentSavedChildcare = totalParentDaysCovering > 0
    ? (daysCoveredBySecondParent / totalParentDaysCovering) * totalChildcareSavings
    : 0
  const secondParentNetCost = secondParentLostIncomeAfterTax - secondParentSavedChildcare
  
  // Family support breakdown
  const familySupportSavedChildcare = partTimeChildcareOutOfPocketWithoutSupport - partTimeChildcareOutOfPocket
  
  // Calculate effective hourly rate for working an extra day
  // This shows what you'd effectively earn per hour if you worked one more day per week
  const HOURS_PER_YEAR_FOR_ONE_EXTRA_DAY = HOURS_PER_DAY * 52 // 395.2 hours
  
  // Calculate the cost per day of childcare (annual)
  // This is the cost that would be incurred if a parent worked one more day
  const childcareCostPerDayAnnual = totalParentDaysCovering > 0
    ? totalChildcareSavings / totalParentDaysCovering
    : 0
  
  // For Parent 1: calculate effective rate if they worked one more day
  const firstParentDaysToAdd = 5 - firstParentDays
  // Hours not in paid work (the hours they're covering childcare instead of working)
  const firstParentHoursNotInPaidWork = firstParentDaysToAdd > 0
    ? firstParentDaysToAdd * HOURS_PER_YEAR_FOR_ONE_EXTRA_DAY
    : 0
  // Extra income per year if they worked one more day (pro-rated)
  const firstParentExtraIncomePerDay = firstParentDaysToAdd > 0 
    ? firstParentLostIncomeAfterTax / firstParentDaysToAdd 
    : 0
  // Extra childcare cost if they worked one more day (they'd no longer cover that day)
  // This is the cost of one day of childcare per year
  const firstParentExtraChildcarePerDay = firstParentDaysToAdd > 0
    ? childcareCostPerDayAnnual
    : 0
  const firstParentNetBenefitPerExtraDay = firstParentExtraIncomePerDay - firstParentExtraChildcarePerDay
  const firstParentEffectiveHourlyRate = firstParentDaysToAdd > 0
    ? firstParentNetBenefitPerExtraDay / HOURS_PER_YEAR_FOR_ONE_EXTRA_DAY
    : 0
  
  // For Parent 2: calculate effective rate if they worked one more day
  const secondParentDaysToAdd = 5 - secondParentDays
  // Hours not in paid work (the hours they're covering childcare instead of working)
  const secondParentHoursNotInPaidWork = secondParentDaysToAdd > 0
    ? secondParentDaysToAdd * HOURS_PER_YEAR_FOR_ONE_EXTRA_DAY
    : 0
  // Extra income per year if they worked one more day (pro-rated)
  const secondParentExtraIncomePerDay = secondParentDaysToAdd > 0
    ? secondParentLostIncomeAfterTax / secondParentDaysToAdd
    : 0
  // Extra childcare cost if they worked one more day (they'd no longer cover that day)
  // This is the cost of one day of childcare per year
  const secondParentExtraChildcarePerDay = secondParentDaysToAdd > 0
    ? childcareCostPerDayAnnual
    : 0
  const secondParentNetBenefitPerExtraDay = secondParentExtraIncomePerDay - secondParentExtraChildcarePerDay
  const secondParentEffectiveHourlyRate = secondParentDaysToAdd > 0
    ? secondParentNetBenefitPerExtraDay / HOURS_PER_YEAR_FOR_ONE_EXTRA_DAY
    : 0
  
  // Australian minimum wage after tax (approximate)
  // Minimum wage is $23.23/hour gross, after tax at 19% (first bracket) ≈ $18.82/hour
  const MINIMUM_WAGE_AFTER_TAX = 23.23 * 0.81 // Approximately $18.82/hour
  
  // Calculate combined effective hourly rate if both parents worked additional days to reach full-time
  const totalAdditionalHours = firstParentHoursNotInPaidWork + secondParentHoursNotInPaidWork
  const totalNetBenefitForAdditionalDays = firstParentNetBenefitPerExtraDay + secondParentNetBenefitPerExtraDay
  const combinedEffectiveHourlyRate = totalAdditionalHours > 0
    ? totalNetBenefitForAdditionalDays / totalAdditionalHours
    : 0
  
  // Prepare data for stacked bar chart
  // Stack order: Net Income Base (bottom), Family Support Benefit (on top of base), Childcare (middle), Tax (top)
  // Total height = Gross Income
  const chartLabels = bothFullTime 
    ? ['Full-Time (Both 5 days)']
    : ['Full-Time (Both 5 days)', `${firstParentDays} days/${secondParentDays} days`]
  
  const hasFamilySupport = daysCoveredByNonParents > 0
  
  const chartData: ChartData<'bar'> & { familySupportInfo?: { fullTime?: number; partTime?: number } } = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Net Income',
        data: bothFullTime 
          ? [fullTimeNetIncome]
          : [fullTimeNetIncome, partTimeNetIncome],
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        maxBarThickness: undefined,
      },
      {
        label: 'Childcare',
        data: bothFullTime
          ? [fullTimeChildcareOutOfPocket]
          : [fullTimeChildcareOutOfPocket, partTimeChildcareOutOfPocket],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
        maxBarThickness: undefined,
      },
      {
        label: 'Tax',
        data: bothFullTime
          ? [fullTimeTax]
          : [fullTimeTax, partTimeTax],
        backgroundColor: 'rgba(251, 146, 60, 0.8)',
        borderColor: 'rgba(251, 146, 60, 1)',
        borderWidth: 1,
        maxBarThickness: undefined,
      },
    ],
    ...(hasFamilySupport ? {
      familySupportInfo: {
        fullTime: fullTimeFamilySupportBenefit,
        partTime: partTimeFamilySupportBenefit
      }
    } : {}),
  }
  
  // Detect mobile for responsive padding
  const [isMobileView, setIsMobileView] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const chartOptions: ChartOptions<'bar'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed.y
            if (value === null || value === undefined) return ''
            return `${context.dataset.label}: $${Math.round(value).toLocaleString()}`
          },
          footer: function(tooltipItems) {
            if (!tooltipItems || tooltipItems.length === 0) return ''
            const firstItem = tooltipItems[0]
            if (!firstItem || firstItem.dataIndex === null || firstItem.dataIndex === undefined) return ''
            const grossIncome = bothFullTime 
              ? fullTimeCombinedIncome 
              : (firstItem.dataIndex === 0 ? fullTimeCombinedIncome : partTimeCombinedIncome)
            return `Gross Income: $${Math.round(grossIncome).toLocaleString()}`
          }
        }
      }
    },
    layout: {
      padding: {
        right: isMobileView ? 5 : 10,
        left: isMobileView ? 0 : 10,
        top: isMobileView ? 5 : 10,
        bottom: isMobileView ? 5 : 10,
      },
    },
    scales: {
      x: {
        stacked: true,
        categoryPercentage: 1.0,
        barPercentage: 1.0,
        ticks: {
          font: {
            size: isMobileView ? 11 : 12,
          },
        },
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          font: {
            size: isMobileView ? 11 : 12,
          },
          callback: function(value) {
            return `$${Math.round(Number(value)).toLocaleString()}`
          }
        }
      }
    }
  }), [isMobileView])
  
  
  return (
    <div className="bg-white rounded-lg shadow-lg p-2 md:p-8 mb-3 md:mb-8">
      <div className="text-center mb-3 md:mb-6">
        <h2 className="text-base md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
          Would sharing the childcare load help things?
        </h2>
        <p className="text-xs md:text-base text-gray-600 mb-2 md:mb-3">
          Tax is calculated individually for each parent, but childcare costs are shared and the subsidy is based on combined household income. Because tax rates are marginal, reducing a day of work that crosses into a higher tax bracket saves more in tax than reducing a day in a lower bracket. This means different arrangements with the same total days worked (e.g., 4+4 days vs 3+5 days) can result in different net household income, depending on which parent reduces days and whether it crosses a tax bracket. Use the calculator below to see which arrangement works best for different scenarios.
        </p>
      </div>
      
      {/* Parent FTE Incomes and Sliders - Combined Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
        {/* Parent 1 */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 md:p-4">
          <h3 className="text-xs md:text-sm font-semibold text-gray-900 mb-2">Parent 1</h3>
          
          <div className="mb-3">
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-gray-600">Net full-time income:</span>
              <span className="font-semibold text-gray-900">
                ${Math.round(calculateAfterTaxIncome(firstParentFTEIncome)).toLocaleString()}/year
              </span>
            </div>
          </div>
          
          {/* Slider for Parent 1 */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
              Days per week
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={firstParentDays}
              onChange={(e) => setFirstParentDays(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0</span>
              <span className="font-semibold text-gray-900">{firstParentDays} day{firstParentDays !== 1 ? 's' : ''}</span>
              <span>5</span>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-gray-600">Net pro-rata income:</span>
                <span className="font-semibold text-gray-900">
                  ${Math.round(calculateAfterTaxIncome(firstParentProRataIncome)).toLocaleString()}/year
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Parent 2 */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 md:p-4">
          <h3 className="text-xs md:text-sm font-semibold text-gray-900 mb-2">Parent 2</h3>
          
          <div className="mb-3">
            <div className="flex justify-between text-xs md:text-sm">
              <span className="text-gray-600">Net full-time income:</span>
              <span className="font-semibold text-gray-900">
                ${Math.round(calculateAfterTaxIncome(secondParentFTEIncome)).toLocaleString()}/year
              </span>
            </div>
          </div>
          
          {/* Slider for Parent 2 */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
              Days per week
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="1"
              value={secondParentDays}
              onChange={(e) => setSecondParentDays(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>0</span>
              <span className="font-semibold text-gray-900">{secondParentDays} day{secondParentDays !== 1 ? 's' : ''}</span>
              <span>5</span>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-gray-600">Net pro-rata income:</span>
                <span className="font-semibold text-gray-900">
                  ${Math.round(calculateAfterTaxIncome(secondParentProRataIncome)).toLocaleString()}/year
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Days Covered by Non-Parents */}
      <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
        <h3 className="text-xs md:text-sm font-semibold text-gray-900 mb-1">Support network care days</h3>
        <p className="text-xs text-gray-600 mb-2">Some families are fortunate enough to have a support network willing to look after children while the parents are working. This input configures the number of days that families don't need childcare for even though they're working. For example, if a grandparent or other family member cares for the children.</p>
        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">
            Days per week
          </label>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={daysCoveredByNonParents}
            onChange={(e) => setDaysCoveredByNonParents(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>0</span>
            <span className="font-semibold text-gray-900">{daysCoveredByNonParents} day{daysCoveredByNonParents !== 1 ? 's' : ''}</span>
            <span>5</span>
          </div>
        </div>
      </div>
      
      {/* Childcare Days Needed */}
      <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
        <h3 className="text-xs md:text-sm font-semibold text-gray-900 mb-2">Childcare Days Needed</h3>
        <div className="space-y-2 text-xs md:text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total days per week:</span>
            <span className="font-medium text-gray-900">{totalDaysNeeded} days</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Days covered by parents:</span>
            <span className="font-medium text-gray-900 text-right">
              {totalDaysCoveredByParents} days
              {totalDaysCoveredByParents > 0 && (
                <div className="text-gray-500 text-xs font-normal mt-0.5">
                  (Parent 1: {daysCoveredByParents}, Parent 2: {daysCoveredBySecondParent})
                </div>
              )}
            </span>
          </div>
          {daysCoveredByNonParents > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Days covered by support network:</span>
              <span className="font-medium text-gray-900">
                {daysCoveredByNonParents} day{daysCoveredByNonParents !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-orange-200 pt-2">
            <span className="text-gray-600">Total days covered:</span>
            <span className="font-medium text-gray-900">
              {totalDaysCovered} days
            </span>
          </div>
          <div className="flex justify-between border-t border-orange-200 pt-2">
            <span className="font-semibold text-gray-900">Childcare days needed:</span>
            <span className="font-bold text-orange-700">{childcareDaysNeeded} day{childcareDaysNeeded !== 1 ? 's' : ''}/week</span>
          </div>
        </div>
        
        {/* Childcare Costs Breakdown */}
        {childcareDaysNeeded > 0 && (
          <div className="mt-4 pt-4 border-t border-orange-200">
            <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-2">Childcare Costs (Annual)</h4>
            <div className="bg-white rounded-md p-2 md:p-3 space-y-2">
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-gray-600">Total cost:</span>
                <span className="font-medium text-gray-900">
                  ${Math.round(partTimeCosts.totalChildcareCost * 26).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs md:text-sm">
                <span className="text-gray-600">Subsidy received:</span>
                <span className="font-medium text-gray-700">
                  ${Math.round(partTimeCosts.totalChildcareSubsidy * 26).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs md:text-sm border-t border-gray-200 pt-2">
                <span className="font-semibold text-gray-900">Out-of-pocket:</span>
                <span className="font-bold text-orange-700">
                  ${Math.round(partTimeChildcareOutOfPocket).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Cost/Benefit Breakdown */}
      <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
        <h3 className="text-xs md:text-base font-semibold text-gray-900 mb-3 md:mb-4">Cost/Benefit Breakdown</h3>
        
        {bothFullTime && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-4 rounded">
            <p className="text-xs md:text-sm text-gray-800">
              <strong>Try adjusting the sliders above:</strong> Reduce the days worked by one or both parents to see how sharing the childcare load affects household finances. The effective hourly rate for working an extra day shows what families actually earn after tax and childcare costs.
            </p>
          </div>
        )}
        
        {(firstParentDays < 5 || secondParentDays < 5) && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded">
            <p className="text-xs md:text-sm text-gray-800">
              <strong>New perspective:</strong> Instead of thinking "it costs $X to work part-time", consider what people effectively earn per hour when they work an <em>extra</em> day after accounting for tax and childcare costs.
            </p>
          </div>
        )}
        
        <div className="space-y-4 md:space-y-6">
          {/* Parent 1 Breakdown */}
          {firstParentDays < 5 && (
            <div className="bg-white rounded-md p-3 md:p-4 border border-gray-200">
              <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-2">
                Parent 1 ({firstParentDays} day{firstParentDays !== 1 ? 's' : ''} per week)
              </h4>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Days covering childcare:</span>
                  <span className="font-medium text-gray-900">
                    {daysCoveredByParents} day{daysCoveredByParents !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lost income (vs full-time):</span>
                  <span className="font-medium text-gray-900">
                    ${Math.round(firstParentLostIncomeAfterTax).toLocaleString()}
                  </span>
                </div>
                <div className="pl-4 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Gross:</span>
                    <span>${Math.round(firstParentLostIncomeGross).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax saved:</span>
                    <span>${Math.round(firstParentTaxSaved).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Saved childcare:</span>
                  <span className="font-medium text-green-700">
                    ${Math.round(firstParentSavedChildcare).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">
                    {firstParentNetCost >= 0 ? 'Net cost vs full-time:' : 'Net benefit vs full-time:'}
                  </span>
                  <span className={`font-bold ${firstParentNetCost >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.round(Math.abs(firstParentNetCost)).toLocaleString()}
                  </span>
                </div>
                {firstParentDaysToAdd > 0 && (
                  <div className="border-t-2 border-gray-300 pt-3 mt-3">
                    <p className="text-xs md:text-sm text-gray-600 mb-3">
                    What is the effective hourly rate for working additional days to reach full-time (after tax and childcare)?
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Additional paid work hours:</span>
                        <span className="font-medium text-gray-900">
                          {Math.round(firstParentHoursNotInPaidWork).toLocaleString()} hours/year
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Net additional income:</span>
                        <span className="font-medium text-gray-900">
                          ${Math.round(firstParentNetBenefitPerExtraDay).toLocaleString()}/year
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-900">Net hourly rate:</span>
                        <span className={`font-bold text-base ${
                          firstParentEffectiveHourlyRate < 0 
                            ? 'text-red-600' 
                            : firstParentEffectiveHourlyRate < MINIMUM_WAGE_AFTER_TAX
                            ? 'text-orange-600'
                            : 'text-gray-900'
                        }`}>
                          ${firstParentEffectiveHourlyRate.toFixed(2)}/hour
                        </span>
                      </div>
                      {firstParentEffectiveHourlyRate < 0 && (
                        <p className="text-xs text-red-600 mt-1 text-right">
                          Working full time results in a net loss
                        </p>
                      )}
                      {firstParentEffectiveHourlyRate >= 0 && firstParentEffectiveHourlyRate < MINIMUM_WAGE_AFTER_TAX && (
                        <p className="text-xs text-orange-600 mt-1 text-right">
                          Working full time results in earnings below minimum wage (${MINIMUM_WAGE_AFTER_TAX.toFixed(2)}/h after tax)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Parent 2 Breakdown */}
          {secondParentDays < 5 && (
            <div className="bg-white rounded-md p-3 md:p-4 border border-gray-200">
              <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-2">
                Parent 2 ({secondParentDays} day{secondParentDays !== 1 ? 's' : ''} per week)
              </h4>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Days covering childcare:</span>
                  <span className="font-medium text-gray-900">
                    {daysCoveredBySecondParent} day{daysCoveredBySecondParent !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lost income (vs full-time):</span>
                  <span className="font-medium text-gray-900">
                    ${Math.round(secondParentLostIncomeAfterTax).toLocaleString()}
                  </span>
                </div>
                <div className="pl-4 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Gross:</span>
                    <span>${Math.round(secondParentLostIncomeGross).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax saved:</span>
                    <span>${Math.round(secondParentTaxSaved).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Saved childcare:</span>
                  <span className="font-medium text-green-700">
                    ${Math.round(secondParentSavedChildcare).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">
                    {secondParentNetCost >= 0 ? 'Net cost vs full-time:' : 'Net benefit vs full-time:'}
                  </span>
                  <span className={`font-bold ${secondParentNetCost >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ${Math.round(Math.abs(secondParentNetCost)).toLocaleString()}
                  </span>
                </div>
                {secondParentDaysToAdd > 0 && (
                  <div className="border-t-2 border-gray-300 pt-3 mt-3">
                    <p className="text-xs md:text-sm text-gray-600 mb-3">
                    What is the effective hourly rate for working additional days to reach full-time (after tax and childcare)?
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Additional paid work hours:</span>
                        <span className="font-medium text-gray-900">
                          {Math.round(secondParentHoursNotInPaidWork).toLocaleString()} hours/year
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Net additional income:</span>
                        <span className="font-medium text-gray-900">
                          ${Math.round(secondParentNetBenefitPerExtraDay).toLocaleString()}/year
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-900">Net hourly rate:</span>
                        <span className={`font-bold text-base ${
                          secondParentEffectiveHourlyRate < 0 
                            ? 'text-red-600' 
                            : secondParentEffectiveHourlyRate < MINIMUM_WAGE_AFTER_TAX
                            ? 'text-orange-600'
                            : 'text-gray-900'
                        }`}>
                          ${secondParentEffectiveHourlyRate.toFixed(2)}/hour
                        </span>
                      </div>
                      {secondParentEffectiveHourlyRate < 0 && (
                        <p className="text-xs text-red-600 mt-1 text-right">
                          Working full time results in a net loss
                        </p>
                      )}
                      {secondParentEffectiveHourlyRate >= 0 && secondParentEffectiveHourlyRate < MINIMUM_WAGE_AFTER_TAX && (
                        <p className="text-xs text-orange-600 mt-1 text-right">
                          Working full time results in earnings below minimum wage (${MINIMUM_WAGE_AFTER_TAX.toFixed(2)}/h after tax)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Family Support Breakdown */}
          {daysCoveredByNonParents > 0 && (
            <div className="bg-white rounded-md p-3 md:p-4 border border-gray-200">
              <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-2">
                Family support days ({daysCoveredByNonParents} day{daysCoveredByNonParents !== 1 ? 's' : ''} per week)
              </h4>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Days covering childcare:</span>
                  <span className="font-medium text-gray-900">
                    {daysCoveredByNonParents} day{daysCoveredByNonParents !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="font-semibold text-gray-900">Saved childcare:</span>
                  <span className="font-bold text-green-700">
                    ${Math.round(familySupportSavedChildcare).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {/* Summary */}
          {(firstParentDays < 5 || secondParentDays < 5) && (
            <div className="bg-blue-50 rounded-md p-3 md:p-4 border-2 border-blue-300 mt-4">
              <h4 className="text-xs md:text-sm font-semibold text-gray-900 mb-1">Summary</h4>
              <p className="text-xs text-gray-600 mb-3">Compared to both parents working full-time (5 days each)</p>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total lost income (vs full-time):</span>
                  <span className="font-medium text-gray-900">
                    ${Math.round(
                      (firstParentDays < 5 ? firstParentLostIncomeAfterTax : 0) +
                      (secondParentDays < 5 ? secondParentLostIncomeAfterTax : 0)
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total saved childcare (vs full-time):</span>
                  <span className="font-medium text-green-700">
                    ${Math.round(
                      (firstParentDays < 5 ? firstParentSavedChildcare : 0) +
                      (secondParentDays < 5 ? secondParentSavedChildcare : 0) +
                      (daysCoveredByNonParents > 0 ? familySupportSavedChildcare : 0)
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t-2 border-blue-200 pt-2">
                  {(() => {
                    const totalNetCost = (firstParentDays < 5 ? firstParentNetCost : 0) +
                      (secondParentDays < 5 ? secondParentNetCost : 0) -
                      (daysCoveredByNonParents > 0 ? familySupportSavedChildcare : 0)
                    return (
                      <>
                        <span className="font-semibold text-gray-900">
                          {totalNetCost >= 0 ? 'Total net cost vs full-time:' : 'Total net benefit vs full-time:'}
                        </span>
                        <span className={`font-bold text-lg ${totalNetCost >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ${Math.round(Math.abs(totalNetCost)).toLocaleString()}
                        </span>
                      </>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Bar Graph Comparison */}
      {!bothFullTime && (
        <div className="mb-4 md:mb-6">
          <h3 className="text-xs md:text-base font-semibold text-gray-900 mb-2 md:mb-3 text-center">
            Comparison: Full-Time vs Part-Time Arrangement
          </h3>
          <div className="w-full h-[450px] md:h-[400px] overflow-visible">
            <Bar data={chartData} options={chartOptions} />
          </div>
          <div className="mt-3 space-y-2 text-xs md:text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Full-time net income:</span>
              <span className="font-semibold text-gray-900">
                ${Math.round(fullTimeNetIncome).toLocaleString()}/year
              </span>
            </div>
            <div className="flex justify-between">
              <span>Part-time net income:</span>
              <span className="font-semibold text-gray-900">
                ${Math.round(partTimeNetIncome).toLocaleString()}/year
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">Difference:</span>
              <span className={`font-bold ${partTimeNetIncome >= fullTimeNetIncome ? 'text-green-600' : 'text-red-600'}`}>
                {partTimeNetIncome >= fullTimeNetIncome ? '+' : ''}
                ${Math.round(partTimeNetIncome - fullTimeNetIncome).toLocaleString()}/year
              </span>
            </div>
            {totalAdditionalHours > 0 && (
              <>
                <div className="flex justify-between border-t-2 border-gray-300 pt-2 mt-2">
                  <span className="text-gray-600">Hours not in paid work:</span>
                  <span className="font-medium text-gray-900">
                    {Math.round(totalAdditionalHours).toLocaleString()} hours/year
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-900">Effective net hourly rate to work:</span>
                  <span className={`font-bold text-base ${
                    combinedEffectiveHourlyRate < 0 
                      ? 'text-red-600' 
                      : combinedEffectiveHourlyRate < MINIMUM_WAGE_AFTER_TAX
                      ? 'text-orange-600'
                      : 'text-gray-900'
                  }`}>
                    ${combinedEffectiveHourlyRate.toFixed(2)}/hour
                  </span>
                </div>
                {combinedEffectiveHourlyRate < 0 && (
                  <p className="text-xs text-red-600 mt-1 text-right">
                    Working full time results in a net loss
                  </p>
                )}
                {combinedEffectiveHourlyRate >= 0 && combinedEffectiveHourlyRate < MINIMUM_WAGE_AFTER_TAX && (
                  <p className="text-xs text-orange-600 mt-1 text-right">
                    Working full time results in earnings below minimum wage (${MINIMUM_WAGE_AFTER_TAX.toFixed(2)}/h after tax)
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Single bar when both are full-time */}
      {bothFullTime && (
        <div className="mb-4 md:mb-6">
          <h3 className="text-xs md:text-base font-semibold text-gray-900 mb-2 md:mb-3 text-center">
            Full-Time Arrangement Breakdown
          </h3>
          <div className="w-full h-[450px] md:h-[400px] overflow-visible">
            <Bar data={chartData} options={chartOptions} />
          </div>
          <div className="mt-3 space-y-2 text-xs md:text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Gross income:</span>
              <span className="font-semibold text-gray-900">
                ${Math.round(fullTimeCombinedIncome).toLocaleString()}/year
              </span>
            </div>
            <div className="flex justify-between">
              <span>Tax:</span>
              <span className="font-semibold text-gray-900">
                ${Math.round(fullTimeTax).toLocaleString()}/year
              </span>
            </div>
            <div className="flex justify-between">
              <span>Childcare out-of-pocket:</span>
              <span className="font-semibold text-gray-900">
                ${Math.round(fullTimeChildcareOutOfPocket).toLocaleString()}/year
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="font-semibold text-gray-900">Net income:</span>
              <span className="font-bold text-gray-900">
                ${Math.round(fullTimeNetIncome).toLocaleString()}/year
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

