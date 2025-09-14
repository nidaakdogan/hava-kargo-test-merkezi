import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import Toast from '../components/Toast'
import ConfirmModal from '../components/ConfirmModal'
import { toastManager, eventBus } from '../services/ToastManager'

const NotificationContext = createContext()

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const [modal, setModal] = useState(null)

  // ToastManager ile senkronizasyon
  useEffect(() => {
    const unsubscribe = toastManager.addListener((newToasts) => {
      setToasts(newToasts)
    })

    // Sayfa yenilendiğinde toast'ları temizle
    const handleBeforeUnload = () => {
      toastManager.clearAll()
      setModal(null)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      unsubscribe()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // Toast işlemleri - ToastManager kullan
  const showToast = useCallback((toast) => {
    const id = toast.id || `toast-${Date.now()}-${Math.random()}`
    toastManager.addToast({
      id,
      type: 'info',
      ...toast
    })
  }, [])

  const removeToast = useCallback((id) => {
    toastManager.removeToast(id)
  }, [])

  // Modal işlemleri
  const showModal = useCallback((modalConfig) => {
    setModal(modalConfig)
  }, [])

  const hideModal = useCallback(() => {
    setModal(null)
  }, [])

  // Hazır toast fonksiyonları
  const showSuccess = useCallback((message, title = 'Başarılı') => {
    showToast({ type: 'success', title, message })
  }, [showToast])

  const showWarning = useCallback((message, title = 'Uyarı') => {
    showToast({ type: 'warning', title, message })
  }, [showToast])

  const showError = useCallback((message, title = 'Hata') => {
    showToast({ type: 'error', title, message })
  }, [showToast])

  const showInfo = useCallback((message, title = 'Bilgi') => {
    showToast({ type: 'info', title, message })
  }, [showToast])

  // Debounce için
  const debouncedToasts = useRef({})
  
  const showDebouncedToast = useCallback((key, toast, delay = 500) => {
    if (debouncedToasts.current[key]) {
      clearTimeout(debouncedToasts.current[key])
    }
    
    debouncedToasts.current[key] = setTimeout(() => {
      showToast(toast)
      delete debouncedToasts.current[key]
    }, delay)
  }, [showToast])

  const value = {
    // Toast
    showToast,
    removeToast,
    showSuccess,
    showWarning,
    showError,
    showInfo,
    showDebouncedToast,
    
    // ToastManager & EventBus
    toastManager,
    eventBus,
    
    // Modal
    showModal,
    hideModal,
    
    // State
    toasts,
    modal
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={removeToast}
          />
        ))}
      </div>
      
      {/* Modal */}
      {modal && (
        <ConfirmModal
          {...modal}
          onClose={hideModal}
        />
      )}
    </NotificationContext.Provider>
  )
}

