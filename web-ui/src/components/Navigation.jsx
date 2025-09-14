import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useOffline } from '../contexts/OfflineContext'
import { Plane, User } from 'lucide-react'

const Navigation = () => {
  const location = useLocation()
  const { isOffline, offlineQueue, processOfflineQueue } = useOffline()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  
  const connectionStatus = isOffline ? 'disconnected' : 'connected'

  const isActive = (path) => {
    return location.pathname === path
  }

  // Body scroll lock - menü açıkken arka planı scroll etmeyi engelle
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMenuOpen])

  // Drawer dışına tıklandığında menüyü kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.mobile-drawer') && !event.target.closest('.hamburger-menu')) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  // ESC tuşu ile menüyü kapat
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [isMenuOpen])

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-container">
          {/* Sol: Logo + Platform Adı */}
          <div className="nav-left">
            <div className="nav-brand">
              <div className="brand-icon">
                <Plane size={22} />
              </div>
              <span className="brand-text">Hava Kargo Test Merkezi</span>
            </div>
          </div>
          
          {/* Orta: Menü Sekmeleri */}
          <div className="nav-center">
            {/* Hamburger Menu Button - Mobil için */}
            <button 
              className={`hamburger-menu ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              data-testid="hamburger-menu"
              aria-label="Menüyü aç/kapat"
              aria-expanded={isMenuOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
            
            {/* Desktop Navigation Links */}
            <div className="nav-links">
              <Link 
                to="/" 
                className={`nav-link ${isActive('/') ? 'active' : ''}`}
                data-testid="nav-dashboard"
              >
                Gösterge Paneli
              </Link>
              <Link 
                to="/awb" 
                className={`nav-link ${isActive('/awb') ? 'active' : ''}`}
                data-testid="nav-awb"
              >
                AWB Yönetimi
              </Link>
              <Link 
                to="/uld" 
                className={`nav-link ${isActive('/uld') ? 'active' : ''}`}
                data-testid="nav-uld"
              >
                ULD Kapasite
              </Link>
              <Link 
                to="/dg" 
                className={`nav-link ${isActive('/dg') ? 'active' : ''}`}
                data-testid="nav-dg"
              >
                DG Formu
              </Link>
              {/* Barkod Simülasyonu kaldırıldı - sadece emülatörde çalışır */}
            </div>
          </div>
          
          {/* Sağ: Bağlantı Durumu */}
          <div className="nav-right">
            <div 
              className={`connection-status ${connectionStatus}`}
              data-testid="connection-status"
              title={connectionStatus === 'connected' ? 'Sistem Çevrimiçi' : 'Bağlantı Hatası'}
            >
              <span className="status-dot"></span>
              <span className="status-text">Bağlı</span>
            </div>
          </div>
          
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMenu}></div>
      )}

      {/* Mobile Drawer Menu */}
      <div className={`mobile-drawer ${isMenuOpen ? 'active' : ''}`}>
        {/* Mobile Menu Header */}
        <div className="mobile-menu-header">
          <h3 className="mobile-menu-title">Menü</h3>
          <button 
            className="mobile-menu-close"
            onClick={closeMenu}
            aria-label="Menüyü kapat"
          >
            <span>×</span>
          </button>
        </div>

        {/* Mobile Navigation Links */}
        <div className="mobile-nav-links">
          <Link 
            to="/" 
            className={`mobile-nav-link ${isActive('/') ? 'active' : ''}`}
            data-testid="mobile-nav-dashboard"
            onClick={closeMenu}
          >
            Gösterge Paneli
          </Link>
          <Link 
            to="/awb" 
            className={`mobile-nav-link ${isActive('/awb') ? 'active' : ''}`}
            data-testid="mobile-nav-awb"
            onClick={closeMenu}
          >
            AWB Yönetimi
          </Link>
          <Link 
            to="/uld" 
            className={`mobile-nav-link ${isActive('/uld') ? 'active' : ''}`}
            data-testid="mobile-nav-uld"
            onClick={closeMenu}
          >
            ULD Kapasite
          </Link>
          <Link 
            to="/dg" 
            className={`mobile-nav-link ${isActive('/dg') ? 'active' : ''}`}
            data-testid="mobile-nav-dg"
            onClick={closeMenu}
          >
            DG Formu
          </Link>
          {/* Barkod Simülasyonu kaldırıldı - sadece emülatörde çalışır */}
        </div>
      </div>
    </>
  )
}

export default Navigation
