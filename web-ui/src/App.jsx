import React, { useState, useEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Navigation from './components/Navigation'
import MobileNavigation from './components/MobileNavigation'
import Dashboard from './pages/Dashboard'
import AwbForm from './pages/AwbForm'
import UldForm from './pages/UldForm'
import DgForm from './pages/DgForm'
// ScanSimulator kaldırıldı - sadece emülatörde çalışır
import BarcodeBlockedPage from './pages/BarcodeBlockedPage'
import MobileBarcode from './pages/mobile/MobileBarcode'
import MobileAwb from './pages/mobile/MobileAwb'
import MobileUld from './pages/mobile/MobileUld'
// MobileTest kaldırıldı - sadece emülatörde çalışır
import { OfflineProvider } from './contexts/OfflineContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { RunStateProvider } from './contexts/RunStateContext'
import ErrorBoundary from './components/ErrorBoundary'
import ToastContainer from './components/ToastContainer'
// DevToolbar - Sadece development'da import et
import DevToolbar from './components/DevToolbar';
import './App.css'

// Toast sistemi artık ToastManager ile yönetiliyor

function App() {
  const [isMobile, setIsMobile] = useState(false)
  const [tenantId, setTenantId] = useState('default')

  useEffect(() => {
    // URL'den tenant parametresini al
    const urlParams = new URLSearchParams(window.location.search)
    const tenant = urlParams.get('tenant') || 'default'
    setTenantId(tenant)
    console.log(`🏢 Tenant ID: ${tenant}`)

    const checkMobile = () => {
      const isMobileViewport = window.innerWidth <= 768
      const isMobileUserAgent = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      setIsMobile(isMobileViewport || isMobileUserAgent)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    // DEBUG kodu kaldırıldı - artık gerekli değil
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    }
  }, [])

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <OfflineProvider>
          <RunStateProvider>
            {/* Toast Container - En üst seviyede, hiç unmount olmaz */}
            <ToastContainer />
            <Router>
              <div className={`App ${isMobile ? 'mobile' : 'desktop'}`}>
                {isMobile ? <MobileNavigation /> : <Navigation />}
                <main className="main-content">
                  <Routes>
                    {/* Desktop routes */}
                    <Route path="/" element={<Dashboard tenantId={tenantId} />} />
                    <Route path="/awb" element={<AwbForm />} />
                    <Route path="/uld" element={<UldForm />} />
                    <Route path="/dg" element={<DgForm />} />
                    {/* /scan route kaldırıldı - sadece emülatörde çalışır */}
                    <Route path="/scan" element={<BarcodeBlockedPage />} />
                    <Route path="/barkod-simulasyonu" element={<BarcodeBlockedPage />} />
                    <Route path="/mobile-test" element={<Navigate to="/" replace />} />
                    <Route path="/uld-form/mobile-test" element={<Navigate to="/" replace />} />
                    <Route path="/barkod-test" element={<Navigate to="/" replace />} />
                    <Route path="/barcode-test" element={<Navigate to="/" replace />} />
                    
                    {/* Mobile routes */}
                    <Route path="/mobile" element={<MobileBarcode />} />
                    <Route path="/mobile/barcode" element={<MobileBarcode />} />
                    <Route path="/mobile/awb" element={<MobileAwb />} />
                    <Route path="/mobile/uld" element={<MobileUld />} />
                  </Routes>
                </main>
              </div>
            </Router>
            {/* DevToolbar - Sadece development'da ve koşullu olarak görünür */}
            <DevToolbar />
          </RunStateProvider>
        </OfflineProvider>
      </NotificationProvider>
    </ErrorBoundary>
  )
}

export default App
