import { useEffect, useRef } from 'react'

interface SourceModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  isConfigModal?: boolean
  onSave?: () => void
}

export default function SourceModal({ isOpen, onClose, title, children, isConfigModal = false, onSave }: SourceModalProps) {
  const mouseDownOnBackdropRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      
      // Allow standard keyboard shortcuts (Cmd+A, Ctrl+A, etc.) to work in input fields
      if (isInput && (event.metaKey || event.ctrlKey)) {
        return // Let the browser handle these shortcuts
      }
      
      if (event.key === 'Escape') {
        onClose()
      } else if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        // For config modals: Enter saves when in single-line inputs or when not in any input
        // (but not in textareas, where Enter should create a new line)
        // For non-config modals: Enter closes only when not in an input
        const isTextarea = target.tagName === 'TEXTAREA'
        
        if (isConfigModal && onSave) {
          // In config modals, Enter saves when in single-line inputs or when not in any input
          if (!isInput || !isTextarea) {
            event.preventDefault()
            onSave()
          }
          // If in textarea, let Enter create a new line (don't prevent default)
        } else if (!isInput) {
          // For non-config modals, Enter closes only when not in an input
          event.preventDefault()
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, isConfigModal, onSave])

  if (!isOpen) return null

  const handleSave = () => {
    if (onSave) {
      onSave()
    }
    onClose()
  }

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    // Only track mousedown if it's directly on the backdrop, not inside the modal content
    if (e.target === e.currentTarget) {
      mouseDownOnBackdropRef.current = true
    } else {
      mouseDownOnBackdropRef.current = false
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if the mousedown also happened on the backdrop
    // This prevents closing when text selection starts inside and ends outside
    if (e.target === e.currentTarget && mouseDownOnBackdropRef.current) {
      onClose()
    }
    // Reset the ref after handling the click
    mouseDownOnBackdropRef.current = false
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          // Prevent backdrop mousedown tracking when clicking inside modal
          e.stopPropagation()
          mouseDownOnBackdropRef.current = false
        }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-4 md:px-6 py-4 md:py-6 text-sm md:text-base text-gray-700 space-y-4">
          {children}
        </div>
        {isConfigModal && (
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 md:px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-medium hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


