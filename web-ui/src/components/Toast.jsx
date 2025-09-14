import React, { useState, useEffect } from 'react'
import { toastManager } from '../services/ToastManager'
import './Toast.css'

const Toast = ({ 
  id, 
  type = 'info', 
  message, 
  duration = 6000,
  onClose, 
  isVisible = true
}) => {
  const [internalVisible, setInternalVisible] = useState(isVisible)

  // isVisible prop'u değiştiğinde internalVisible'ı güncelle
  useEffect(() => {
    setInternalVisible(isVisible)
  }, [isVisible])

  // Hover event'leri - pauseOnHover: true
  const handleMouseEnter = () => {
    toastManager.pauseToast(id)
  }

  const handleMouseLeave = () => {
    toastManager.resumeToast(id)
  }

  const handleClose = () => {
    setInternalVisible(false)
    setTimeout(() => onClose(id), 300) // CSS transition için
  }

  const getIcon = () => {
    switch (type) {
      case 'success': return '✓'
      case 'warning': return '⚠'
      case 'error': return '✕'
      case 'info': 
      default: return 'ℹ'
    }
  }

  if (!internalVisible) return null

  return (
    <div 
      className={`toast toast-${type} toast-visible`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="alert"
      aria-live="polite"
    >
      <div className="toast-content">
        <div className="toast-icon">{getIcon()}</div>
        <div className="toast-text">
          <div className="toast-message">{message}</div>
        </div>
        <button 
          className="toast-close" 
          onClick={handleClose}
          aria-label="Bildirimi kapat"
          tabIndex={0}
        >
          ×
        </button>
      </div>
    </div>
  )
}

export default Toast