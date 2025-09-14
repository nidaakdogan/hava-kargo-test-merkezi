import localforage from 'localforage';

// LocalForage konfigürasyonu
localforage.config({
  name: 'cargo-mobile-app',
  storeName: 'offline-queue'
});

export class OfflineQueueService {
  constructor() {
    this.queueKey = 'offline-queue';
    this.syncKey = 'last-sync';
    
    // Mobil cihaz algılama
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.apiBaseUrl = 'http://localhost:3001';
    
    console.log(`🌐 API Base URL: ${this.apiBaseUrl} (Mobile: ${isMobile})`);
  }

  // Queue'ya veri ekle
  async addToQueue(data) {
    try {
      const queue = await this.getQueue();
      const queueItem = {
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: data.type,
        data: data,
        timestamp: new Date().toISOString(),
        deviceId: data.deviceId || 'unknown',
        status: 'pending',
        retryCount: 0,
        maxRetries: 3
      };

      queue.push(queueItem);
      await this.saveQueue(queue);

      console.log('📱 Veri kuyruğa eklendi:', queueItem);
      return queueItem.id;
    } catch (error) {
      console.error('❌ Queue ekleme hatası:', error);
      throw error;
    }
  }

  // Queue'dan veri al
  async getQueue() {
    try {
      const queue = await localforage.getItem(this.queueKey);
      return queue || [];
    } catch (error) {
      console.error('❌ Queue okuma hatası:', error);
      return [];
    }
  }

  // Queue'yu kaydet
  async saveQueue(queue) {
    try {
      await localforage.setItem(this.queueKey, queue);
    } catch (error) {
      console.error('❌ Queue kaydetme hatası:', error);
      throw error;
    }
  }

  // Queue uzunluğunu al
  async getQueueLength() {
    const queue = await this.getQueue();
    return queue.length;
  }

  // Queue'dan veri kaldır
  async removeFromQueue(id) {
    try {
      const queue = await this.getQueue();
      const filteredQueue = queue.filter(item => item.id !== id);
      await this.saveQueue(filteredQueue);
      return true;
    } catch (error) {
      console.error('❌ Queue silme hatası:', error);
      return false;
    }
  }

  // Queue'yu sunucu ile senkronize et
  async syncWithServer() {
    try {
      const queue = await this.getQueue();
      if (queue.length === 0) {
        return 0;
      }

      let syncedCount = 0;
      const failedItems = [];

      for (const item of queue) {
        try {
          // API'ye gönder
          const success = await this.sendToServer(item);
          
          if (success) {
            // Başarılı olanı queue'dan kaldır
            await this.removeFromQueue(item.id);
            syncedCount++;
          } else {
            // Başarısız olanı retry count'u artır
            item.retryCount++;
            if (item.retryCount >= item.maxRetries) {
              item.status = 'failed';
              failedItems.push(item);
            }
          }
        } catch (error) {
          console.error(`❌ Senkronizasyon hatası (${item.id}):`, error);
          item.retryCount++;
          if (item.retryCount >= item.maxRetries) {
            item.status = 'failed';
            failedItems.push(item);
          }
        }
      }

      // Failed item'ları güncelle
      if (failedItems.length > 0) {
        const updatedQueue = await this.getQueue();
        const newQueue = updatedQueue.map(item => {
          const failedItem = failedItems.find(fi => fi.id === item.id);
          return failedItem || item;
        });
        await this.saveQueue(newQueue);
      }

      // Son senkronizasyon zamanını kaydet
      await this.updateLastSync();

      console.log(`✅ ${syncedCount} veri senkronize edildi`);
      return syncedCount;

    } catch (error) {
      console.error('❌ Genel senkronizasyon hatası:', error);
      throw error;
    }
  }

  // Veriyi sunucuya gönder
  async sendToServer(item) {
    try {
      const endpoint = this.getEndpointForType(item.type);
      if (!endpoint) {
        console.warn(`⚠️ Bilinmeyen tip için endpoint yok: ${item.type}`);
        return false;
      }

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...item.data,
          offlineQueueId: item.id,
          deviceId: item.deviceId,
          originalTimestamp: item.timestamp
        })
      });

      if (response.ok) {
        console.log(`✅ Veri sunucuya gönderildi: ${item.id}`);
        return true;
      } else {
        console.warn(`⚠️ Sunucu hatası: ${response.status} - ${item.id}`);
        return false;
      }

    } catch (error) {
      console.error(`❌ Sunucu gönderim hatası (${item.id}):`, error);
      return false;
    }
  }

  // Tip için endpoint al
  getEndpointForType(type) {
    const endpoints = {
      'barcode_scan': '/api/scan',
      'awb-acceptance': '/api/awb/acceptance',
      'uld-loading': '/api/uld/loading',
      'dg-control': '/api/dg/control',
      'photo-capture': '/api/photo',
      'signature': '/api/signature'
    };

    return endpoints[type] || null;
  }

  // Son senkronizasyon zamanını güncelle
  async updateLastSync() {
    try {
      await localforage.setItem(this.syncKey, new Date().toISOString());
    } catch (error) {
      console.error('❌ Son senkronizasyon zamanı güncellenemedi:', error);
    }
  }

  // Son senkronizasyon zamanını al
  async getLastSync() {
    try {
      return await localforage.getItem(this.syncKey);
    } catch (error) {
      console.error('❌ Son senkronizasyon zamanı alınamadı:', error);
      return null;
    }
  }

  // Queue'yu temizle
  async clearQueue() {
    try {
      await localforage.removeItem(this.queueKey);
      console.log('🗑️ Queue temizlendi');
      return true;
    } catch (error) {
      console.error('❌ Queue temizleme hatası:', error);
      return false;
    }
  }

  // Queue istatistikleri
  async getQueueStats() {
    try {
      const queue = await this.getQueue();
      const stats = {
        total: queue.length,
        pending: queue.filter(item => item.status === 'pending').length,
        failed: queue.filter(item => item.status === 'failed').length,
        byType: {}
      };

      // Tip bazında sayım
      queue.forEach(item => {
        if (!stats.byType[item.type]) {
          stats.byType[item.type] = 0;
        }
        stats.byType[item.type]++;
      });

      return stats;
    } catch (error) {
      console.error('❌ Queue istatistikleri alınamadı:', error);
      return null;
    }
  }


}
