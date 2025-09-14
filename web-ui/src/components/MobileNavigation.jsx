import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './MobileNavigation.css'

const MobileNavigation = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [syncStatus, setSyncStatus] = useState('connected')

  useEffect(() => {
    // Simulate network status changes
    const interval = setInterval(() => {
      const statuses = ['connected', 'offline', 'syncing', 'error']
      setSyncStatus(statuses[Math.floor(Math.random() * statuses.length)])
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#28a745'
      case 'offline': return '#ffc107'
      case 'syncing': return '#007bff'
      case 'error': return '#dc3545'
      default: return '#6c757d'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'connected': return 'Bağlı'
      case 'offline': return 'Offline'
      case 'syncing': return 'Senkronize ediliyor…'
      case 'error': return 'Hata'
      default: return 'Bilinmiyor'
    }
  }

  const navItems = [
    { path: '/mobile/barcode', label: 'Barkod', icon: '📱' },
    { path: '/mobile/awb', label: 'AWB', icon: '📋' },
    { path: '/mobile/uld', label: 'ULD', icon: '📦' }
  ]

  return (
    <div className="mobile-navigation">
      {/* Header with status chip */}
      <header className="mobile-header">
        <h1 className="mobile-title">Hava Kargo Test & Simülasyon Merkezi</h1>
        <div 
          className="status-chip"
          style={{ backgroundColor: getStatusColor(syncStatus) }}
        >
          {getStatusText(syncStatus)}
        </div>
      </header>

      {/* Tab bar */}
      <nav className="mobile-tab-bar">
        {navItems.map((item) => (
          <button
            key={item.path}
            className={`tab-button ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            data-testid={`nav-${item.label.toLowerCase()}`}
          >
            <span className="tab-icon">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

export default MobileNavigation
