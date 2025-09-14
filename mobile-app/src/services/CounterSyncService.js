// 🎯 ORTAK SAYAÇ SENKRONİZASYON SERVİSİ
// Mobil ↔ Web ↔ API tam senkronizasyon

export class CounterSyncService {
  constructor() {
    // Mobil cihaz algılama
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.apiBaseUrl = isMobile ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
    
    this.listeners = new Set();
    this.lastCounters = null;
    this.syncInterval = null;
    
    console.log(`🌐 CounterSyncService API Base URL: ${this.apiBaseUrl} (Mobile: ${isMobile})`);
  }

  // Sayaçları API'den getir
  async getCounters() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/counters`);
      if (response.ok) {
        const data = await response.json();
        return data.counters;
      }
      return null;
    } catch (error) {
      console.error('❌ Sayaçları getirirken hata:', error);
      return null;
    }
  }

  // Sayaçları API'ye gönder
  async updateCounters(counters) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/counters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(counters)
      });
      
      if (response.ok) {
        const data = await response.json();
        this.notifyListeners(data.counters);
        return data.counters;
      }
      return null;
    } catch (error) {
      console.error('❌ Sayaçları güncellerken hata:', error);
      return null;
    }
  }

  // Belirli bir sayacı güncelle
  async updateCounter(key, value) {
    const update = { [key]: value };
    return await this.updateCounters(update);
  }

  // Otomatik senkronizasyon başlat (polling)
  startAutoSync(intervalMs = 2000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const counters = await this.getCounters();
      if (counters && this.hasChanged(counters)) {
        this.lastCounters = counters;
        this.notifyListeners(counters);
      }
    }, intervalMs);
  }

  // Otomatik senkronizasyonu durdur
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Değişim kontrolü
  hasChanged(newCounters) {
    if (!this.lastCounters) return true;
    
    return (
      this.lastCounters.Q !== newCounters.Q ||
      this.lastCounters.P !== newCounters.P ||
      this.lastCounters.T !== newCounters.T ||
      this.lastCounters.offline !== newCounters.offline
    );
  }

  // Listener ekle (component'ler için)
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Listener'lara bildir
  notifyListeners(counters) {
    this.listeners.forEach(callback => {
      try {
        callback(counters);
      } catch (error) {
        console.error('❌ Listener hatası:', error);
      }
    });
  }

  // Temizlik
  destroy() {
    this.stopAutoSync();
    this.listeners.clear();
  }
}

// Singleton instance
export const counterSync = new CounterSyncService();
