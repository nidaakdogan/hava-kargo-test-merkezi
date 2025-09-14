import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaBarcode, FaToggleOn, FaToggleOff, FaTrash, FaSync, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import { counterSync } from '../services/CounterSyncService';
import './BarcodeScanner.css';

const SyncedBarcodeScanner = ({ offlineQueue, onUpdate }) => {
  // 🎯 TEK KAYNAKLI DURUM MODELİ - 4 Ana State (API Senkronize)
  const [offline, setOffline] = useState(false);  // true/false
  const [Q, setQ] = useState(0);                  // kuyruk: tamsayı
  const [P, setP] = useState(0);                  // işleniyor: tamsayı
  const [T, setT] = useState(0);                  // toplam: tamsayı
  
  // Yardımcı state (UI için)
  const [queueItems, setQueueItems] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);
  
  // Debounce koruma - 300ms
  const [lastActionTime, setLastActionTime] = useState(0);
  const DEBOUNCE_DELAY = 300;

  const testBarcodes = [
    { code: 'ULD-AKE12345AB', type: 'ULD', valid: true },
    { code: '123-45678901', type: 'AWB', valid: true },
    { code: 'ULD-ABC123', type: 'ULD', valid: false },
    { code: 'INVALID-CODE', type: 'INVALID', valid: false }
  ];

  // Debounce check fonksiyonu
  const checkDebounce = () => {
    const now = Date.now();
    if (now - lastActionTime < DEBOUNCE_DELAY) {
      console.log('⚠️ Debounced - çok hızlı tıklama');
      return false;
    }
    setLastActionTime(now);
    return true;
  };

  // Aksiyon logu helper
  const logAction = (action, before, after) => {
    console.log(`${action}: önce Q=${before.Q},P=${before.P},T=${before.T}, offline=${before.offline} → sonra Q=${after.Q},P=${after.P},T=${after.T}, offline=${after.offline}`);
  };

  // 🔄 1) Toggle: Offline Modu - TEK KAYNAK KONTROLLÜ
  const handleOfflineModeToggle = async (newValue) => {
    if (!checkDebounce()) {
      console.log('⚠️ Toggle debounced - çok hızlı tıklama');
      return;
    }

    console.log(`🔄 onChange: set offline = ${newValue} (önceki: ${offline})`);
    
    const before = { Q, P, T, offline };
    
    // TEK KAYNAK: sadece burada state güncelle
    setOffline(newValue);
    await counterSync.updateCounter('offline', newValue);
    
    const after = { Q, P, T, offline: newValue };
    logAction('Toggle Offline', before, after);
    
    // Doğru eşleme: offline=true → yeşil → "Offline moda geçildi"
    setTimeout(() => {
      console.log(`🔄 Toggle completed: offline=${newValue}`);
      toast.info(newValue ? '📱 Offline moda geçildi' : '🌐 Online moda geçildi');
    }, 50);
  };

  // 🔄 2) Barkod Tara / Oku - API Senkronize
  const simulateScan = async (barcode) => {
    if (!checkDebounce()) return;
    
    console.log(`🔄 Barkod Tara clicked: offline=${offline}, Q=${Q}, P=${P}, T=${T}, barcode=${barcode.code}`);
    
    const before = { Q, P, T, offline };
    
    if (offline) {
      // offline = true (yeşil): Q = Q + 1, P değişmez (0'da kalır), T değişmez
      const newQ = Q + 1;
      setQ(newQ);
      await counterSync.updateCounter('Q', newQ);
      
      // Kuyruğa ekle
      if (offlineQueue) {
        const scanData = {
          type: 'barcode_scan',
          barcode: barcode.code,
          barcode_type: barcode.type,
          timestamp: Date.now(),
          valid: barcode.valid
        };
        await offlineQueue.addToQueue(scanData);
        await updateQueueItems();
      }
      
      const after = { Q: newQ, P, T, offline };
      logAction('Barkod Tara (Offline)', before, after);
      
      toast.success(`📥 Çevrimdışı: kuyruğa eklendi (Q=${newQ})`);
      
    } else {
      // offline = false (gri): P = 1 (işlem başladı)
      setP(1);
      await counterSync.updateCounter('P', 1);
      
      const afterStart = { Q, P: 1, T, offline };
      logAction('Barkod Tara (Online) - Başladı', before, afterStart);
      
      try {
        // Simülasyon - işleme süresi (1000ms)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Sonuca göre:
        if (barcode.valid) {
          const newT = T + 1;
          setT(newT);
          await counterSync.updateCounter('T', newT);
          add24hTotal(1);
          
          const afterSuccess = { Q, P: 0, T: newT, offline };
          setP(0); // P = 0 (işlem bitti)
          await counterSync.updateCounter('P', 0);
          logAction('Barkod Tara (Online) - Başarılı', afterStart, afterSuccess);
          
          setTimeout(() => {
            toast.success(`✅ Barkod işlendi (T=${newT})`);
          }, 200);
          
        } else {
          // Başarısız: T değişmez
          setP(0); // P = 0 (işlem bitti)
          await counterSync.updateCounter('P', 0);
          
          const afterFailed = { Q, P: 0, T, offline };
          logAction('Barkod Tara (Online) - Başarısız', afterStart, afterFailed);
          
          setTimeout(() => {
            toast.error('❌ İşlem başarısız');
          }, 200);
        }
        
      } catch (error) {
        // Hata durumu: P = 0, T değişmez
        setP(0);
        await counterSync.updateCounter('P', 0);
        toast.error('❌ İşlem hatası');
      }
    }
  };

  // 🔄 3) Kuyruğu İşle (yalnız online ve Q>0 iken) - API Senkronize
  const processQueue = async () => {
    if (!checkDebounce()) return;
    
    console.log(`🔄 Kuyruğu İşle clicked: offline=${offline}, Q=${Q}, P=${P}, T=${T}`);
    
    if (offline) {
      console.log('🚫 Kuyruğu İşle blocked: offline mode');
      toast.warning('⚠️ Offline modda kuyruk işlenez');
      return;
    }

    if (Q === 0) {
      toast.info('ℹ️ Kuyruk boş');
      return;
    }

    const before = { Q, P, T, offline };
    const batchSize = 5;
    let currentQ = Q;
    let currentT = T;
    
    try {
      // Batch'ler halinde işle
      while (currentQ > 0) {
        const currentBatchSize = Math.min(currentQ, batchSize);
        setP(currentBatchSize);
        await counterSync.updateCounter('P', currentBatchSize);
        
        console.log(`⚡ Batch başladı: P=${currentBatchSize}, Q=${currentQ}`);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const successCount = Math.floor(currentBatchSize * 0.85) || Math.min(1, currentBatchSize);
        
        for (let i = 0; i < currentBatchSize; i++) {
          if (i < successCount) {
            currentT++;
            setT(currentT);
            await counterSync.updateCounter('T', currentT);
            add24hTotal(1);
          }
          currentQ--;
          setQ(currentQ);
          await counterSync.updateCounter('Q', currentQ);
          setP(Math.max(0, currentBatchSize - i - 1));
          await counterSync.updateCounter('P', Math.max(0, currentBatchSize - i - 1));
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log(`✅ Batch tamamlandı: Q=${currentQ}, T=${currentT}, P=0`);
      }
      
      setP(0);
      await counterSync.updateCounter('P', 0);
      const after = { Q: currentQ, P: 0, T: currentT, offline };
      logAction('Kuyruğu İşle - Tamamlandı', before, after);
      
      if (offlineQueue) {
        await offlineQueue.clearQueue();
        await updateQueueItems();
      }
      
      toast.success(`🎉 Kuyruk işlendi: ${currentT - before.T} başarılı`);
      
    } catch (error) {
      setP(0);
      await counterSync.updateCounter('P', 0);
      toast.error('❌ Kuyruk işleme hatası');
    }
  };

  // 🔄 4) Kuyruğu Temizle (onaydan sonra) - API Senkronize
  const clearQueue = async () => {
    if (!checkDebounce()) return;
    
    console.log(`🔄 Kuyruğu Temizle clicked: offline=${offline}, Q=${Q}, P=${P}, T=${T}`);
    
    if (Q === 0) {
      console.log('🚫 Kuyruğu Temizle blocked: Q=0');
      toast.info('ℹ️ Kuyruk zaten boş');
      return;
    }
    
    const before = { Q, P, T, offline };
    
    if (P === 0) {
      setQ(0);
      await counterSync.updateCounter('Q', 0);

      if (offlineQueue) {
        await offlineQueue.clearQueue();
        await updateQueueItems();
      }
      
      const after = { Q: 0, P, T, offline };
      logAction('Kuyruğu Temizle', before, after);
      
      toast.success(`🗑️ Kuyruk temizlendi (${before.Q} kayıt)`);
      
    } else {
      setP(0);
      setQ(0);
      await counterSync.updateCounters({ P: 0, Q: 0 });
      
      if (offlineQueue) {
        await offlineQueue.clearQueue();
        await updateQueueItems();
      }
      
      const after = { Q: 0, P: 0, T, offline };
      logAction('Kuyruğu Temizle (İşlem İptal)', before, after);
      
      toast.success(`🛑 İşlem durduruldu ve kuyruk temizlendi (${before.Q} kayıt)`);
    }
  };

  const updateQueueItems = async () => {
    if (offlineQueue) {
      const items = await offlineQueue.getQueue();
      setQueueItems(items);
      if (onUpdate) onUpdate();
    }
  };

  // Initialization - sayaçları API'den senkronize et
  useEffect(() => {
    const initializeCounters = async () => {
      // 1. API'den global sayaçları çek
      const apiCounters = await counterSync.getCounters();
      if (apiCounters) {
        setQ(apiCounters.Q);
        setP(apiCounters.P);
        setT(apiCounters.T);
        setOffline(apiCounters.offline);
        console.log(`🔄 API'den yüklendi:`, apiCounters);
      }
      
      // 2. Lokal kuyruk verilerini yükle
      if (offlineQueue) {
        const queue = await offlineQueue.getQueue();
        setQueueItems(queue);
      }
    };
    
    initializeCounters();
    
    // Otomatik senkronizasyon başlat
    counterSync.startAutoSync(2000);
    
    // API değişikliklerini dinle
    const unsubscribe = counterSync.addListener((newCounters) => {
      console.log('🔄 API güncellemesi:', newCounters);
      setQ(newCounters.Q);
      setP(newCounters.P);
      setT(newCounters.T);
      setOffline(newCounters.offline);
    });
    
    return () => {
      counterSync.stopAutoSync();
      unsubscribe();
    };
  }, [offlineQueue]);

  // 24 saatlik toplama ekleme (T artırmak için)
  const add24hTotal = (count = 1) => {
    const now = new Date().toISOString();
    const records = JSON.parse(localStorage.getItem('24h_records') || '[]');
    for (let i = 0; i < count; i++) {
      records.push({ timestamp: now });
    }
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const filteredRecords = records.filter(record => record.timestamp > oneDayAgo);
    
    localStorage.setItem('24h_records', JSON.stringify(filteredRecords));
  };

  // 🔄 RENDER LOG - State takibi
  console.log(`🔄 render: offline=${offline}, Q=${Q}, P=${P}, T=${T}`);

  return (
    <div className="barcode-scanner">
      {/* Header */}
      <div className="scanner-header">
        <h1 className="scanner-title">🔄 Senkronize Barkod Sistemi</h1>
        <div className={`status-badge ${offline ? 'offline' : 'online'}`}>
          {offline ? '📱 Offline' : '🌐 Online'} • Senkronize
        </div>
      </div>

      {/* Q/P/T Sayaç Kutucukları - API SENKRONIZE */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card queue">
            <div className="stat-value">{Q}</div>
            <div className="stat-label">Kuyruk</div>
          </div>
          <div className="stat-card processing">
            <div className="stat-value">{P}</div>
            <div className="stat-label">İşleniyor</div>
          </div>
          <div className="stat-card total">
            <div className="stat-value">{T}</div>
            <div className="stat-label">Toplam</div>
            <div className="stat-subtitle">24 saat</div>
          </div>
        </div>
      </div>

      {/* Offline Toggle */}
      <div className="toggle-section">
        <div className="toggle-wrapper">
          <span className="toggle-label">Offline Modu</span>
          <div 
            className="toggle-hit-area"
            onClick={() => handleOfflineModeToggle(!offline)}
            onTouchStart={(e) => {
              e.preventDefault();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
            }}
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              zIndex: 10 // Toast üstüne çık
            }}
          >
            <button 
              className={`toggle-switch ${offline ? 'active' : ''}`}
              style={{ pointerEvents: 'none' }}
              data-offline={offline}
              data-class={offline ? 'active' : 'inactive'}
            >
              <div className="toggle-handle"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="action-section">
        <button 
          className="action-btn primary"
          onClick={processQueue}
          onTouchStart={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onTouchEnd={(e) => {
            setTimeout(() => {
              e.currentTarget.style.transform = '';
            }, 150);
          }}
          disabled={offline || Q === 0 || P > 0}
          title={
            offline 
              ? 'Offline modda pasif - Online moda geçin' 
              : Q === 0 
                ? 'Kuyruk boş - önce barkod ekleyin'
                : P > 0
                  ? 'İşlem devam ediyor'
                  : 'Kuyruktaki barkodları toplu işle'
          }
        >
          <FaSync className={P > 0 ? 'spinning' : ''} />
          {P > 0 ? 'İşleniyor...' : 'Kuyruğu İşle'}
        </button>

        <button 
          className="action-btn danger"
          onClick={() => {
            if (Q === 0) {
              toast.info('ℹ️ Kuyruk zaten boş');
              return;
            }
            setShowClearModal(true);
          }}
          onTouchStart={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onTouchEnd={(e) => {
            setTimeout(() => {
              e.currentTarget.style.transform = '';
            }, 150);
          }}
          disabled={Q === 0}
          title={
            Q === 0 
              ? 'Kuyruk boş - temizlenecek barkod yok'
              : `${Q} barkod var - kuyruğu temizle`
          }
        >
          <FaTrash />
          Temizle
        </button>
      </div>

      {/* Test Barkodları */}
      <div className="test-section">
        <h2 className="section-title">Test Barkodları</h2>
        <div className="test-grid">
          {testBarcodes.map((barcode, index) => (
            <div 
              key={index}
              className={`test-card ${barcode.valid ? 'valid' : 'invalid'}`}
              onClick={() => simulateScan(barcode)}
              onTouchStart={(e) => {
                e.currentTarget.style.transform = 'scale(0.95)';
              }}
              onTouchEnd={(e) => {
                setTimeout(() => {
                  e.currentTarget.style.transform = '';
                }, 150);
              }}
              style={{
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <div className="barcode-icon">
                <FaBarcode />
              </div>
              <div className="barcode-info">
                <div className="barcode-code">{barcode.code}</div>
                <div className="barcode-type">{barcode.type}</div>
                <div className={`barcode-status ${barcode.valid ? 'valid' : 'invalid'}`}>
                  {barcode.valid ? '✅ Geçerli' : '❌ Geçersiz'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue Items */}
      <div className="queue-section">
        <h3 className="queue-title">
          Kuyruk ({queueItems.length})
        </h3>
        
        {queueItems.length === 0 ? (
          <div className="empty-queue">
            <FaInfoCircle />
            <span>Kuyruk boş</span>
          </div>
        ) : (
          <div className="queue-list">
            {queueItems.map((item, index) => (
              <div key={item.id} className="queue-item">
                <div className="item-info">
                  <span className="item-barcode">{item.data?.barcode || 'N/A'}</span>
                  <span className="item-type">{item.data?.type || 'scan'}</span>
                  <span className={`item-status ${item.data?.status || 'pending'}`}>
                    {item.data?.status === 'pending' && '⏳ Bekliyor'}
                    {item.data?.status === 'processing' && '🔄 İşleniyor'}
                    {item.data?.status === 'success' && '✅ Başarılı'}
                    {item.data?.status === 'error' && '❌ Hatalı'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {Q >= 100 && (
          <div className="long-queue-warning">
            <FaInfoCircle />
            <span>Kuyruk büyük, arka planda gönderiliyor...</span>
          </div>
        )}
      </div>

      {/* Temizleme Onay Modalı */}
      {showClearModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h4>Kuyruğu temizle</h4>
            <p>Kuyrukta <strong>{Q}</strong> kayıt var. Bu işlem geri alınamaz.</p>
            {P > 0 && (
              <div className="warning-text">
                ⚠️ Şu anda {P} barkod işleniyor. İşlemi durdurup kuyruğu temizlemek istiyor musunuz?
              </div>
            )}
            <div className="modal-buttons">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowClearModal(false)}
              >
                Vazgeç
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => {
                  clearQueue();
                  setShowClearModal(false);
                }}
              >
                {P > 0 ? 'Evet, durdur ve sil' : 'Evet, temizle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncedBarcodeScanner;
