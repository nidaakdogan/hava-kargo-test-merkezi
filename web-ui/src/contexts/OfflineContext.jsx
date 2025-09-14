import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const OfflineContext = createContext();

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

export const OfflineProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [lastSync, setLastSync] = useState(null);

  // Offline durumunu kontrol et
  const checkConnection = useCallback(() => {
    const online = navigator.onLine;
    setIsOffline(!online);
    
    if (online && offlineQueue.length > 0) {
      // Online olduğunda kuyruğu işle
      processOfflineQueue();
    }
  }, [offlineQueue.length]);

  // Offline kuyruğa ekle
  const addToOfflineQueue = useCallback((action, data) => {
    const queueItem = {
      id: Date.now() + Math.random(),
      action,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };
    
    setOfflineQueue(prev => [...prev, queueItem]);
    
    // LocalStorage'a kaydet
    localStorage.setItem('offline_queue', JSON.stringify([...offlineQueue, queueItem]));
    
    return queueItem.id;
  }, [offlineQueue]);

  // Offline kuyruğu işle
  const processOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;
    
    const itemsToProcess = [...offlineQueue];
    const successfulItems = [];
    const failedItems = [];
    
    for (const item of itemsToProcess) {
      try {
        // Backend'e gönder
        const response = await fetch('/api/offline-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(item)
        });
        
        if (response.ok) {
          successfulItems.push(item.id);
        } else {
          failedItems.push(item);
        }
      } catch (error) {
        console.error('Offline sync error:', error);
        failedItems.push(item);
      }
    }
    
    // Başarılı olanları kuyruktan çıkar
    setOfflineQueue(prev => prev.filter(item => !successfulItems.includes(item.id)));
    
    // LocalStorage'ı güncelle
    const updatedQueue = offlineQueue.filter(item => !successfulItems.includes(item.id));
    localStorage.setItem('offline_queue', JSON.stringify(updatedQueue));
    
    // Son sync zamanını güncelle
    if (successfulItems.length > 0) {
      setLastSync(new Date().toISOString());
      localStorage.setItem('last_sync', new Date().toISOString());
    }
    
    return { successful: successfulItems.length, failed: failedItems.length };
  }, [offlineQueue]);

  // Kuyruğu temizle
  const clearOfflineQueue = useCallback(() => {
    setOfflineQueue([]);
    localStorage.removeItem('offline_queue');
  }, []);

  // Kuyruk durumunu getir
  const getQueueStatus = useCallback(() => ({
    count: offlineQueue.length,
    lastSync,
    isOffline
  }), [offlineQueue.length, lastSync, isOffline]);

  // İlk yüklemede offline kuyruğu kontrol et
  useEffect(() => {
    const savedQueue = localStorage.getItem('offline_queue');
    const savedLastSync = localStorage.getItem('last_sync');
    
    if (savedQueue) {
      try {
        setOfflineQueue(JSON.parse(savedQueue));
      } catch (error) {
        console.error('Offline queue parse error:', error);
        localStorage.removeItem('offline_queue');
      }
    }
    
    if (savedLastSync) {
      setLastSync(savedLastSync);
    }
    
    // Bağlantı durumunu kontrol et
    checkConnection();
  }, [checkConnection]);

  // Online/offline event listener'ları
  useEffect(() => {
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    
    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, [checkConnection]);

  // Offline durumunda otomatik sync (her 30 saniyede bir)
  useEffect(() => {
    if (!isOffline && offlineQueue.length > 0) {
      const syncInterval = setInterval(() => {
        processOfflineQueue();
      }, 30000);
      
      return () => clearInterval(syncInterval);
    }
  }, [isOffline, offlineQueue.length, processOfflineQueue]);

  const value = {
    isOffline,
    offlineQueue,
    lastSync,
    addToOfflineQueue,
    processOfflineQueue,
    clearOfflineQueue,
    getQueueStatus,
    checkConnection
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};
