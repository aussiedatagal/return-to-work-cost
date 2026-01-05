import { describe, it, expect } from 'vitest'
import { encodeStateToUrl, decodeStateFromUrl, getShareableUrl, type ShareableState, type DefaultState } from './shareUtils'

describe('shareUtils', () => {
  const mockDefaults: DefaultState = {
    familyType: 'two-parent' as const,
    firstParentIncome: 104496,
    firstParentHoursPerWeek: 38,
    secondParentIncome: 94103,
    secondParentHoursPerWeek: 38,
    children: [
      {
        age: 'under-school' as const,
        hoursPerDay: 10,
        daysPerWeek: 5,
        hourlyRate: 18,
        isSecondOrLater: false
      },
      {
        age: 'under-school' as const,
        hoursPerDay: 10,
        daysPerWeek: 5,
        hourlyRate: 18,
        isSecondOrLater: true
      }
    ]
  }

  const mockState: ShareableState = {
    familyType: 'two-parent' as const,
    firstParentIncome: 104496,
    firstParentHoursPerWeek: 38,
    secondParentIncome: 94103,
    secondParentHoursPerWeek: 38,
    children: [
      {
        age: 'under-school' as const,
        hoursPerDay: 10,
        daysPerWeek: 5,
        hourlyRate: 18,
        isSecondOrLater: false
      },
      {
        age: 'school-age' as const,
        hoursPerDay: 3.5,
        daysPerWeek: 5,
        hourlyRate: 18,
        isSecondOrLater: true
      }
    ]
  }

  describe('encodeStateToUrl', () => {
    it('encodes only changed values', () => {
      const encoded = encodeStateToUrl(mockState, mockDefaults)
      const params = new URLSearchParams(encoded)
      
      // Family type, incomes, and hours match defaults, so they shouldn't be in URL
      expect(params.get('ft')).toBeNull()
      expect(params.get('fpi')).toBeNull()
      expect(params.get('fph')).toBeNull()
      expect(params.get('spi')).toBeNull()
      expect(params.get('sph')).toBeNull()
      
      // Only children differ (second child is school-age vs under-school), so only children should be encoded
      const childrenStr = params.get('c') || ''
      const childrenParts = childrenStr.split('_')
      expect(childrenParts).toHaveLength(2)
      expect(childrenParts[0].startsWith('u-')).toBe(true)
      expect(childrenParts[1].startsWith('s-')).toBe(true)
    })

    it('encodes single-parent family type when different', () => {
      const singleParentState: ShareableState = { ...mockState, familyType: 'single-parent' as const }
      const encoded = encodeStateToUrl(singleParentState, mockDefaults)
      const params = new URLSearchParams(encoded)
      
      expect(params.get('ft')).toBe('1')
    })

    it('encodes nothing when state matches defaults', () => {
      const encoded = encodeStateToUrl(mockDefaults, mockDefaults)
      const params = new URLSearchParams(encoded)
      
      expect(params.toString()).toBe('')
    })
  })

  describe('decodeStateFromUrl', () => {
    it('decodes URL parameters and merges with defaults', () => {
      const encoded = encodeStateToUrl(mockState, mockDefaults)
      const params = new URLSearchParams(encoded)
      const decoded = decodeStateFromUrl(params, mockDefaults)
      
      expect(decoded).not.toBeNull()
      expect(decoded?.familyType).toBe('two-parent')
      expect(decoded?.firstParentIncome).toBe(104496)
      expect(decoded?.firstParentHoursPerWeek).toBe(38)
      expect(decoded?.secondParentIncome).toBe(94103)
      expect(decoded?.secondParentHoursPerWeek).toBe(38)
      expect(decoded?.children).toHaveLength(2)
      expect(decoded?.children?.[0].age).toBe('under-school')
      expect(decoded?.children?.[0].hoursPerDay).toBe(10)
      expect(decoded?.children?.[1].age).toBe('school-age')
      expect(decoded?.children?.[1].isSecondOrLater).toBe(true)
    })

    it('uses defaults when parameters are missing', () => {
      const params = new URLSearchParams()
      params.set('spi', '100000') // Only second parent income changed
      const decoded = decodeStateFromUrl(params, mockDefaults)
      
      expect(decoded).not.toBeNull()
      expect(decoded?.familyType).toBe('two-parent') // From defaults
      expect(decoded?.firstParentIncome).toBe(104496) // From defaults
      expect(decoded?.secondParentIncome).toBe(100000) // From URL
      expect(decoded?.children).toHaveLength(2) // From defaults
    })

    it('decodes single-parent family type', () => {
      const singleParentState: ShareableState = { ...mockState, familyType: 'single-parent' as const }
      const encoded = encodeStateToUrl(singleParentState, mockDefaults)
      const params = new URLSearchParams(encoded)
      const decoded = decodeStateFromUrl(params, mockDefaults)
      
      expect(decoded?.familyType).toBe('single-parent')
    })

    it('returns defaults when no URL parameters', () => {
      const params = new URLSearchParams()
      const decoded = decodeStateFromUrl(params, mockDefaults)
      
      expect(decoded).not.toBeNull()
      expect(decoded?.familyType).toBe(mockDefaults.familyType)
      expect(decoded?.firstParentIncome).toBe(mockDefaults.firstParentIncome)
      expect(decoded?.children).toHaveLength(mockDefaults.children.length)
    })

    it('handles malformed children data gracefully', () => {
      const params = new URLSearchParams()
      params.set('c', 'not-json')
      const decoded = decodeStateFromUrl(params, mockDefaults)
      
      // Should fall back to defaults
      expect(decoded).not.toBeNull()
      expect(decoded?.children).toEqual(mockDefaults.children)
    })
  })

  describe('getShareableUrl', () => {
    it('generates shareable URL with only changed values', () => {
      const url = getShareableUrl(mockState, mockDefaults)
      
      expect(url).toContain('?')
      const queryString = url.split('?')[1]
      const params = new URLSearchParams(queryString)
      
      // Should only contain children since that's what differs
      expect(params.get('c')).not.toBeNull()
    })

    it('generates URL without query string when state matches defaults', () => {
      const url = getShareableUrl(mockDefaults, mockDefaults)
      
      expect(url).not.toContain('?')
    })
  })

  describe('round-trip encoding', () => {
    it('preserves state through encode/decode cycle', () => {
      const encoded = encodeStateToUrl(mockState, mockDefaults)
      const params = new URLSearchParams(encoded)
      const decoded = decodeStateFromUrl(params, mockDefaults)
      
      expect(decoded).not.toBeNull()
      expect(decoded?.familyType).toBe(mockState.familyType)
      expect(decoded?.firstParentIncome).toBe(mockState.firstParentIncome)
      expect(decoded?.firstParentHoursPerWeek).toBe(mockState.firstParentHoursPerWeek)
      expect(decoded?.secondParentIncome).toBe(mockState.secondParentIncome)
      expect(decoded?.secondParentHoursPerWeek).toBe(mockState.secondParentHoursPerWeek)
      expect(decoded?.children).toHaveLength(mockState.children.length)
      
      decoded?.children?.forEach((child, index) => {
        const original = mockState.children[index]
        expect(child.age).toBe(original.age)
        expect(child.hoursPerDay).toBe(original.hoursPerDay)
        expect(child.daysPerWeek).toBe(original.daysPerWeek)
        expect(child.hourlyRate).toBe(original.hourlyRate)
        expect(child.isSecondOrLater).toBe(original.isSecondOrLater)
      })
    })
  })
})

