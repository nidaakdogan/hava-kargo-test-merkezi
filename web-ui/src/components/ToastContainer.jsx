import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import { toastManager } from '../services/ToastManager';
import './Toast.css';

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Toast manager'dan değişiklikleri dinle
    const unsubscribe = toastManager.addListener((newToasts) => {
      setToasts(newToasts);
    });

    return unsubscribe;
  }, []);

  const handleClose = (id) => {
    toastManager.removeToast(id);
  };

  // Portal ile body'ye render et - Route değişince/unmount olmasın
  return createPortal(
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onClose={handleClose}
          isVisible={toast.isVisible !== false}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;
