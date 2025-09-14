import React, { useState, useEffect } from 'react'
import { useNotification } from '../../contexts/NotificationContext'
import { useOffline } from '../../contexts/OfflineContext'
import { Smartphone, Clock, CheckCircle, XCircle } from 'lucide-react'
import './MobileBarcode.css'

const MobileBarcode = () => {
  // 🎯 TEK DURUM MODELİ - 4 Ana State (Spesifikasyona göre)
  const [offline, setOffline] = useState(false)  // true/false
  const [Q, setQ] = useState(0)                  // kuyruk: int (status=queued adedi)
  const [P, setP] = useState(0)                  // işleniyor: int (status=processing adedi)
  const [T, setT] = useState(0)                  // toplam: int (status=done ve today(createdAt) adedi)

  // RunId tracking
  const [currentRunId, setCurrentRunId] = useState(null)
  
  // Worker durumu - idle | running | paused
  const [workerState, setWorkerState] = useState('idle')
  
  // Sayaç güncelleme fonksiyonu - depodan yeniden okuma
  const updateCountersFromStorage = async () => {
    try {
      // Kuyruk: status=queued adedi
      const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      const queuedCount = queueData.filter(item => item.status === 'queued').length
      setQ(queuedCount)
      
      // İşleniyor: status=processing adedi
      const processingCount = queueData.filter(item => item.status === 'processing').length
      setP(processingCount)
      
      // Toplam: status=done ve bugün tamamlanan
      const today = new Date().toDateString()
      const doneCount = queueData.filter(item => 
        item.status === 'done' && 
        new Date(item.completedAt).toDateString() === today
      ).length
      setT(doneCount)
      
      console.log(`📊 Sayaçlar güncellendi: Q=${queuedCount}, P=${processingCount}, T=${doneCount}`)
    } catch (error) {
      console.error('Sayaç güncelleme hatası:', error)
    }
  }

  // Yardımcı state (UI için)
  const [queueItems, setQueueItems] = useState([])
  const [showClearModal, setShowClearModal] = useState(false)
  const [eventLog, setEventLog] = useState([])

  const [expandedStep, setExpandedStep] = useState(null)
  
  // Simülasyon paneli state'leri
  const [showSimulationPanel, setShowSimulationPanel] = useState(false)
  const [simulationInput, setSimulationInput] = useState('')
  const [simulationError, setSimulationError] = useState('')
  const [lastScannedBarcodes, setLastScannedBarcodes] = useState([]) // Tekrarlı okuma koruması için
  
  // Durum makinesi state'leri
  const [testPhase, setTestPhase] = useState('IDLE') // IDLE, WEB_RUNNING, WEB_SUCCESS, WEB_FAILED, MOBILE_READY, MOBILE_RUNNING, MOBILE_SUCCESS, MOBILE_FAILED, FINISHED
  const [mobileStep, setMobileStep] = useState(0) // 0: Başlat, 1: Barkod Seç, 2: Offline Açık+Kuyruğa Ekle, 3: Offline Kapalı+Kuyruğu İşle, 4: Temizlik/Doğrulama
  const [mobileStepStatus, setMobileStepStatus] = useState('') // SUCCESS, FAILED, RUNNING
  const [mobileStepError, setMobileStepError] = useState('') // Hata detayı
  const [isMobileTestRunning, setIsMobileTestRunning] = useState(false) // Tek runner koruması
  const [selectedBarcode, setSelectedBarcode] = useState('') // Seçilen barkod
  const [initialOfflineState, setInitialOfflineState] = useState(false) // Başlangıçtaki offline durumu
  
  // Debounce koruma - çift tıklama önleme
  const [lastActionTime, setLastActionTime] = useState(0)
  const DEBOUNCE_DELAY = 300 // 300ms
  
  // Debounce check fonksiyonu
  const checkDebounce = () => {
    const now = Date.now()
    if (now - lastActionTime < DEBOUNCE_DELAY) {
      return false
    }
    setLastActionTime(now)
    return true
  }
  
  // Notification context
  const { showSuccess, showError, showInfo } = useNotification()

  // Event log fonksiyonu
  const addEventLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('tr-TR')
    setEventLog(prev => [...prev, { timestamp, message, type }])
  }

  // Detaylı loglama fonksiyonu
  const addDetailedLog = (phase, step, action, result, detail = '') => {
    const timestamp = new Date().toISOString()
    const logEntry = `${timestamp} | ${phase} | ${step} | ${action} | ${result} | ${detail}`
    console.log(logEntry)
    addEventLog(logEntry, result === 'SUCCESS' ? 'success' : result === 'FAILED' ? 'error' : 'info')
  }

  // Durum makinesi fonksiyonları
  const updateTestPhase = (newPhase) => {
    const oldPhase = testPhase
    setTestPhase(newPhase)
    addDetailedLog('STATE', 'PHASE', 'CHANGE', 'SUCCESS', `${oldPhase} → ${newPhase}`)
  }

  const updateMobileStep = (step, status, error = '') => {
    setMobileStep(step)
    setMobileStepStatus(status)
    setMobileStepError(error)
    addDetailedLog('MOBILE', `STEP_${step}`, status, status, error)
  }

  // Web testi tamamlandığında çağrılacak
  const onWebTestCompleted = (success) => {
    if (success) {
      updateTestPhase('MOBILE_READY')
      showSuccess('Web testi tamamlandı. Mobil testine geçebilirsiniz.')
    } else {
      updateTestPhase('WEB_FAILED')
      showError('Web testi başarısız. Mobil test başlatılamaz.')
    }
  }

  // Dashboard güncelleme fonksiyonu
  const updateDashboard = async (validCount = 0, invalidCount = 0) => {
    try {
      // WebSocket ile dashboard'a veri gönder
      const ws = new WebSocket('ws://localhost:3001')
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'mobile_test_results',
          valid: validCount,
          invalid: invalidCount,
          timestamp: new Date().toISOString()
        }))
        ws.close()
      }
    } catch (error) {
      console.error('Dashboard güncelleme hatası:', error)
    }
  }

  // Mobil testi başlat
  const handleMobileTestStart = async () => {
    if (isMobileTestRunning) {
      showError('Mobil test zaten çalışıyor.')
      return
    }

    if (testPhase !== 'MOBILE_READY') {
      showError('Mobil test başlatılamaz. Web testi önce tamamlanmalı.')
      return
    }

    setIsMobileTestRunning(true)
    updateTestPhase('MOBILE_RUNNING')
    updateMobileStep(0, 'RUNNING')

    try {
      // Adım 1: Başlat/Önkoşullar
      await executeMobileStep1()
    } catch (error) {
      handleMobileTestError(0, error.message)
    }
  }

  // Adım 1: Başlat/Önkoşullar
  const executeMobileStep1 = async () => {
    addDetailedLog('MOBILE', 'STEP_1', 'PRECHECKS', 'RUNNING', 'Başlat/Önkoşullar kontrolü')
    
    // Önkoşul 1: Kuyruk temiz mi?
    if (Q > 0) {
      const shouldClean = window.confirm(`Kuyrukta ${Q} kayıt var. Temizleyelim mi?`)
      if (shouldClean) {
        setQ(0)
        setQueueItems([])
        addDetailedLog('MOBILE', 'STEP_1', 'CLEAN_QUEUE', 'SUCCESS', `${Q} kayıt temizlendi`)
      } else {
        throw new Error('Kuyruk temizlenmedi')
      }
    }

    // Önkoşul 2: Offline durumunu not et
    setInitialOfflineState(offline)
    addDetailedLog('MOBILE', 'STEP_1', 'SAVE_OFFLINE_STATE', 'SUCCESS', `Offline: ${offline}`)

    updateMobileStep(1, 'SUCCESS')
    showInfo('Adım 1 tamamlandı. Barkod seçimi için hazır.')
    
    // Adım 2'ye geç
    setTimeout(() => executeMobileStep2(), 1000)
  }

  // Adım 2: Barkod Seç/Gir
  const executeMobileStep2 = async () => {
    addDetailedLog('MOBILE', 'STEP_2', 'BARKOD_SELECT', 'RUNNING', 'Barkod seçimi bekleniyor')
    updateMobileStep(2, 'RUNNING')
    
    // Simülasyon panelini aç
    setShowSimulationPanel(true)
    
    // Barkod seçimi için event listener ekle
    const handleBarcodeSelection = (barcode) => {
      setSelectedBarcode(barcode)
      updateMobileStep(2, 'SUCCESS', `Seçildi: ${barcode}`)
      showSuccess(`Seçildi: ${barcode}`)
      
      // Event listener'ı kaldır
      document.removeEventListener('barcodeSelected', handleBarcodeSelection)
      
      // Adım 3'e geç
      setTimeout(() => executeMobileStep3(), 1000)
    }
    
    document.addEventListener('barcodeSelected', handleBarcodeSelection)
  }

  // Adım 3: Offline = AÇIK iken Kuyruğa Ekle
  const executeMobileStep3 = async () => {
    addDetailedLog('MOBILE', 'STEP_3', 'OFFLINE_QUEUE', 'RUNNING', 'Offline moda geçiş ve kuyruğa ekleme')
    updateMobileStep(3, 'RUNNING')
    
    try {
      // Offline modu aç
      setOffline(true)
      addDetailedLog('MOBILE', 'STEP_3', 'SET_OFFLINE', 'SUCCESS', 'Offline modu açıldı')
      
      // Barkod simülasyonu - kuyruğa ekle
      const validation = validateBarcode(selectedBarcode)
      if (!validation.valid) {
        throw new Error(`Geçersiz barkod: ${validation.error}`)
      }

      // Kuyruğa ekle
      const newQ = Q + 1
      setQ(newQ)
      
      const newItem = {
        id: Date.now(),
        barcode: selectedBarcode,
        timestamp: new Date().toISOString(),
        status: 'pending'
      }
      setQueueItems(prev => [...prev, newItem])
      
      addDetailedLog('MOBILE', 'STEP_3', 'ADD_TO_QUEUE', 'SUCCESS', `Kuyruk: ${Q} → ${newQ}`)
      showSuccess('Offline: kuyruğa eklendi')
      
      updateMobileStep(3, 'SUCCESS')
      
      // Adım 4'e geç
      setTimeout(() => executeMobileStep4(), 1000)
    } catch (error) {
      throw new Error(`Adım 3 hatası: ${error.message}`)
    }
  }

  // Adım 4: Offline = KAPALI + "Kuyruğu İşle"
  const executeMobileStep4 = async () => {
    addDetailedLog('MOBILE', 'STEP_4', 'ONLINE_PROCESS', 'RUNNING', 'Online moda geçiş ve kuyruk işleme')
    updateMobileStep(4, 'RUNNING')
    
    try {
      // Offline modu kapat
      setOffline(false)
      addDetailedLog('MOBILE', 'STEP_4', 'SET_ONLINE', 'SUCCESS', 'Online modu açıldı')
      
      // Kuyruğu işle (geliştirilmiş fonksiyonu kullan)
      if (Q === 0) {
        throw new Error('Kuyruk boş - işlenecek kayıt yok')
      }
      
      addDetailedLog('MOBILE', 'STEP_4', 'START_PROCESSING', 'SUCCESS', `İşleniyor: ${Q}`)
      showInfo('Kuyruk işleniyor...')
      
      // Worker kilidini kontrol et
      if (isProcessingQueue) {
        throw new Error('Worker zaten çalışıyor')
      }
      
      // Kuyruğu işle (tek tek)
      const itemsToProcess = [...queueItems]
      let successCount = 0
      let failCount = 0
      
      for (const item of itemsToProcess) {
        try {
          const response = await fetch('http://localhost:3001/api/barcode-scanned', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              runId: currentRunId,
              code: item.barcode,
              mode: 'online'
            })
          })
          
          const result = await response.json()
          
          if (result.success) {
            successCount++
          } else {
            failCount++
          }
        } catch (error) {
          failCount++
        }
      }
      
      // Sonuçları işle
      const newT = T + successCount
      setT(newT)
      setP(0)
      setQ(0)
      setQueueItems([])
      
      addDetailedLog('MOBILE', 'STEP_4', 'PROCESS_COMPLETE', 'SUCCESS', `Başarılı: ${successCount}, Başarısız: ${failCount}`)
      showSuccess(`Kuyruk işlendi: ${successCount} başarılı, ${failCount} başarısız`)
      
      updateMobileStep(4, 'SUCCESS')
      
      // Adım 5'e geç
      setTimeout(() => executeMobileStep5(), 1000)
    } catch (error) {
      setP(0)
      throw new Error(`Adım 4 hatası: ${error.message}`)
    }
  }

  // Adım 5: Temizlik/Doğrulama
  const executeMobileStep5 = async () => {
    addDetailedLog('MOBILE', 'STEP_5', 'CLEANUP_VERIFY', 'RUNNING', 'Temizlik ve doğrulama')
    updateMobileStep(5, 'RUNNING')
    
    try {
      // Doğrulama: Kuyruk 0, İşleniyor 0, Toplam ≥ 1
      if (Q !== 0) {
        throw new Error(`Kuyruk sıfırlanmadı: ${Q}`)
      }
      if (P !== 0) {
        throw new Error(`İşleniyor sıfırlanmadı: ${P}`)
      }
      if (T < 1) {
        throw new Error(`Toplam artmadı: ${T}`)
      }
      
      addDetailedLog('MOBILE', 'STEP_5', 'VERIFY_COUNTERS', 'SUCCESS', `Kuyruk: ${Q}, İşleniyor: ${P}, Toplam: ${T}`)
      showSuccess('Kuyruk işlendi ve temizlendi')
      
      updateMobileStep(5, 'SUCCESS')
      updateTestPhase('MOBILE_SUCCESS')
      setIsMobileTestRunning(false)
      
      showSuccess('Mobil test başarıyla tamamlandı!')
    } catch (error) {
      throw new Error(`Adım 5 hatası: ${error.message}`)
    }
  }

  // Mobil test hatası
  const handleMobileTestError = (step, error) => {
    updateMobileStep(step, 'FAILED', error)
    updateTestPhase('MOBILE_FAILED')
    setIsMobileTestRunning(false)
    showError(`Mobil test hatası - Adım ${step}: ${error}`)
  }

  // Mobil testi bitir
  const handleMobileTestComplete = async () => {
    if (testPhase === 'MOBILE_SUCCESS') {
    try {
        // Backend'e gönder
      const response = await fetch('http://localhost:3001/api/mobile-test-completed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          runId: currentRunId
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
          updateTestPhase('FINISHED')
        showSuccess('Mobil test tamamlandı.')
          addDetailedLog('MOBILE', 'COMPLETE', 'FINISH', 'SUCCESS', 'Test tamamlandı')
      } else {
        throw new Error('Mobil test tamamlanamadı')
      }
    } catch (error) {
      console.error('Mobil test tamamlama hatası:', error)
      showError('Mobil test tamamlanamadı.')
        addDetailedLog('MOBILE', 'COMPLETE', 'FINISH', 'FAILED', error.message)
      }
    } else {
      // Hata durumunda testi sonlandır
      updateTestPhase('FINISHED')
      showError('Test sonlandırıldı (hata var)')
    }
  }


  // Barkod doğrulama fonksiyonu - Geliştirilmiş
  const validateBarcode = (barcode) => {
    const cleanBarcode = (barcode || '').trim().toUpperCase()
    
    // Boş veya çok kısa kontrolü
    if (!cleanBarcode || cleanBarcode.length < 5) {
      return { valid: false, error: 'Barkod çok kısa (minimum 5 karakter)' }
    }
    
    // Yasaklı karakter kontrolü
    if (!/^[A-Z0-9\-_]+$/.test(cleanBarcode)) {
      return { valid: false, error: 'Geçersiz karakterler içeriyor' }
    }
    
    // Format kontrolleri
    const uldRegex = /^ULD-[A-Z]{3}\d{5}[A-Z]{2}$/
    const awbRegex = /^\d{3}-\d{8}$/
    const testRegex = /^TEST-\d{5}$/
    const uldTestRegex = /^ULD-TEST\d+$/
    const eanRegex = /^\d{12,13}$/
    const code128Regex = /^[A-Z0-9]{8,20}$/
    
    const isValid = uldRegex.test(cleanBarcode) || awbRegex.test(cleanBarcode) || 
                   testRegex.test(cleanBarcode) || uldTestRegex.test(cleanBarcode) ||
                   eanRegex.test(cleanBarcode) || code128Regex.test(cleanBarcode)
    
    return { 
      valid: isValid, 
      error: isValid ? null : 'Geçersiz barkod formatı' 
    }
  }

  // Tekrarlı okuma koruması
  const checkDuplicateBarcode = (barcode) => {
    const now = Date.now()
    const DUPLICATE_WINDOW = 5000 // 5 saniye
    
    // Eski kayıtları temizle (5 saniyeden eski)
    const recentBarcodes = lastScannedBarcodes.filter(item => 
      now - item.timestamp < DUPLICATE_WINDOW
    )
    
    // Aynı barkod var mı kontrol et
    const isDuplicate = recentBarcodes.some(item => item.barcode === barcode)
    
    if (isDuplicate) {
      return { isDuplicate: true, message: 'Zaten okundu' }
    }
    
    // Yeni barkodu listeye ekle
    setLastScannedBarcodes(prev => [
      ...recentBarcodes,
      { barcode, timestamp: now }
    ])
    
    return { isDuplicate: false }
  }

  // Rastgele geçerli barkod üret
  const generateValidBarcode = () => {
    const types = [
      () => `ULD-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`,
      () => `${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}-${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
      () => `TEST-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
      () => `ULD-TEST${Math.floor(Math.random() * 10000)}`,
      () => Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0'),
      () => Math.random().toString(36).substring(2, 15).toUpperCase()
    ]
    
    const randomType = types[Math.floor(Math.random() * types.length)]
    return randomType()
  }

  // Rastgele geçersiz barkod üret
  const generateInvalidBarcode = () => {
    const invalidTypes = [
      'TOO-SHORT',
      'VERY-LONG-INVALID-BARCODE-FORMAT',
      'INVALID@CHAR',
      '123',
      'INVALID-FORMAT-123',
      'BAD-CHECKSUM-12345'
    ]
    
    return invalidTypes[Math.floor(Math.random() * invalidTypes.length)]
  }

  // Hazır barkod listesi - Genişletilmiş
  const getPredefinedBarcodes = () => [
    // Geçerli barkodlar
    { code: 'ULD-AKE12345AB', type: 'ULD', valid: true },
    { code: 'ULD-BCD67890CD', type: 'ULD', valid: true },
    { code: 'ULD-EFG90123EF', type: 'ULD', valid: true },
    { code: '123-45678901', type: 'AWB', valid: true },
    { code: '456-78901234', type: 'AWB', valid: true },
    { code: '789-01234567', type: 'AWB', valid: true },
    { code: 'TEST-12345', type: 'TEST', valid: true },
    { code: 'TEST-67890', type: 'TEST', valid: true },
    { code: 'ULD-TEST123', type: 'ULD-TEST', valid: true },
    { code: 'ULD-TEST456', type: 'ULD-TEST', valid: true },
    { code: '1234567890123', type: 'EAN', valid: true },
    { code: '9876543210987', type: 'EAN', valid: true },
    { code: 'ABC123DEF456', type: 'CODE128', valid: true },
    { code: 'XYZ789GHI012', type: 'CODE128', valid: true },
    
    // Geçersiz barkodlar (Negatif test için)
    { code: 'INVALID-123', type: 'ERR', valid: false },
    { code: 'BAD-FORMAT', type: 'ERR', valid: false },
    { code: 'TOO-SHORT', type: 'ERR', valid: false },
    { code: 'WRONG@CHAR', type: 'ERR', valid: false },
    { code: 'EMPTY', type: 'ERR', valid: false }
  ]

  // A) Toggle (Offline Modu) - SPESİFİKASYON
  const handleOfflineModeToggle = () => {
    if (!checkDebounce()) {
      return
    }

    const newOfflineMode = !offline

    // 1. State'i güncelle (sadece offline, sayaçlara dokunma)
    setOffline(newOfflineMode)

    // 2. UI güncelleme (buton aktifliklerini yenile)
    // 3. Toast göster - detaylı mesajlar
    if (newOfflineMode) {
      showSuccess('Offline moda geçildi – barkodlar kuyruğa eklenecek.')
    } else {
      showSuccess('Online moda geçildi – barkodlar direkt işlenecek.')
    }
  }

  // B) Barkod Tara / Oku - SPESİFİKASYON (Simülasyon)
  const handleBarcodeScan = async (barcode) => {
    if (!checkDebounce()) return

    console.log(`🔄 B) Barkod Tara: offline=${offline}, barcode=${barcode}`)

    // Tekrarlı okuma koruması
    const duplicateCheck = checkDuplicateBarcode(barcode)
    if (duplicateCheck.isDuplicate) {
      showError(duplicateCheck.message)
      addEventLog(`duplicate_barcode: ${barcode}`, 'warning')
      return
    }

    // Barkod doğrula (format)
    const validation = validateBarcode(barcode)
    
    if (!validation.valid) {
      showError(`Geçersiz barkod – işlem yapılmadı: ${validation.error}`)
      addEventLog(`validation_error: ${barcode} - ${validation.error}`, 'error')
      return
    }

    if (offline) {
      // offline=true (yeşil): Geçerliyse Q = Q + 1. (P ve T değişmez)
      // Kuyruğa ekle (depoya kaydet)
      const newItem = {
        id: Date.now(),
        barcode,
        timestamp: new Date().toISOString(),
        status: 'queued',
        createdAt: new Date().toISOString()
      }
      
      // Depoya kaydet
      const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      queueData.push(newItem)
      localStorage.setItem('offline_queue', JSON.stringify(queueData))
      
      // Sayaçları depodan güncelle
      await updateCountersFromStorage()
      
      // UI için güncelle
      setQueueItems(prev => [...prev, newItem])

      showSuccess('Offline: kuyruğa eklendi')
      addEventLog(`queued: ${barcode}`, 'success')
    } else {
      // offline=false (gri): ONLINE mod - anında işleme
      // İşleniyor sayacını güncelle
      setP(1)
      console.log(`🔄 Online: P=0 → 1 (işlem başladı)`)
      
      try {
        // 5) Mobil Barkod - ONLINE - Backend'e gönder
        const response = await fetch('http://localhost:3001/api/barcode-scanned', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            runId: currentRunId,
            code: barcode,
            mode: 'online'
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          // Başarılı → T = T + 1, P = 0
          const newItem = {
            id: Date.now(),
            barcode,
            timestamp: new Date().toISOString(),
            status: 'done',
            completedAt: new Date().toISOString()
          }
          
          // Depoya kaydet
          const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
          queueData.push(newItem)
          localStorage.setItem('offline_queue', JSON.stringify(queueData))
          
          // Sayaçları depodan güncelle
          await updateCountersFromStorage()
          
          showSuccess(`Gönderildi: ${barcode}`)
          addEventLog(`barcode_success: ${barcode}`, 'success')
          updateDashboard(1, 0)
        } else {
          // Hatalı → T değişmez, P = 0
          setP(0)
          showError('Geçersiz barkod – işlenmedi')
          addEventLog(`barcode_fail: ${barcode}`, 'error')
          updateDashboard(0, 1)
        }
      } catch (error) {
        setP(0)
        
        // Sebep bazlı hata mesajları
        if (error.message.includes('Geçersiz barkod')) {
          showError('Geçersiz barkod – işlenmedi')
        } else if (error.message.includes('Zaten okundu')) {
          showError('Zaten okundu')
        } else if (error.message.includes('Offline açıkken')) {
          showError('Offline açıkken işleme yapılamaz')
        } else {
          showError(`Sunucuya ulaşılamadı – tekrar denenecek (2/3)`)
        }
        
        addEventLog(`barcode_error: ${barcode}`, 'error')
      }
    }
  }

  // Simülasyon paneli fonksiyonları
  const openSimulationPanel = () => {
    if (!checkDebounce()) return
    setShowSimulationPanel(true)
    setSimulationInput('')
    setSimulationError('')
  }

  const closeSimulationPanel = () => {
    setShowSimulationPanel(false)
    setSimulationInput('')
    setSimulationError('')
  }

  const handleGenerateValid = () => {
    const barcode = generateValidBarcode()
    showInfo(`Üretildi: ${barcode}`)
    addEventLog(`generated_valid: ${barcode}`, 'info')
    
    // Mobil test akışında mı kontrol et
    if (isMobileTestRunning && mobileStep === 2) {
      // Event tetikle
      document.dispatchEvent(new CustomEvent('barcodeSelected', { detail: barcode }))
    } else {
      // Normal akış
      handleBarcodeScan(barcode)
    }
    closeSimulationPanel()
  }

  const handleGenerateInvalid = () => {
    const barcode = generateInvalidBarcode()
    showInfo(`Üretildi: ${barcode}`)
    addEventLog(`generated_invalid: ${barcode}`, 'info')
    
    // Mobil test akışında mı kontrol et
    if (isMobileTestRunning && mobileStep === 2) {
      // Event tetikle
      document.dispatchEvent(new CustomEvent('barcodeSelected', { detail: barcode }))
    } else {
      // Normal akış
      handleBarcodeScan(barcode)
    }
    closeSimulationPanel()
  }

  const handleSelectPredefined = (barcode) => {
    addEventLog(`selected_predefined: ${barcode}`, 'info')
    
    // Mobil test akışında mı kontrol et
    if (isMobileTestRunning && mobileStep === 2) {
      // Event tetikle
      document.dispatchEvent(new CustomEvent('barcodeSelected', { detail: barcode }))
    } else {
      // Normal akış
      handleBarcodeScan(barcode)
    }
    closeSimulationPanel()
  }

  const handleManualSubmit = () => {
    const barcode = simulationInput.trim().toUpperCase()
    if (!barcode) {
      setSimulationError('Barkod giriniz')
      return
    }
    
    addEventLog(`manual_input: ${barcode}`, 'info')
    
    // Mobil test akışında mı kontrol et
    if (isMobileTestRunning && mobileStep === 2) {
      // Event tetikle
      document.dispatchEvent(new CustomEvent('barcodeSelected', { detail: barcode }))
    } else {
      // Normal akış
      handleBarcodeScan(barcode)
    }
    closeSimulationPanel()
  }

  // C) Kuyruğu İşle - GELİŞTİRİLMİŞ (Tek worker kilidi, atomik durum geçişi, retry politikası)
  const [queueRetryCount, setQueueRetryCount] = useState(0) // Retry sayacı
  const [queueRetrySchedule, setQueueRetrySchedule] = useState(null) // Retry zamanlayıcısı
  const [failedItems, setFailedItems] = useState([]) // Başarısız öğeler
  
  // Watchdog ve lease sistemi
  const [processingItems, setProcessingItems] = useState(new Map()) // leaseId -> {item, startedAt, timeoutId}
  const [watchdogTimers, setWatchdogTimers] = useState(new Map()) // leaseId -> timeoutId
  
  // Watchdog timer - 20 saniye maksimum süre
  const WATCHDOG_TIMEOUT = 20000 // 20 saniye
  
  // Atomic lease sistemi - öğeyi queued'dan processing'e al
  const acquireLease = (item) => {
    const leaseId = `lease_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startedAt = Date.now()
    
    // Watchdog timer başlat
    const timeoutId = setTimeout(() => {
      handleWatchdogTimeout(leaseId)
    }, WATCHDOG_TIMEOUT)
    
    // Lease'i kaydet
    setProcessingItems(prev => {
      const newMap = new Map(prev)
      newMap.set(leaseId, { item, startedAt, timeoutId })
      return newMap
    })
    
    setWatchdogTimers(prev => {
      const newMap = new Map(prev)
      newMap.set(leaseId, timeoutId)
      return newMap
    })
    
    addDetailedLog('QUEUE', 'acquireLease', 'SUCCESS', 'SUCCESS', `id=${item.id}, leaseId=${leaseId}`)
    return leaseId
  }
  
  // Lease'i serbest bırak
  const releaseLease = (leaseId) => {
    // Timer'ı temizle
    const timeoutId = watchdogTimers.get(leaseId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      setWatchdogTimers(prev => {
        const newMap = new Map(prev)
        newMap.delete(leaseId)
        return newMap
      })
    }
    
    // Lease'i kaldır
    setProcessingItems(prev => {
      const newMap = new Map(prev)
      newMap.delete(leaseId)
      return newMap
    })
    
    addDetailedLog('QUEUE', 'releaseLease', 'SUCCESS', 'SUCCESS', `leaseId=${leaseId}`)
  }
  
  // Watchdog timeout handler
  const handleWatchdogTimeout = (leaseId) => {
    const processingItem = processingItems.get(leaseId)
    if (!processingItem) return
    
    const { item, startedAt } = processingItem
    const age = Date.now() - startedAt
    
    addDetailedLog('QUEUE', 'watchdogTimeout', 'FAILED', 'FAILED', `id=${item.id}, leaseId=${leaseId}, age=${age}ms`)
    
    // Öğeyi tekrar queued yap
    setQueueItems(prev => [...prev, { ...item, status: 'queued' }])
    setQ(prev => prev + 1)
    
    // Lease'i serbest bırak
    releaseLease(leaseId)
    
    showError(`Barkod işleme zaman aşımı: ${item.barcode} (${Math.round(age/1000)}s)`)
  }
  
  // Uzlaşma sistemi - uygulama açılışında takılı processing öğeleri temizle
  const reconcileProcessingItems = async () => {
    const now = Date.now()
    const WATCHDOG_TIMEOUT = 20000 // 20 saniye
    
    // Depodan processing kayıtları al
    const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
    const stuckItems = []
    
    queueData.forEach(item => {
      if (item.status === 'processing' && item.startedAt) {
        const age = now - new Date(item.startedAt).getTime()
        
        if (age > WATCHDOG_TIMEOUT) {
          stuckItems.push(item)
        }
      }
    })
    
    if (stuckItems.length > 0) {
      addDetailedLog('QUEUE', 'reconcile', 'SUCCESS', 'SUCCESS', `stuckItems=${stuckItems.length}`)
      
      // Takılı processing kayıtları queued'a döndür
      const updatedQueueData = queueData.map(item => {
        if (item.status === 'processing' && item.startedAt) {
          const age = now - new Date(item.startedAt).getTime()
          if (age > WATCHDOG_TIMEOUT) {
            return {
              ...item,
              status: 'queued',
              retryCount: (item.retryCount || 0) + 1
            }
          }
        }
        return item
      })
      
      localStorage.setItem('offline_queue', JSON.stringify(updatedQueueData))
      
      // Sayaçları depodan güncelle
      await updateCountersFromStorage()
      
      showInfo(`${stuckItems.length} takılı öğe kuyruğa geri alındı`)
    }
  }

  // Retry politikası - Exponential backoff (5s → 10s → 15s)
  const scheduleRetry = (items, attempt) => {
    const backoffDelays = [5000, 10000, 15000] // 5s, 10s, 15s
    const delay = backoffDelays[attempt - 1] || 15000
    
    addDetailedLog('QUEUE', 'retryScheduled', 'RUNNING', 'SUCCESS', `attempt=${attempt}/3, backoff=${delay}ms`)
    
    const timeoutId = setTimeout(() => {
      setQueueRetryCount(attempt)
      retryFailedItems(items, attempt)
    }, delay)
    
    setQueueRetrySchedule(timeoutId)
    
    // Sebep bazlı retry mesajları
    if (attempt === 1) {
      showInfo(`Sunucuya ulaşılamadı – tekrar denenecek (1/3) - ${delay/1000}s sonra`)
    } else if (attempt === 2) {
      showInfo(`Sunucuya ulaşılamadı – tekrar denenecek (2/3) - ${delay/1000}s sonra`)
    } else {
      showInfo(`Sunucu hatası 5xx – tekrar denenecek (3/3) - ${delay/1000}s sonra`)
    }
  }

  // Başarısız öğeleri tekrar dene
  const retryFailedItems = async (items, attempt) => {
    if (attempt > 3) {
      addDetailedLog('QUEUE', 'retryExhausted', 'FAILED', 'FAILED', 'Maksimum deneme sayısı aşıldı')
      showError('3 deneme başarısız - kayıtlar işlenemedi')
      setWorkerState('idle')
      return
    }

    addDetailedLog('QUEUE', 'retryStart', 'RUNNING', 'SUCCESS', `attempt=${attempt}, items=${items.length}`)
    
    let successCount = 0
    let stillFailedItems = []
    
    for (const item of items) {
      try {
        const response = await fetch('http://localhost:3001/api/barcode-scanned', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            runId: currentRunId,
            code: item.barcode,
            mode: 'online'
          })
        })
        
        const result = await response.json()
        
        if (result.success) {
          successCount++
          addDetailedLog('QUEUE', 'retrySuccess', 'SUCCESS', 'SUCCESS', `id=${item.id}, attempt=${attempt}`)
        } else {
          stillFailedItems.push(item)
          addDetailedLog('QUEUE', 'retryFail', 'FAILED', 'FAILED', `id=${item.id}, attempt=${attempt}`)
        }
      } catch (error) {
        stillFailedItems.push(item)
        addDetailedLog('QUEUE', 'retryError', 'FAILED', 'FAILED', `id=${item.id}, attempt=${attempt}, error=${error.message}`)
      }
    }
    
    if (successCount > 0) {
      const newT = T + successCount
      setT(newT)
      showSuccess(`Retry başarılı: ${successCount} kayıt işlendi`)
    }
    
    if (stillFailedItems.length > 0) {
      scheduleRetry(stillFailedItems, attempt + 1)
    } else {
      setWorkerState('idle')
      setP(0)
      addDetailedLog('QUEUE', 'retryComplete', 'SUCCESS', 'SUCCESS', 'Tüm retry işlemleri tamamlandı')
    }
  }

  const handleProcessQueue = async () => {
    // Debounce koruması
    if (!checkDebounce()) return

    addDetailedLog('QUEUE', 'startProcess', 'RUNNING', 'SUCCESS', `offline=${offline}, queueCount=${Q}`)

    // Koruma 1: Offline açıkken işleme yapılamaz
    if (offline) {
      addDetailedLog('QUEUE', 'startProcess', 'FAILED', 'FAILED', 'Offline açıkken işleme yapılamaz')
      showError('Offline açıkken işleme yapılamaz.')
      return
    }
    
    // Koruma 2: Kuyruk boş
    if (Q === 0) {
      addDetailedLog('QUEUE', 'startProcess', 'FAILED', 'FAILED', 'İşlenecek kayıt yok')
      showInfo('İşlenecek kayıt yok.')
      return
    }
    
    // Koruma 3: Worker idle olmalı
    if (workerState !== 'idle') {
      addDetailedLog('QUEUE', 'startProcess', 'FAILED', 'FAILED', 'Worker zaten çalışıyor')
      showError('İşlem zaten devam ediyor.')
      return
    }

    // Worker durumunu güncelle
    setWorkerState('running')
    addDetailedLog('QUEUE', 'startProcess', 'RUNNING', 'SUCCESS', 'Worker başlatıldı')

    try {
      // Atomik durum geçişi: queued → processing
      const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
      const itemsToProcess = queueData.filter(item => item.status === 'queued')
      const totalItems = itemsToProcess.length
      
      addDetailedLog('QUEUE', 'takeItem', 'RUNNING', 'SUCCESS', `id=batch, from=queued -> processing, count=${totalItems}`)
      
      // Atomik durum geçişi: queued → processing
      const updatedQueueData = queueData.map(item => {
        if (item.status === 'queued') {
          return {
            ...item,
            status: 'processing',
            leaseId: `lease_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            startedAt: new Date().toISOString()
          }
        }
        return item
      })
      
      // Depoya kaydet
      localStorage.setItem('offline_queue', JSON.stringify(updatedQueueData))
      
      // Sayaçları depodan güncelle
      await updateCountersFromStorage()
      
      // Her öğeyi tek tek işle (FIFO)
      let successCount = 0
      let failCount = 0
      const failedItems = []

      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i]
        
        // startTime'ı try bloğu dışında tanımla
        const startTime = Date.now()
        
        try {
          addDetailedLog('QUEUE', 'request', 'RUNNING', 'SUCCESS', `id=${item.id}, ms=0`)
          
          // Backend'e gönder
          const response = await fetch('http://localhost:3001/api/barcode-scanned', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              runId: currentRunId,
              code: item.barcode,
              mode: 'online'
            })
          })
          
          const result = await response.json()
          const duration = Date.now() - startTime
          
          if (result.success) {
            // Başarılı → done
            successCount++
            const updatedQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
            const finalQueueData = updatedQueueData.map(queueItem => {
              if (queueItem.id === item.id) {
                return {
                  ...queueItem,
                  status: 'done',
                  completedAt: new Date().toISOString()
                }
              }
              return queueItem
            })
            localStorage.setItem('offline_queue', JSON.stringify(finalQueueData))
            
            addDetailedLog('QUEUE', 'response', 'SUCCESS', 'SUCCESS', `id=${item.id}, status=200, ms=${duration}`)
          } else {
            // Hata türüne göre ayrıştır
            if (response.status >= 500) {
              // 5xx - Sunucu hatası, retry edilebilir → queued
              const updatedQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
              const finalQueueData = updatedQueueData.map(queueItem => {
                if (queueItem.id === item.id) {
                  return {
                    ...queueItem,
                    status: 'queued',
                    retryCount: (queueItem.retryCount || 0) + 1
                  }
                }
                return queueItem
              })
              localStorage.setItem('offline_queue', JSON.stringify(finalQueueData))
              
              failedItems.push({ ...item, status: 'retry', error: result.error, retryCount: 0 })
              addDetailedLog('QUEUE', 'response', 'FAILED', 'FAILED', `id=${item.id}, status=5xx, ms=${duration}`)
            } else if (response.status >= 400) {
              // 4xx - Geçersiz kayıt, retry edilmez → failed
              failCount++
              const updatedQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
              const finalQueueData = updatedQueueData.map(queueItem => {
                if (queueItem.id === item.id) {
                  return {
                    ...queueItem,
                    status: 'failed',
                    error: result.error
                  }
                }
                return queueItem
              })
              localStorage.setItem('offline_queue', JSON.stringify(finalQueueData))
              
              addDetailedLog('QUEUE', 'response', 'FAILED', 'FAILED', `id=${item.id}, status=4xx, ms=${duration}`)
            } else {
              // Diğer hatalar → failed
              failCount++
              const updatedQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
              const finalQueueData = updatedQueueData.map(queueItem => {
                if (queueItem.id === item.id) {
                  return {
                    ...queueItem,
                    status: 'failed',
                    error: result.error
                  }
                }
                return queueItem
              })
              localStorage.setItem('offline_queue', JSON.stringify(finalQueueData))
              
              addDetailedLog('QUEUE', 'response', 'FAILED', 'FAILED', `id=${item.id}, status=other, ms=${duration}`)
            }
          }
        } catch (error) {
          const duration = Date.now() - startTime
          // Ağ hatası - retry edilebilir → queued
          const updatedQueueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
          const finalQueueData = updatedQueueData.map(queueItem => {
            if (queueItem.id === item.id) {
              return {
                ...queueItem,
                status: 'queued',
                retryCount: (queueItem.retryCount || 0) + 1
              }
            }
            return queueItem
          })
          localStorage.setItem('offline_queue', JSON.stringify(finalQueueData))
          
          failedItems.push({ ...item, status: 'retry', error: error.message, retryCount: 0 })
          addDetailedLog('QUEUE', 'response', 'FAILED', 'FAILED', `id=${item.id}, status=network, ms=${duration}`)
        }
      }

      // Sayaçları depodan güncelle
      await updateCountersFromStorage()
      
      // Başarılı sonuçları işle
      if (successCount > 0) {
        showSuccess(`Kuyruk işlendi: ${successCount} başarılı, ${failCount} başarısız`)
        updateDashboard(successCount, failCount)
      }

      // Retry edilebilir öğeler varsa retry başlat
      if (failedItems.length > 0) {
        addDetailedLog('QUEUE', 'retryStart', 'RUNNING', 'SUCCESS', `retryable=${failedItems.length}, failed=${failCount}`)
        scheduleRetry(failedItems, 1)
        return // Worker durumu retry tamamlanana kadar running kalacak
      }

      // Tüm işlemler tamamlandı
      setWorkerState('idle') // Worker durumunu idle yap
      addDetailedLog('QUEUE', 'done', 'SUCCESS', 'SUCCESS', `İşlem tamamlandı`)
      
      if (successCount === 0 && failCount > 0) {
        showError('Tüm kayıtlar başarısız oldu')
      }
      
    } catch (error) {
      addDetailedLog('QUEUE', 'processError', 'FAILED', 'FAILED', error.message)
      
      // Sebep bazlı hata mesajları
      if (error.message.includes('Worker zaten çalışıyor')) {
        showError('İşlem zaten devam ediyor - bekleyin')
      } else if (error.message.includes('Offline açıkken')) {
        showError('Offline açıkken işleme yapılamaz')
      } else if (error.message.includes('İşlenecek kayıt yok')) {
        showInfo('İşlenecek kayıt yok')
      } else {
        showError(`Sistem hatası: ${error.message}`)
      }
      
      // Hata durumunda sayaçları sıfırla
      setP(0)
      setQ(queueItems.length) // Kuyruğu geri yükle
    } finally {
      // Worker durumunu idle yap
      setWorkerState('idle')
      addDetailedLog('QUEUE', 'workerComplete', 'SUCCESS', 'SUCCESS', 'Worker tamamlandı')
    }
  }

  // D) Kuyruğu Temizle - SPESİFİKASYON
  const handleClearQueue = () => {
    console.log(`🔄 D) Kuyruğu Temizle: Q=${Q}, P=${P}`)

    if (Q === 0) {
      showInfo('ℹ️ Kuyruk zaten boş')
      return
    }
    
    // Onay modalı göster
    setShowClearModal(true)
  }

  const confirmClearQueue = async () => {
    console.log(`🔄 D) Onaylandı: Q=${Q}, P=${P}`)

    // Kuyruk=0, İşleniyor=0, Toplam değişmez (spesifikasyona göre)
    // Depodan queued ve processing kayıtları temizle
    const queueData = JSON.parse(localStorage.getItem('offline_queue') || '[]')
    const filteredData = queueData.filter(item => 
      item.status !== 'queued' && item.status !== 'processing'
    )
    localStorage.setItem('offline_queue', JSON.stringify(filteredData))
    
    // Sayaçları depodan güncelle
    await updateCountersFromStorage()
    
    // UI için güncelle
    setQueueItems([])
    
    showSuccess('Kuyruk başarıyla temizlendi.')

    setShowClearModal(false)
  }

  // Appium bağlantı kontrolü kaldırıldı - artık kontrol edilmiyor

  // RunId'yi URL'den veya localStorage'dan al
  useEffect(() => {
    // URL'den runId al (query parameter)
    const urlParams = new URLSearchParams(window.location.search)
    const runIdFromUrl = urlParams.get('runId')
    
    if (runIdFromUrl) {
      setCurrentRunId(runIdFromUrl)
      addEventLog(`RunId alındı: ${runIdFromUrl}`, 'info')
    } else {
      // localStorage'dan al
      const savedRunId = localStorage.getItem('currentRunId')
      if (savedRunId) {
        setCurrentRunId(savedRunId)
        addEventLog(`RunId localStorage'dan alındı: ${savedRunId}`, 'info')
      }
    }
    
    // Uzlaşma sistemi - takılı processing öğeleri temizle
    reconcileProcessingItems()
    
    // Sayaçları depodan güncelle
    updateCountersFromStorage()
  }, [])

  // Bağlantı durumu kontrolü kaldırıldı
  useEffect(() => {
    addEventLog('Mobil test ekranı açıldı', 'info')
    
    // Web testi tamamlandığında dinle
    const handleWebTestCompleted = (event) => {
      onWebTestCompleted(event.detail.success)
    }
    
    document.addEventListener('webTestCompleted', handleWebTestCompleted)
    
    return () => {
      document.removeEventListener('webTestCompleted', handleWebTestCompleted)
      
      // Retry zamanlayıcısını temizle
      if (queueRetrySchedule) {
        clearTimeout(queueRetrySchedule)
        setQueueRetrySchedule(null)
      }
    }
  }, [queueRetrySchedule])

  return (
    <div className="mobile-page">
      {/* Professional Form Header */}
      <div className="form-header">
        <h1 className="form-title" data-testid="mobile-barcode-title">Barkod Simülasyonu</h1>
        <p className="form-subtitle">Test barkodları üretin ve sonuçları görün</p>
        </div>

      {/* Toggle Container - Basit */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          margin: '20px 20px 24px 20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}>
          <span style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#374151'
          }}>Offline Modu</span>
          
          <div 
              onClick={handleOfflineModeToggle}
            style={{
              position: 'relative',
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              backgroundColor: offline ? '#28a745' : '#cccccc',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease'
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: offline ? '26px' : '2px',
              width: '24px',
              height: '24px',
              background: 'white',
              borderRadius: '50%',
              transition: 'left 0.3s ease',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)'
            }}></div>
          </div>
        </div>
      
      {/* Kontrol Paneli - 3 Kutucuk */}
      <div className="mobile-control-stats">
        <div className="mobile-stat-box">
          <div className="mobile-stat-number">{Q}</div>
          <div className="mobile-stat-title">Kuyruk</div>
        </div>
        <div className="mobile-stat-box">
          <div className="mobile-stat-number">{P}</div>
          <div className="mobile-stat-title">İşleniyor</div>
        </div>
        <div className="mobile-stat-box">
          <div className="mobile-stat-number">{T}</div>
          <div className="mobile-stat-title">Toplam</div>
        </div>
      </div>

      {/* Aksiyon Butonları - Etkinlik Matrisi Uygulandı */}
      <div className="mobile-action-section">
        {/* Barkod Tara: Simülasyon paneli açar */}
        <button
          className="mobile-action-btn mobile-action-primary"
          onClick={openSimulationPanel}
          title="Barkod simülasyonu panelini açar"
        >
          Barkod Tara / Oku
        </button>
        
        {/* Kuyruğu İşle: Online + Q>0 + worker=idle iken aktif */}
        <button
          className={`mobile-action-btn mobile-action-secondary ${
            offline || Q === 0 || workerState !== 'idle' ? 'disabled' : ''
          }`}
          onClick={handleProcessQueue}
          disabled={offline || Q === 0 || workerState !== 'idle'}
          title={
            offline
              ? 'Offline açıkken işleme yapılamaz' 
              : Q === 0
                ? 'İşlenecek kayıt yok'
                : workerState !== 'idle'
                  ? 'İşlem devam ediyor'
                  : 'Kuyruktaki barkodları işle'
          }
        >
          {workerState !== 'idle' ? 'İşleniyor…' : 'Kuyruğu İşle'}
        </button>
        
        {/* Kuyruğu Temizle: Q>0 ve worker=idle iken aktif */}
        <button
          className={`mobile-action-btn mobile-action-danger ${
            Q === 0 || workerState !== 'idle' ? 'disabled' : ''
          }`}
          onClick={handleClearQueue}
          disabled={Q === 0 || workerState !== 'idle'}
          title={
            Q === 0
                ? 'Kuyruk boş - temizlenecek barkod yok'
                : workerState !== 'idle'
                  ? 'İşlem devam ediyor - bekleyin'
                  : `${Q} barkod var - kuyruğu temizle`
          }
        >
          Kuyruğu Temizle
        </button>
      </div>
          
      {/* Test Barkodları Listesi kaldırıldı - tek kaynak modal */}

      {/* Manuel Giriş kaldırıldı - tek kaynak modal */}


      {/* Senaryo Adımları */}
      <div className="mobile-scenario-section">
        <h3>Senaryo Adımları</h3>
        <div className="mobile-scenario-accordion">
          
                <div className="mobile-accordion-item">
                  <button 
                    className="mobile-accordion-header"
                    onClick={() => setExpandedStep(expandedStep === 1 ? null : 1)}
                    aria-expanded={expandedStep === 1}
              aria-controls="step-1-content"
                  >
                    <div className="mobile-step-badge">1</div>
              <div className="mobile-step-title">Offline modu aktif edin</div>
                    <div className="mobile-accordion-chevron">
                      {expandedStep === 1 ? '▲' : '▼'}
            </div>
                  </button>
                  {expandedStep === 1 && (
              <div id="step-1-content" className="mobile-accordion-content">
                <p>Toggle ile offline modu açın. Bu modda barkodlar kuyruğa eklenir.</p>
        </div>
                  )}
      </div>

                <div className="mobile-accordion-item">
                  <button 
                    className="mobile-accordion-header"
                    onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)}
                    aria-expanded={expandedStep === 2}
              aria-controls="step-2-content"
                  >
                    <div className="mobile-step-badge">2</div>
              <div className="mobile-step-title">Bir barkod seçin veya girin</div>
                    <div className="mobile-accordion-chevron">
                      {expandedStep === 2 ? '▲' : '▼'}
              </div>
                  </button>
                  {expandedStep === 2 && (
              <div id="step-2-content" className="mobile-accordion-content">
                <p>Test barkodlarından birini tıklayın veya manuel giriş yapın.</p>
                </div>
              )}
            </div>

                <div className="mobile-accordion-item">
                  <button 
                    className="mobile-accordion-header"
                    onClick={() => setExpandedStep(expandedStep === 3 ? null : 3)}
                    aria-expanded={expandedStep === 3}
              aria-controls="step-3-content"
                  >
                    <div className="mobile-step-badge">3</div>
              <div className="mobile-step-title">Barkod kuyruğa eklenir</div>
                    <div className="mobile-accordion-chevron">
                      {expandedStep === 3 ? '▲' : '▼'}
        </div>
                  </button>
                  {expandedStep === 3 && (
              <div id="step-3-content" className="mobile-accordion-content">
                <p>Kuyruk sayacı artar ve barkod beklemeye alınır.</p>
                    </div>
                  )}
      </div>

                <div className="mobile-accordion-item">
        <button
                    className="mobile-accordion-header"
                    onClick={() => setExpandedStep(expandedStep === 4 ? null : 4)}
                    aria-expanded={expandedStep === 4}
              aria-controls="step-4-content"
                  >
                    <div className="mobile-step-badge">4</div>
              <div className="mobile-step-title">"Kuyruğu İşle" butonuna tıklayın</div>
                    <div className="mobile-accordion-chevron">
                      {expandedStep === 4 ? '▲' : '▼'}
                    </div>
        </button>
                  {expandedStep === 4 && (
              <div id="step-4-content" className="mobile-accordion-content">
                <p>Önce online moda geçin. Kuyruktaki barkodları işleyin. İşleniyor sayacı geçici olarak artar.</p>
                    </div>
                  )}
                </div>

                <div className="mobile-accordion-item">
                  <button 
                    className="mobile-accordion-header"
                    onClick={() => setExpandedStep(expandedStep === 5 ? null : 5)}
                    aria-expanded={expandedStep === 5}
              aria-controls="step-5-content"
                  >
                    <div className="mobile-step-badge">5</div>
              <div className="mobile-step-title">Kuyruk işlenir ve temizlenir</div>
                    <div className="mobile-accordion-chevron">
                      {expandedStep === 5 ? '▲' : '▼'}
                    </div>
                  </button>
                  {expandedStep === 5 && (
              <div id="step-5-content" className="mobile-accordion-content">
                <p>Toplam sayacı güncellenir ve kuyruk temizlenir.</p>
                    </div>
                  )}
            </div>

          </div>
      </div>

      {/* Mobil Test Butonları */}
      <div className="mobile-complete-section">
        {/* Mobil Test Başlat Butonu */}
        {testPhase === 'MOBILE_READY' && (
        <button
            className="mobile-complete-btn mobile-start-btn"
            onClick={handleMobileTestStart}
            disabled={isMobileTestRunning}
          >
            {isMobileTestRunning ? 'Mobil Test Çalışıyor...' : 'Mobil Testini Başlat'}
          </button>
        )}

        {/* Mobil Test Durumu */}
        {isMobileTestRunning && (
          <div className="mobile-test-status">
            <h4>Mobil Test Durumu</h4>
            <div className="test-phase">Faz: {testPhase}</div>
            <div className="test-step">Adım: {mobileStep}</div>
            <div className="test-status">Durum: {mobileStepStatus}</div>
            {mobileStepError && (
              <div className="test-error">Hata: {mobileStepError}</div>
            )}
          </div>
        )}

        {/* Mobil Test Bitir Butonu */}
        {(testPhase === 'MOBILE_SUCCESS' || testPhase === 'MOBILE_FAILED') && (
          <button
            className={`mobile-complete-btn ${
              testPhase === 'MOBILE_SUCCESS' ? 'mobile-success-btn' : 'mobile-error-btn'
            }`}
          onClick={handleMobileTestComplete}
        >
            {testPhase === 'MOBILE_SUCCESS' 
              ? 'Mobil Testini Bitir' 
              : 'Testi Sonlandır (Hata var)'
            }
        </button>
        )}

        {/* Test Sıfırla Butonu */}
        {testPhase === 'FINISHED' && (
          <button
            className="mobile-complete-btn mobile-reset-btn"
            onClick={() => {
              setTestPhase('IDLE')
              setMobileStep(0)
              setMobileStepStatus('')
              setMobileStepError('')
              setIsMobileTestRunning(false)
              setSelectedBarcode('')
              setInitialOfflineState(false)
              showInfo('Test sıfırlandı')
            }}
          >
            Testi Sıfırla
          </button>
        )}
      </div>

      {/* Kuyruğu Temizle Modal - Mobil Optimize */}
      {showClearModal && (
        <div className="mobile-modal-overlay" onClick={() => setShowClearModal(false)}>
          <div className="mobile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-modal-header">
              <h3 className="mobile-modal-title">Kuyruğu Temizle</h3>
            </div>
            
            <div className="mobile-modal-body">
              <p className="mobile-modal-text">
                Kuyrukta {Q} kayıt var. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
              </p>
              </div>
              
            <div className="mobile-modal-buttons">
                <button
                className="mobile-modal-btn mobile-modal-btn-secondary"
                onClick={() => setShowClearModal(false)}
              >
                Vazgeç
                </button>
                <button
                className="mobile-modal-btn mobile-modal-btn-danger"
                onClick={confirmClearQueue}
              >
                Evet, Temizle
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Barkod Simülasyon Paneli */}
      {showSimulationPanel && (
        <div className="mobile-modal-overlay" onClick={closeSimulationPanel}>
          <div className="mobile-modal-content simulation-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-modal-header">
              <h3 className="mobile-modal-title">Barkod Simülasyonu</h3>
              <button 
                className="mobile-modal-close"
                onClick={closeSimulationPanel}
              >
                ×
              </button>
            </div>
            
            <div className="mobile-modal-body">
              {/* Rastgele Geçerli Barkod Üret */}
              <div className="simulation-option">
                <button
                  className="mobile-action-btn mobile-action-primary"
                  onClick={handleGenerateValid}
                >
                  Geçerli Barkod Üret
                </button>
                <p className="simulation-description">
                  Rastgele geçerli format barkod üretir
                </p>
              </div>

              {/* Rastgele Geçersiz Barkod Üret */}
              <div className="simulation-option">
                <button
                  className="mobile-action-btn mobile-action-secondary"
                  onClick={handleGenerateInvalid}
                >
                  Geçersiz Barkod Üret
                </button>
                <p className="simulation-description">
                  Negatif test için geçersiz barkod üretir
                </p>
              </div>

              {/* Hazır Barkod Listesi */}
              <div className="simulation-option">
                <h4>Hazır Barkodlardan Seç</h4>
                <div className="predefined-barcodes">
                  {getPredefinedBarcodes().map((item, index) => (
                    <button
                      key={index}
                      className={`predefined-barcode ${item.valid ? 'valid' : 'invalid'}`}
                      onClick={() => handleSelectPredefined(item.code)}
                    >
                      <span className="barcode-type">{item.type}</span>
                      <span className="barcode-code">{item.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Manuel Giriş */}
              <div className="simulation-option">
                <h4>Manuel Giriş</h4>
                <div className="manual-input-group">
                  <input
                    type="text"
                    value={simulationInput}
                    onChange={(e) => setSimulationInput(e.target.value.toUpperCase())}
                    placeholder="Barkod giriniz (örn: ULD-AKE12345AB)"
                    className="manual-barcode-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleManualSubmit()
                      }
                    }}
                  />
                  {simulationError && (
                    <div className="simulation-error">{simulationError}</div>
                  )}
                  <button
                    className="mobile-action-btn mobile-action-primary"
                    onClick={handleManualSubmit}
                    disabled={!simulationInput.trim()}
                  >
                    Ekle
                  </button>
                </div>
              </div>
              </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default MobileBarcode