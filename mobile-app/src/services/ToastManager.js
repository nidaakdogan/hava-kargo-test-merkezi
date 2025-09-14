// Mobile Toast Manager - React Toastify ile entegrasyon
import { toast } from 'react-toastify';

class MobileToastManager {
  constructor() {
    this.toasts = new Map(); // toastId -> toast data
    this.maxToasts = 3;
    this.queue = []; // bekleyen toasts
  }

  // Toast ekleme - tekilleştirme ile
  addToast(toastData) {
    const { id, type = 'info', title, message, duration, action, sticky = false } = toastData;
    
    // Tekilleştirme: aynı ID varsa güncelle
    if (this.toasts.has(id)) {
      this.updateToast(id, toastData);
      return;
    }

    // Süre ayarları
    const durations = {
      info: 3000,
      success: 3000,
      warning: 4000,
      error: 6000
    };

    const toastConfig = {
      id,
      type,
      title,
      message,
      duration: duration || durations[type] || 3000,
      action,
      sticky,
      timestamp: Date.now()
    };

    // 3 toast limiti kontrolü
    if (this.toasts.size >= this.maxToasts) {
      this.queue.push(toastConfig);
      return;
    }

    this.toasts.set(id, toastConfig);
    this.showToast(toastConfig);
  }

  // Toast gösterme
  showToast(toastConfig) {
    const { id, type, title, message, duration, action, sticky } = toastConfig;

    const toastContent = (
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{title}</div>
        <div>{message}</div>
        {action && (
          <button 
            style={{ 
              marginTop: '8px', 
              padding: '4px 8px', 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              fontSize: '12px'
            }}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
      </div>
    );

    const toastOptions = {
      toastId: id,
      autoClose: sticky ? false : duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    };

    switch (type) {
      case 'success':
        toast.success(toastContent, toastOptions);
        break;
      case 'warning':
        toast.warning(toastContent, toastOptions);
        break;
      case 'error':
        toast.error(toastContent, toastOptions);
        break;
      case 'info':
      default:
        toast.info(toastContent, toastOptions);
        break;
    }
  }

  // Toast güncelleme
  updateToast(id, newData) {
    if (this.toasts.has(id)) {
      const existing = this.toasts.get(id);
      const updated = { ...existing, ...newData, timestamp: Date.now() };
      this.toasts.set(id, updated);
      this.showToast(updated);
    }
  }

  // Toast kaldırma
  removeToast(id) {
    if (this.toasts.has(id)) {
      this.toasts.delete(id);
      toast.dismiss(id);
      
      // Kuyruktan bir toast al
      if (this.queue.length > 0) {
        const nextToast = this.queue.shift();
        this.toasts.set(nextToast.id, nextToast);
        this.showToast(nextToast);
      }
    }
  }

  // Tüm toasts'ları temizle
  clearAll() {
    this.toasts.clear();
    this.queue = [];
    toast.dismiss();
  }

  // Predefined toast scenarios
  scenarios = {
    // Mobil hazır olduğunda
    mobileReady: () => this.addToast({
      id: 'mobile-ready',
      type: 'success',
      title: 'Mobil Test Hazır',
      message: 'Mobil test hazır. Barkodları okutabilirsiniz.'
    }),

    // Barkod OK
    barcodeOk: (code) => this.addToast({
      id: 'barcode-ok',
      type: 'success',
      title: 'Barkod Okundu',
      message: `Barkod okundu: ${code}`
    }),

    // Barkod FAIL
    barcodeFail: () => this.addToast({
      id: 'barcode-fail',
      type: 'error',
      title: 'Geçersiz Barkod',
      message: 'Geçersiz barkod formatı. Örn: 1234567890128'
    }),

    // Kuyruğa ekleme
    queueAdd: () => this.addToast({
      id: 'queue-add',
      type: 'info',
      title: 'Kuyruğa Eklendi',
      message: 'Barkod kuyruğa eklendi.'
    }),

    // Kuyruk işleme
    queueProcessing: () => this.addToast({
      id: 'queue-processing',
      type: 'info',
      title: 'Kuyruk İşleniyor',
      message: 'Kuyruk işleniyor…'
    }),

    // Kuyruk sonucu
    queueResult: (ok, fail) => this.addToast({
      id: 'queue-result',
      type: 'success',
      title: 'Kuyruk İşlendi',
      message: `Kuyruk işlendi: ${ok} OK, ${fail} FAIL.`
    }),

    // Boş kuyruk
    queueEmpty: () => this.addToast({
      id: 'queue-empty',
      type: 'info',
      title: 'Boş Kuyruk',
      message: 'İşlenecek barkod yok.'
    }),

    // Kuyruk temizlendi
    queueCleared: (count) => this.addToast({
      id: 'queue-cleared',
      type: 'warning',
      title: 'Kuyruk Temizlendi',
      message: `Kuyruk temizlendi (${count} öğe).`
    }),

    // Mobil test tamamlandı
    mobileDone: () => this.addToast({
      id: 'mobile-done',
      type: 'success',
      title: 'Mobil Test Tamamlandı',
      message: 'Mobil test tamamlandı.'
    }),


    // Zaman aşımı
    timeoutMobile: () => this.addToast({
      id: 'timeout-mobile',
      type: 'warning',
      title: 'Bağlantı Zaman Aşımı',
      message: 'Mobil bağlantı bekleniyor… Yardım için tıklayın.',
      sticky: true,
      action: {
        label: 'Yardım',
        onClick: () => {
          console.log('Yardım modalı açılıyor...');
        }
      }
    })
  };
}

// Singleton instance
const mobileToastManager = new MobileToastManager();

// Event Bus - UI ekranları doğrudan toast basmasın
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  // Event dinleme
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  // Event gönderme
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  // Event dinlemeyi bırakma
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }
}

const eventBus = new EventBus();

// Event Bus ile toast senaryolarını bağla
eventBus.on('mobile:ready', () => mobileToastManager.scenarios.mobileReady());
eventBus.on('barcode:ok', (data) => mobileToastManager.scenarios.barcodeOk(data.code));
eventBus.on('barcode:fail', () => mobileToastManager.scenarios.barcodeFail());
eventBus.on('queue:add', () => mobileToastManager.scenarios.queueAdd());
eventBus.on('queue:processing', () => mobileToastManager.scenarios.queueProcessing());
eventBus.on('queue:result', (data) => mobileToastManager.scenarios.queueResult(data.ok, data.fail));
eventBus.on('queue:empty', () => mobileToastManager.scenarios.queueEmpty());
eventBus.on('mobile:done', () => mobileToastManager.scenarios.mobileDone());
eventBus.on('mobile:timeout', () => mobileToastManager.scenarios.timeoutMobile());
eventBus.on('queue:cleared', (data) => mobileToastManager.scenarios.queueCleared(data.count));

export { mobileToastManager, eventBus };
