import { useState, useEffect } from 'react'

interface Section {
  id: string
  label: string
}

const ALL_SECTIONS: Section[] = [
  { id: 'income-graph', label: 'Net income gain' },
  { id: 'detailed-breakdown', label: 'Detailed breakdown' },
  { id: 'hours-graph', label: 'Diminishing returns' },
  { id: 'sharing-load', label: 'Sharing the load' },
]

export default function SectionProgressTracker() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [visibleSections, setVisibleSections] = useState<Section[]>([])
  const [isNearBottom, setIsNearBottom] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const clientHeight = window.innerHeight
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
      
      // Hide if within 100px of the bottom
      setIsNearBottom(distanceFromBottom < 100)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Check initial position

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    const checkVisibleSections = () => {
      return ALL_SECTIONS.filter((section) => {
        const element = document.getElementById(section.id)
        return element !== null
      })
    }

    const visible = checkVisibleSections()
    setVisibleSections(visible)

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    visible.forEach((section) => {
      const element = document.getElementById(section.id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      visible.forEach((section) => {
        const element = document.getElementById(section.id)
        if (element) {
          observer.unobserve(element)
        }
      })
    }
  }, [])

  const currentIndex = activeSection
    ? visibleSections.findIndex((s) => s.id === activeSection)
    : -1

  const sections = visibleSections.length > 0 ? visibleSections : ALL_SECTIONS
  const activeSectionData = sections.find((s) => s.id === activeSection)

  if (isNearBottom) {
    return null
  }

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-50 md:bottom-4">
      <div className="bg-white/90 backdrop-blur-sm rounded px-1.5 py-1">
        <div className="flex flex-col items-center gap-1">
          {activeSectionData && (
            <div className="text-xs text-gray-500 whitespace-nowrap">
              {activeSectionData.label}
            </div>
          )}
          <div className="flex items-center gap-1">
            {sections.map((section, index) => {
              const isActive = activeSection === section.id
              const isPast = currentIndex > index
              
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    const element = document.getElementById(section.id)
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }}
                  className={`
                    rounded-full transition-all
                    ${
                      isActive
                        ? 'bg-blue-600 w-2 h-2'
                        : isPast
                        ? 'bg-blue-300 hover:bg-blue-400 w-1.5 h-1.5'
                        : 'bg-gray-300 hover:bg-gray-400 w-1.5 h-1.5'
                    }
                  `}
                  title={section.label}
                  aria-label={`Go to ${section.label}`}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

