import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaSync, FaTrash, FaExclamationTriangle, FaCheck, FaClock, FaWifi, FaTimes } from 'react-icons/fa';
import './OfflineQueue.css';

const OfflineQueue = ({ offlineQueue, onUpdate }) => {
  const [queueItems, setQueueItems] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [filterType, setFilterType] = useState('all');

  // Queue verilerini yükle
  useEffect(() => {
    loadQueueData();
  }, []);

  const loadQueueData = async () => {
    if (offlineQueue) {
      try {
        const items = await offlineQueue.getQueueItems();
        setQueueItems(items);
      } catch (error) {
        console.error('Queue load error:', error);
        toast.error('❌ Kuyruk verileri yüklenemedi');
      }
    }
  };

  // Senkronizasyon başlat
  const handleSync = async () => {
    if (!offlineQueue) return;

    setIsSyncing(true);
    setSyncProgress(0);

    try {
      // Simüle edilmiş ilerleme
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const synced = await offlineQueue.syncWithServer();
      
      clearInterval(progressInterval);
      setSyncProgress(100);

      if (synced > 0) {
        toast.success(`✅ ${synced} veri senkronize edildi`);
        loadQueueData();
        if (onUpdate) onUpdate();
      } else {
        toast.info('ℹ️ Senkronize edilecek veri bulunamadı');
      }
    } catch (error) {
      toast.error('❌ Senkronizasyon hatası');
      console.error('Sync error:', error);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
        setSyncProgress(0);
      }, 1000);
    }
  };

  // Tekil item'ı sil
  const removeItem = async (id) => {
    if (!offlineQueue) return;

    try {
      await offlineQueue.removeFromQueue(id);
      toast.success('✅ Veri kuyruktan kaldırıldı');
      loadQueueData();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('❌ Veri kaldırılamadı');
      console.error('Remove error:', error);
    }
  };

  // Tüm queue'yu temizle
  const clearQueue = async () => {
    if (!offlineQueue) return;

    try {
      await offlineQueue.clearQueue();
      toast.success('✅ Tüm kuyruk temizlendi');
      setQueueItems([]);
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('❌ Kuyruk temizlenemedi');
      console.error('Clear error:', error);
    }
  };

  // Queue item'larını filtrele
  const filteredItems = queueItems.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  // Queue istatistikleri
  const getQueueStats = () => {
    const total = queueItems.length;
    const byType = queueItems.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

    return { total, byType };
  };

  const stats = getQueueStats();

  return (
    <div className="offline-queue">
      <div className="queue-header">
        <h2>📱 Offline Kuyruk</h2>
        <p className="queue-subtitle">Çevrimdışı veri yönetimi ve senkronizasyon</p>
      </div>

      {/* Queue İstatistikleri */}
      <div className="queue-stats">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Toplam Veri</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.byType.barcode_scan || 0}</div>
          <div className="stat-label">Barkod Tarama</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.byType.awb_acceptance || 0}</div>
          <div className="stat-label">AWB Kabul</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.byType.uld_loading || 0}</div>
          <div className="stat-label">ULD Yükleme</div>
        </div>
      </div>

      {/* Kontrol Paneli */}
      <div className="queue-controls">
        <div className="control-buttons">
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className={`sync-btn ${isSyncing ? 'syncing' : ''}`}
          >
            {isSyncing ? (
              <>
                <FaSync className="spinning" />
                Senkronize Ediliyor... ({syncProgress}%)
              </>
            ) : (
              <>
                <FaSync />
                Senkronize Et
              </>
            )}
          </button>
          
          <button 
            onClick={clearQueue}
            disabled={queueItems.length === 0}
            className="clear-btn"
          >
            <FaTrash />
            Tümünü Temizle
          </button>
        </div>

        {/* Filtre */}
        <div className="filter-controls">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tüm Veriler</option>
            <option value="barcode_scan">Barkod Tarama</option>
            <option value="awb_acceptance">AWB Kabul</option>
            <option value="uld_loading">ULD Yükleme</option>
          </select>
        </div>
      </div>

      {/* Senkronizasyon İlerlemesi */}
      {isSyncing && (
        <div className="sync-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${syncProgress}%` }}
            ></div>
          </div>
          <div className="progress-text">
            Senkronizasyon: %{syncProgress}
          </div>
        </div>
      )}

      {/* Queue Listesi */}
      <div className="queue-list">
        <div className="list-header">
          <h3>📋 Bekleyen Veriler</h3>
          <div className="list-count">
            {filteredItems.length} / {queueItems.length} veri
          </div>
        </div>
        
        {filteredItems.length === 0 ? (
          <div className="empty-queue">
            {queueItems.length === 0 ? (
              <>
                <FaCheck className="empty-icon success" />
                <p>Kuyrukta bekleyen veri yok</p>
                <small>Tüm veriler senkronize edildi</small>
              </>
            ) : (
              <>
                <FaExclamationTriangle className="empty-icon warning" />
                <p>Seçilen filtrede veri bulunamadı</p>
                <small>Filtreyi değiştirmeyi deneyin</small>
              </>
            )}
          </div>
        ) : (
          <div className="queue-items">
            {filteredItems.map((item) => (
              <div key={item.id} className="queue-item">
                <div className="item-header">
                  <div className="item-type">
                    {item.type === 'barcode_scan' && '📱 Barkod Tarama'}
                    {item.type === 'awb_acceptance' && '📋 AWB Kabul'}
                    {item.type === 'uld_loading' && '📦 ULD Yükleme'}
                  </div>
                  <div className="item-status pending">
                    <FaClock />
                    Bekliyor
                  </div>
                </div>
                
                <div className="item-content">
                  {item.type === 'barcode_scan' && (
                    <div className="item-details">
                      <div className="detail-row">
                        <span className="label">Kod:</span>
                        <span className="value">{item.data.code}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Tip:</span>
                        <span className="value">{item.data.type}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Zaman:</span>
                        <span className="value">{item.data.timestamp}</span>
                      </div>
                    </div>
                  )}
                  
                  {item.type === 'awb_acceptance' && (
                    <div className="item-details">
                      <div className="detail-row">
                        <span className="label">AWB:</span>
                        <span className="value">{item.data.awbNumber}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Rota:</span>
                        <span className="value">{item.data.origin} → {item.data.destination}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Ağırlık:</span>
                        <span className="value">{item.data.weight} kg</span>
                      </div>
                    </div>
                  )}
                  
                  {item.type === 'uld_loading' && (
                    <div className="item-details">
                      <div className="detail-row">
                        <span className="label">ULD:</span>
                        <span className="value">{item.data.uldCode}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Tip:</span>
                        <span className="value">{item.data.uldType}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Ağırlık:</span>
                        <span className="value">{item.data.currentWeight} / {item.data.maxWeight} kg</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="item-actions">
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="remove-btn"
                    title="Veriyi kaldır"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bağlantı Durumu */}
      <div className="connection-status">
        <div className="status-indicator">
          {navigator.onLine ? (
            <>
              <FaWifi className="status-icon online" />
              <span>Çevrimiçi - Senkronizasyon mümkün</span>
            </>
          ) : (
            <>
              <FaTimes className="status-icon offline" />
              <span>Çevrimdışı - Veriler kuyruğa yazılıyor</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineQueue;
