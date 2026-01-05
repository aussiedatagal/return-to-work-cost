import type { Child } from './subsidyCalculations'

export interface ShareableState {
  familyType: 'two-parent' | 'single-parent'
  firstParentIncome: number
  firstParentHoursPerWeek: number
  secondParentIncome: number
  secondParentHoursPerWeek: number
  children: Child[]
}

export interface DefaultState {
  familyType: 'two-parent' | 'single-parent'
  firstParentIncome: number
  firstParentHoursPerWeek: number
  secondParentIncome: number
  secondParentHoursPerWeek: number
  children: Child[]
}

export function encodeStateToUrl(state: ShareableState, defaults: DefaultState): string {
  const params: string[] = []
  
  // Only include family type if different from default
  if (state.familyType !== defaults.familyType) {
    params.push(`ft=${state.familyType === 'two-parent' ? '2' : '1'}`)
  }
  
  // Only include first parent income if different
  if (state.firstParentIncome !== defaults.firstParentIncome) {
    params.push(`fpi=${state.firstParentIncome}`)
  }
  
  // Only include first parent hours if different
  if (state.firstParentHoursPerWeek !== defaults.firstParentHoursPerWeek) {
    params.push(`fph=${state.firstParentHoursPerWeek}`)
  }
  
  // Only include second parent income if different
  if (state.secondParentIncome !== defaults.secondParentIncome) {
    params.push(`spi=${state.secondParentIncome}`)
  }
  
  // Only include second parent hours if different
  if (state.secondParentHoursPerWeek !== defaults.secondParentHoursPerWeek) {
    params.push(`sph=${state.secondParentHoursPerWeek}`)
  }
  
  // Compare children - only include if different from defaults
  const childrenChanged = state.children.length !== defaults.children.length ||
    state.children.some((child, index) => {
      const defaultChild = defaults.children[index]
      if (!defaultChild) return true
      return child.age !== defaultChild.age ||
        child.hoursPerDay !== defaultChild.hoursPerDay ||
        child.daysPerWeek !== defaultChild.daysPerWeek ||
        child.hourlyRate !== defaultChild.hourlyRate ||
        child.isSecondOrLater !== defaultChild.isSecondOrLater
    })
  
  if (childrenChanged) {
    // Compact format: each child is "a-h-d-r-i" separated by "_"
    // a = age (u/s), h = hours, d = days, r = rate, i = isSecondOrLater (0/1)
    // Using "-" and "_" which are URL-safe and don't need encoding
    const childrenStr = state.children.map(child => {
      const age = child.age === 'under-school' ? 'u' : 's'
      const isSecond = child.isSecondOrLater ? '1' : '0'
      return `${age}-${child.hoursPerDay}-${child.daysPerWeek}-${child.hourlyRate}-${isSecond}`
    }).join('_')
    params.push(`c=${childrenStr}`)
  }
  
  return params.join('&')
}

export function decodeStateFromUrl(searchParams: URLSearchParams, defaults: DefaultState): ShareableState {
  try {
    const result: ShareableState = {
      familyType: defaults.familyType,
      firstParentIncome: defaults.firstParentIncome,
      firstParentHoursPerWeek: defaults.firstParentHoursPerWeek,
      secondParentIncome: defaults.secondParentIncome,
      secondParentHoursPerWeek: defaults.secondParentHoursPerWeek,
      children: [...defaults.children]
    }
    
    // Decode family type if present, otherwise use default
    const familyType = searchParams.get('ft')
    if (familyType) {
      result.familyType = familyType === '2' ? 'two-parent' : 'single-parent'
    }
    
    // Decode first parent income if present, otherwise use default
    const firstParentIncome = searchParams.get('fpi')
    if (firstParentIncome) {
      result.firstParentIncome = Number(firstParentIncome) || defaults.firstParentIncome
    }
    
    // Decode first parent hours if present, otherwise use default
    const firstParentHoursPerWeek = searchParams.get('fph')
    if (firstParentHoursPerWeek) {
      result.firstParentHoursPerWeek = Number(firstParentHoursPerWeek) || defaults.firstParentHoursPerWeek
    }
    
    // Decode second parent income if present, otherwise use default
    const secondParentIncome = searchParams.get('spi')
    if (secondParentIncome) {
      result.secondParentIncome = Number(secondParentIncome) || defaults.secondParentIncome
    }
    
    // Decode second parent hours if present, otherwise use default
    const secondParentHoursPerWeek = searchParams.get('sph')
    if (secondParentHoursPerWeek) {
      result.secondParentHoursPerWeek = Number(secondParentHoursPerWeek) || defaults.secondParentHoursPerWeek
    }
    
    // Decode children if present, otherwise use defaults
    const childrenData = searchParams.get('c')
    if (childrenData) {
      try {
        // Compact format: "a-h-d-r-i_a-h-d-r-i" where a=age(u/s), h=hours, d=days, r=rate, i=isSecond(0/1)
        // Support both old format (comma/pipe) and new format (dash/underscore) for backward compatibility
        const childrenParts = childrenData.includes('_') 
          ? childrenData.split('_')
          : childrenData.includes('|') 
            ? childrenData.split('|')
            : [childrenData]
        
        const decodedChildren = childrenParts.map(part => {
          // Try new format first (dash), then fall back to old format (comma)
          const parts = part.includes('-') ? part.split('-') : part.split(',')
          // Validate format: must have exactly 5 parts
          if (parts.length !== 5) {
            throw new Error('Invalid child format')
          }
          const [age, hours, days, rate, isSecond] = parts
          // Validate age is 'u' or 's'
          if (age !== 'u' && age !== 's') {
            throw new Error('Invalid age value')
          }
          return {
            age: (age === 'u' ? 'under-school' : 'school-age') as 'under-school' | 'school-age',
            hoursPerDay: Number(hours) || 0,
            daysPerWeek: Number(days) || 0,
            hourlyRate: Number(rate) || 0,
            isSecondOrLater: isSecond === '1'
          }
        })
        // Only use decoded children if we got at least one valid child
        if (decodedChildren.length > 0) {
          result.children = decodedChildren
        } else {
          result.children = defaults.children
        }
      } catch {
        // If parsing fails, use defaults
        result.children = defaults.children
      }
    } else {
      result.children = defaults.children
    }
    
    return result
  } catch {
    // Return defaults on error
    return defaults
  }
}

export function getShareableUrl(state: ShareableState, defaults: DefaultState): string {
  const params = encodeStateToUrl(state, defaults)
  const baseUrl = window.location.origin + window.location.pathname
  // Only add query string if there are params
  return params ? `${baseUrl}?${params}` : baseUrl
}

