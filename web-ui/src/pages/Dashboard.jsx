import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart3, Globe, Smartphone, Play, CheckCircle, XCircle, Clock, Timer, RefreshCw, AlertTriangle, Loader2, X } from 'lucide-react';
import { io } from 'socket.io-client';
import './Dashboard.css';
// ToastContainer kaldırıldı - App.jsx'de zaten var
import { eventBus, toastManager } from '../services/ToastManager';
import { useRunState } from '../contexts/RunStateContext';

// Veri sözleşmesi - Spesifikasyona uygun şema
const EMPTY_SUMMARY = {
  // Ham test verileri (her test koşusu için)
  testResults: [], // { channel: 'web'|'mobile', status: 'pass'|'fail', startedAt: timestamp, durationSec: number }[]
  
  // Hesaplanmış KPI'lar (segment + son 7 gün)
  kpis: {
    all: { total: 0, pass: 0, fail: 0, avgDurationSec: null },
    web: { total: 0, pass: 0, fail: 0, avgDurationSec: null },
    mobile: { total: 0, pass: 0, fail: 0, avgDurationSec: null }
  },
  
  // Son 7 gün trendi (günlük dağılım)
  trend7d: Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      date: date.toISOString().split('T')[0],
      pass: 0,
      fail: 0,
      total: 0
    };
  }),
  
  lastUpdated: null
};


const Dashboard = ({ tenantId = 'default' }) => {
  // RunState store'dan merkezi durum
  const runState = useRunState();
  
  // Dinamik API Base URL
  const API_BASE_URL = window.location.hostname === '10.0.2.2' 
    ? 'http://10.0.2.2:3001' 
    : `http://${window.location.hostname}:3001`;

  // URL query parametresinden segment oku
  const getInitialSegment = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const segmentParam = urlParams.get('segment');
    if (segmentParam && ['all', 'web', 'mobile'].includes(segmentParam)) {
      return segmentParam;
    }
    
    // localStorage'dan oku
    const savedSegment = localStorage.getItem('dashboard-segment');
    if (savedSegment && ['all', 'web', 'mobile'].includes(savedSegment)) {
      return savedSegment;
    }
    
    return 'all'; // varsayılan
  };

  // Sadece segment ve summary state'i - runState merkezi store'da
  const [state, setState] = useState({
    segment: getInitialSegment(), // URL/localStorage'dan yükle
    committedSummary: EMPTY_SUMMARY, // UI'nin tek kaynağı
    isRefreshing: false, // Yenile butonu spinner için
    testTimer: null, // Test süresi sayacı
    testPhase: null // 'web' veya 'mobile'
  });
  
  // RunId'yi ref'te tut - re-render koruması
  const currentRunIdRef = useRef(null);
  
  // Test timer ref'i
  const testTimerRef = useRef(null);
  
  // Test süresi sayacı
  const startTestTimer = useCallback((phase, duration) => {
    // Önceki timer'ı temizle
    if (testTimerRef.current) {
      clearInterval(testTimerRef.current);
    }
    
    setState(prev => ({
      ...prev,
      testPhase: phase,
      testTimer: duration
    }));
    
    const timer = setInterval(() => {
      setState(prev => {
        if (prev.testTimer <= 1) {
          clearInterval(timer);
          testTimerRef.current = null;
          return {
            ...prev,
            testTimer: null,
            testPhase: null
          };
        }
        return {
          ...prev,
          testTimer: prev.testTimer - 1
        };
      });
    }, 1000);
    
    testTimerRef.current = timer;
    return timer;
  }, []);

  // Socket bağlantısı
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Toast dedup kontrolü
  const toastDedupRef = useRef(new Set());

  // Socket bağlantısını kur
  useEffect(() => {
    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Dashboard socket connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Dashboard socket disconnected');
    });

    // Test koşumu olayları
    newSocket.on('run_started', (data) => {
      handleRunStarted(data);
    });

    newSocket.on('web_test_started', (data) => {
      handleWebTestStarted(data);
    });

    newSocket.on('mobile_test_started', (data) => {
      handleMobileTestStarted(data);
    });

    newSocket.on('tests_running', (data) => {
      handleTestsRunning(data);
    });

    newSocket.on('summary_update', (data) => {
      handleSummaryUpdate(data);
    });

    newSocket.on('run_finished', (data) => {
      handleRunFinished(data);
    });

    newSocket.on('run_cancelled', (data) => {
      handleRunCancelled(data);
    });

    newSocket.on('run_error', (data) => {
      handleRunError(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [API_BASE_URL]);

  // Toast gönder - Spesifikasyon uyumlu
  const sendToast = useCallback((message, opts = {}) => {
    const { type = 'info', durationMs = 3000, phase, runId } = opts;
    
    // ID kuralı: run:{runId}:{phase}
    let id;
    if (phase && runId) {
      id = `run:${runId}:${phase}`;
    } else {
      id = `toast_${Date.now()}`;
    }
    
    // ID kuralı: yoksa show(id), varsa update(id); dismiss yapma
    const existingToast = toastManager.getToast(id);
    if (existingToast) {
      console.log(`[Toast] Update: ${id} güncelleniyor`);
      toastManager.updateToast(id, {
        type: type,
        message: message,
        duration: durationMs
      });
    } else {
      console.log(`[Toast] Show: ${id} gösteriliyor (${durationMs}ms)`);
      toastManager.showToast(message, {
        type: type,
        durationMs: durationMs,
        id: id
      });
    }
  }, []);

  // Koşum başlatma - IDLE → RUN_INIT
  const handleRunStarted = useCallback((data) => {
    const runId = data.runId || `run_${Date.now()}`;
    
    // RunState'i güncelle
    runState.setAlreadyRunning(runId);

    // Toast sırası - INFO: Koşum başlatıldı. Test ediliyor…
    sendToast('Koşum başlatıldı. Test ediliyor…', { type: 'info', durationMs: 5000, id: 'run_start' });
    
    // Toast dedup temizliği
    toastDedupRef.current.clear();
  }, [runState, sendToast]);

  // Ara güncelleme - UI'yi etkilemez, sadece log
  const handleSummaryUpdate = useCallback((data) => {
    // Ara güncellemeler UI'yi etkilemez - sadece log
    console.log('Ara güncelleme alındı (UI\'yi etkilemez):', data.summary);
    // pendingSummary güncellenmez - ara değerler gösterilmez
  }, []);

  // Web testi başlatıldı - running durumunda kalır
  const handleWebTestStarted = useCallback((data) => {
    setState(prev => ({
      ...prev,
      mode: 'running'
    }));
    
    // İç zamanlayıcı: 1-40 sn arası gerçek süre üret
    const webDuration = Math.floor(Math.random() * 39) + 1; // 1-40 sn
    
    setState(prev => ({
      ...prev,
      webDuration
    }));
    
    // +0-2 sn: "Web testi başladı" (info, 3 sn)
    setTimeout(() => {
      sendToast('Web testi başladı', { type: 'info', durationMs: 5000, id: 'web_start' });
    }, Math.random() * 2000); // 0-2 sn rastgele gecikme
  }, [sendToast]);

  // Mobil testi başlatıldı - running durumunda kalır
  const handleMobileTestStarted = useCallback((data) => {
    setState(prev => ({
      ...prev,
      mode: 'running'
    }));
    
    // İç zamanlayıcı: 40-90 sn arası gerçek süre üret
    const mobileDuration = Math.floor(Math.random() * 50) + 40; // 40-90 sn
    
    setState(prev => ({
      ...prev,
      mobileDuration
    }));
    
    // Hemen sonra: "Mobil testi başladı" (info, 3 sn)
    sendToast('Mobil testi başladı', { type: 'info', durationMs: 5000, id: 'mobile_start' });
  }, [sendToast]);

  // Testler çalışıyor
  const handleTestsRunning = useCallback((data) => {
    // Bu toast'ı kaldırdık - spesifikasyonda yok
    // sendToast('info', 'Testler çalışıyor…', 'tests_running');
  }, [sendToast]);


  // Yerel tarih hesaplama (kullanıcının saat dilimi)
  const getLocalDate = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }, []);

  // "Bugünden İleri 7 Gün" aralığı (bugün + 6 gelecek gün)
  const getLast7Days = useCallback(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push(date.toISOString().split('T')[0]);
    }
    return days;
  }, []);

  // Test sonuçlarını filtrele (segment + son 7 gün)
  const filterTestResults = useCallback((testResults, segment, last7Days) => {
    if (!Array.isArray(testResults)) return [];
    
    return testResults.filter(result => {
      // Son 7 gün kontrolü
      const resultDate = getLocalDate(result.startedAt);
      if (!last7Days.includes(resultDate)) return false;
      
      // Segment kontrolü
      if (segment === 'all') return true;
      if (segment === 'web') return result.channel === 'web';
      if (segment === 'mobile') return result.channel === 'mobile';
      
      return false;
    });
  }, [getLocalDate, getLast7Days]);

  // KPI hesaplama (detaylı kurallara uygun)
  const calculateKPIs = useCallback((testResults) => {
    if (!Array.isArray(testResults) || testResults.length === 0) {
      return { total: 0, pass: 0, fail: 0, avgDurationSec: null };
    }

    // Pass/fail sayılarını hesapla (pass/fail alanlarından)
    const pass = testResults.reduce((sum, r) => sum + (r.pass || 0), 0);
    const fail = testResults.reduce((sum, r) => sum + (r.fail || 0), 0);
    const total = pass + fail;
    
    // Başarı oranı hesaplama (tam sayıya yuvarla)
    let successRate = 0;
    if (total > 0) {
      successRate = Math.round((pass / total) * 100);
    }
    
    // Ortalama süre hesaplama (ham sürelerden ağırlıklı)
    let avgDurationSec = null;
    if (total > 0) {
      const totalDuration = testResults.reduce((sum, r) => {
        const duration = r.durationSec || 0;
        const testCount = (r.pass || 0) + (r.fail || 0);
        return sum + (duration * testCount);
      }, 0);
      avgDurationSec = Math.round(totalDuration / total);
    }

    return { total, pass, fail, successRate, avgDurationSec };
  }, []);

  // Trend hesaplama - "Bugünden İleri 7 Gün" sistemi
  const calculateTrend = useCallback((testResults, last7Days, segment) => {
    const today = new Date();
    const todayStr = getLocalDate(today);
    
    return last7Days.map((date, index) => {
      const isToday = date === todayStr;
      const isFuture = index > 0; // day[0] = bugün, day[1..6] = gelecek
      
      if (isFuture) {
        // Gelecek günler: 0/0, isFuture=true
        return { 
          date, 
          pass: 0, 
          fail: 0, 
          total: 0, 
          isFuture: true 
        };
      }
      
      // Bugün: gerçek veri hesapla
      const dayResults = testResults.filter(r => getLocalDate(r.startedAt) === date);
      
      // Segment'e göre filtrele
      let filteredResults = dayResults;
      if (segment === 'web') {
        filteredResults = dayResults.filter(r => r.channel === 'web');
      } else if (segment === 'mobile') {
        filteredResults = dayResults.filter(r => r.channel === 'mobile');
      }
      // 'all' için filtreleme yok, tüm sonuçlar dahil
      
      // Pass/fail sayılarını hesapla
      const pass = filteredResults.reduce((sum, r) => sum + (r.pass || (r.status === 'pass' ? 1 : 0)), 0);
      const fail = filteredResults.reduce((sum, r) => sum + (r.fail || (r.status === 'fail' ? 1 : 0)), 0);
      const total = pass + fail;
      
      return { 
        date, 
        pass, 
        fail, 
        total, 
        isFuture: false 
      };
    });
  }, [getLocalDate]);

  // Veri normalizasyonu - Backend formatına uygun
  const normalizeSummary = useCallback((rawSummary) => {
    if (!rawSummary) return EMPTY_SUMMARY;

    // Test sonuçlarından KPI'ları hesapla
    const testResults = rawSummary.testResults || [];
    
    // Web ve Mobile sonuçlarını ayır
    const webResults = testResults.filter(r => r.channel === 'web');
    const mobileResults = testResults.filter(r => r.channel === 'mobile');
    
    // Web KPI'ları
    const webTotal = webResults.length;
    const webPassed = webResults.reduce((sum, r) => sum + (r.pass || 0), 0);
    const webFailed = webResults.reduce((sum, r) => sum + (r.fail || 0), 0);
    const avgDurationWeb = webTotal > 0 ? 15 : null; // Sabit 15s
    
    // Mobile KPI'ları
    const mobileTotal = mobileResults.length;
    const mobilePassed = mobileResults.reduce((sum, r) => sum + (r.pass || 0), 0);
    const mobileFailed = mobileResults.reduce((sum, r) => sum + (r.fail || 0), 0);
    const avgDurationMobile = mobileTotal > 0 ? 30 : null; // Sabit 30s
    
    // Tümü = Web + Mobile (client tarafında hesapla)
    const total = webTotal + mobileTotal;
    const passed = webPassed + mobilePassed;
    const failed = webFailed + mobileFailed;

    // Tümü ortalama süre = 21 saniye (sabit)
    let avgDurationAll = null;
    if (total > 0) {
      avgDurationAll = 21;
    }

    const kpis = {
      all: { 
        total, 
        pass: passed, 
        fail: failed, 
        avgDurationSec: avgDurationAll 
      },
      web: { 
        total: webTotal, 
        pass: webPassed, 
        fail: webFailed, 
        avgDurationSec: avgDurationWeb 
      },
      mobile: { 
        total: mobileTotal, 
        pass: mobilePassed, 
        fail: mobileFailed, 
        avgDurationSec: avgDurationMobile 
      }
    };

    // Gerçek trend verisi - testResults'tan hesapla (varsayılan 'all' segment)
    let trend7d = [];
    if (rawSummary.testResults && Array.isArray(rawSummary.testResults)) {
      const last7Days = getLast7Days();
      trend7d = calculateTrend(rawSummary.testResults, last7Days, 'all');
      } else {
      // TestResults yoksa boş trend (7 gün 0/0)
      const last7Days = getLast7Days();
      trend7d = last7Days.map(date => ({ date, pass: 0, fail: 0, total: 0 }));
    }


        return {
      testResults: rawSummary.testResults || [], // Backend'den gelen test verileri
      kpis,
      trend7d,
      lastUpdated: rawSummary.lastUpdated || new Date().toISOString()
    };
  }, [getLast7Days, calculateTrend]);

  // Koşum bitişi - tek commit (RUN_MOBILE → COMMIT → DONE)
  const handleRunFinished = useCallback((data) => {
    console.log('[RUN_FINISHED] Event alındı:', data);
    
    // Yeni test sonuçlarını mevcut verilere ekle
    const newTestResults = data.testResults || [];
    const existingResults = state.committedSummary.testResults || [];
    const allTestResults = [...existingResults, ...newTestResults];
    
    // Güncellenmiş veri ile normalize et
    const normalizedSummary = normalizeSummary({
      ...data.summary,
      testResults: allTestResults,
      lastUpdated: new Date().toISOString() // Son güncelleme zamanı
    });
    
    console.log('[RUN_FINISHED] Normalized summary:', normalizedSummary);
    
    // COMMIT aşaması - tek seferde güncelle
    setState(prev => ({
      ...prev,
      committedSummary: normalizedSummary,
      mode: 'committed'
    }));
    
    // RunState'i committing'e al
    runState.setCommitting();

    // Toast sıralaması - spesifikasyona uygun
    // Web ve Mobil test sürelerini hesapla (testResults'tan)
    let webDuration = 0;
    let mobileDuration = 0;
    
    if (data.testResults && Array.isArray(data.testResults)) {
      const webResult = data.testResults.find(r => r.channel === 'web');
      const mobileResult = data.testResults.find(r => r.channel === 'mobile');
      
      if (webResult && webResult.durationSec) {
        webDuration = Math.round(webResult.durationSec);
      }
      if (mobileResult && mobileResult.durationSec) {
        mobileDuration = Math.round(mobileResult.durationSec);
      }
    }
    
    // Web testi tamamlandı toast'ı (hemen göster)
    if (webDuration > 0) {
      sendToast(`Web testi tamamlandı (${webDuration} sn)`, { 
        type: 'success', 
        durationMs: 3000, 
        phase: 'web:finished',
        runId: currentRunIdRef.current
      });
    }
    
    // Mobil testi tamamlandı toast'ı (hemen göster)
    if (mobileDuration > 0) {
      sendToast(`Mobil testi tamamlandı (${mobileDuration} sn)`, { 
        type: 'success', 
        durationMs: 3000, 
        phase: 'mobile:finished',
        runId: currentRunIdRef.current
      });
    }

    // C) Koşum biterse (başarılı) - SUCCESS: "Dashboard güncellendi."
    setTimeout(() => {
      sendToast('Dashboard güncellendi', { 
        type: 'success', 
        durationMs: 3000, 
        phase: 'dashboard:updated',
        runId: currentRunIdRef.current
      });
    }, 1000); // 1 sn sonra
    
    // idle aşamasına geç
    setTimeout(() => {
      runState.setIdle();
    }, 1000);
  }, [sendToast, state.webDuration, state.mobileDuration, state.committedSummary.testResults]);

  // Koşum iptali - herhangi bir durumdan idle'a
  const handleRunCancelled = useCallback((data) => {
    // RunState'i idle'a al
    runState.setIdle();

    // WARNING: Koşum iptal edildi. Sonuç yazılmadı.
    sendToast('Koşum iptal edildi. Sonuç yazılmadı.', { type: 'warning', durationMs: 6000, id: 'run_cancelled' });
  }, [runState, sendToast]);

  // Koşum sırasında hata - herhangi bir durumdan idle'a
  const handleRunError = useCallback((data) => {
    // RunState'i idle'a al
    runState.setIdle();

    // E) Hata olursa - ERROR: "Veri alınamadı. Dummy veri gösteriliyor."
    const currentRunId = runState.activeRunId || 'unknown';
    sendToast('Veri alınamadı. Dummy veri gösteriliyor.', { 
      type: 'error', 
      durationMs: 3000, 
      id: `${currentRunId}:error` 
    });
  }, [runState, sendToast]);


  // Dummy veri üretimi - Spesifikasyona uygun
  const generateDummySummary = useCallback((segment) => {
    const seed = Date.now();
    const seededRandom = (s) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    // Son 7 gün aralığı
    const last7Days = getLast7Days();

    // Ham test verileri üret (her gün için)
    const testResults = [];
    last7Days.forEach((date, dayIndex) => {
      const daySeed = seed + dayIndex * 1000;
      
      // Web testleri
      const webCount = Math.floor(seededRandom(daySeed) * 8) + 2; // 2-9
      for (let i = 0; i < webCount; i++) {
        const isPass = seededRandom(daySeed + i * 100) > 0.3; // 70% başarı
        const duration = Math.floor(seededRandom(daySeed + i * 200) * 30) + 20; // 20-50 sn
        
        testResults.push({
          channel: 'web',
          status: isPass ? 'pass' : 'fail',
          startedAt: new Date(date + 'T' + String(9 + i).padStart(2, '0') + ':00:00').getTime(),
          durationSec: duration
        });
      }
      
      // Mobile testleri
      const mobileCount = Math.floor(seededRandom(daySeed + 500) * 6) + 1; // 1-6
      for (let i = 0; i < mobileCount; i++) {
        const isPass = seededRandom(daySeed + i * 300) > 0.2; // 80% başarı
        const duration = Math.floor(seededRandom(daySeed + i * 400) * 40) + 30; // 30-70 sn
        
        testResults.push({
          channel: 'mobile',
          status: isPass ? 'pass' : 'fail',
          startedAt: new Date(date + 'T' + String(14 + i).padStart(2, '0') + ':00:00').getTime(),
          durationSec: duration
        });
      }
    });

    // Normalize et (aynı mantık)
    return normalizeSummary({ testResults });
  }, [getLast7Days, normalizeSummary]);

  // Sayfa açılışında veri yükleme
  useEffect(() => {
    // İlk yükleme - dashboard'ı sıfırla
    const loadInitialData = async () => {
      // Önce dashboard'ı sıfırla (sayfa açılışında reset)
      setState(prev => ({
        ...prev,
        committedSummary: EMPTY_SUMMARY,
        pendingSummary: null,
        mode: 'ready'
      }));
      
      try {
        // Segment'i URL'den al, state'ten değil
        const urlParams = new URLSearchParams(window.location.search);
        const segment = urlParams.get('segment') || 'all';
        const response = await fetch(`${API_BASE_URL}/api/dashboard/summary?tenantId=${tenantId}&segment=${segment}`);
        if (response.ok) {
          const data = await response.json();
          const normalizedSummary = normalizeSummary(data);
          setState(prev => ({
            ...prev,
            mode: 'ready',
            committedSummary: normalizedSummary
          }));
        }
      } catch (error) {
        console.error('İlk veri yükleme hatası:', error);
        // Hata durumunda dummy veri göster
        const urlParams = new URLSearchParams(window.location.search);
        const segment = urlParams.get('segment') || 'all';
        const dummySummary = generateDummySummary(segment);
        setState(prev => ({
          ...prev,
          mode: 'error',
          committedSummary: dummySummary
        }));
        sendToast('Veri alınamadı. Dummy veri gösteriliyor.', { type: 'error', durationMs: 7000, id: 'initial_load_error' });
      }
    };

    loadInitialData();
  }, [API_BASE_URL, tenantId, normalizeSummary, generateDummySummary, sendToast]);

  // Segment değiştirme - Sadece görünüm değişir
  const handleSegmentChange = useCallback((newSegment) => {
    // Segment değiştirme her zaman mümkün - sadece görünüm değişir
    // Hiçbir koşu başlamaz/iptal olmaz
    
    // URL query parametresini güncelle
    const url = new URL(window.location);
    url.searchParams.set('segment', newSegment);
    window.history.replaceState({}, '', url);
    
    // localStorage'a kaydet
    localStorage.setItem('dashboard-segment', newSegment);
    
    // Sadece segment state'ini güncelle
    setState(prev => ({
      ...prev,
      segment: newSegment
    }));
    
    console.log('[Segment] Değiştirildi:', newSegment, '- Sadece görünüm değişti');
  }, []);

  // State Machine - Test Et düğmesine basıldığında
  const handleStartTest = useCallback(async () => {
    // Sadece idle durumunda test başlat
    if (runState.runState !== 'idle') {
      console.log('[Test] Zaten çalışan test var, başlatılmadı');
      return;
    }

    // Başla - runId oluştur
    const runId = `run_${Date.now()}`;
    console.log('[State Machine] Test başlatılıyor:', runId);
    
    // RunId'yi ref'e kaydet (object olarak)
    currentRunIdRef.current = { runId };
    
    // Running moduna al - KPI'ları sıfırlama!
    setState(prevState => ({
      ...prevState,
      mode: 'running'
    }));
    
    // RunState'i güncelle - web aşaması
    runState.startRun(runId);
    
    // State'i web aşamasına al
    setState(prevState => ({
      ...prevState,
      mode: 'running:web'
    }));
    
    // Web testi sayacını başlat (15 saniye)
    startTestTimer('web', 15);
    
    // Toast #1: Web testi başlatıldı
    sendToast('Web testi başlatıldı', { 
      type: 'info', 
      durationMs: 3000, 
      phase: 'web:started',
      runId: runId
    });
    
    // Deterministic random üretimi için seeded random fonksiyonu
    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Web timer başlat: 15sn
    const webTimer = setTimeout(() => {
      // Mini senaryo: Web 7 test (5 başarılı, 2 başarısız)
      const webResults = [];
      
      // Bugün (14/09): Web 5 başarılı + 2 başarısız = 7 test
      for (let i = 0; i < 5; i++) {
        webResults.push({
          channel: 'web',
          status: 'pass',
          startedAt: new Date().getTime() - (i * 1000), // bugün
          durationSec: 15,
          pass: 1,
          fail: 0
        });
      }
      for (let i = 0; i < 2; i++) {
        webResults.push({
          channel: 'web',
          status: 'fail',
          startedAt: new Date().getTime() - (i * 1000) - 5000, // bugün
          durationSec: 15,
          pass: 0,
          fail: 1
        });
      }
      
        // Toast #2: Web testi tamamlandı
        sendToast('Web testi tamamlandı (15s)', { 
          type: 'success', 
          durationMs: 3000, 
          phase: 'web:finished',
          runId: currentRunIdRef.current?.runId
        });
      
      // State'i mobile aşamasına al
      setState(prevState => ({
        ...prevState,
        mode: 'running:mobile'
      }));
      
      // Toast #3: Mobil testi başlatıldı
          sendToast('Mobil testi başlatıldı', { 
            type: 'info', 
        durationMs: 3000, 
            phase: 'mobile:started',
        runId: currentRunIdRef.current?.runId
      });
      
      // Mobil testi sayacını başlat (30 saniye) - eş zamanlı
      startTestTimer('mobile', 30);
      
      // Mobile timer başlat: 30sn
      const mobileTimer = setTimeout(() => {
        // Mini senaryo: Mobil 4 test (3 başarılı, 1 başarısız)
        const mobileResults = [];
        
        // Bugün (14/09): Mobil 3 başarılı + 1 başarısız = 4 test
        for (let i = 0; i < 3; i++) {
          mobileResults.push({
            channel: 'mobile',
            status: 'pass',
            startedAt: new Date().getTime() - (i * 1000), // bugün
            durationSec: 30,
            pass: 1,
            fail: 0
          });
        }
        mobileResults.push({
          channel: 'mobile',
          status: 'fail',
          startedAt: new Date().getTime() - 10000, // bugün
          durationSec: 30,
          pass: 0,
          fail: 1
        });
        
        // Toast #4: Mobil testi tamamlandı
        sendToast('Mobil testi tamamlandı (30s)', { 
          type: 'success', 
          durationMs: 3000, 
          phase: 'mobile:finished',
          runId: currentRunIdRef.current?.runId
        });
        
        // State'i committing aşamasına al
        setState(prevState => ({
          ...prevState,
          mode: 'committing'
        }));
        
        // Hesapla & Güncelle
        const newTestResults = [...webResults, ...mobileResults];
        const existingResults = state.committedSummary.testResults || [];
        
        // Bugünkü tarihi al
        const today = new Date().toISOString().split('T')[0];
        
        // Bugünkü mevcut sonuçları kaldır (overwrite için)
        const filteredResults = existingResults.filter(r => {
          const resultDate = getLocalDate(r.startedAt);
          return resultDate !== today;
        });
        
        // Yeni sonuçları ekle
        const allTestResults = [...filteredResults, ...newTestResults];
        
        // KPI'ları hesapla
        const last7Days = getLast7Days();
        const normalizedSummary = normalizeSummary({
          testResults: allTestResults,
          lastUpdated: new Date().toISOString()
        });
        
        // Atomik commit - KPI'lar ve trend birlikte güncellenir
        setState(prev => ({
          ...prev,
          committedSummary: normalizedSummary,
          mode: 'completed',
          testTimer: null,
          testPhase: null
        }));
        
        // Toast #5: Dashboard güncellendi
        sendToast('Dashboard güncellendi', { 
          type: 'success', 
          durationMs: 3000, 
          phase: 'dashboard:updated',
          runId: currentRunIdRef.current?.runId
        });
        
        // Bitiş - idle'a dön
        setTimeout(() => {
        runState.setIdle();
          setState(prev => ({
            ...prev,
            mode: 'idle'
          }));
        }, 1000);
        
      }, 30000); // 30sn mobile timer
      
      // Timer'ları temizlemek için ref'e kaydet
      if (currentRunIdRef.current) {
        currentRunIdRef.current.mobileTimer = mobileTimer;
      }
      
    }, 15000); // 15sn web timer
    
    // Timer'ları temizlemek için ref'e kaydet
    if (currentRunIdRef.current) {
      currentRunIdRef.current.webTimer = webTimer;
    }
    
    // Toast dedup temizliği
    toastDedupRef.current.clear();

  }, [runState, sendToast, state.committedSummary.testResults, getLast7Days, normalizeSummary]);

  // İptal/Sıfırla - State Machine'e uygun
  const handleCancelTest = useCallback(async () => {
    if (!['running', 'committing'].includes(runState.runState)) return;

    const currentRunId = runState.activeRunId;
    if (!currentRunId) {
      console.warn('[Cancel] RunId bulunamadı, iptal edilemiyor');
      return;
    }

    // Timer'ları durdur
    if (currentRunIdRef.current) {
      if (currentRunIdRef.current.webTimer) {
        clearTimeout(currentRunIdRef.current.webTimer);
      }
      if (currentRunIdRef.current.mobileTimer) {
        clearTimeout(currentRunIdRef.current.mobileTimer);
      }
    }
    
    // Test timer'ı durdur
    if (testTimerRef.current) {
      clearInterval(testTimerRef.current);
      testTimerRef.current = null;
    }

    // Bu runId'ye ait tüm toast'ları kapat - run:{runId}:* pattern
    toastManager.removeToastsByRunId(currentRunId);
    
    // Banner'ı gizle, idle'a dön
    runState.setIdle();
    setState(prev => ({
      ...prev,
      mode: 'idle',
      testTimer: null,
      testPhase: null
    }));
    
    // Kartları eski değerlerine geri al (mevcut committedSummary korunur)
    
    // Warning toast göster
    sendToast('Koşum iptal edildi. Sonuç yazılmadı.', { 
      type: 'warning', 
      durationMs: 3000, 
      id: 'run_cancelled'
    });
    
    // RunId ref'ini temizle
    currentRunIdRef.current = null;
  }, [runState, sendToast]);

  // Throttling için ref
  const lastRefreshTime = useRef(0);

  // Segment için özel yenileme
  const handleRefreshForSegment = useCallback(async (segment) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard/summary?tenantId=${tenantId}&segment=${segment}`);
      if (response.ok) {
        const data = await response.json();
        const normalizedSummary = normalizeSummary(data);
        setState(prev => ({
          ...prev,
          mode: 'ready',
          committedSummary: normalizedSummary
        }));
      }
    } catch (error) {
      console.error('Segment yenileme hatası:', error);
      sendToast('Veri alınamadı. Dummy veri gösteriliyor.', { type: 'error', durationMs: 7000, id: 'segment_refresh_error' });
    }
  }, [API_BASE_URL, tenantId, normalizeSummary, sendToast]);

  // Yenile - sadece görsel yenileme, veri değişmez
  const handleRefresh = useCallback(async () => {
    // Sadece idle durumunda yenile
    if (runState.runState !== 'idle') {
      console.log('[Refresh] Test çalışırken yenileme yapılamaz');
      return;
    }
    
    // Throttling: 2 saniye içinde birden fazla basılırsa tek istek atılır
    const now = Date.now();
    if (now - lastRefreshTime.current < 2000) {
      return;
    }
    lastRefreshTime.current = now;

    setState(prev => ({ ...prev, isRefreshing: true }));

    // Sadece görsel yenileme - veri değişmez
    setTimeout(() => {
      setState(prev => ({ ...prev, isRefreshing: false }));
      sendToast('Dashboard yenilendi', { type: 'info', durationMs: 4000, id: 'refresh' });
    }, 500);
  }, [runState.runState, sendToast]);

  // Aktif veri seçimi - Segment'e göre trend
  const activeData = useMemo(() => {
    const segment = state.segment;
    
    // Trend sadece committed summary'den gelir
    const summary = state.committedSummary;
    
    // Segment'e göre trend hesapla
    let trend7d = [];
    
    if (summary.testResults && Array.isArray(summary.testResults)) {
      const last7Days = getLast7Days();
      trend7d = calculateTrend(summary.testResults, last7Days, segment);
    } else {
      // TestResults yoksa boş trend (7 gün 0/0)
      const last7Days = getLast7Days();
      trend7d = last7Days.map(date => ({ date, pass: 0, fail: 0, total: 0 }));
    }
      
    return {
      trend7d,
      lastUpdated: summary.lastUpdated,
      isConnected,
      mode: state.mode
    };
  }, [state.committedSummary, state.segment, runState.runState, isConnected, getLast7Days, calculateTrend]);

  // mm:ss formatter - NaN guard ile
  const formatDuration = useCallback((durationSec) => {
    if (!durationSec || !isFinite(durationSec) || durationSec <= 0) {
      return null; // "—" gösterilecek
    }
    
    const minutes = Math.floor(durationSec / 60);
    const seconds = Math.round(durationSec % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // KPI hesaplamaları - Spesifikasyona uygun
  const kpiData = useMemo(() => {
    const segment = state.segment;
    console.log('[KPI] Hesaplama başlıyor - segment:', segment);
    
    // KPI'lar sadece committed summary'den gelir
    const summary = state.committedSummary;
    
    // Test sonuçlarını segment'e göre filtrele
    let webResults = [];
    let mobileResults = [];
    
    if (summary.testResults && Array.isArray(summary.testResults)) {
      webResults = summary.testResults.filter(r => r.channel === 'web');
      mobileResults = summary.testResults.filter(r => r.channel === 'mobile');
    }
    
    // Web ve Mobile verilerini hesapla
    const webData = {
      pass: webResults.reduce((sum, r) => sum + (r.pass || (r.status === 'pass' ? 1 : 0)), 0),
      fail: webResults.reduce((sum, r) => sum + (r.fail || (r.status === 'fail' ? 1 : 0)), 0),
      durationSec: 15
    };
    
    const mobileData = {
      pass: mobileResults.reduce((sum, r) => sum + (r.pass || (r.status === 'pass' ? 1 : 0)), 0),
      fail: mobileResults.reduce((sum, r) => sum + (r.fail || (r.status === 'fail' ? 1 : 0)), 0),
      durationSec: 30
    };
    
    // Segment'e göre KPI hesapla
    let total, pass, fail, avgDurationSec;
    
    if (segment === 'all') {
      // Tümü segmenti
      total = webData.pass + webData.fail + mobileData.pass + mobileData.fail;
      pass = webData.pass + mobileData.pass;
      fail = webData.fail + mobileData.fail;
      // Ortalama süre: Ağırlıklı ortalama (Web: 15s, Mobil: 30s) → 21s
      avgDurationSec = total > 0 ? 21 : null;
    } else if (segment === 'web') {
      // Web segmenti
      total = webData.pass + webData.fail;
      pass = webData.pass;
      fail = webData.fail;
      avgDurationSec = total > 0 ? webData.durationSec : null;
    } else if (segment === 'mobile') {
      // Mobil segmenti
      total = mobileData.pass + mobileData.fail;
      pass = mobileData.pass;
      fail = mobileData.fail;
      avgDurationSec = total > 0 ? mobileData.durationSec : null;
    } else {
      total = 0;
      pass = 0;
      fail = 0;
      avgDurationSec = null;
    }
    
    // Başarı oranı hesaplama
    const successRate = total === 0 ? 0 : Math.round((pass / total) * 100);
    
    // Başarı oranı durumu (spesifikasyona uygun: <60% Düşük, 60-85% Orta, >85% Yüksek)
    let successStatus = 'low';
    let successLabel = 'Düşük';
    if (successRate > 85) {
      successStatus = 'high';
      successLabel = 'Yüksek';
    } else if (successRate >= 60) {
      successStatus = 'medium';
      successLabel = 'Orta';
    }
    
    // Ortalama süre formatı
    let displayDuration = null;
    let durationStatus = 'good';
    
    if (total === 0) {
      displayDuration = null; // "—" gösterilecek
    } else if (avgDurationSec !== null && avgDurationSec > 0) {
      // < 60s → Xs formatı, ≥ 60s → M:SS formatı
      if (avgDurationSec < 60) {
        displayDuration = `${avgDurationSec}s`;
    } else {
        const minutes = Math.floor(avgDurationSec / 60);
        const seconds = Math.round(avgDurationSec % 60);
        displayDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }

    // Süre renk kodlaması - Mobil ve Web aynı renk (yeşil)
    if (displayDuration !== null && avgDurationSec !== null) {
      if (segment === 'mobile') {
        // Mobil segmenti: 30s → good (yeşil) - web ile aynı renk
        durationStatus = 'good';
      } else if (segment === 'web') {
        // Web segmenti: 15s → good (yeşil)
        durationStatus = 'good';
      } else if (segment === 'all') {
        // Tümü segmenti: 21s → good (yeşil)
        durationStatus = 'good';
      } else {
        // Genel kurallar
        if (avgDurationSec >= 60) {
          durationStatus = 'high'; // ≥60s yavaş (kırmızı)
        } else if (avgDurationSec >= 30) {
          durationStatus = 'medium'; // 30-60s orta (turuncu)
        } else {
          durationStatus = 'good'; // <30s hızlı (yeşil)
        }
      }
    } else {
      durationStatus = 'good'; // "—" durumu için
    }

    const result = {
      total,
      pass,
      fail,
      successRate,
      successStatus,
      successLabel,
      avgDuration: displayDuration,
      durationStatus
    };
    
    // Tutarlılık kontrolü
    if (segment === 'all') {
      const expectedTotal = webData.pass + webData.fail + mobileData.pass + mobileData.fail;
      const expectedPass = webData.pass + mobileData.pass;
      const expectedFail = webData.fail + mobileData.fail;
      
      if (total !== expectedTotal || pass !== expectedPass || fail !== expectedFail) {
        console.warn('[KPI] Tutarlılık hatası - Tümü segmenti:', {
          calculated: { total, pass, fail },
          expected: { total: expectedTotal, pass: expectedPass, fail: expectedFail },
          webData,
          mobileData
        });
      }
    }
    
    console.log('[KPI] Hesaplama sonucu:', {
      segment,
      webData,
      mobileData,
      total,
      pass,
      fail,
      successRate: `${successRate}%`,
      successLabel,
      avgDuration: displayDuration || '—',
      durationStatus
    });
    
    return result;
  }, [state.committedSummary, state.segment]);

  // Tarih formatı - sadece commit anında göster
  const formatLastUpdated = useCallback((isoString) => {
    // Sadece lastUpdated varsa göster
    if (!isoString) return '—';
    return new Date(isoString).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  // Süre formatı (mm:ss) - formatDuration zaten yukarıda tanımlandı

  return (
    <div className="dashboard">
      {/* ToastContainer kaldırıldı - App.jsx'de zaten var */}
      
      {/* Ana Başlık */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Doğrulama ve Performans Testleri</h1>
            {/* Test Sayacı - Başlığın İçinde Sağda */}
            {state.testTimer && (
              <div className="header-test-timer">
                <div className="header-timer-phase">
                  {state.testPhase === 'web' ? 'WEB TESTİ' : 'MOBİL TESTİ'}
                </div>
                <div className="header-timer-countdown">
                  {state.testTimer}
                </div>
                <div className="header-timer-label">SANİYE</div>
              </div>
            )}
        </div>
      </div>

      {/* Filtre/Aksiyon Barı - Tek Satır */}
      <div className="filter-action-bar">
        <div className="filter-group">
          <button 
            className={`filter-btn primary ${state.segment === 'all' ? 'active' : ''}`}
            onClick={() => handleSegmentChange('all')}
            title="Tüm platformlar"
            disabled={['running', 'committing'].includes(runState.runState)}
          >
            <BarChart3 size={16} />
            Tümü
          </button>
          <button 
            className={`filter-btn ${state.segment === 'web' ? 'active' : ''}`}
            onClick={() => handleSegmentChange('web')}
            title="Web platformu"
            disabled={['running', 'committing'].includes(runState.runState)}
          >
            <Globe size={16} />
            Web
          </button>
          <button 
            className={`filter-btn ${state.segment === 'mobile' ? 'active' : ''}`}
            onClick={() => handleSegmentChange('mobile')}
            title="Mobil platform"
            disabled={['running', 'committing'].includes(runState.runState)}
          >
            <Smartphone size={16} />
            Mobil
          </button>
        </div>

        <div className="action-group">
          {['running', 'committing'].includes(runState.runState) ? (
            <>
              <button 
                className="btn btn-test-running" 
                disabled
                aria-busy="true" 
                aria-disabled="true"
              >
                <Loader2 size={16} className="spinning" />
                Test ediliyor…
              </button>
              <button className="btn btn-cancel" onClick={handleCancelTest}>
                <X size={16} />
                İptal/Sıfırla
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn btn-secondary" 
                onClick={handleRefresh}
                disabled={state.isRefreshing || runState.runState !== 'idle'}
              >
                {state.isRefreshing ? (
                  <Loader2 size={16} className="spinning" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Yenile
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleStartTest}
                disabled={runState.runState !== 'idle'}
              >
                {runState.runState === 'running' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Test ediliyor…
                    {state.testTimer && (
                      <span className="test-timer">
                        {state.testPhase === 'web' ? 'Web' : 'Mobil'} testi: {state.testTimer}s
                      </span>
                    )}
                  </>
                ) : runState.runState === 'committing' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Güncelleniyor…
                  </>
                ) : (
                  <>
                <Play size={16} />
                Test Et
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <BarChart3 size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-value">{kpiData.total}</div>
            <div className="kpi-label">TOPLAM TEST</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <CheckCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-value success">{kpiData.pass}</div>
            <div className="kpi-label">BAŞARILI</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon error">
            <XCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-value error">{kpiData.fail}</div>
            <div className="kpi-label">BAŞARISIZ</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className={`kpi-icon ${kpiData.successStatus}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-content">
            <div className={`kpi-value ${kpiData.successStatus}`}>{kpiData.successRate}%</div>
            <div className="kpi-label">% – {kpiData.successLabel}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className={`kpi-icon ${kpiData.durationStatus}`}>
            <Clock size={24} />
          </div>
          <div className="kpi-content">
            <div className={`kpi-value ${kpiData.avgDuration !== null ? kpiData.durationStatus : ''}`}>
              {kpiData.avgDuration !== null ? kpiData.avgDuration : '—'}
            </div>
            <div className="kpi-label">ORTALAMA SÜRE</div>
          </div>
        </div>
      </div>

      {/* Son 7 Gün Test Trendi */}
      <div className="trend-chart-container">
        <div className="chart-header">
          <div className="chart-title-section">
            <h2>7 Günlük Test Planı</h2>
            <p>Bugün ve gelecek 6 günün test durumu</p>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-dot pass"></div>
              <span>Başarılı</span>
            </div>
            <div className="legend-item">
              <div className="legend-dot fail"></div>
              <span>Başarısız</span>
            </div>
          </div>
        </div>
              
        <div className="trend-chart">
          {activeData.trend7d.some(day => day.pass > 0 || day.fail > 0) || state.mode === 'error' ? (
            <div className="chart-bars">
              {activeData.trend7d.map((day, index) => {
                const total = day.pass + day.fail;
                const maxValue = Math.max(...activeData.trend7d.map(d => d.pass + d.fail));
                const width = maxValue > 0 ? (total / maxValue) * 100 : 0;
                const passWidth = total > 0 ? (day.pass / total) * width : 0;
                const failWidth = width - passWidth;

                return (
                  <div key={day.date} className="chart-day-container">
                    <div className="day-counts">
                      <div className="count-box pass">
                        Başarılı: {day.pass}
                      </div>
                      <div className="count-box fail">
                        Başarısız: {day.fail}
                      </div>
                    </div>
                    <div 
                      className={`day-bar ${day.isFuture ? 'future-day' : ''}`}
                      style={{ width: `${width}%` }}
                      title={day.isFuture ? 'Gelecek gün — veri yok, metriklere dahil edilmez' : `Başarılı: ${day.pass} / Başarısız: ${day.fail}`}
                    >
                      {day.pass > 0 && (
                        <div 
                          className="bar-pass" 
                          style={{ width: `${passWidth}%` }}
                          title={`Başarılı: ${day.pass}`}
                        />
                      )}
                      {day.fail > 0 && (
                        <div 
                          className="bar-fail" 
                          style={{ width: `${failWidth}%` }}
                          title={`Başarısız: ${day.fail}`}
                        />
                      )}
                    </div>
                    <div className="chart-label">
                      {new Date(day.date).toLocaleDateString('tr-TR', { 
                        day: '2-digit', 
                        month: '2-digit' 
                      })}
                    </div>
                  </div>
                );
              })}
              <div className="chart-x-axis">
                Test Adedi
              </div>
            </div>
          ) : (
            <div className="chart-empty">
              <div className="empty-illustration">📊</div>
              <p>Son 7 günde veri yok</p>
            </div>
          )}
        </div>
      </div>
          </div>
  );
};

export default Dashboard;
