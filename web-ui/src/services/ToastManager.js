// Toast Manager - Spesifikasyon uyumlu
class ToastManager {
  constructor() {
    this.toasts = new Map(); // toastId -> toast data
    this.maxToasts = 3; // limit: 3 (kuyruk devam eder)
    this.queue = []; // bekleyen toasts
    this.listeners = new Set(); // UI listeners
    this.isMobile = window.innerWidth <= 640; // Mobil tespiti (640px)
  }

  // Toast ekleme - Spesifikasyon uyumlu
  showToast(message, opts = {}) {
    const { type = 'info', durationMs = 6000, position = 'top-right', id } = opts;
    
    // Sanitize: boş message → no-op
    if (!message || message.trim() === '') {
      console.log('[Toast] Boş mesaj, gösterilmiyor');
      return;
    }
    
    // Sanitize: tip dışındaysa → info
    const validTypes = ['info', 'success', 'warning', 'error'];
    const finalType = validTypes.includes(type) ? type : 'info';
    
    // Sanitize: süre NaN → 3000
    const finalDuration = isNaN(durationMs) ? 3000 : durationMs;
    
    const toastId = id || `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const toastData = {
      id: toastId,
      type: finalType,
      message: message.trim(),
      duration: finalDuration,
      position
    };
    
    this.addToast(toastData);
  }

  // Internal toast ekleme
  addToast(toastData) {
    const { id, type = 'info', message, duration = 6000 } = toastData;
    
    // ID kuralı: yoksa show(id), varsa update(id); dismiss yapma
    if (this.toasts.has(id)) {
      this.updateToast(id, toastData);
      return;
    }
    
    const now = Date.now();
    const toast = {
      id,
      type,
      message,
      duration,
      timestamp: now,
      isVisible: true,
      isPaused: false,
      remainingTime: duration
    };

    // Limit kontrolü
    if (this.toasts.size >= this.maxToasts) {
      this.queue.push(toast);
      console.log(`[Toast] Kuyruğa eklendi (${this.queue.length} bekliyor):`, id);
      return;
    }

    this.toasts.set(id, toast);
    this.notifyListeners();
    
    // Auto close timer - pauseOnHover: true
    if (duration > 0) {
      this.startAutoCloseTimer(id, duration);
    }
    
    console.log(`[Toast] Gösterildi: ${id} (${duration}ms)`);
  }

  // Auto close timer başlat
  startAutoCloseTimer(id, duration) {
    const toast = this.toasts.get(id);
    if (!toast) return;

    const timer = setTimeout(() => {
      this.removeToast(id);
    }, duration);

    toast.timer = timer;
    this.toasts.set(id, toast);
  }

  // Toast'ı pause et (hover)
  pauseToast(id) {
    const toast = this.toasts.get(id);
    if (!toast || !toast.timer) return;

    clearTimeout(toast.timer);
    toast.isPaused = true;
    this.toasts.set(id, toast);
    this.notifyListeners();
  }

  // Toast'ı resume et (hover bırakma)
  resumeToast(id) {
    const toast = this.toasts.get(id);
    if (!toast || !toast.isPaused) return;

    const remainingTime = toast.remainingTime || toast.duration;
    this.startAutoCloseTimer(id, remainingTime);
    
    toast.isPaused = false;
    this.toasts.set(id, toast);
    this.notifyListeners();
  }

  // Toast güncelleme
  updateToast(id, newData) {
    if (!this.toasts.has(id)) {
      console.warn(`[Toast] Güncellenmeye çalışılan toast bulunamadı: ${id}`);
      return;
    }

    const existingToast = this.toasts.get(id);
    const updatedToast = {
      ...existingToast,
      ...newData,
      id, // ID değiştirilemez
      timestamp: existingToast.timestamp // Timestamp korunur
    };

    this.toasts.set(id, updatedToast);
    this.notifyListeners();
    
    console.log(`[Toast] Güncellendi: ${id}`);
  }

  // Toast kaldırma
  removeToast(id) {
    if (this.toasts.has(id)) {
      this.toasts.delete(id);
      this.notifyListeners();
      
      // Kuyruktan bir sonraki toast'ı göster
      if (this.queue.length > 0) {
        const nextToast = this.queue.shift();
        this.addToast(nextToast);
      }
      
      console.log(`[Toast] Kaldırıldı: ${id}`);
    }
  }

  // RunId'ye ait tüm toast'ları kapat
  removeToastsByRunId(runId) {
    const toRemove = [];
    
    for (const [id, toast] of this.toasts) {
      if (id.startsWith(`run:${runId}:`)) {
        toRemove.push(id);
      }
    }
    
    toRemove.forEach(id => this.removeToast(id));
    
    // Kuyruktaki runId toast'larını da temizle
    this.queue = this.queue.filter(toast => !toast.id.startsWith(`run:${runId}:`));
    
    console.log(`[Toast] RunId ${runId} toast'ları kaldırıldı: ${toRemove.length} adet`);
  }

  // Toast alma
  getToast(id) {
    return this.toasts.get(id);
  }

  // Tüm toast'ları alma
  getAllToasts() {
    return Array.from(this.toasts.values());
  }

  // Listener ekleme
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Listener'ları bilgilendirme
  notifyListeners() {
    const toasts = this.getAllToasts();
    this.listeners.forEach(callback => {
      try {
        callback(toasts);
      } catch (error) {
        console.error('[Toast] Listener hatası:', error);
      }
    });
  }

  // Tüm toast'ları temizle
  clearAll() {
    this.toasts.clear();
    this.queue = [];
    this.notifyListeners();
    console.log('[Toast] Tüm toast\'lar temizlendi');
  }
}

// Singleton instance
const toastManager = new ToastManager();

// Event bus for backward compatibility
const eventBus = {
  emit: (event, data) => {
    console.log(`[EventBus] ${event}:`, data);
  },
  on: (event, callback) => {
    console.log(`[EventBus] Listener eklendi: ${event}`);
  },
  off: (event, callback) => {
    console.log(`[EventBus] Listener kaldırıldı: ${event}`);
  }
};

export { toastManager, eventBus };