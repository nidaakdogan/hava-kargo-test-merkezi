import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaBarcode, FaToggleOn, FaToggleOff, FaTrash, FaSync, FaInfoCircle, FaMobile } from 'react-icons/fa';
import { counterSync } from '../services/CounterSyncService';
import { eventBus } from '../services/ToastManager';
import './BarcodeScanner.css';

const BarcodeScanner = ({ offlineQueue, onUpdate, runState, onTestComplete }) => {
  // 🎯 TEK KAYNAKLI DURUM MODELİ - Sadece depodan oku
  const [offline, setOffline] = useState(false);  // true/false
  const [Q, setQ] = useState(0);                  // kuyruk: count(status == "queued")
  const [P, setP] = useState(0);                  // işleniyor: count(status == "processing")
  const [T, setT] = useState(0);                  // toplam: count(status == "done" AND sameDay(completedAt, today))
  
  // Worker durumu - idle | running (kilitleme için)
  const [running, setRunning] = useState(false);
  
  // 🔄 RECALC() - Her olaydan sonra çalışır, depodan yeniden hesaplar
  const recalc = async () => {
    try {
      const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      
      // Kuyruk = count(status == "queued")
      const queuedCount = queueData.filter(item => item.status === 'queued').length
      
      // İşleniyor = count(status == "processing") 
      const processingCount = queueData.filter(item => item.status === 'processing').length
      
      // Toplam (Bugün) = count(status == "done" AND sameDay(completedAt, today))
      const today = new Date().toDateString()
      const doneCount = queueData.filter(item => 
        item.status === 'done' && 
        item.completedAt && 
        new Date(item.completedAt).toDateString() === today
      ).length
      
      // State'i güncelle
      setQ(queuedCount)
      setP(processingCount)
      setT(doneCount)
      
      console.log(`🔄 RECALC: Q=${queuedCount}, P=${processingCount}, T=${doneCount}`)
    } catch (error) {
      console.error('❌ RECALC hatası:', error)
    }
  }
  
  // Yardımcı state (UI için)
  const [queueItems, setQueueItems] = useState([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  
  // Debounce koruma - 300ms
  const [lastActionTime, setLastActionTime] = useState(0);
  const DEBOUNCE_DELAY = 300;
  
  // 20 saniyelik watchdog - takılmayı önler
  const [watchdogTimer, setWatchdogTimer] = useState(null);
  const WATCHDOG_TIMEOUT = 20000; // 20 saniye

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

  // 🐕 WATCHDOG - 20 saniye sonra processing kayıtları queued'a döndür
  const startWatchdog = () => {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
    }
    
    const timer = setTimeout(async () => {
      console.log('🐕 Watchdog tetiklendi - 20sn aşan processing kayıtları kontrol ediliyor');
      
      const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      const now = new Date().getTime()
      let updated = false
      
      // Processing kayıtları kontrol et: now - startedAt > 20sn
      const updatedQueueData = queueData.map(item => {
        if (item.status === 'processing' && item.startedAt) {
          const startedTime = new Date(item.startedAt).getTime()
          const elapsed = now - startedTime
          
          if (elapsed > 20000) { // 20 saniye
            console.log(`⏰ Watchdog: ${item.id} 20sn aştı (${Math.round(elapsed/1000)}sn), queued'a döndürülüyor`)
            updated = true
            return {
              ...item,
              status: 'queued',
              startedAt: null,
              retryCount: (item.retryCount || 0) + 1
            }
          }
        }
        return item
      })
      
      if (updated) {
        localStorage.setItem('offline_queue', JSON.stringify(updatedQueueData))
        await recalc() // RECALC çalıştır
        toast.warning('⚠️ 20 saniye aşan işler kuyruğa döndürüldü')
      }
      
      setWatchdogTimer(null)
    }, WATCHDOG_TIMEOUT);
    
    setWatchdogTimer(timer);
  };

  // Watchdog'u durdur
  const stopWatchdog = () => {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      setWatchdogTimer(null);
    }
  };

  // Buton durumları hesaplama - SPESİFİKASYONA GÖRE
  const getButtonStates = () => {
    return {
      scanButton: {
        disabled: false, // Her zaman aktif
        tooltip: 'Barkod tara/oku'
      },
      processButton: {
        disabled: !(Q > 0 && !running), // Q > 0 && !running (offline kontrolü kaldırıldı)
        tooltip: !(Q > 0) ? 'Kuyruk boş' :
                running ? 'İşlem devam ediyor' : 'Kuyruğu işle'
      },
      clearButton: {
        disabled: !(Q > 0 && !running), // Q > 0 && !running
        tooltip: !(Q > 0) ? 'Kuyruk boş' :
                running ? 'İşlem devam ediyor' : 'Kuyruğu temizle'
      }
    };
  };



  // Toggle fonksiyonu kaldırıldı - sadece online mod


  // 🔄 2) Barkod Tara / Oku - Anında işlem veya modal açma
  const openBarcodeModal = () => {
    if (!checkDebounce()) return;
    
    // Test tamamlandıysa UI'ı kilitle
    if (runState === 'completed' || runState === 'failed') {
      toast.info('Test tamamlandı - yeni test başlatın');
      return;
    }
    
    console.log(`🔄 Barkod Tara clicked: offline=${offline}, Q=${Q}, P=${P}, T=${T}`);
    
    // Offline KAPALI ise anında işlem yap
    if (!offline) {
      handleInstantBarcodeScan();
    } else {
      // Offline AÇIK ise modal aç
      setIsSimModalOpen(true);
    }
  };

  // Anında barkod işleme (offline kapalı)
  const handleInstantBarcodeScan = async () => {
    if (!checkDebounce()) return;
    
    console.log(`🎯 Anında barkod işleme: offline=${offline}`);
    
    setRunning(true); // Kilitleme
    
    try {
      // Test barkodu kullan
      const testBarcode = { code: 'ULD-ABC12345XY', valid: true };
      
      console.log(`🎯 Barkod işleniyor: ${testBarcode.code}`);
      
      // Simülasyon - işleme süresi (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (testBarcode.valid) {
        // Başarılı → status=done, completedAt=now
        const newItem = {
          id: `barcode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          barcode: testBarcode.code,
          timestamp: new Date().toISOString(),
          status: 'done',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          retryCount: 0
        }
        
        // Depoya kaydet
        const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
        queueData.push(newItem)
        localStorage.setItem('offline_queue', JSON.stringify(queueData))
        
        // RECALC çalıştır
        await recalc()
        
        toast.success(`✅ Barkod işlendi: ${testBarcode.code}`);
        eventBus.emit('barcode:ok', { code: testBarcode.code });
        
        // Event gönder
        await sendEvent('barcode_ok', { 
          code: testBarcode.code, 
          mode: 'online' 
        });
      } else {
        // Başarısız: T değişmez (hiçbir şey kaydetme)
        toast.error('❌ İşlem başarısız');
        eventBus.emit('barcode:fail');
        
        // Event gönder
        await sendEvent('barcode_fail', { 
          reason: 'invalid_format' 
        });
      }
      
    } catch (error) {
      console.error('❌ Anında barkod işleme hatası:', error);
      toast.error('❌ Barkod işlenemedi');
      
      // Event gönder
      await sendEvent('barcode_fail', { 
        reason: 'server_5xx' 
      });
    } finally {
      setRunning(false); // Kilidi aç
    }
  };

  // 🔄 3) Barkod seçimi ve işleme
  const simulateScan = async (barcode) => {
    if (!checkDebounce()) return;
    
    console.log(`🔄 Barkod seçildi: offline=${offline}, Q=${Q}, P=${P}, T=${T}, barcode=${barcode?.code || 'manual'}`);
    
    // Modal kapat
    setIsSimModalOpen(false);
    
    // Offline AÇIK iken barkod eklendi → Kuyruk +1
    if (offline) {
      const newItem = {
        id: `barcode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        barcode: barcode?.code || 'TEST-12345',
        timestamp: new Date().toISOString(),
        status: 'queued',
        createdAt: new Date().toISOString(),
        retryCount: 0
      }
      
      // Depoya kaydet
      const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      queueData.push(newItem)
      localStorage.setItem('offline_queue', JSON.stringify(queueData))
      
      // RECALC çalıştır
      await recalc()
      
      eventBus.emit('queue:add');
      return;
    }
    
    // Online modda simülasyon - API çağrısı yapma
    setRunning(true); // Kilitleme
    
    try {
      const testBarcode = barcode || { code: 'TEST-12345', valid: true };
      
      console.log(`🎯 Barkod simülasyonu: ${testBarcode.code}`);
      
      // Simülasyon - işleme süresi (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (testBarcode.valid) {
        // Başarılı → status=done, completedAt=now
        const newItem = {
          id: `barcode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          barcode: testBarcode.code,
          timestamp: new Date().toISOString(),
          status: 'done',
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          retryCount: 0
        }
        
        // Depoya kaydet
        const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
        queueData.push(newItem)
        localStorage.setItem('offline_queue', JSON.stringify(queueData))
        
        // RECALC çalıştır
        await recalc()
        
        toast.success(`✅ Barkod işlendi (simülasyon)`);
        eventBus.emit('barcode:ok', { code: testBarcode.code });
        
        // Event gönder
        await sendEvent('barcode_ok', { 
          code: testBarcode.code, 
          mode: 'online' 
        });
      } else {
        // Başarısız: T değişmez (hiçbir şey kaydetme)
        toast.error('❌ İşlem başarısız (simülasyon)');
        eventBus.emit('barcode:fail');
        
        // Event gönder
        await sendEvent('barcode_fail', { 
          reason: 'invalid_format' 
        });
      }
      
    } catch (error) {
      console.error('❌ Barkod simülasyon hatası:', error);
      toast.error('❌ Simülasyon hatası');
    } finally {
      setRunning(false); // Kilidi aç
    }
  };

  // Health check fonksiyonu
  const checkServerHealth = async () => {
    try {
      // URL parametresinden test modunu kontrol et
      const urlParams = new URLSearchParams(window.location.search);
      const testMode = urlParams.get('test') || 'desktop';
      
      let apiBaseUrl;
      if (testMode === 'mobile' || testMode === 'emulator') {
        apiBaseUrl = 'http://localhost:3001';
      } else {
        apiBaseUrl = 'http://localhost:3001';
      }
      
      console.log(`🏥 Health check: ${apiBaseUrl}/health (testMode: ${testMode})`);
      const startTime = Date.now();
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${apiBaseUrl}/health`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        console.log(`✅ Server health OK: ${duration}ms`);
        return { success: true, url: apiBaseUrl, duration };
      } else {
        console.log(`❌ Server health failed: ${response.status} - ${duration}ms`);
        return { success: false, url: apiBaseUrl, error: `HTTP ${response.status}`, duration };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Server health error: ${error.message} - ${duration}ms`);
      
      let errorType = 'UNKNOWN';
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorType = 'NETWORK_ERROR';
      } else if (error.name === 'AbortError') {
        errorType = 'TIMEOUT';
      } else if (error.message.includes('DNS')) {
        errorType = 'DNS_ERROR';
      }
      
      return { 
        success: false, 
        url: apiBaseUrl, 
        error: errorType, 
        duration 
      };
    }
  };

  // 🔄 3) Kuyruğu İşle (yalnız offline KAPALI ve Q>0 iken)
  const processQueue = async () => {
    if (!checkDebounce()) return;
    
    // Kilitleme kontrolü
    if (running) {
      console.log('🚫 Kuyruğu İşle blocked: zaten çalışıyor');
      return;
    }
    
    // Run state kontrolü (Shadow Runner için)
    const urlParams = new URLSearchParams(window.location.search);
    const runId = urlParams.get('runId');
    if (!runId) {
      console.log('🚫 Kuyruğu İşle blocked: runId yok');
      toast.error('❌ RunId bulunamadı - yeni test başlatın');
      return;
    }
    
    // Health check önce
    console.log('🏥 Kuyruğu İşle öncesi health check...');
    const healthResult = await checkServerHealth();
    
    if (!healthResult.success) {
      const errorMsg = `Sunucuya ulaşılamıyor – ${healthResult.url}/health → ${healthResult.error} (${healthResult.duration}ms)`;
      console.log(`❌ ${errorMsg}`);
      toast.error(errorMsg);
      return;
    }
    
    setRunning(true); // Kilitleme
    
    try {
      console.log(`🔄 Kuyruğu İşle başladı: Q=${Q}, P=${P}, T=${T}`);
      
      // Depodan queued kayıtları al
      const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      const queuedItems = queueData.filter(item => item.status === 'queued')
      
      if (queuedItems.length === 0) {
        toast.info('ℹ️ Kuyruk boş');
        return;
      }
      
      // Her queued kaydı için işle
      for (const item of queuedItems) {
        try {
          // 1) Al (atomik): queued → processing
          const updatedQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
          const finalQueueData = updatedQueueData.map(queueItem => {
            if (queueItem.id === item.id && queueItem.status === 'queued') {
              return {
                ...queueItem,
                status: 'processing',
                startedAt: new Date().toISOString()
              }
            }
            return queueItem
          })
          localStorage.setItem('offline_queue', JSON.stringify(finalQueueData))
          
          // RECALC çalıştır
          await recalc()
          
          // 2) Gönder (gerçek API çağrısı)
          const urlParams = new URLSearchParams(window.location.search);
          const testMode = urlParams.get('test') || 'desktop';
          
          let apiBaseUrl;
          if (testMode === 'mobile' || testMode === 'emulator') {
            apiBaseUrl = 'http://localhost:3001';
          } else {
            apiBaseUrl = 'http://localhost:3001';
          }
          
          // Shadow Runner: /api/events endpoint'ini kullan (tenant bazlı)
          const eventId = `${runId}-barcode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const tenantId = urlParams.get('tenant') || 'default';
          
          console.log(`📤 Shadow Runner: Barkod event gönderiliyor: ${item.barcode} → ${apiBaseUrl}/api/events`);
          console.log(`📤 Event detayları: runId=${runId}, eventId=${eventId}, tenantId=${tenantId}, timestamp=${new Date().toISOString()}`);
          
          const startTime = Date.now();
          const response = await fetch(`${apiBaseUrl}/api/events?tenant=${tenantId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              runId: runId,
              eventId: eventId,
              type: 'barcode_ok',
              source: 'mobile',
              data: {
                code: item.barcode,
                mode: 'online',
                timestamp: item.timestamp
              }
            })
          });
          
          const duration = Date.now() - startTime;
          console.log(`📡 Shadow Runner API yanıtı: ${response.status} (${duration}ms) - runId=${runId}, eventId=${eventId}`);
          
          // Response'u parse et
          const responseData = await response.json();
          console.log(`📡 Shadow Runner API response:`, responseData);
          
          // Shadow Runner: HTTP 200 = başarılı event gönderimi
          const isSuccess = response.ok;
          console.log(`📊 Event işleme sonucu: ${isSuccess ? 'ACCEPTED' : 'REJECTED'} - ${response.status} - ${duration}ms`);
          
          if (isSuccess) {
            // 200 → status=done, completedAt=now
            const successQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
            const finalSuccessData = successQueueData.map(queueItem => {
              if (queueItem.id === item.id && queueItem.status === 'processing') {
                return {
                  ...queueItem,
                  status: 'done',
                  completedAt: new Date().toISOString()
                }
              }
              return queueItem
            })
            localStorage.setItem('offline_queue', JSON.stringify(finalSuccessData))
            
            console.log(`✅ ${item.barcode} başarıyla işlendi - runId=${runId}, eventId=${eventId}`)
            toast.success(`✅ ${item.barcode} işlendi`);
          } else {
            // 5xx/timeout/ağ → status=queued, retry++
            const retryQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
            const finalRetryData = retryQueueData.map(queueItem => {
              if (queueItem.id === item.id && queueItem.status === 'processing') {
                return {
                  ...queueItem,
                  status: 'queued',
                  startedAt: null,
                  retryCount: (queueItem.retryCount || 0) + 1,
                  lastError: `HTTP ${response.status} (${duration}ms)`
                }
              }
              return queueItem
            })
            localStorage.setItem('offline_queue', JSON.stringify(finalRetryData))
            
            console.log(`⚠️ ${item.barcode} geçici hata (${response.status}), kuyruğa döndürüldü`)
            toast.warning(`Sunucuya ulaşılamadı – tekrar denenecek (${(item.retryCount || 0) + 1}/3)`)
          }
          
          // RECALC çalıştır
          await recalc()
          
        } catch (error) {
          console.error(`❌ ${item.barcode} işleme hatası:`, error)
          
          // Hata türünü belirle
          let errorType = 'UNKNOWN';
          if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorType = 'NETWORK_ERROR';
          } else if (error.name === 'AbortError') {
            errorType = 'TIMEOUT';
          } else if (error.message.includes('DNS')) {
            errorType = 'DNS_ERROR';
          }
          
          // Hata durumunda queued'a döndür
          const errorQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
          const finalErrorData = errorQueueData.map(queueItem => {
            if (queueItem.id === item.id && queueItem.status === 'processing') {
              return {
                ...queueItem,
                status: 'queued',
                startedAt: null,
                retryCount: (queueItem.retryCount || 0) + 1,
                lastError: `${errorType}: ${error.message}`
              }
            }
            return queueItem
          })
          localStorage.setItem('offline_queue', JSON.stringify(finalErrorData))
          
          console.log(`⚠️ ${item.barcode} ${errorType} hatası, kuyruğa döndürüldü`)
          toast.warning(`Sunucuya ulaşılamadı – tekrar denenecek (${(item.retryCount || 0) + 1}/3)`)
          
          await recalc()
        }
      }
      
      toast.success(`🎉 Kuyruk işleme tamamlandı`);
      
    } catch (error) {
      console.error('❌ Kuyruk işleme hatası:', error);
      toast.error('❌ Kuyruk işleme hatası');
    } finally {
      setRunning(false); // Kilidi aç
    }
  };

  // 🔄 4) Kuyruğu Temizle (Q > 0 && !running iken)
  const clearQueue = async () => {
    if (!checkDebounce()) return;
    
    if (running) {
      console.log('🚫 Kuyruğu Temizle blocked: işlem devam ediyor');
      return;
    }
    
    console.log(`🔄 Kuyruğu Temizle clicked: Q=${Q}, P=${P}, T=${T}`);
    
    if (Q === 0) {
      toast.info('ℹ️ Kuyruk zaten boş');
      return;
    }
    
    // Depodan queued ve processing kayıtları temizle
    const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
    const filteredData = queueData.filter(item => 
      item.status !== 'queued' && item.status !== 'processing'
    )
    localStorage.setItem('offline_queue', JSON.stringify(filteredData))
    
    // RECALC çalıştır
    await recalc()
    
    toast.success(`🗑️ Kuyruk temizlendi`);
  };

  const updateQueueItems = async () => {
    if (offlineQueue) {
      const items = await offlineQueue.getQueue();
      setQueueItems(items);
      if (onUpdate) onUpdate();
    }
  };

  // Initialization - sayaçları senkronize et
  useEffect(() => {
    const initializeCounters = async () => {
      // RECALC çalıştır
      await recalc();
      
      if (offlineQueue) {
        const queue = await offlineQueue.getQueue();
        setQueueItems(queue);
        
        console.log(`🔄 Initialized: Q=${Q}, P=${P}, T=${T}, offline=${offline}`);
      }
    };
    
    initializeCounters();
  }, [offlineQueue]);

  // Cleanup - component unmount olduğunda watchdog'u temizle
  useEffect(() => {
    return () => {
      stopWatchdog();
    };
  }, []);


  // Test sıfırlama fonksiyonu
  const resetTest = () => {
    try {
      console.log('🔄 Test sıfırlanıyor...');
      
      // Sadece yerel state'i temizle, finalize etme
      localStorage.removeItem('offline_queue');
      
      // State'leri sıfırla
      setQ(0);
      setP(0);
      setT(0);
      setQueueItems([]);
      
      toast.info('ℹ️ Test sıfırlandı (finalize edilmedi)');
      
    } catch (error) {
      console.error('❌ Test sıfırlama hatası:', error);
      toast.error('❌ Test sıfırlanamadı');
    }
  };

  // Run finalize fonksiyonu
  const completeRun = async (runId, successCount, failCount) => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const testMode = urlParams.get('test') || 'desktop';
      
      let apiBaseUrl;
      if (testMode === 'mobile' || testMode === 'emulator') {
        apiBaseUrl = 'http://localhost:3001';
      } else {
        apiBaseUrl = 'http://localhost:3001';
      }
      
      const runData = {
        runId,
        status: failCount > 0 ? 'failed' : 'success',
        web: {
          pass: 0, // Web testi yapılmadı
          fail: 0,
          total: 0
        },
        mobile: {
          pass: successCount,
          fail: failCount,
          total: successCount + failCount
        },
        completedAt: new Date().toISOString(),
        duration: Date.now() // Basit süre hesaplama
      };
      
      console.log(`🏁 Run finalize ediliyor: ${runId} → ${apiBaseUrl}/api/runs/complete`);
      
      const response = await fetch(`${apiBaseUrl}/api/runs/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(runData)
      });
      
      if (response.ok) {
        console.log(`✅ Run finalize edildi: ${runId}`);
        return true;
      } else {
        console.log(`❌ Run finalize edilemedi: ${response.status}`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Run finalize hatası:', error);
      return false;
    }
  };

  // Event gönderme fonksiyonu
  const sendEvent = async (type, payload) => {
    try {
      // URL parametresinden test modunu kontrol et
      const urlParams = new URLSearchParams(window.location.search);
      const testMode = urlParams.get('test') || 'desktop';
      
      let apiBaseUrl;
      if (testMode === 'mobile' || testMode === 'emulator') {
        apiBaseUrl = 'http://localhost:3001';
      } else {
        apiBaseUrl = 'http://localhost:3001';
      }
      
      // RunId'yi URL'den al veya oluştur
      const runId = urlParams.get('runId') || `run-${Date.now()}`;
      const eventId = `${runId}-${type}-${Date.now()}`;
      
      // Önce run progress'e gönder
      try {
        await fetch(`${apiBaseUrl}/api/runs/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            runId,
            eventType: type,
            payload,
            timestamp: new Date().toISOString()
          })
        });
        console.log(`📊 Run progress güncellendi: ${type}`);
      } catch (progressError) {
        console.warn('⚠️ Run progress güncellenemedi:', progressError);
      }
      
      // Sonra events endpoint'ine gönder
      const event = {
        runId,
        eventId,
        type,
        payload,
        source: 'mobile'
      };
      
      console.log(`📤 Event gönderiliyor: ${type} → ${apiBaseUrl}/api/events`);
      
      const response = await fetch(`${apiBaseUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });
      
      if (response.ok) {
        console.log(`✅ Event gönderildi: ${type}`);
      } else {
        console.log(`❌ Event gönderilemedi: ${response.status}`);
      }
      
    } catch (error) {
      console.error('❌ Event gönderme hatası:', error);
    }
  };

  // Render logu - her render'da
  console.log(`🔄 Render: offline=${offline}, Q=${Q}, P=${P}, T=${T}, running=${running}`);

  return (
    <div className="barcode-scanner">
      {/* Test Tamamlandı Mesajı */}
      {(runState === 'completed' || runState === 'failed') && (
        <div className="test-completed-message">
          <div className="message-content">
            <FaCheckCircle className="message-icon" />
            <div className="message-text">
              <h3>Test Tamamlandı</h3>
              <p>Koşum bitti – yeni test başlatın</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="scanner-header">
        <h1 className="scanner-title">Dijital İkiz Tabanlı Test Sistemi</h1>
        <div className={`status-badge ${offline ? 'offline' : 'online'}`}>
          {offline ? '📱 Offline' : '🌐 Online'}
        </div>
      </div>

      {/* Q/P/T Sayaç Kutucukları - TEK KAYNAKLI STATE */}
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
        <div className="toggle-container">
          <span className="toggle-label">Offline Modu</span>
          <button 
            className={`toggle-btn ${offline ? 'active' : ''}`}
            onClick={() => setOffline(!offline)}
          >
            {offline ? <FaToggleOn /> : <FaToggleOff />}
          </button>
        </div>
      </div>

      {/* Action Buttons - BUTON ETKİNLİK KURALLARI */}
      <div className="action-section">
        {(() => {
          const buttonStates = getButtonStates();
          return (
            <>
              {/* Barkod Tara/Oku */}
              <button 
                className="action-btn primary"
                onClick={openBarcodeModal}
                disabled={buttonStates.scanButton.disabled}
                title={buttonStates.scanButton.tooltip}
              >
                <FaBarcode />
                Barkod Tara/Oku
              </button>

              {/* Kuyruğu İşle */}
              <button 
                className="action-btn secondary"
                onClick={processQueue}
                disabled={buttonStates.processButton.disabled}
                title={buttonStates.processButton.tooltip}
              >
                <FaSync className={running ? 'spinning' : ''} />
                {running ? 'İşleniyor...' : 'Kuyruğu İşle'} ({Q})
              </button>

              {/* Kuyruğu Temizle */}
              <button 
                className="action-btn danger"
                onClick={clearQueue}
                disabled={buttonStates.clearButton.disabled}
                title={buttonStates.clearButton.tooltip}
              >
                <FaTrash />
                Kuyruğu Temizle
              </button>


              {/* Testi Sıfırla */}
              <button 
                className="action-btn warning"
                onClick={resetTest}
                disabled={running}
                title="Testi sıfırla (finalize etmeden)"
              >
                <FaTrash />
                Testi Sıfırla
              </button>
            </>
          );
        })()}

      </div>

      {/* Test Barkodları - Modal açıkken gizle */}
      {!isSimModalOpen && (
        <div className="test-section">
          <h2 className="section-title">Test Barkodları</h2>
          <div className="test-grid">
            {testBarcodes.map((barcode, index) => (
              <div 
                key={index}
                className={`test-card ${barcode.valid ? 'valid' : 'invalid'}`}
                onClick={() => simulateScan(barcode)}
                onTouchStart={(e) => {
                  // iOS için touch feedback
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onTouchEnd={(e) => {
                  // Touch end'de normal haline dön
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
      )}

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

        {/* Uzun kuyruk uyarısı */}
        {Q >= 100 && (
          <div className="long-queue-warning">
            <FaInfoCircle />
            <span>Kuyruk büyük, arka planda gönderiliyor...</span>
          </div>
        )}
      </div>

      {/* Barkod Simülasyon Modalı */}
      {isSimModalOpen && (
        <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Barkod Simülasyonu</h4>
              <button 
                className="modal-close"
                onClick={() => setIsSimModalOpen(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              {/* Geçerli Barkod Üret */}
              <div className="simulation-option">
                <button 
                  className="sim-btn primary"
                  onClick={() => simulateScan({ code: 'ULD-AKE12345AB', valid: true })}
                >
                  Geçerli Barkod Üret
                </button>
                <p className="sim-desc">Rastgele geçerli format barkod üretir</p>
              </div>

              {/* Geçersiz Barkod Üret */}
              <div className="simulation-option">
                <button 
                  className="sim-btn secondary"
                  onClick={() => simulateScan({ code: 'INVALID-CODE', valid: false })}
                >
                  Geçersiz Barkod Üret
                </button>
                <p className="sim-desc">Negatif test için geçersiz barkod üretir</p>
              </div>

              {/* Hazır Barkodlardan Seç */}
              <div className="simulation-option">
                <h5>Hazır Barkodlardan Seç</h5>
                <div className="barcode-list">
                  {testBarcodes.map((barcode, index) => (
                    <div 
                      key={barcode.code}
                      className={`barcode-item ${barcode.valid ? 'valid' : 'invalid'}`}
                      onClick={() => simulateScan(barcode)}
                    >
                      <span className="barcode-code">{barcode.code}</span>
                      <span className="barcode-type">{barcode.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobil Testi Butonu */}
              <div className="simulation-option">
                <button 
                  className="sim-btn test"
                  onClick={() => {
                    setIsSimModalOpen(false);
                    runMobileTest();
                  }}
                >
                  <FaMobile />
                  Mobil Testi Başlat
                </button>
                <p className="sim-desc">Otomatik test senaryosunu çalıştırır</p>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default BarcodeScanner;
