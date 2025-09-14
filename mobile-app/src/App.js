import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { eventBus } from './services/ToastManager';

// Offline Queue Service
import { OfflineQueueService } from './services/OfflineQueueService';

// Components
import BarcodeScanner from './components/BarcodeScanner';
import SyncedBarcodeScanner from './components/SyncedBarcodeScanner';
import AwbAcceptance from './components/AwbAcceptance';
import UldLoading from './components/UldLoading';
import MobileNavigation from './components/MobileNavigation';

// Icons
import { 
  FaBarcode, 
  FaClipboardCheck, 
  FaBoxes, 
  FaWifi,
  FaTimes,
  FaSync,
  FaExclamationTriangle
} from 'react-icons/fa';

// Status Chip Component
const StatusChip = ({ status, isOnline, isSyncing }) => {
  let statusText = '';
  let statusClass = '';
  let statusIcon = null;

  if (isSyncing) {
    statusText = 'Senkronize ediliyor...';
    statusClass = 'syncing';
    statusIcon = <FaSync className="spinning" />;
  } else if (isOnline) {
    statusText = 'Bağlı';
    statusClass = 'online';
    statusIcon = <FaWifi />;
  } else {
    statusText = 'Offline';
    statusClass = 'offline';
    statusIcon = <FaTimes />;
  }

  return (
    <div className={`status-chip ${statusClass}`}>
      {statusIcon}
      <span>{statusText}</span>
    </div>
  );
};

// MobileNavigation zaten import edilmiş

const App = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    id: 'user-001',
    name: 'Saha Operatörü',
    role: 'field-operator',
    deviceId: `device-${Date.now()}`
  });

  // Offline Queue Service
  const offlineQueue = new OfflineQueueService();

  // Online/Offline durumu kontrol et
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('✅ Çevrimiçi bağlantı kuruldu');
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('ℹ️ Offline modda tarama kuyruğa eklendi.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Queue sayısını güncelle
    updateQueueCount();

    // Mobil test hazır olduğunda toast göster
    eventBus.emit('mobile:ready');

    // RunId ile backend'e bağlan
    connectToBackend();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Backend'e runId ile bağlan
  const connectToBackend = async () => {
    try {
      // URL'den runId'yi al (query parameter olarak)
      const urlParams = new URLSearchParams(window.location.search);
      const runId = urlParams.get('runId');
      
      if (!runId) {
        console.log('⚠️ RunId bulunamadı, manuel bağlantı gerekli');
        return;
      }

      console.log(`📱 RunId ile bağlanıyor: ${runId}`);
      
      // Backend URL'ini belirle (mobil cihazda 10.0.2.2 kullan)
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const apiBaseUrl = isMobile ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
      
      // Backend'e mobile_connect isteği gönder
      const response = await fetch(`${apiBaseUrl}/api/mobile-connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ runId })
      });

      if (response.ok) {
        console.log('✅ Mobil uygulama backend\'e bağlandı');
        toast.success('✅ Backend\'e bağlandı');
        
        // mobile_ready isteği gönder
        await fetch(`${apiBaseUrl}/api/mobile-ready`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ runId })
        });
        
        console.log('✅ Mobil test hazır durumu bildirildi');
      } else {
        console.error('❌ Backend bağlantısı başarısız:', response.status);
        toast.error('❌ Backend bağlantısı başarısız');
      }
    } catch (error) {
      console.error('❌ Backend bağlantı hatası:', error);
      toast.error('❌ Backend bağlantı hatası');
    }
  };

  // Queue sayısını güncelle
  const updateQueueCount = async () => {
    const count = await offlineQueue.getQueueLength();
    setQueueCount(count);
  };

  // Offline queue'yu senkronize et
  const syncOfflineQueue = async () => {
    if (!isOnline) return;
    
    try {
      setIsSyncing(true);
      const synced = await offlineQueue.syncWithServer();
      if (synced > 0) {
        toast.success(`✅ ${synced} barkod gönderildi`);
        updateQueueCount();
      }
    } catch (error) {
      toast.error('❌ İşlem tamamlanamadı. Tekrar deneyin.');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };


  return (
    <Router>
      <div className="mobile-app">
        {/* Header */}
        <header className="mobile-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="app-title" data-testid="app-title">Hava Kargo Test & Simülasyon Merkezi</h1>
              <p className="app-subtitle">Dijital İkiz Tabanlı Test Sistemi</p>
            </div>
            <StatusChip 
              status="online" 
              isOnline={isOnline} 
              isSyncing={isSyncing} 
            />
          </div>
          
          {/* Offline Queue Indicator */}
          {queueCount > 0 && (
            <div className="queue-indicator">
              <span className="queue-count">{queueCount}</span>
              <span className="queue-label">Barkod Kuyrukta</span>
              <button 
                className="sync-button"
                onClick={syncOfflineQueue}
                disabled={!isOnline || isSyncing}
                title="Kuyruğu İşle"
              >
                <FaSync className={`sync-icon ${isSyncing ? 'spinning' : ''}`} />
                {isSyncing ? 'İşleniyor...' : 'İşle'}
              </button>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="mobile-main">
          <Routes>
            <Route path="/" element={<SyncedBarcodeScanner offlineQueue={offlineQueue} onUpdate={updateQueueCount} />} />
            <Route path="/awb" element={<AwbAcceptance offlineQueue={offlineQueue} />} />
            <Route path="/uld" element={<UldLoading offlineQueue={offlineQueue} />} />
          </Routes>
        </main>

        {/* Bottom Navigation */}
        <MobileNavigation queueCount={queueCount} />

        {/* Toast Container */}
        <ToastContainer
          position="bottom-center"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </Router>
  );
};

export default App;
