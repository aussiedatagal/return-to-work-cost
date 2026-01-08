import { useState, useEffect } from 'react'
import {
  type Child,
  HOURLY_RATE_CAP_UNDER_SCHOOL_AGE,
  HOURLY_RATE_CAP_SCHOOL_AGE,
  ACTIVITY_THRESHOLD_FOR_MAX_HOURS,
  MAX_SUBSIDISED_HOURS,
  MIN_SUBSIDISED_HOURS,
} from '../utils/subsidyCalculations'
import { calculateSecondParentScenario, type SecondParentScenario } from '../utils/advocacyCalculator'
import { calculateMinimumWageAfterTaxForHours } from '../utils/graphData'
import { calculateAfterTaxIncome } from '../utils/taxCalculations'
import { getShareableUrl, decodeStateFromUrl } from '../utils/shareUtils'
import IncomeGraph from './IncomeGraph'
import HoursWorkedGraph from './HoursWorkedGraph'
import SharingChildcareLoad from './SharingChildcareLoad'
import SourceModal from './SourceModal'

// Based on ABS Characteristics of Employment (released Aug 2024, data to Aug 2024)
// NSW median full-time female: $1,700/week
// Greater Sydney median full-time female: $1,809.67/week = $94,103/year (calculated from NSW figure adjusted by GS/NSW ratio 1.0645)
//   Ratio source: Greater Sydney median earnings (all females) $1,380 / NSW median (all females) $1,297 = 1.0645
// NSW median full-time male: $1,891.33/week
// Greater Sydney median full-time male: $2,009.54/week = $104,496/year (calculated from NSW figure adjusted by GS/NSW ratio 1.0625)
//   Ratio source: Greater Sydney median earnings (all males) $1,700 / NSW median (all males) $1,600 = 1.0625
const DEFAULT_FIRST_PARENT_INCOME = 104496  // Median Greater Sydney full-time male (ABS Characteristics of Employment Aug 2024, Table 2)
const DEFAULT_SECOND_PARENT_INCOME = 94103  // Median Greater Sydney full-time female (ABS Characteristics of Employment Aug 2024, Table 2)
const DEFAULT_CHILDCARE_HOURLY_RATE = 16.00  // Typical Sydney childcare rate (Department of Education Quarterly Reports 2025-2026)
const DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE = 11  // Typical long day care session (e.g., 7am-6pm)
const DEFAULT_HOURS_PER_DAY_SCHOOL_AGE = 3.5  // Typical before/after school care (e.g., 7am-9am before school + 3pm-6pm after school, or just after school)
const DEFAULT_SECOND_PARENT_HOURS_PER_WEEK = 38  // Full-time (38h/week = 76h/fortnight)
const DEFAULT_FIRST_PARENT_HOURS_PER_WEEK = 38  // Full-time (38h/week = 76h/fortnight)

// Get default hours per day based on age
const getDefaultHoursPerDay = (age: 'under-school' | 'school-age'): number => {
  return age === 'under-school' ? DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE : DEFAULT_HOURS_PER_DAY_SCHOOL_AGE
}

// Get default hourly rate (same for all ages)
const getDefaultHourlyRate = (): number => {
  return DEFAULT_CHILDCARE_HOURLY_RATE
}

export default function Calculator() {
  const [familyType, setFamilyType] = useState<'two-parent' | 'single-parent'>('two-parent')
  const [firstParentIncome, setFirstParentIncome] = useState(DEFAULT_FIRST_PARENT_INCOME)
  const [firstParentIncomeInput, setFirstParentIncomeInput] = useState(String(DEFAULT_FIRST_PARENT_INCOME))
  const [selectedSecondParentIncome, setSelectedSecondParentIncome] = useState(DEFAULT_SECOND_PARENT_INCOME)
  const [secondParentIncomeInput, setSecondParentIncomeInput] = useState(String(DEFAULT_SECOND_PARENT_INCOME))
  // Default activity hours: both parents full-time (76h/fortnight each), so minimum is 76h/fortnight
  const [firstParentHoursPerWeek, setFirstParentHoursPerWeek] = useState(DEFAULT_FIRST_PARENT_HOURS_PER_WEEK)
  const [firstParentHoursInput, setFirstParentHoursInput] = useState(String(DEFAULT_FIRST_PARENT_HOURS_PER_WEEK))
  const [secondParentHoursPerWeek, setSecondParentHoursPerWeek] = useState(DEFAULT_SECOND_PARENT_HOURS_PER_WEEK)
  const [secondParentHoursInput, setSecondParentHoursInput] = useState(String(DEFAULT_SECOND_PARENT_HOURS_PER_WEEK))
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  
  // Calculate activity hours for subsidy: 
  // - Two-parent: uses the parent with the LOWEST activity hours (not combined)
  // - Single-parent: uses only the parent's activity hours
  // Source: Services Australia - the parent with the lower activity level determines subsidised hours
  const calculateActivityHoursForSubsidy = () => {
    if (familyType === 'single-parent') {
      // Single parent: use only their hours
      return secondParentHoursPerWeek * 2
    }
    // Two-parent: use minimum of both parents' hours
    const firstParentFortnightly = firstParentHoursPerWeek * 2
    const secondParentFortnightly = secondParentHoursPerWeek * 2
    return Math.min(firstParentFortnightly, secondParentFortnightly)
  }
  
  const activityHoursPerFortnight = calculateActivityHoursForSubsidy()
  const [modalOpen, setModalOpen] = useState<'secondParentIncome' | 'firstParentIncome' | 'childcareRate' | 'subsidisedHours' | 'hoursPerDay' | 'hourlyRateCap' | null>(null)
  const [configModalOpen, setConfigModalOpen] = useState<'secondParent' | 'firstParent' | 'childcare' | null>(null)
  
  // Calculate default days per week based on parent with lowest work hours (for two-parent families)
  // or the single parent's hours (for single-parent families)
  // Assuming 7.6 hours per day (standard work day)
  const calculateDaysPerWeekFromHours = (hoursPerWeek: number) => {
    const hoursPerDay = 7.6
    return Math.round(hoursPerWeek / hoursPerDay)
  }
  
  // Get the minimum hours for childcare days calculation
  const getMinimumHoursForChildcareDays = () => {
    if (familyType === 'single-parent') {
      return secondParentHoursPerWeek
    }
    return Math.min(firstParentHoursPerWeek, secondParentHoursPerWeek)
  }
  
  const defaultDaysPerWeek = calculateDaysPerWeekFromHours(Math.min(DEFAULT_FIRST_PARENT_HOURS_PER_WEEK, DEFAULT_SECOND_PARENT_HOURS_PER_WEEK))
  
  const [children, setChildren] = useState<Child[]>(() => [
    { age: 'under-school', hoursPerDay: DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE, daysPerWeek: defaultDaysPerWeek, hourlyRate: DEFAULT_CHILDCARE_HOURLY_RATE, isSecondOrLater: false },
    { age: 'under-school', hoursPerDay: DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE, daysPerWeek: defaultDaysPerWeek, hourlyRate: DEFAULT_CHILDCARE_HOURLY_RATE, isSecondOrLater: true }
  ])

  // Get default state for comparison and URL encoding
  const getDefaultState = () => {
    return {
      familyType: 'two-parent' as const,
      firstParentIncome: DEFAULT_FIRST_PARENT_INCOME,
      firstParentHoursPerWeek: DEFAULT_FIRST_PARENT_HOURS_PER_WEEK,
      secondParentIncome: DEFAULT_SECOND_PARENT_INCOME,
      secondParentHoursPerWeek: DEFAULT_SECOND_PARENT_HOURS_PER_WEEK,
      children: [
        { age: 'under-school' as const, hoursPerDay: DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE, daysPerWeek: defaultDaysPerWeek, hourlyRate: DEFAULT_CHILDCARE_HOURLY_RATE, isSecondOrLater: false },
        { age: 'under-school' as const, hoursPerDay: DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE, daysPerWeek: defaultDaysPerWeek, hourlyRate: DEFAULT_CHILDCARE_HOURLY_RATE, isSecondOrLater: true }
      ]
    }
  }

  // Restore state from URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // Only restore if there are any URL parameters
    if (params.toString()) {
      const defaults = getDefaultState()
      const decodedState = decodeStateFromUrl(params, defaults)
      
      setFamilyType(decodedState.familyType)
      setFirstParentIncome(decodedState.firstParentIncome)
      setFirstParentIncomeInput(String(decodedState.firstParentIncome))
      setSelectedSecondParentIncome(decodedState.secondParentIncome)
      setSecondParentIncomeInput(String(decodedState.secondParentIncome))
      setFirstParentHoursPerWeek(decodedState.firstParentHoursPerWeek)
      setFirstParentHoursInput(String(decodedState.firstParentHoursPerWeek))
      setSecondParentHoursPerWeek(decodedState.secondParentHoursPerWeek)
      setSecondParentHoursInput(String(decodedState.secondParentHoursPerWeek))
      setChildren(decodedState.children)
    }
  }, [])

  // Update childcare days when family type or hours change
  useEffect(() => {
    const minHours = getMinimumHoursForChildcareDays()
    const newDaysPerWeek = calculateDaysPerWeekFromHours(minHours)
    setChildren(prevChildren => 
      prevChildren.map(child => ({ ...child, daysPerWeek: newDaysPerWeek }))
    )
  }, [familyType, firstParentHoursPerWeek, secondParentHoursPerWeek])

  const handleShare = async () => {
    const shareableState = {
      familyType,
      firstParentIncome,
      firstParentHoursPerWeek,
      secondParentIncome: selectedSecondParentIncome,
      secondParentHoursPerWeek,
      children
    }
    
    const defaults = getDefaultState()
    const url = getShareableUrl(shareableState, defaults)
    
    try {
      await navigator.clipboard.writeText(url)
      setShareFeedback('Link to this scenario copied!')
      setTimeout(() => setShareFeedback(null), 3000)
    } catch {
      setShareFeedback('Failed to copy link')
      setTimeout(() => setShareFeedback(null), 3000)
    }
  }

  const handleShareDefault = async () => {
    const defaultState = getDefaultState()
    const url = getShareableUrl(defaultState, defaultState)
    
    try {
      await navigator.clipboard.writeText(url)
      setShareFeedback('Link copied!')
      setTimeout(() => setShareFeedback(null), 3000)
    } catch {
      setShareFeedback('Failed to copy link')
      setTimeout(() => setShareFeedback(null), 3000)
    }
  }
  
  const addChild = () => {
    // Use parent with lowest work hours for childcare days calculation
    const minHours = getMinimumHoursForChildcareDays()
    const currentDaysPerWeek = calculateDaysPerWeekFromHours(minHours)
    setChildren([...children, { 
      age: 'under-school', 
      hoursPerDay: DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE,
      daysPerWeek: currentDaysPerWeek,
      hourlyRate: DEFAULT_CHILDCARE_HOURLY_RATE,
      isSecondOrLater: children.length >= 1 
    }])
  }
  
  const removeChild = (index: number) => {
    const newChildren = children.filter((_, i) => i !== index)
    newChildren.forEach((child, i) => {
      child.isSecondOrLater = i >= 1
    })
    setChildren(newChildren)
  }
  
  const updateChild = (index: number, updates: Partial<Child>) => {
    const newChildren = [...children]
    const child = newChildren[index]
    newChildren[index] = { ...child, ...updates }
    
    // If age changes, update hours per day and hourly rate to age-appropriate defaults
    if (updates.age !== undefined && updates.age !== child.age) {
      newChildren[index].hoursPerDay = getDefaultHoursPerDay(updates.age)
      newChildren[index].hourlyRate = getDefaultHourlyRate()
    }
    
    if (updates.isSecondOrLater !== undefined) {
      newChildren.forEach((child, i) => {
        child.isSecondOrLater = i >= 1
      })
    }
    setChildren(newChildren)
  }
  
  const scenario: SecondParentScenario = {
    firstParentIncome: familyType === 'single-parent' ? 0 : firstParentIncome,
    secondParentIncome: selectedSecondParentIncome,
    children,
    activityHoursPerFortnight,
    secondParentHoursPerFortnight: secondParentHoursPerWeek * 2, // Convert weekly to fortnightly
  }
  
  const breakdown = calculateSecondParentScenario(scenario)
  
  // For total costs: calculate per day based on days per week the parents pay
  // This is the number of days per week (typically same for all children), not total days across all children
  // If children have different days per week, use the maximum (representing the actual days parents pay)
  const daysPerWeekForParents = children.length > 0 
    ? Math.max(...children.map(child => child.daysPerWeek))
    : 0
  const daysPerYearForParents = daysPerWeekForParents * 52
  
  const calculatePerDayForTotal = (annual: number) => {
    return daysPerYearForParents > 0 ? annual / daysPerYearForParents : 0
  }
  
  // Calculate minimum wage after tax for the actual hours worked
  const minimumWageForHours = calculateMinimumWageAfterTaxForHours(secondParentHoursPerWeek)
  const isOutrageous = breakdown.netIncomeAfterChildcare < minimumWageForHours

  // Check if current state differs from defaults
  const hasCustomizations = () => {
    // Check family type
    if (familyType !== 'two-parent') return true
    
    // Check first parent income and hours
    if (firstParentIncome !== DEFAULT_FIRST_PARENT_INCOME) return true
    if (firstParentHoursPerWeek !== DEFAULT_FIRST_PARENT_HOURS_PER_WEEK) return true
    
    // Check second parent income and hours
    if (selectedSecondParentIncome !== DEFAULT_SECOND_PARENT_INCOME) return true
    if (secondParentHoursPerWeek !== DEFAULT_SECOND_PARENT_HOURS_PER_WEEK) return true
    
    // Check children - default is 2 children, both under-school, with default values
    const defaultDaysPerWeek = calculateDaysPerWeekFromHours(Math.min(DEFAULT_FIRST_PARENT_HOURS_PER_WEEK, DEFAULT_SECOND_PARENT_HOURS_PER_WEEK))
    if (children.length !== 2) return true
    
    const defaultChild1 = {
      age: 'under-school' as const,
      hoursPerDay: DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE,
      daysPerWeek: defaultDaysPerWeek,
      hourlyRate: DEFAULT_CHILDCARE_HOURLY_RATE,
      isSecondOrLater: false
    }
    const defaultChild2 = {
      age: 'under-school' as const,
      hoursPerDay: DEFAULT_HOURS_PER_DAY_UNDER_SCHOOL_AGE,
      daysPerWeek: defaultDaysPerWeek,
      hourlyRate: DEFAULT_CHILDCARE_HOURLY_RATE,
      isSecondOrLater: true
    }
    
    const child1 = children[0]
    const child2 = children[1]
    
    if (!child1 || !child2) return true
    if (child1.age !== defaultChild1.age || child1.hoursPerDay !== defaultChild1.hoursPerDay ||
        child1.daysPerWeek !== defaultChild1.daysPerWeek || child1.hourlyRate !== defaultChild1.hourlyRate ||
        child1.isSecondOrLater !== defaultChild1.isSecondOrLater) return true
    if (child2.age !== defaultChild2.age || child2.hoursPerDay !== defaultChild2.hoursPerDay ||
        child2.daysPerWeek !== defaultChild2.daysPerWeek || child2.hourlyRate !== defaultChild2.hourlyRate ||
        child2.isSecondOrLater !== defaultChild2.isSecondOrLater) return true
    
    return false
  }

  const hasChanges = hasCustomizations()
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-2 md:px-4 py-4 md:py-12">
        <header className="mb-3 md:mb-6 text-center">
          <h1 className="text-xl md:text-4xl font-bold text-gray-900 mb-1 md:mb-3">
            The 100-Hour Trap<br />
            <span className="text-lg md:text-3xl">Why CCS Fails Full-Time Families</span>
          </h1>
          <div className="text-xs md:text-base text-gray-600 max-w-3xl mx-auto px-2 md:px-4">
            <p className="mb-2 md:mb-3">
              The Child Care Subsidy (CCS) is capped at 100 hours per fortnight, but many centres operate on 11-hour+ daily sessions. This means 10 days of care often equals 110+ hours, leaving families paying full fees for those extra 10+ hours and often wiping out the financial benefit of working that 5th day.
            </p>
            <p className="text-gray-500 italic">
              Scroll down to explore how childcare costs affect your family's net income, and use the sliders at the bottom to find the optimal configuration for your family.
            </p>
          </div>
        </header>
        
        <div id="income-graph" className="bg-white rounded-lg shadow-lg p-2 md:p-8 mb-3 md:mb-8">
          <IncomeGraph
            firstParentIncome={familyType === 'single-parent' ? 0 : firstParentIncome}
            children={children}
            activityHoursPerFortnight={activityHoursPerFortnight}
            secondParentHoursPerFortnight={secondParentHoursPerWeek * 2}
            defaultFirstParentIncome={DEFAULT_FIRST_PARENT_INCOME}
            selectedSecondParentIncome={selectedSecondParentIncome}
            defaultSecondParentIncome={DEFAULT_SECOND_PARENT_INCOME}
            onConfigureFirstParentIncome={() => setConfigModalOpen('firstParent')}
            onConfigureChildren={() => setConfigModalOpen('childcare')}
            onConfigureSecondParentIncome={() => setConfigModalOpen('secondParent')}
            onOpenSourceModal={setModalOpen}
            familyType={familyType}
          />
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-2.5 md:p-8 mb-3 md:mb-8">
          <div className="text-center mb-3 md:mb-6">
            <h2 className="text-base md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">
              Detailed Breakdown
            </h2>
            <p className="text-xs md:text-base text-gray-600 mb-1.5 md:mb-2">
              {familyType === 'single-parent' 
                ? 'Single parent working: what they actually take home'
                : 'Net increase in family income when second parent returns to work (after tax and childcare)'}
            </p>
            <p className="text-xs md:text-sm text-gray-500 mb-2 md:mb-3">
              Using data for a typical Sydney family (click on the <span className="inline-block w-3 h-3 align-middle mx-0.5"><svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span> for sources). Change to different scenarios using the <span className="inline-block w-3 h-3 align-middle mx-0.5"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></span> icon.
            </p>
                </div>
                
          <div className="space-y-2.5 md:space-y-6">
            <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3 md:p-6 mb-3 md:mb-4">
              <div className="flex justify-between items-center mb-2 md:mb-2">
                <span className="text-xs md:text-lg font-semibold text-gray-900 pr-2">Already Working Parent</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfigModalOpen('firstParent')}
                    className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center"
                    title="Configure"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen('firstParentIncome')}
                    className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center"
                    title="Why this income?"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              {familyType === 'two-parent' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-baseline pb-1 border-b border-gray-200">
                    <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Work hours:</span>
                    <span className="text-xs md:text-sm text-gray-600 text-right font-medium">{firstParentHoursPerWeek}h/week</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Gross Income (before tax)</span>
                    <span className="text-xs md:text-sm font-semibold text-gray-900 text-right">
                      ${firstParentIncome.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Tax</span>
                    <span className="text-xs md:text-sm font-semibold text-gray-700 text-right">
                      -${(firstParentIncome - calculateAfterTaxIncome(firstParentIncome)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Net Income (after tax)</span>
                    <span className="text-sm md:text-base font-bold text-gray-900 text-right">
                      ${calculateAfterTaxIncome(firstParentIncome).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {familyType === 'single-parent' && (
                <div className="text-xs md:text-sm text-gray-500 italic pt-1">
                  This parent isn't included in the calculation
                </div>
              )}
            </div>
          
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 md:p-6 mb-3 md:mb-4">
              <div className="flex justify-between items-center mb-2 md:mb-2">
                <span className="text-xs md:text-lg font-semibold text-gray-900 pr-2">
                  {familyType === 'single-parent' ? 'Parent' : 'Parent Returning to Work'}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfigModalOpen('secondParent')}
                    className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center"
                    title="Configure"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen('secondParentIncome')}
                    className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center"
                    title="Why this income?"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline pb-1 border-b border-blue-200">
                  <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Work hours:</span>
                  <span className="text-xs md:text-sm text-gray-600 text-right font-medium">{secondParentHoursPerWeek}h/week</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Gross Income (before tax)</span>
                  <span className="text-base md:text-xl font-semibold text-gray-900 text-right">
                    ${breakdown.secondParentGrossIncome.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Tax</span>
                  <span className="text-sm md:text-base font-semibold text-gray-700 text-right">
                    -${(breakdown.secondParentGrossIncome - breakdown.secondParentAfterTax).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs md:text-sm text-gray-600 min-w-[100px]">Net Income (after tax)</span>
                  <span className="text-xl md:text-3xl font-bold text-gray-900 text-right">
                    ${breakdown.secondParentAfterTax.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <div className="text-2xl md:text-3xl text-gray-400">↓</div>
            </div>
            
            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-3 md:p-6">
              <div className="space-y-3 md:space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 md:mb-2 gap-2">
                  <span className="text-xs md:text-lg font-semibold text-gray-900">Childcare Costs (Annual)</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfigModalOpen('childcare')}
                      className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center"
                      title="Configure"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalOpen('childcareRate')}
                      className="text-blue-600 hover:text-blue-800 w-4 h-4 flex items-center justify-center"
                      title="Why this rate?"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="text-xs md:text-sm text-gray-600 mb-2 md:mb-3 pb-2 md:pb-3 border-b border-orange-200">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1">
                    <span>Subsidised hours (per child):</span>
                    <span className="font-medium text-gray-700">
                      {activityHoursPerFortnight >= ACTIVITY_THRESHOLD_FOR_MAX_HOURS 
                        ? `${MAX_SUBSIDISED_HOURS / 2}h/week`
                        : `${MIN_SUBSIDISED_HOURS / 2}h/week`}
                    </span>
                  </div>
                </div>
                
                {breakdown.childcareCosts.childDetails.length > 0 && (
                  <div className="bg-white rounded-md p-2 md:p-4 space-y-3 md:space-y-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">Per Child Breakdown:</p>
                    {breakdown.childcareCosts.childDetails.map((child, index) => {
                      const dailyRate = children[index] ? children[index].hourlyRate * children[index].hoursPerDay : 0
                      const totalHoursPerWeek = children[index] ? children[index].hoursPerDay * children[index].daysPerWeek : 0
                      const subsidisedHoursPerWeek = 'subsidisedHours' in child && child.subsidisedHours ? child.subsidisedHours / 2 : 0
                      const unsubsidisedHoursPerWeek = 'unsubsidisedHours' in child && child.unsubsidisedHours ? child.unsubsidisedHours / 2 : 0
                      
                      return (
                      <div key={index} className="border-t border-gray-200 pt-3 md:pt-4 first:border-t-0 first:pt-0">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm md:text-base font-semibold text-gray-900">
                            Child {index + 1}
                          </span>
                          <span className="text-xs md:text-sm font-semibold text-gray-700">
                            {child.subsidyPercent.toFixed(1)}% subsidy
                          </span>
                        </div>
                        
                        {/* Care Details */}
                        <div className="bg-gray-50 rounded-md p-2 md:p-3 mb-3 space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-600">Rate:</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-sm font-semibold text-gray-900 text-right">${dailyRate.toFixed(2)}/day</span>
                              {children[index]?.hoursPerDay > 0 && (
                                <span className="text-xs text-gray-500 text-right">(${children[index].hourlyRate.toFixed(2)}/hr)</span>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-600">Hours per week:</span>
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-sm font-medium text-gray-900 text-right">{totalHoursPerWeek.toFixed(1)}h</span>
                              {subsidisedHoursPerWeek > 0 && (
                                <span className="text-xs text-gray-600 text-right">
                                  {subsidisedHoursPerWeek.toFixed(1)}h subsidised
                                  {unsubsidisedHoursPerWeek > 0 && `, ${unsubsidisedHoursPerWeek.toFixed(1)}h unsubsidised`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Cost Breakdown */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-600">Annual cost:</span>
                            <span className="text-sm font-semibold text-red-600">-${Math.round(child.totalCost).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-600">Subsidy:</span>
                            <span className="text-sm font-semibold text-green-600">+${Math.round(child.subsidyAmount).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-baseline border-t border-gray-200 pt-2">
                            <span className="text-xs font-medium text-gray-700">Out-of-pocket:</span>
                            <span className="text-sm font-bold text-red-600">-${Math.round(child.outOfPocket).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
                
                <div className="text-xs md:text-sm text-gray-600 space-y-1.5 border-t border-orange-300 pt-2.5 md:pt-3">
                  <div className="flex justify-between items-start">
                    <span className="min-w-[120px]">Total childcare cost:</span>
                    <div className="text-right">
                      <div className="text-base md:text-xl font-semibold text-red-600">-${Math.round(breakdown.childcareCosts.totalAnnual).toLocaleString()}</div>
                      {daysPerYearForParents > 0 && (
                        <div className="text-gray-500 text-[10px]">-${calculatePerDayForTotal(breakdown.childcareCosts.totalAnnual).toFixed(2)}/day</div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="min-w-[120px]">Total subsidy received:</span>
                    <div className="text-right">
                      <div className="text-base md:text-xl font-semibold text-green-600">+${Math.round(breakdown.childcareCosts.totalSubsidy).toLocaleString()}</div>
                      {daysPerYearForParents > 0 && (
                        <div className="text-gray-500 text-[10px]">+${calculatePerDayForTotal(breakdown.childcareCosts.totalSubsidy).toFixed(2)}/day</div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="min-w-[120px]">Out-of-pocket cost:</span>
                    <div className="text-right">
                      <div className="text-xl md:text-3xl font-bold text-red-600">-${Math.round(breakdown.childcareCosts.outOfPocketAnnual).toLocaleString()}</div>
                      {daysPerYearForParents > 0 && (
                        <div className="text-gray-500 text-[10px] font-normal">-${calculatePerDayForTotal(breakdown.childcareCosts.outOfPocketAnnual).toFixed(2)}/day</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center">
              <div className="text-2xl md:text-3xl text-gray-400">↓</div>
            </div>
            
            <div className={`rounded-lg p-2.5 md:p-8 ${isOutrageous ? 'bg-red-50' : 'bg-gray-50 border-2 border-gray-200'}`}>
              <div className="text-center">
                <p className="text-xs font-medium text-gray-600 mb-1 md:mb-2">
                  {familyType === 'single-parent' ? 'NET INCOME AFTER CHILDCARE' : 'NET HOUSEHOLD INCOME INCREASE AFTER CHILDCARE'}
                </p>
                <div className={`text-xl md:text-3xl font-bold mb-1 md:mb-2 ${isOutrageous ? 'text-red-700' : 'text-gray-700'}`}>
                  ${Math.round(breakdown.netIncomeAfterChildcare).toLocaleString()}
                </div>
                {breakdown.netIncomeAfterChildcare < 0 && (
                  <p className="text-sm md:text-base font-semibold text-red-600 mt-2 mb-1">
                    Families are paying to work
                  </p>
                )}
                {breakdown.netIncomeAfterChildcare >= 0 && isOutrageous && (
                  <p className="text-sm md:text-base font-semibold text-orange-600 mt-2 mb-1">
                    {familyType === 'single-parent' 
                      ? 'Parent will take home less than minimum wage' 
                      : 'Family\'s net income increase is less than minimum wage for the hours worked'}
                  </p>
                )}
                <p className="text-xs md:text-base text-gray-600">
                  Household income increases ${breakdown.effectiveHourlyRate.toFixed(2)}/hr worked by second parent.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div id="hours-graph" className="bg-white rounded-lg shadow-lg p-2 md:p-8 mb-3 md:mb-8">
          <div className="text-center mb-3 md:mb-4">
            <h2 className="text-base md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">
              The Diminishing Returns of Working More Days
            </h2>
            <p className="text-xs md:text-base text-gray-600">
              As income increases, the subsidy percentage decreases. Once families hit the 100-hour per fortnight cap, extra hours aren't subsidised, so each additional day brings less net income.
            </p>
          </div>
          <HoursWorkedGraph
            secondParentIncome={selectedSecondParentIncome}
            secondParentHoursPerWeek={secondParentHoursPerWeek}
            firstParentIncome={familyType === 'single-parent' ? 0 : firstParentIncome}
            firstParentHoursPerWeek={firstParentHoursPerWeek}
            children={children}
            familyType={familyType}
            onConfigureSecondParentIncome={() => setConfigModalOpen('secondParent')}
            onConfigureChildren={() => setConfigModalOpen('childcare')}
          />
        </div>
        
        {familyType === 'two-parent' && (
          <SharingChildcareLoad
            firstParentIncome={firstParentIncome}
            firstParentHoursPerWeek={firstParentHoursPerWeek}
            secondParentIncome={selectedSecondParentIncome}
            secondParentHoursPerWeek={secondParentHoursPerWeek}
            children={children}
            familyType={familyType}
          />
        )}
        
        <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-200">
          {hasChanges ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleShareDefault}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-gray-100 text-gray-700 text-sm md:text-base font-medium rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors border border-gray-300"
                title="Share with default values"
                aria-label="Share default scenario"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share default scenario</span>
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-blue-600 text-white text-sm md:text-base font-medium rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                title="Share with customized values"
                aria-label="Share my scenario"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share my scenario</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleShareDefault}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-blue-600 text-white text-sm md:text-base font-medium rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              title="Share"
              aria-label="Share"
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share</span>
            </button>
          )}
          {shareFeedback && (
            <div className="mt-3 text-xs md:text-sm text-green-600 font-medium text-center">
              {shareFeedback}
            </div>
          )}
        </div>
        
        <footer className="mt-12 pt-8 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            <a 
              href="https://aussiedatagal.github.io" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-gray-600 transition-colors"
            >
              More from Aussie Data Gal
            </a>
          </p>
        </footer>
          </div>
          
      {/* Source Modals */}
      <SourceModal
        isOpen={modalOpen === 'secondParentIncome'}
        onClose={() => setModalOpen(null)}
        title="Why This Income?"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>$94,103/year</strong> is the calculated median income for full-time female employees in Greater Sydney.
          </p>
          <p className="text-gray-700">
            The ABS doesn't publish this figure directly for Greater Sydney. It is calculated by adjusting the NSW median for full-time female employees ($1,700/week) using the Greater Sydney to NSW earnings ratio of 1.0645, resulting in $1,809.67/week ($94,103/year).
          </p>
          <p className="text-gray-700">
            We default to the female median income for the parent returning to work because mothers typically take more parental leave than fathers and are often the parent returning to work after paid parental leave ends. The median female salary is also lower than the median male salary, which means many families find that when one parent reduces work hours, it's often the lower-earning parent who does so.
          </p>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <strong>Sources:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <a href="https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/characteristics-employment-australia/aug-2024" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  ABS Characteristics of Employment (August 2024)
                </a>
              </li>
            </ul>
          </div>
        </div>
      </SourceModal>

      <SourceModal
        isOpen={modalOpen === 'firstParentIncome'}
        onClose={() => setModalOpen(null)}
        title="Why This Income?"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>$104,496/year</strong> is the calculated median income for full-time male employees in Greater Sydney.
          </p>
          <p className="text-gray-700">
            The ABS doesn't publish this figure directly for Greater Sydney. It is calculated by adjusting the NSW median for full-time male employees ($1,891.33/week) using the Greater Sydney to NSW earnings ratio of 1.0625, resulting in $2,009.54/week ($104,496/year).
          </p>
          <p className="text-gray-700">
            We default to the higher median income (male) for the already working parent because, due to the gender pay gap, many families find that when one parent reduces work hours, it's often the lower-earning parent who does so. This is also consistent with patterns where mothers typically take more parental leave than fathers.
          </p>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <strong>Sources:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <a href="https://www.abs.gov.au/statistics/labour/earnings-and-working-conditions/characteristics-employment-australia/aug-2024" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  ABS Characteristics of Employment (August 2024)
                </a>
              </li>
            </ul>
          </div>
        </div>
      </SourceModal>

      <SourceModal
        isOpen={modalOpen === 'childcareRate'}
        onClose={() => setModalOpen(null)}
        title="Why This Rate?"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            <strong>${DEFAULT_CHILDCARE_HOURLY_RATE}/hr</strong> are typical <a 
              href="https://kindicare.com/childcare/centres/Australia/NSW/2000/sydney" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Sydney childcare rates
            </a>.
          </p>
          <p className="text-gray-700">
            <strong>11hr/day</strong> (under school age), <strong>3.5hr/day</strong> (school age), typical childcare centre session hours.
          </p>
          <p className="text-gray-700">
            <strong>Subsidised hours:</strong> {activityHoursPerFortnight >= ACTIVITY_THRESHOLD_FOR_MAX_HOURS 
              ? `${MAX_SUBSIDISED_HOURS / 2}h/week`
              : `${MIN_SUBSIDISED_HOURS / 2}h/week`} per child per week
          </p>
                    <p className="text-gray-700">
            {familyType === 'single-parent' 
              ? `Based on activity hours (${secondParentHoursPerWeek}h/week):`
              : `Based on the parent with lowest activity hours (${Math.min(firstParentHoursPerWeek, secondParentHoursPerWeek)}h/week):`}
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li><strong>24+ hours/week:</strong> 50 hours/week subsidised per child</li>
            <li><strong>Less than 24 hours/week:</strong> 36 hours/week subsidised per child (3 Day Guarantee minimum)</li>
          </ul>
          <p className="text-sm text-gray-600">
            Activity hours include: paid work, study, volunteering. {familyType === 'single-parent' 
              ? 'The parent must meet the activity test.'
              : 'Both parents must meet the activity test, but the lower hours determine eligibility.'}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> Centres charge daily rates, not hourly. The subsidy cap is $14.63/hr (under school) or $12.81/hr (school age). Families pay any difference out of pocket.
          </p>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              <strong>Sources:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <a href="https://kindicare.com/childcare/centres/Australia/NSW/2000/sydney" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Sydney childcare rates: KindiCare
                </a>
              </li>
              <li>
                <a href="https://www.education.gov.au/early-childhood/about/data-and-reports/quarterly-reports#toc-2025-2026" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Typical childcare rates: Department of Education - Quarterly Reports 2025-2026
                </a>
              </li>
              <li>
                <a href="https://www.education.gov.au/early-childhood/announcements/child-care-subsidy-hourly-rate-caps-are-changing-soon-0" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Hourly rate caps: Department of Education
                </a>
              </li>
              <li>
                <a href="https://www.education.gov.au/early-childhood/providers/child-care-subsidy/3-day-guarantee" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Subsidised hours: Department of Education
                </a>
              </li>
            </ul>
          </div>
        </div>
      </SourceModal>

      <SourceModal
        isOpen={modalOpen === 'subsidisedHours'}
        onClose={() => setModalOpen(null)}
        title="Subsidised Hours"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Based on the <strong>parent with lowest activity hours</strong>:
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
            <li><strong>24+ hours/week:</strong> 50 hours/week subsidised per child</li>
            <li><strong>Less than 24 hours/week:</strong> 36 hours/week subsidised per child (3 Day Guarantee minimum)</li>
          </ul>
          <p className="text-sm text-gray-600">
            Activity hours include: paid work, study, volunteering. {familyType === 'single-parent' 
              ? 'The parent must meet the activity test.'
              : 'Both parents must meet the activity test, but the lower hours determine eligibility.'}
          </p>
          <p className="text-sm text-gray-600">
            <a href="https://www.education.gov.au/early-childhood/providers/child-care-subsidy/3-day-guarantee" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Source: Department of Education
            </a>
          </p>
        </div>
      </SourceModal>

      <SourceModal
        isOpen={modalOpen === 'hoursPerDay'}
        onClose={() => setModalOpen(null)}
        title="Hours Per Day"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            This is the <strong>session duration</strong>: hours children are booked for care. Centres charge daily rates, which we convert to hourly for subsidy calculations.
          </p>
          <p className="text-gray-700">
            <strong>Typical hours:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li><strong>Under school age:</strong> 11 hours/day (long day care, e.g., 7am-6pm)</li>
            <li><strong>School age:</strong> 3.5 hours/day (before/after school care)</li>
          </ul>
          <p className="text-sm text-gray-600">
            More hours = more of the daily cost is eligible for subsidy (up to the hourly cap: $14.63/hr under school, $12.81/hr school age).
          </p>
          <p className="text-sm text-gray-600">
            <a href="https://www.education.gov.au/early-childhood/about/data-and-reports/quarterly-reports#toc-2025-2026" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Source: Department of Education - Quarterly Reports 2025-2026
            </a>
          </p>
        </div>
      </SourceModal>

      <SourceModal
        isOpen={modalOpen === 'hourlyRateCap'}
        onClose={() => setModalOpen(null)}
        title="Hourly Rate Caps"
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            The subsidy only applies up to a maximum hourly rate. If a centre charges more, families pay the difference out of pocket.
          </p>
          <p className="text-gray-700">
            <strong>2025-26 caps (Centre-Based Day Care):</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li>Under school age: <strong>$14.63/hr</strong></li>
            <li>School age: <strong>$12.81/hr</strong></li>
          </ul>
          <p className="text-sm text-gray-600">
            <strong>Example:</strong> If a centre charges $18/hr, subsidy applies to $14.63/hr. Families pay $3.37/hr plus their share of the subsidised portion.
          </p>
          <p className="text-sm text-gray-600">
            <a href="https://www.education.gov.au/early-childhood/announcements/child-care-subsidy-hourly-rate-caps-are-changing-soon-0" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              Source: Department of Education
            </a>
          </p>
        </div>
      </SourceModal>

      {/* Configuration Modals */}
      <SourceModal
        isOpen={configModalOpen === 'secondParent'}
        onClose={() => setConfigModalOpen(null)}
        title="Configure Parent Returning to Work"
        isConfigModal={true}
        onSave={() => setConfigModalOpen(null)}
      >
        <div className="space-y-6">
                    <div>
            <label htmlFor="config-second-income" className="block text-sm font-medium text-gray-700 mb-2">
              Second Parent Income (AUD per year)
            </label>
            <input
              id="config-second-income"
              type="text"
              inputMode="numeric"
              value={secondParentIncomeInput}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '')
                setSecondParentIncomeInput(value)
                const numValue = value === '' ? 0 : Number(value)
                setSelectedSecondParentIncome(numValue)
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              step="1000"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: ${Math.round(DEFAULT_SECOND_PARENT_INCOME).toLocaleString()} pa{' '}
              <button type="button" onClick={() => { setConfigModalOpen(null); setModalOpen('secondParentIncome'); }} className="text-blue-600 hover:underline">Why this?</button>
            </p>
          </div>
          
          <div>
            <label htmlFor="config-second-hours" className="block text-sm font-medium text-gray-700 mb-2">
              Second Parent's Hours (per week)
            </label>
            <input
              id="config-second-hours"
              type="text"
              inputMode="decimal"
              value={secondParentHoursInput}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '')
                setSecondParentHoursInput(value)
                const numValue = value === '' ? 0 : Number(value)
                if (!isNaN(numValue) && numValue >= 0) {
                  setSecondParentHoursPerWeek(numValue)
                  // Recalculate days based on parent with lowest hours
                  const minHours = familyType === 'single-parent' 
                    ? numValue 
                    : Math.min(firstParentHoursPerWeek, numValue)
                  const newDaysPerWeek = calculateDaysPerWeekFromHours(minHours)
                  setChildren(prevChildren => 
                    prevChildren.map(child => ({ ...child, daysPerWeek: newDaysPerWeek }))
                  )
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min="0"
              step="0.5"
            />
            <p className="text-xs text-gray-500 mt-1">
              Default: {DEFAULT_SECOND_PARENT_HOURS_PER_WEEK} hours/week (~5 days/week)
            </p>
          </div>

        </div>
      </SourceModal>

      <SourceModal
        isOpen={configModalOpen === 'firstParent'}
        onClose={() => setConfigModalOpen(null)}
        title="Configure Already Working Parent"
        isConfigModal={true}
        onSave={() => setConfigModalOpen(null)}
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Family Type
            </label>
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setFamilyType('two-parent')}
                className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  familyType === 'two-parent'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Two Parent
              </button>
              <button
                type="button"
                onClick={() => setFamilyType('single-parent')}
                className={`flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  familyType === 'single-parent'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Single Parent
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {familyType === 'two-parent' 
                ? 'Include income from the already working parent in calculations'
                : 'Exclude income from the already working parent (single parent scenario)'}
            </p>
          </div>

          {familyType === 'two-parent' && (
            <>
              <div>
                <label htmlFor="config-first-income" className="block text-sm font-medium text-gray-700 mb-2">
                  First Parent Income (AUD per year)
                </label>
                <input
                  id="config-first-income"
                  type="text"
                  inputMode="numeric"
                  value={firstParentIncomeInput}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '')
                    setFirstParentIncomeInput(value)
                    const numValue = value === '' ? 0 : Number(value)
                    setFirstParentIncome(numValue)
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="1000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: ${DEFAULT_FIRST_PARENT_INCOME.toLocaleString()}{' '}
                  <button type="button" onClick={() => { setConfigModalOpen(null); setModalOpen('firstParentIncome'); }} className="text-blue-600 hover:underline">Why this?</button>
                </p>
              </div>
              
              <div>
                <label htmlFor="config-first-hours" className="block text-sm font-medium text-gray-700 mb-2">
                  First Parent's Work Hours (per week)
                </label>
                <input
                  id="config-first-hours"
                  type="text"
                  inputMode="numeric"
                  value={firstParentHoursInput}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9.]/g, '')
                    setFirstParentHoursInput(value)
                    const numValue = value === '' ? 0 : Number(value)
                    if (!isNaN(numValue) && numValue >= 0) {
                      setFirstParentHoursPerWeek(numValue)
                      // Recalculate days based on parent with lowest hours
                      const minHours = Math.min(numValue, secondParentHoursPerWeek)
                      const newDaysPerWeek = calculateDaysPerWeekFromHours(minHours)
                      setChildren(prevChildren => 
                        prevChildren.map(child => ({ ...child, daysPerWeek: newDaysPerWeek }))
                      )
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                  step="0.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: {DEFAULT_FIRST_PARENT_HOURS_PER_WEEK} hours/week (full-time)
                </p>
              </div>
            </>
          )}
        </div>
      </SourceModal>

      <SourceModal
        isOpen={configModalOpen === 'childcare'}
        onClose={() => setConfigModalOpen(null)}
        title="Configure Childcare"
        isConfigModal={true}
        onSave={() => setConfigModalOpen(null)}
      >
        <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-semibold text-gray-900">
                    Children in Childcare
                  </h2>
                </div>
                <button
                  onClick={addChild}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                >
                  Add Child
                </button>
              </div>
              
              <div className="space-y-4">
                {children.map((child, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-base font-medium text-gray-900">
                        Child {index + 1} {child.isSecondOrLater && '(Higher Subsidy Rate)'}
                      </h3>
                      {children.length > 1 && (
                        <button
                          onClick={() => removeChild(index)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                      <div className="relative lg:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Age Group
                        </label>
                        <select
                          value={child.age}
                          onChange={(e) => updateChild(index, { age: e.target.value as 'under-school' | 'school-age' })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          style={{ minHeight: '48px' }}
                        >
                          <option value="under-school">Under School Age</option>
                          <option value="school-age">School Age</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hours per Day
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={child.hoursPerDay === 0 ? '' : String(child.hoursPerDay)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '')
                            if (value === '') {
                              updateChild(index, { hoursPerDay: 0 })
                            } else {
                              const numValue = Number(value)
                              if (!isNaN(numValue) && numValue >= 0 && numValue <= 12) {
                                updateChild(index, { hoursPerDay: numValue })
                              }
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          max="12"
                          step="0.5"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                      Typical: <button type="button" onClick={() => { setConfigModalOpen(null); setModalOpen('hoursPerDay'); }} className="text-blue-600 hover:underline">
                            {child.age === 'under-school' ? '11 hours/day' : '3.5 hours/day'}
                          </button>
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Days per Week
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={child.daysPerWeek === 0 ? '' : String(child.daysPerWeek)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '')
                            if (value === '') {
                              updateChild(index, { daysPerWeek: 0 })
                            } else {
                              const numValue = Number(value)
                              if (!isNaN(numValue) && numValue >= 0 && numValue <= 7) {
                                updateChild(index, { daysPerWeek: numValue })
                              }
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          max="7"
                          step="1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Default: {calculateDaysPerWeekFromHours(getMinimumHoursForChildcareDays())} days/week
                        </p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hourly Rate
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={child.hourlyRate === 0 ? '' : String(child.hourlyRate)}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '')
                            if (value === '') {
                              updateChild(index, { hourlyRate: 0 })
                            } else {
                              const numValue = Number(value)
                              if (!isNaN(numValue) && numValue >= 0) {
                                updateChild(index, { hourlyRate: numValue })
                              }
                            }
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-md text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          step="0.01"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Cap: <button 
                            type="button"
                            onClick={() => { setConfigModalOpen(null); setModalOpen('hourlyRateCap'); }}
                            className="text-blue-600 hover:underline"
                          >
                            ${child.age === 'under-school' ? HOURLY_RATE_CAP_UNDER_SCHOOL_AGE : HOURLY_RATE_CAP_SCHOOL_AGE}/hr
                          </button>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Typical: <button 
                            type="button"
                            onClick={() => { setConfigModalOpen(null); setModalOpen('childcareRate'); }}
                            className="text-blue-600 hover:underline"
                          >
                            ${DEFAULT_CHILDCARE_HOURLY_RATE}/hr
                          </button>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
        </div>
      </SourceModal>
    </div>
  )
}
