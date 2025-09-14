import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import TestOrchestrationService from './test-orchestration.js';
import BarcodeScenariosService from './barcode-scenarios.js';
import DatabaseService from './database-service.js';
import BrowserTestService from './browser-test-service.js';

// Demo modu feature flag
const DEMO_MODE = process.env.DEMO_MODE === 'true' || true; // LinkedIn demo için aktif

// Demo run tracking
let demoRuns = new Map(); // runId -> { startTime, timer, demoInjected }
let demoResults = new Map(); // runId -> {web_status, web_duration_ms, mobile_status, mobile_duration_ms}
let demoRunCounter = 0;

// Test results store
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  lastUpdated: null,
  testHistory: [],
  results: [],
  web: {
    total: 0,
    passed: 0,
    failed: 0
  },
  mobile: {
    total: 0,
    passed: 0,
    failed: 0
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3001;

// Servisleri başlat
const testOrchestration = new TestOrchestrationService();

// Test orchestration'a WebSocket io instance'ını set et
testOrchestration.setIO(io);
const browserTest = new BrowserTestService();
const barcodeScenarios = new BarcodeScenariosService();
const database = new DatabaseService();

// Veritabanını başlat
database.initialize().catch(console.error);

// WebSocket instance'ını test orchestration'a set et
testOrchestration.setSocketIO(io);

// Database instance'ını test orchestration'a set et
testOrchestration.setDatabase(database);

// Run progress tracking - her run için ayrı
const runProgress = new Map();

// Dashboard filtreleri
const dashboardFilters = {
  all: 'all',
  web: 'web', 
  mobile: 'mobile'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mobil uygulama için static dosya servisi
app.use('/mobile', express.static(path.join(__dirname, '../mobile-app/dist')));

// Kalıcı test sonuçları (tüm zamanlar)
let persistentTestResults = {
  total: 0,
  passed: 0,
  failed: 0,
  lastUpdated: null,
  testHistory: [],
  // Platform bazlı breakdown
  web: { total: 0, passed: 0, failed: 0 },
  mobile: { total: 0, passed: 0, failed: 0 },
  // Günlük trend verisi
  dailyTrend: []
};

// Aktif run sayaçları (canlı mod)
let activeRunCounters = new Map(); // runId -> { total, passed, failed, web: {...}, mobile: {...} }

// Sabit test verisi (seed'li)
const TEST_DATA_SEED = 12345;
const generateTestData = (runId, step) => {
  const seed = TEST_DATA_SEED + runId.charCodeAt(runId.length - 1) + step;
  return {
    uldCode: `ULD${String(seed % 1000).padStart(3, '0')}`,
    weight: 150 + (seed % 100),
    barcode: `BC${String(seed % 10000).padStart(4, '0')}`,
    timestamp: new Date().toISOString()
  };
};

// Otomasyon durumu
let automationStatus = {
  currentRun: null,
  webStatus: 'idle',
  mobileStatus: 'idle',
  finalSummaryReady: false
};

// Demo steps için client'lar
const demoStepClients = new Set();

// RunId sistemi - Tek doğruluk kaynağı
let activeRuns = new Map(); // runId -> run data
let currentRunId = null;

// Run durumu
let runStatus = {
  currentRunId: null,
  status: 'IDLE', // IDLE, STARTING, RUNNING_WEB, RUNNING_MOBILE, COMPLETED, FAILED
  startedAt: null,
  web: { status: 'idle', pass: 0, fail: 0, total: 0 },
  mobile: { status: 'idle', pass: 0, fail: 0, total: 0 }
};

// Canlı kanal - WebSocket (SSE alternatifi)
const liveChannels = new Map(); // runId -> Set of sockets

// Dashboard summary için mock data - LinkedIn demo için dummy data
let dashboardSummary = {
  lastUpdated: new Date().toISOString(),
  cards: {
    total: 247,
    passed: 198,
    failed: 49,
    successRate: 80.2
  },
  trend7d: {
    all: [
      { date: '2025-09-06', passed: 23, failed: 7, total: 30 },
      { date: '2025-09-07', passed: 31, failed: 4, total: 35 },
      { date: '2025-09-08', passed: 28, failed: 8, total: 36 },
      { date: '2025-09-09', passed: 35, failed: 5, total: 40 },
      { date: '2025-09-10', passed: 29, failed: 6, total: 35 },
      { date: '2025-09-11', passed: 32, failed: 9, total: 41 },
      { date: '2025-09-12', passed: 20, failed: 10, total: 30 }
    ],
    web: [
      { date: '2025-09-06', passed: 15, failed: 3, total: 18 },
      { date: '2025-09-07', passed: 20, failed: 2, total: 22 },
      { date: '2025-09-08', passed: 18, failed: 4, total: 22 },
      { date: '2025-09-09', passed: 22, failed: 3, total: 25 },
      { date: '2025-09-10', passed: 19, failed: 3, total: 22 },
      { date: '2025-09-11', passed: 21, failed: 5, total: 26 },
      { date: '2025-09-12', passed: 13, failed: 5, total: 18 }
    ],
    mobile: [
      { date: '2025-09-06', passed: 8, failed: 4, total: 12 },
      { date: '2025-09-07', passed: 11, failed: 2, total: 13 },
      { date: '2025-09-08', passed: 10, failed: 4, total: 14 },
      { date: '2025-09-09', passed: 13, failed: 2, total: 15 },
      { date: '2025-09-10', passed: 10, failed: 3, total: 13 },
      { date: '2025-09-11', passed: 11, failed: 4, total: 15 },
      { date: '2025-09-12', passed: 7, failed: 5, total: 12 }
    ]
  },
  alerts: [
    { type: 'warning', text: 'Son 24 saatte 3 test başarısız oldu' },
    { type: 'info', text: 'Mobil test performansı %15 arttı' }
  ],
  runSummary: {
    web: { status: 'idle', message: '' },
    mobile: { status: 'idle', message: '' }
  },
  version: 'ae91f7',
  avg_duration_ms_all: 245000,
  avg_duration_ms_web: 198000,
  avg_duration_ms_mobile: 312000
};

// Dashboard güncelleme fonksiyonu
const updateDashboardSummary = async () => {
  const now = new Date();
  const trend7d = [];
  
  // Aggregate store'dan güncel verileri al
  const aggregateStore = testOrchestration.aggregateStore;
  
  console.log('🔍 [updateDashboardSummary] Aggregate store:', JSON.stringify(aggregateStore, null, 2));
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    // Tarih formatı: DD/MM
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const dateStr = `${day}/${month}`;
    
    // Gün adı
    const dayNames = ['Cmt', 'Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
    const dayName = dayNames[date.getDay()];
    
    // Bugün için aggregate store verilerini kullan, diğer günler için rastgele
    let passed, failed;
    if (i === 0) { // Bugün
      passed = aggregateStore.total > 0 ? aggregateStore.passed : Math.floor(Math.random() * 10) + 1;
      failed = aggregateStore.total > 0 ? aggregateStore.failed : Math.floor(Math.random() * 3);
    } else {
      passed = Math.floor(Math.random() * 10) + 1;
      failed = Math.floor(Math.random() * 3);
    }
    
    trend7d.push({
      date: dateStr,
      dayName: dayName,
      passed,
      failed
    });
  }
  
  // Platform bazlı breakdown oluştur
  const webTrend = trend7d.map(day => ({
    date: day.date,
    dayName: day.dayName,
    passed: Math.floor(day.passed * 0.6), // Web %60
    failed: Math.floor(day.failed * 0.5)  // Web %50
  }));
  
  const mobileTrend = trend7d.map(day => ({
    date: day.date,
    dayName: day.dayName,
    passed: day.passed - Math.floor(day.passed * 0.6), // Kalan %40
    failed: day.failed - Math.floor(day.failed * 0.5)  // Kalan %50
  }));
  
  // Platform bazlı toplamlar - Aggregate store'dan al
  const webTotal = aggregateStore.web.total;
  const webPassed = aggregateStore.web.passed;
  const webFailed = aggregateStore.web.failed;
  const webSuccessRate = webTotal > 0 ? Math.round((webPassed / webTotal) * 100) : 0;
  
  const mobileTotal = aggregateStore.mobile.total;
  const mobilePassed = aggregateStore.mobile.passed;
  const mobileFailed = aggregateStore.mobile.failed;
  const mobileSuccessRate = mobileTotal > 0 ? Math.round((mobilePassed / mobileTotal) * 100) : 0;
  
  // Toplam hesapla - Aggregate store'dan al
  const total = aggregateStore.total;
  const passed = aggregateStore.passed;
  const failed = aggregateStore.failed;
  const successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
  
  // Web başarısızlığı durumunda özel veri
  let finalSummary = {
    all: {
      total,
      passed,
      failed,
      successRate
    },
    web: {
      total: webTotal,
      passed: webPassed,
      failed: webFailed,
      successRate: webSuccessRate
    },
    mobile: {
      total: mobileTotal,
      passed: mobilePassed,
      failed: mobileFailed,
      successRate: mobileSuccessRate
    }
  };

  // Eğer web testi başarısızsa, özel veri oluştur
  if (automationStatus.webStatus === 'failed') {
    console.log('❌ [Dashboard] Web başarısızlığı tespit edildi, özel summary oluşturuluyor');
    
    // Bugün için 1 başarısız web testi ekle
    const today = trend7d[trend7d.length - 1];
    today.failed += 1;
    
    // Web trend'i güncelle
    const webToday = webTrend[webTrend.length - 1];
    webToday.failed += 1;
    
    // Mobil testi başarılıysa, mobil verilerini de ekle
    if (automationStatus.mobileStatus === 'done') {
      console.log('✅ [Dashboard] Mobil testi başarılı, mobil verileri ekleniyor');
      
      // Bugün için 1 başarılı mobil testi ekle
      today.passed += 1;
      
      // Mobil trend'i güncelle
      const mobileToday = mobileTrend[mobileTrend.length - 1];
      mobileToday.passed += 1;
    }
    
    // Summary'yi yeniden hesapla
    const newTotal = trend7d.reduce((sum, day) => sum + day.passed + day.failed, 0);
    const newPassed = trend7d.reduce((sum, day) => sum + day.passed, 0);
    const newFailed = trend7d.reduce((sum, day) => sum + day.failed, 0);
    const newSuccessRate = newTotal > 0 ? Math.round((newPassed / newTotal) * 100) : 0;
    
    const newWebTotal = webTrend.reduce((sum, day) => sum + day.passed + day.failed, 0);
    const newWebPassed = webTrend.reduce((sum, day) => sum + day.passed, 0);
    const newWebFailed = webTrend.reduce((sum, day) => sum + day.failed, 0);
    const newWebSuccessRate = newWebTotal > 0 ? Math.round((newWebPassed / newWebTotal) * 100) : 0;
    
    const newMobileTotal = mobileTrend.reduce((sum, day) => sum + day.passed + day.failed, 0);
    const newMobilePassed = mobileTrend.reduce((sum, day) => sum + day.passed, 0);
    const newMobileFailed = mobileTrend.reduce((sum, day) => sum + day.failed, 0);
    const newMobileSuccessRate = newMobileTotal > 0 ? Math.round((newMobilePassed / newMobileTotal) * 100) : 0;
    
    finalSummary = {
      all: {
        total: newTotal,
        passed: newPassed,
        failed: newFailed,
        successRate: newSuccessRate
      },
      web: {
        total: newWebTotal,
        passed: newWebPassed,
        failed: newWebFailed,
        successRate: newWebSuccessRate
      },
      mobile: {
        total: newMobileTotal,
        passed: newMobilePassed,
        failed: newMobileFailed,
        successRate: newMobileSuccessRate
      }
    };
  }

  // Dashboard summary'yi güncelle
  dashboardSummary = {
    lastUpdated: now.toISOString(),
    summary: finalSummary,
    trend7d: {
      all: trend7d,
      web: webTrend,
      mobile: mobileTrend
    },
    alerts: automationStatus.webStatus === 'failed' 
      ? [
          { type: 'error', text: 'Web testi başarısız: ULD kapasite aşımı hatası' },
          { type: 'info', text: 'Mobil testi normal çalıştı' }
        ]
      : [
          { type: 'warning', text: 'Mobil login testi 2 kez başarısız' },
          { type: 'info', text: 'Web performans testi optimize edildi' }
        ],
    runSummary: {
      web: { 
        status: automationStatus.webStatus, 
        message: automationStatus.webStatus === 'failed' ? 'Kapasite aşımı hatası' : '' 
      },
      mobile: { 
        status: automationStatus.mobileStatus, 
        message: automationStatus.mobileStatus === 'done' ? 'Barkod okuma başarılı' : '' 
      }
    },
    version: 'ae91f7'
  };
  
  console.log('📊 [Dashboard] Summary güncellendi');
};

// Anomaliler için storage
let anomalies = [];

// Test sonucu güncelle - Canlı mod (RunId bazlı) + Timeout & Retry
const updateTestResult = (runId, status, testType, details = {}) => {
  const now = new Date();
  
  // Aktif run sayaçlarını güncelle
  if (!activeRunCounters.has(runId)) {
    console.log(`⚠️ RunId bulunamadı: ${runId}`);
    return;
  }
  
  const counters = activeRunCounters.get(runId);
  
  // Genel sayaçları güncelle
  counters.total += 1;
  
  if (status === 'pass') {
    counters.passed += 1;
  } else {
    counters.failed += 1;
    
    // Anomali ekle
    anomalies.push({
      id: Date.now(),
      type: 'TEST_FAILURE',
      severity: 'HIGH',
      message: `${testType} testi başarısız: ${details.error || 'Bilinmeyen hata'}`,
      timestamp: now.toISOString(),
      testType,
      details
    });
  }
  
  // Platform bazlı güncelleme
  const platform = details.platform || (testType.includes('WEB') || testType.includes('ULD') ? 'web' : 'mobile');
  if (platform === 'web') {
    counters.web.total += 1;
    if (status === 'pass') {
      counters.web.passed += 1;
    } else {
      counters.web.failed += 1;
    }
  } else if (platform === 'mobile') {
    counters.mobile.total += 1;
    if (status === 'pass') {
      counters.mobile.passed += 1;
    } else {
      counters.mobile.failed += 1;
    }
  }
  
  // Tutarlılık kontrolü: Toplam = Başarılı + Başarısız
  if (counters.total !== counters.passed + counters.failed) {
    console.error(`❌ Tutarlılık hatası: Toplam (${counters.total}) ≠ Başarılı (${counters.passed}) + Başarısız (${counters.failed})`);
  }
  
  console.log(`📊 [${runId}] Test sonucu güncellendi: ${testType} - ${status} (${platform})`);
  console.log(`📈 [${runId}] Canlı durum: Toplam: ${counters.total}, Başarılı: ${counters.passed}, Başarısız: ${counters.failed}`);
  
  // WebSocket ile canlı güncelleme gönder (retry ile)
  sendWebSocketUpdate(runId, {
    type: 'test_result_updated',
    runId,
    metrics: {
      totalTests: counters.total,
      success: counters.passed,
      failed: counters.failed,
      web: counters.web,
      mobile: counters.mobile
    },
    timestamp: now.toISOString()
  });
};

// WebSocket güncelleme gönder (retry ile)
const sendWebSocketUpdate = (runId, data, retryCount = 0) => {
  if (!io) {
    console.log('⚠️ WebSocket mevcut değil');
    return;
  }
  
  try {
    io.emit('dashboard_update', data);
    console.log(`📡 [${runId}] WebSocket güncelleme gönderildi (retry: ${retryCount})`);
  } catch (error) {
    console.error(`❌ [${runId}] WebSocket hatası:`, error);
    
    // Retry mekanizması (3, 5, 10 sn)
    if (retryCount < 3) {
      const retryDelays = [3000, 5000, 10000];
      const delay = retryDelays[retryCount];
      
      console.log(`🔄 [${runId}] ${delay}ms sonra tekrar denenecek (${retryCount + 1}/3)`);
      setTimeout(() => {
        sendWebSocketUpdate(runId, data, retryCount + 1);
      }, delay);
    } else {
      console.error(`❌ [${runId}] WebSocket güncelleme başarısız (3 deneme)`);
    }
  }
};

// Run tamamlandığında kalıcı özete yaz
const finalizeRunResults = (runId) => {
  if (!activeRunCounters.has(runId)) {
    console.log(`⚠️ RunId bulunamadı: ${runId}`);
    return;
  }
  
  const counters = activeRunCounters.get(runId);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Kalıcı özete ekle
  persistentTestResults.total += counters.total;
  persistentTestResults.passed += counters.passed;
  persistentTestResults.failed += counters.failed;
  
  persistentTestResults.web.total += counters.web.total;
  persistentTestResults.web.passed += counters.web.passed;
  persistentTestResults.web.failed += counters.web.failed;
  
  persistentTestResults.mobile.total += counters.mobile.total;
  persistentTestResults.mobile.passed += counters.mobile.passed;
  persistentTestResults.mobile.failed += counters.mobile.failed;
  
  // Günlük trend verisini güncelle
  const todayIndex = persistentTestResults.dailyTrend.findIndex(day => day.date === today);
  if (todayIndex >= 0) {
    persistentTestResults.dailyTrend[todayIndex].passed += counters.passed;
    persistentTestResults.dailyTrend[todayIndex].failed += counters.failed;
    persistentTestResults.dailyTrend[todayIndex].total += counters.total;
  } else {
    persistentTestResults.dailyTrend.push({
      date: today,
      passed: counters.passed,
      failed: counters.failed,
      total: counters.total
    });
    
    // Son 7 günü tut
    if (persistentTestResults.dailyTrend.length > 7) {
      persistentTestResults.dailyTrend = persistentTestResults.dailyTrend.slice(-7);
    }
  }
  
  persistentTestResults.lastUpdated = now.toISOString();
  
  console.log(`📊 [${runId}] Run finalize edildi - Kalıcı özete eklendi`);
  console.log(`📈 Kalıcı durum: Toplam: ${persistentTestResults.total}, Başarılı: ${persistentTestResults.passed}, Başarısız: ${persistentTestResults.failed}`);
  
  // Aktif run sayaçlarını temizle
  activeRunCounters.delete(runId);
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    testResults: testResults
  });
});


// Barkod işleme endpoint'i - Mobil için
app.post('/api/scan', async (req, res) => {
  try {
    const { barcode, runId } = req.body;
    
    console.log(`📱 Barkod işleme: ${barcode} (runId: ${runId})`);
    
    // Barkod validasyonu
    if (!barcode || barcode.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz barkod formatı',
        reason: 'invalid_format'
      });
    }
    
    // ULD format kontrolü
    const uldRegex = /^ULD-[A-Z]{3}\d{5}[A-Z]{2}$/;
    const awbRegex = /^\d{3}-\d{8}$/;
    
    if (!uldRegex.test(barcode) && !awbRegex.test(barcode)) {
      return res.status(400).json({
        success: false,
        error: 'Geçersiz barkod formatı',
        reason: 'invalid_format'
      });
    }
    
    // Başarılı işlem
    res.json({
      success: true,
      message: 'Barkod başarıyla işlendi',
      barcode,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Barkod işleme hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası',
      reason: 'server_5xx'
    });
  }
});

// ULD Overweight doğrulaması - Web için
app.post('/api/uld/validate', async (req, res) => {
  try {
    const { currentWeight, maxWeight } = req.body;
    
    console.log(`⚖️ ULD ağırlık doğrulaması: ${currentWeight}kg / ${maxWeight}kg`);
    
    // Backend'de aynı validasyonu tekrarla
    if (currentWeight > maxWeight) {
      return res.status(400).json({
        success: false,
        error: 'Ağırlık limiti aşıldı',
        overweight: {
          max: maxWeight,
          current: currentWeight,
          excess: currentWeight - maxWeight
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Ağırlık doğrulaması başarılı',
      weight: {
        current: currentWeight,
        max: maxWeight
      }
    });
    
  } catch (error) {
    console.error('❌ ULD doğrulama hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu hatası'
    });
  }
});

// Events endpoint - idempotent olay kaydetme
app.post('/api/events', async (req, res) => {
  try {
    const { runId, eventId, type, payload, source, tenant = 'demo' } = req.body;
    
    // Validation
    if (!runId || !eventId || !type || !source) {
      console.log(`[${new Date().toISOString()}] EVENT rejected - tenant:${tenant}, runId:${runId}, reason:missing_fields`);
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: runId, eventId, type, source' 
      });
    }
    
    // RunId mismatch kontrolü
    if (runId !== currentRunId) {
      console.log(`[${new Date().toISOString()}] EVENT rejected - tenant:${tenant}, runId:${runId}, reason:runId_mismatch, current:${currentRunId}`);
      return res.status(400).json({ 
        success: false, 
        error: 'runId_mismatch' 
      });
    }
    
    // Event'i kaydet (idempotent)
    const event = {
      eventId,
      runId,
      type,
      payload: payload || {},
      source,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    // Database'e kaydet (idempotent - aynı eventId varsa güncelle)
    await database.upsertEvent(event);
    
    // EVENT received log
    const accepted = payload?.accepted !== false;
    console.log(`[${new Date().toISOString()}] EVENT received - tenant:${tenant}, runId:${runId}, type:${type}, accepted:${accepted}, source:${source}`);
    
    // Run durumunu güncelle
    await updateRunState(runId, type, payload);
    
    res.json({ 
      success: true, 
      eventId,
      message: 'Event kaydedildi' 
    });
    
  } catch (error) {
    console.error('❌ Event kaydetme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Event kaydedilemedi' 
    });
  }
});

// Test sonuçlarını getir
app.get('/api/test-results', (req, res) => {
  res.json({
    total: testResults.total,
    passed: testResults.passed,
    failed: testResults.failed,
    successRate: testResults.total > 0 ? Math.round((testResults.passed / testResults.total) * 100) : 0,
    lastUpdated: testResults.lastUpdated,
    testHistory: testResults.testHistory.slice(-10) // Son 10 test
  });
});

// Anomalileri getir
app.get('/api/test-results/anomalies', (req, res) => {
  res.json(anomalies.slice(-5)); // Son 5 anomali
});

// AWB form kaydı - test sonucu olarak kaydet
app.post('/api/awb', (req, res) => {
  try {
    const { awbNumber, shipper, consignee, origin, destination } = req.body;
    
    // Basit validasyon
    if (!awbNumber || !shipper || !consignee) {
      updateTestResults('fail', 'AWB_FORM', { 
        error: 'Zorunlu alanlar eksik',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Zorunlu alanlar eksik',
        testResult: 'FAIL'
      });
    }
    
    // AWB numarası format kontrolü
    if (!/^\d{3}-\d{8}$/.test(awbNumber)) {
      updateTestResults('fail', 'AWB_FORM', { 
        error: 'Geçersiz AWB numarası formatı',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz AWB numarası formatı',
        testResult: 'FAIL'
      });
    }
    
    // Başarılı kayıt
    updateTestResults('pass', 'AWB_FORM', { 
      awbNumber,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: 'AWB başarıyla kaydedildi',
      testResult: 'PASS',
      data: {
        awbNumber,
        shipper,
        consignee,
        origin,
        destination,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    updateTestResults('fail', 'AWB_FORM', { 
      error: error.message,
      data: req.body 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası',
      testResult: 'FAIL',
      error: error.message
    });
  }
});

// Run progress endpoint - run boyunca event'leri toplar
app.post('/api/runs/progress', (req, res) => {
  try {
    const { runId, eventType, payload, timestamp } = req.body;
    
    if (!runProgress.has(runId)) {
      runProgress.set(runId, {
        runId,
        startTime: new Date().toISOString(),
        events: [],
        web: { pass: 0, fail: 0, total: 0 },
        mobile: { pass: 0, fail: 0, total: 0 },
        status: 'running'
      });
    }
    
    const progress = runProgress.get(runId);
    progress.events.push({
      eventType,
      payload,
      timestamp: timestamp || new Date().toISOString()
    });
    
    // Event tipine göre sayaçları güncelle
    if (eventType === 'web_try') {
      if (payload.success) {
        progress.web.pass++;
      } else {
        progress.web.fail++;
      }
      progress.web.total++;
    } else if (eventType === 'barcode_ok') {
      progress.mobile.pass++;
      progress.mobile.total++;
    } else if (eventType === 'barcode_fail') {
      progress.mobile.fail++;
      progress.mobile.total++;
    }
    
    console.log(`📊 Run progress güncellendi: ${runId} - ${eventType}`);
    
    res.json({
      success: true,
      message: 'Progress güncellendi',
      runId,
      eventType
    });
    
  } catch (error) {
    console.error('❌ Run progress hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Progress güncellenemedi',
      error: error.message
    });
  }
});

// Run finalize endpoint - HER DURUMDA çalışır
app.post('/api/runs/complete', (req, res) => {
  try {
    const { runId, status, completedAt, duration, tenant = 'demo' } = req.body;
    
    // COMPLETE issued log
    console.log(`[${new Date().toISOString()}] COMPLETE issued - tenant:${tenant}, runId:${runId}, status:${status}`);
    
    // Run progress'ten verileri al
    const progress = runProgress.get(runId);
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Run bulunamadı',
        runId
      });
    }
    
    // Finalize verilerini hazırla
    const runData = {
      runId,
      status: status || 'success',
      web: progress.web,
      mobile: progress.mobile,
      completedAt: completedAt || new Date().toISOString(),
      duration: duration || (new Date() - new Date(progress.startTime)) / 1000,
      events: progress.events
    };
    
    // Test sonuçlarını atomik olarak güncelle
    const totalTests = runData.web.total + runData.mobile.total;
    const totalPassed = runData.web.pass + runData.mobile.pass;
    const totalFailed = runData.web.fail + runData.mobile.fail;
    
    if (totalTests > 0) {
      testResults.total += totalTests;
      testResults.passed += totalPassed;
      testResults.failed += totalFailed;
      testResults.lastUpdated = new Date().toISOString();
      
      // Web ve mobil ayrı ayrı güncelle
      testResults.web.total += runData.web.total;
      testResults.web.passed += runData.web.pass;
      testResults.web.failed += runData.web.fail;
      
      testResults.mobile.total += runData.mobile.total;
      testResults.mobile.passed += runData.mobile.pass;
      testResults.mobile.failed += runData.mobile.fail;
    }
    
    // Run'ı tamamlandı olarak işaretle
    progress.status = runData.status;
    
    // Dashboard'ı güncelle
    updateDashboardSummary();
    
    // Summary cache'i temizle
    dashboardSummary.lastUpdated = new Date().toISOString();
    
    // WebSocket ile dashboard_update yayınla
    if (io) {
      io.emit('dashboard_update', {
        type: 'run_completed',
        runId: runData.runId,
        status: runData.status,
        web: runData.web,
        mobile: runData.mobile,
        totalTests,
        totalPassed,
        totalFailed,
        timestamp: new Date().toISOString()
      });
      
      // DASHBOARD_UPDATE pushed log
      console.log(`[${new Date().toISOString()}] DASHBOARD_UPDATE pushed - tenant:${tenant}, runId:${runId}, totalTests:${totalTests}, totalPassed:${totalPassed}, totalFailed:${totalFailed}`);
    }
    
    console.log(`✅ Run finalize edildi: ${runId} - Toplam: ${testResults.total}, Başarılı: ${testResults.passed}, Başarısız: ${testResults.failed}`);
    
    res.json({
      success: true,
      message: 'Run başarıyla finalize edildi',
      runId,
      status: runData.status,
      metrics: {
        totalTests: testResults.total,
        success: testResults.passed,
        failed: testResults.failed,
        successRate: testResults.total > 0 ? Math.round((testResults.passed / testResults.total) * 100) : 0
      }
    });
    
  } catch (error) {
    console.error('❌ Run finalize hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Run finalize edilemedi',
      error: error.message
    });
  }
});

// ULD form kaydı - test sonucu olarak kaydet
app.post('/api/uld', (req, res) => {
  try {
    const { uldCode, uldType, currentWeight, maxWeight, runId } = req.body;
    
    // Basit validasyon
    if (!uldCode || !uldType) {
      updateTestResults('fail', 'ULD_FORM', { 
        error: 'Zorunlu alanlar eksik',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Zorunlu alanlar eksik',
        testResult: 'FAIL'
      });
    }
    
    // ULD kodu format kontrolü
    if (!/^[A-Z]{3}\d{5}[A-Z]{2}$/.test(uldCode)) {
      updateTestResults('fail', 'ULD_FORM', { 
        error: 'Geçersiz ULD kodu formatı',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz ULD kodu formatı',
        testResult: 'FAIL'
      });
    }
    
    // Overweight kontrolü - Yüklenebilir ağırlık kontrolü
    const { allowable } = req.body;
    if (currentWeight && allowable && currentWeight > allowable) {
      updateTestResults('fail', 'ULD_FORM', { 
        error: 'Overweight: Mevcut ağırlık yüklenebilir limiti aşıyor',
        data: req.body,
        overweight: {
          currentWeight,
          allowable,
          excess: currentWeight - allowable
        }
      });
      
      // 2) Web Aşaması - Overweight hatası
      if (runId) {
        // Web testi başarısız olarak işaretle
        runStatus.web.status = 'failed';
        runStatus.web.fail += 1;
        runStatus.web.total += 1;
        
        // web_overweight_fail event'ini canlı kanala gönder
        broadcastToRun(runId, {
          type: 'web_overweight_fail',
          runId,
          reason: 'Kapasite aşımı hatası',
          currentWeight,
          allowable,
          excess: currentWeight - allowable
        });
      }
      
      return res.status(400).json({ 
        success: false, 
        message: `Kayıt başarısız: Mevcut ağırlık (${currentWeight} kg), kapasite (${allowable} kg) değerini aşıyor.`,
        testResult: 'FAIL',
        overweight: true
      });
    }
    
    // Ağırlık kontrolü (maxWeight)
    if (currentWeight && maxWeight && currentWeight > maxWeight) {
      updateTestResults('fail', 'ULD_FORM', { 
        error: 'Mevcut ağırlık maksimum ağırlığı aşıyor',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Mevcut ağırlık maksimum ağırlığı aşıyor',
        testResult: 'FAIL'
      });
    }
    
    // Başarılı kayıt
    updateTestResults('pass', 'ULD_FORM', { 
      uldCode,
      uldType,
      timestamp: new Date().toISOString()
    });
    
    // Web testi başarılı olarak işaretle
    if (runId) {
      runStatus.web.status = 'done';
      runStatus.web.pass += 1;
      runStatus.web.total += 1;
    }
    
    res.json({ 
      success: true, 
      message: 'ULD başarıyla kaydedildi',
      testResult: 'PASS',
      data: {
        uldCode,
        uldType,
        currentWeight,
        maxWeight,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    updateTestResults('fail', 'ULD_FORM', { 
      error: error.message,
      data: req.body 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası',
      testResult: 'FAIL',
      error: error.message
    });
  }
});

// DG form kaydı - test sonucu olarak kaydet
app.post('/api/dg', (req, res) => {
  try {
    const { unNumber, dgClass, packingGroup, quantity } = req.body;
    
    // Basit validasyon
    if (!unNumber || !dgClass || !packingGroup || !quantity) {
      updateTestResults('fail', 'DG_FORM', { 
        error: 'Zorunlu alanlar eksik',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Zorunlu alanlar eksik',
        testResult: 'FAIL'
      });
    }
    
    // UN numarası format kontrolü
    if (!/^UN\d{4}$/.test(unNumber)) {
      updateTestResults('fail', 'DG_FORM', { 
        error: 'Geçersiz UN numarası formatı',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Geçersiz UN numarası formatı',
        testResult: 'FAIL'
      });
    }
    
    // Miktar kontrolü
    if (quantity <= 0) {
      updateTestResults('fail', 'DG_FORM', { 
        error: 'Miktar pozitif olmalı',
        data: req.body 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Miktar pozitif olmalı',
        testResult: 'FAIL'
      });
    }
    
    // Başarılı kayıt
    updateTestResults('pass', 'DG_FORM', { 
      unNumber,
      dgClass,
      packingGroup,
      quantity,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: 'DG formu başarıyla kaydedildi',
      testResult: 'PASS',
      data: {
        unNumber,
        dgClass,
        packingGroup,
        quantity,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    updateTestResults('fail', 'DG_FORM', { 
      error: error.message,
      data: req.body 
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası',
      testResult: 'FAIL',
      error: error.message
    });
  }
});

// Test sonuçlarını manuel güncelle
app.post('/api/test-results/update', (req, res) => {
  const { status, testType, details } = req.body;
  
  if (status && testType) {
    updateTestResults(status, testType, details);
    res.json({ 
      success: true, 
      message: 'Test sonucu güncellendi',
      currentStats: testResults
    });
  } else {
    res.status(400).json({ 
      success: false, 
      message: 'Status ve testType gerekli' 
    });
  }
});

// Test sonuçlarını manuel artır (demo için)
app.post('/api/test-results/increment', (req, res) => {
  const { type = 'pass', count = 1, platform = 'all' } = req.body;
  
  for (let i = 0; i < count; i++) {
    updateTestResults(type, 'MANUAL_TEST', { 
      source: 'manual_increment',
      platform: platform,
      timestamp: new Date().toISOString()
    });
  }
  
  res.json({ 
    success: true, 
    message: `${count} adet ${type} test sonucu eklendi (${platform})`,
    currentStats: testResults
  });
});


// Control Panel endpoints
app.post('/api/control/offline-mode', (req, res) => {
  res.json({ success: true, message: 'Offline mode updated' });
});

app.post('/api/control/generate-barcode', (req, res) => {
  res.json({ success: true, message: 'Barcode generated' });
});

app.post('/api/control/process-queue', (req, res) => {
  res.json({ success: true, message: 'Queue processed' });
});

app.post('/api/control/clear-queue', (req, res) => {
  res.json({ success: true, message: 'Queue cleared' });
});

// 🎯 ORTAK SAYAÇ API - Mobil & Web Senkronizasyon
let globalCounters = {
  Q: 0,     // Kuyruk sayısı
  P: 0,     // İşleniyor sayısı  
  T: 0,     // Toplam başarılı işlem (24 saat)
  offline: false // Offline modu
};

// Sayaçları getir (mobil & web)
app.get('/api/counters', (req, res) => {
  res.json({
    success: true,
    counters: globalCounters,
    timestamp: new Date().toISOString()
  });
});

// Sayaçları güncelle (mobil & web)
app.post('/api/counters', (req, res) => {
  const { Q, P, T, offline } = req.body;
  
  if (Q !== undefined) globalCounters.Q = Q;
  if (P !== undefined) globalCounters.P = P;
  if (T !== undefined) globalCounters.T = T;
  if (offline !== undefined) globalCounters.offline = offline;
  
  res.json({
    success: true,
    counters: globalCounters,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/control/queue-count', (req, res) => {
  res.json({ count: globalCounters.Q });
});

// Mobil Uygulama Endpoint'leri
app.post('/api/scan', (req, res) => {
  try {
    const { barcode, type, deviceId, offlineQueueId } = req.body;
    
    if (!barcode || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Barkod ve tip gerekli' 
      });
    }
    
    // Barkod tarama sonucu
    updateTestResults('pass', 'BARCODE_SCAN', { 
      barcode, 
      type, 
      deviceId,
      offlineQueueId 
    });
    
    // Sayaçları güncelle
    globalCounters.T++;
    
    res.json({ 
      success: true, 
      message: 'Barkod başarıyla tarandı',
      barcode,
      type,
      counters: globalCounters,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Barkod tarama hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

app.post('/api/awb/acceptance', (req, res) => {
  try {
    const { awbNumber, pieces, weight, deviceId, offlineQueueId } = req.body;
    
    if (!awbNumber || !pieces || !weight) {
      return res.status(400).json({ 
        success: false, 
        message: 'AWB numarası, parça sayısı ve ağırlık gerekli' 
      });
    }
    
    // AWB kabul sonucu
    updateTestResults('pass', 'AWB_ACCEPTANCE', { 
      awbNumber, 
      pieces, 
      weight, 
      deviceId,
      offlineQueueId 
    });
    
    res.json({ 
      success: true, 
      message: 'AWB kabul edildi',
      awbNumber,
      pieces,
      weight,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('AWB kabul hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

app.post('/api/uld/loading', (req, res) => {
  try {
    const { uldCode, cargoType, weight, deviceId, offlineQueueId } = req.body;
    
    if (!uldCode || !cargoType || !weight) {
      return res.status(400).json({ 
        success: false, 
        message: 'ULD kodu, kargo tipi ve ağırlık gerekli' 
      });
    }
    
    // ULD yükleme sonucu
    updateTestResults('pass', 'ULD_LOADING', { 
      uldCode, 
      cargoType, 
      weight, 
      deviceId,
      offlineQueueId 
    });
    
    res.json({ 
      success: true, 
      message: 'ULD yükleme kaydedildi',
      uldCode,
      cargoType,
      weight,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('ULD yükleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

app.post('/api/dg/control', (req, res) => {
  try {
    const { unNumber, dgClass, status, deviceId, offlineQueueId } = req.body;
    
    if (!unNumber || !dgClass || !status) {
      return res.status(400).json({ 
        success: false, 
        message: 'UN numarası, DG sınıfı ve durum gerekli' 
      });
    }
    
    // DG kontrol sonucu
    updateTestResults('pass', 'DG_CONTROL', { 
      unNumber, 
      dgClass, 
      status, 
      deviceId,
      offlineQueueId 
    });
    
    res.json({ 
      success: true, 
      message: 'DG kontrol tamamlandı',
      unNumber,
      dgClass,
      status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('DG kontrol hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

app.post('/api/photo', (req, res) => {
  try {
    const { photoData, description, deviceId, offlineQueueId } = req.body;
    
    if (!photoData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Fotoğraf verisi gerekli' 
      });
    }
    
    // Fotoğraf kaydetme sonucu
    updateTestResults('pass', 'PHOTO_CAPTURE', { 
      description, 
      deviceId,
      offlineQueueId 
    });
    
    res.json({ 
      success: true, 
      message: 'Fotoğraf kaydedildi',
      description,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Fotoğraf kaydetme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

app.post('/api/signature', (req, res) => {
  try {
    const { signatureData, purpose, deviceId, offlineQueueId } = req.body;
    
    if (!signatureData || !purpose) {
      return res.status(400).json({ 
        success: false, 
        message: 'İmza verisi ve amaç gerekli' 
      });
    }
    
    // İmza kaydetme sonucu
    updateTestResults('pass', 'SIGNATURE', { 
      purpose, 
      deviceId,
      offlineQueueId 
    });
    
    res.json({ 
      success: true, 
      message: 'İmza kaydedildi',
      purpose,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('İmza kaydetme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Sunucu hatası' 
    });
  }
});

// Stats update endpoint (eski uyumluluk için)
app.post('/api/stats/update', (req, res) => {
  const { totalTests, passedTests, failedTests } = req.body;
  
  if (totalTests !== undefined) {
    testResults.total = totalTests;
  }
  if (passedTests !== undefined) {
    testResults.passed = passedTests;
  }
  if (failedTests !== undefined) {
    testResults.failed = failedTests;
  }
  
  testResults.lastUpdated = new Date().toISOString();
  
  res.json({ 
    success: true, 
    message: 'Stats updated',
    currentStats: testResults
  });
});

// ==================== YENİ API ENDPOINT'LERİ ====================

// 1) Koşumu Başlat (Dashboard) - POST /api/run/start
app.post('/api/run/start', (req, res) => {
  try {
    // Yeni runId üret (tek doğruluk kaynağı)
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Canlı sayaçları sıfırla
    activeRunCounters.set(runId, {
      total: 0,
      passed: 0,
      failed: 0,
      web: { total: 0, passed: 0, failed: 0 },
      mobile: { total: 0, passed: 0, failed: 0 }
    });
    
    // Run durumunu başlat
    runStatus = {
      currentRunId: runId,
      status: 'STARTING',
      startedAt: new Date(),
      web: { status: 'idle', pass: 0, fail: 0, total: 0 },
      mobile: { status: 'idle', pass: 0, fail: 0, total: 0 }
    };
    
    // Run'ı kaydet
    activeRuns.set(runId, {
      id: runId,
      status: 'STARTING',
      startedAt: new Date(),
      web: { status: 'idle', pass: 0, fail: 0, total: 0 },
      mobile: { status: 'idle', pass: 0, fail: 0, total: 0 }
    });
    
    currentRunId = runId;
    
    console.log(`🚀 [RunId] Yeni run başlatıldı: ${runId}`);
    
    // run_started event'ini canlı kanala gönder
    broadcastToRun(runId, {
      type: 'run_started',
      runId,
      ts: new Date().toISOString()
    });
    
    // Toast: Test başlıyor
    broadcastToRun(runId, {
      type: 'toast',
      message: '🚀 Test başlıyor…',
      duration: 2000
    });
    
    // Toast: RunId hazır
    setTimeout(() => {
      broadcastToRun(runId, {
        type: 'toast',
        message: '🆔 RunId hazır',
        duration: 2000
      });
    }, 500);
    
    res.status(201).json({ runId });
  } catch (error) {
    console.error('Run başlatma hatası:', error);
    res.status(500).json({ error: 'Run başlatılamadı' });
  }
});

// Canlı kanal yönetimi - WebSocket
const broadcastToRun = (runId, event) => {
  const channel = liveChannels.get(runId);
  if (channel) {
    channel.forEach(socket => {
      try {
        socket.emit('live_event', event);
      } catch (error) {
        console.error('Canlı kanal gönderim hatası:', error);
        channel.delete(socket);
      }
    });
  }
};

// 3) Web→Mobil Geçiş Onayı - POST /mobile-phase-request
app.post('/api/mobile-phase-request', (req, res) => {
  try {
    const { runId } = req.body;
    
    if (!runId) {
      return res.status(400).json({ error: 'runId gerekli' });
    }
    
    console.log(`📱 Mobil aşama isteği: ${runId}`);
    
    // mobile_phase_requested event'ini canlı kanala gönder
    broadcastToRun(runId, {
      type: 'mobile_phase_requested',
      runId,
      ts: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: 'Mobil aşama isteği alındı',
      runId 
    });
  } catch (error) {
    console.error('Mobil aşama isteği hatası:', error);
    res.status(500).json({ error: 'Mobil aşama isteği işlenemedi' });
  }
});

// 4) Appium Bağlantısı - GET /appium/status
app.get('/api/appium/status', (req, res) => {
  try {
    // Appium durumu simülasyonu
    const isConnected = Math.random() > 0.3; // %70 bağlantı olasılığı
    
    res.json({
      success: true,
      connected: isConnected,
      port: 4723,
      status: isConnected ? 'Bağlı' : 'Kopuk',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Appium durum kontrolü hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Appium durumu kontrol edilemedi' 
    });
  }
});

// 5) Mobil Barkod - ONLINE - POST /barcode-scanned
app.post('/api/barcode-scanned', (req, res) => {
  try {
    const { runId, code, mode = 'online' } = req.body;
    
    if (!runId || !code) {
      return res.status(400).json({ error: 'runId ve code gerekli' });
    }
    
    console.log(`📱 Barkod tarandı: ${code} (${mode})`);
    
    // Barkod doğrulama simülasyonu
    const isValid = /^ULD-[A-Z]{3}\d{5}[A-Z]{2}$/.test(code) || 
                   /^\d{3}-\d{8}$/.test(code) || 
                   /^TEST-\d{5}$/.test(code);
    
    if (isValid) {
      // Başarılı barkod
      runStatus.mobile.pass += 1;
      runStatus.mobile.total += 1;
      
      broadcastToRun(runId, {
        type: 'barcode_ok',
        runId,
        code,
        mode
      });
      
      res.json({ 
        success: true, 
        message: 'Barkod başarıyla okundu',
        code,
        mode
      });
    } else {
      // Başarısız barkod
      runStatus.mobile.fail += 1;
      runStatus.mobile.total += 1;
      
      broadcastToRun(runId, {
        type: 'barcode_fail',
        runId,
        code,
        reason: 'Geçersiz barkod formatı',
        mode
      });
      
      res.status(400).json({ 
        success: false, 
        message: 'Geçersiz barkod formatı',
        code,
        mode
      });
    }
  } catch (error) {
    console.error('Barkod tarama hatası:', error);
    res.status(500).json({ error: 'Barkod tarama işlenemedi' });
  }
});

// 6) Mobil Barkod - OFFLINE - POST /barcode-bulk-process
app.post('/api/barcode-bulk-process', (req, res) => {
  try {
    const { runId, items } = req.body;
    
    if (!runId || !Array.isArray(items)) {
      return res.status(400).json({ error: 'runId ve items gerekli' });
    }
    
    console.log(`📱 Toplu barkod işleme: ${items.length} adet`);
    
    const results = {
      ok: [],
      fail: []
    };
    
    items.forEach(item => {
      const isValid = /^ULD-[A-Z]{3}\d{5}[A-Z]{2}$/.test(item.code) || 
                     /^\d{3}-\d{8}$/.test(item.code) || 
                     /^TEST-\d{5}$/.test(item.code);
      
      if (isValid) {
        results.ok.push(item);
        runStatus.mobile.pass += 1;
      } else {
        results.fail.push({ ...item, reason: 'Geçersiz format' });
        runStatus.mobile.fail += 1;
      }
    });
    
    runStatus.mobile.total += items.length;
    
    // Toplu sonuç event'ini gönder
    broadcastToRun(runId, {
      type: 'barcode_bulk_result',
      runId,
      ok: results.ok,
      fail: results.fail
    });
    
    res.json({ 
      success: true, 
      message: 'Toplu barkod işleme tamamlandı',
      results
    });
  } catch (error) {
    console.error('Toplu barkod işleme hatası:', error);
    res.status(500).json({ error: 'Toplu barkod işleme başarısız' });
  }
});

// 7) Mobil Testi Bitir - POST /mobile-test-completed
app.post('/api/mobile-test-completed', (req, res) => {
  try {
    const { runId } = req.body;
    
    if (!runId) {
      return res.status(400).json({ error: 'runId gerekli' });
    }
    
    console.log(`📱 Mobil test tamamlandı: ${runId}`);
    
    // Mobil testi tamamlandı olarak işaretle
    runStatus.mobile.status = 'done';
    
    broadcastToRun(runId, {
      type: 'mobile_test_completed',
      runId,
      ts: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      message: 'Mobil test tamamlandı',
      runId 
    });
  } catch (error) {
    console.error('Mobil test tamamlama hatası:', error);
    res.status(500).json({ error: 'Mobil test tamamlanamadı' });
  }
});

// 8) Koşumu Tamamla - POST /api/run/complete
app.post('/api/run/complete', (req, res) => {
  try {
    const { runId } = req.body;
    
    if (!runId) {
      return res.status(400).json({ error: 'runId gerekli' });
    }
    
    console.log(`🎯 Run tamamlandı: ${runId}`);
    
    // Run'ı tamamlandı olarak işaretle
    runStatus.status = 'COMPLETED';
    
    // Kalıcı özete yaz
    finalizeRunResults(runId);
    
    // Özet oluştur
    const summary = {
      runId,
      web: runStatus.web,
      mobile: runStatus.mobile,
      totalTests: runStatus.web.total + runStatus.mobile.total,
      totalPassed: runStatus.web.pass + runStatus.mobile.pass,
      totalFailed: runStatus.web.fail + runStatus.mobile.fail,
      completedAt: new Date().toISOString()
    };
    
    // run_completed event'ini gönder
    broadcastToRun(runId, {
      type: 'run_completed',
      runId,
      summary
    });
    
    // Toast: Test tamamlandı
    broadcastToRun(runId, {
      type: 'toast',
      message: '✅ Test tamamlandı',
      duration: 2000
    });
    
    // Toast: Sonuçlar güncellendi
    setTimeout(() => {
      broadcastToRun(runId, {
        type: 'toast',
        message: '📈 Sonuçlar güncellendi',
        duration: 2000
      });
    }, 1000);
    
    res.json({ 
      success: true, 
      message: 'Run tamamlandı',
      summary 
    });
  } catch (error) {
    console.error('Run tamamlama hatası:', error);
    res.status(500).json({ error: 'Run tamamlanamadı' });
  }
});

// Test Orchestration API
app.post('/api/tests/start', async (req, res) => {
  try {
    const { platform = 'both', tenant = 'demo' } = req.body;
    const testId = uuidv4();
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // START issued log
    console.log(`[${new Date().toISOString()}] START issued - tenant:${tenant}, runId:${runId}, platform:${platform}`);
    
    // RunId'yi global olarak set et
    currentRunId = runId;
    
    // ULD Form Testi için özel işlem
    if (platform === 'both' || platform === 'web') {
      console.log('🌐 [ULD Test] Web testi başlatılıyor...');
      
      // Toast: Web testi başlatılıyor
      broadcastToRun(runId, {
        type: 'toast',
        message: '🌐 Web testi başlatılıyor…',
        duration: 2000
      });
      
      // Web testi başlat
      const webResult = await browserTest.startWebTest();
      
      if (webResult.success) {
        console.log('✅ [ULD Test] Web testi başarıyla başlatıldı');
        
        // Toast: Sayfa açılıyor
        setTimeout(() => {
          broadcastToRun(runId, {
            type: 'toast',
            message: '🧭 Sayfa açılıyor',
            duration: 2000
          });
        }, 2000);
        
        // Toast: ULD formu açıldı
        setTimeout(() => {
          broadcastToRun(runId, {
            type: 'toast',
            message: '📄 ULD formu açıldı',
            duration: 2000
          });
        }, 5000);
        
        // Toast: Form alanları dolduruluyor
        setTimeout(() => {
          broadcastToRun(runId, {
            type: 'toast',
            message: '✍️ Form alanları dolduruluyor',
            duration: 2000
          });
        }, 8000);
        
        // Toast: Validasyon çalıştırılıyor
        setTimeout(() => {
          broadcastToRun(runId, {
            type: 'toast',
            message: '🧪 Validasyon çalıştırılıyor',
            duration: 2000
          });
        }, 12000);
        
        // Web testi tamamlandıktan sonra mobil testi başlat
        setTimeout(async () => {
          console.log('📱 [ULD Test] Mobil testi başlatılıyor...');
          
          // Toast: Web başarılı
          broadcastToRun(runId, {
            type: 'toast',
            message: '✅ Web başarılı',
            duration: 2000
          });
          
          // Toast: Mobil teste geçiliyor
          setTimeout(() => {
            broadcastToRun(runId, {
              type: 'toast',
              message: '📱 Mobil teste geçiliyor…',
              duration: 2000
            });
          }, 2000);
          
          // Toast: Emülatör açılıyor
          setTimeout(() => {
            broadcastToRun(runId, {
              type: 'toast',
              message: '🖥️ Emülatör açılıyor',
              duration: 2000
            });
          }, 4000);
          
          // Toast: Uygulama açılıyor
          setTimeout(() => {
            broadcastToRun(runId, {
              type: 'toast',
              message: '📦 Uygulama açılıyor',
              duration: 2000
            });
          }, 6000);
          
          // Toast: Barkod ekranına gidildi
          setTimeout(() => {
            broadcastToRun(runId, {
              type: 'toast',
              message: '🧭 Barkod ekranına gidildi',
              duration: 2000
            });
          }, 8000);
          
          // Toast: Barkod okutma başlıyor
          setTimeout(() => {
            broadcastToRun(runId, {
              type: 'toast',
              message: '📷 Barkod okutma başlıyor',
              duration: 2000
            });
          }, 10000);
          
          // Toast: Kod giriliyor
          setTimeout(() => {
            broadcastToRun(runId, {
              type: 'toast',
              message: '🔢 Kod giriliyor (TEST-12345)',
              duration: 2000
            });
          }, 12000);
          
          // Toast: Barkod okundu
          setTimeout(() => {
            broadcastToRun(runId, {
              type: 'toast',
              message: '✅ Barkod okundu',
              duration: 2000
            });
          }, 14000);
          
          // Mobil testi başlat (simüle edilmiş)
          automationStatus.mobileStatus = 'running';
          updateDashboardSummary();
          
          // Mobil testi simüle et
          setTimeout(() => {
            // %80 başarı olasılığı
            const isSuccess = Math.random() > 0.2;
            
            if (isSuccess) {
              automationStatus.mobileStatus = 'done';
              updateDashboardSummary();
              console.log('✅ [ULD Test] Mobil testi tamamlandı');
              
              // Toast: Mobil başarılı
              broadcastToRun(runId, {
                type: 'toast',
                message: '✅ Mobil başarılı',
                duration: 2000
              });
            } else {
              automationStatus.mobileStatus = 'failed';
              updateDashboardSummary();
              console.log('❌ [ULD Test] Mobil testi başarısız');
              
              // Toast: Mobil başarısız
              broadcastToRun(runId, {
                type: 'toast',
                message: '❌ Mobil başarısız',
                duration: 2000
              });
            }
            
            // Toast: Dashboard güncelleniyor
            setTimeout(() => {
              broadcastToRun(runId, {
                type: 'toast',
                message: '📊 Dashboard güncelleniyor…',
                duration: 2000
              });
            }, 2000);
            
            // Toast: Skorlar hesaplanıyor
            setTimeout(() => {
              broadcastToRun(runId, {
                type: 'toast',
                message: '🧮 Skorlar hesaplanıyor',
                duration: 2000
              });
            }, 4000);
            
            // Toast: Test tamamlandı
            setTimeout(() => {
              broadcastToRun(runId, {
                type: 'toast',
                message: '✅ Test tamamlandı',
                duration: 2000
              });
            }, 6000);
            
            // Toast: Sonuçlar güncellendi
            setTimeout(() => {
              broadcastToRun(runId, {
                type: 'toast',
                message: '📈 Sonuçlar güncellendi',
                duration: 2000
              });
            }, 8000);
          }, 15000); // 15 saniye sonra tamamla
          
        }, 20000); // Web testi 20 saniye sonra tamamla
        
        automationStatus.webStatus = 'running';
        updateDashboardSummary();
      } else {
        console.log('❌ [ULD Test] Web testi başlatılamadı:', webResult.error);
        automationStatus.webStatus = 'failed';
        updateDashboardSummary();
        
        // Toast: Web başarısız
        broadcastToRun(runId, {
          type: 'toast',
          message: '❌ Web başarısız',
          duration: 2000
        });
      }
    }
    
    res.json({
      success: true,
      testId,
      runId,
      tenant,
      platform,
      status: 'started',
      message: 'ULD Form Testi başlatıldı'
    });
    
    // Test senaryosu: web_fail + mob_ok + complete
    setTimeout(async () => {
      // 1. Web overweight event (fail)
      await fetch(`http://localhost:3001/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          eventId: `web_overweight_${Date.now()}`,
          type: 'web_overweight_fail',
          payload: { accepted: false, reason: 'Kapasite aşımı' },
          source: 'web',
          tenant
        })
      });
      
      // 2. Mobile barcode_ok event (pass)
      await fetch(`http://localhost:3001/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          eventId: `mobile_barcode_${Date.now()}`,
          type: 'barcode_ok',
          payload: { accepted: true, barcode: 'TEST-12345' },
          source: 'mobile',
          tenant
        })
      });
      
      // 3. Complete run
      setTimeout(async () => {
        await fetch(`http://localhost:3001/api/runs/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runId,
            status: 'completed',
            tenant
          })
        });
      }, 1000);
    }, 2000);
  } catch (error) {
    console.error('Test başlatma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Test başlatılamadı',
      error: error.message
    });
  }
});

// Test durumu getir
app.get('/api/tests/:testId/status', (req, res) => {
  const { testId } = req.params;
  const testStatus = testOrchestration.getTestStatus(testId);
  
  if (!testStatus) {
    return res.status(404).json({
      success: false,
      message: 'Test bulunamadı'
    });
  }
  
  res.json({
    success: true,
    testStatus
  });
});

// ULD Form Testi için özel endpoint
app.post('/api/tests/uld-form', async (req, res) => {
  try {
    console.log('🎬 [ULD Form Test] Başlatılıyor...');
    
    // Web testi başlat
    const webResult = await browserTest.startWebTest();
    
    if (webResult.success) {
      console.log('✅ [ULD Form Test] Web testi başarıyla başlatıldı');
      
      // Dashboard durumunu güncelle
      automationStatus.webStatus = 'running';
      automationStatus.currentRun = 'uld-form-test';
      updateDashboardSummary();
      
        // Web testi tamamlandıktan sonra mobil testi başlat
        setTimeout(async () => {
          console.log('📱 [ULD Form Test] Mobil testi başlatılıyor...');
          
          // Mobil testi başlat (simüle edilmiş)
          automationStatus.mobileStatus = 'running';
          updateDashboardSummary();
          
          // Mobil testi simüle et
          setTimeout(() => {
            automationStatus.mobileStatus = 'done';
            automationStatus.webStatus = 'done';
            updateDashboardSummary();
            console.log('✅ [ULD Form Test] Tüm testler tamamlandı');
          }, 40000); // 40 saniye sonra tamamla
          
        }, 45000); // Web testi 45 saniye sonra tamamla
      
      res.json({
        success: true,
        message: 'ULD Form Testi başlatıldı',
        webTest: webResult,
        expectedDuration: '85 saniye (Web: 45s + Mobil: 40s)'
      });
    } else {
      console.log('❌ [ULD Form Test] Web testi başlatılamadı:', webResult.error);
      automationStatus.webStatus = 'failed';
      updateDashboardSummary();
      
      res.status(500).json({
        success: false,
        message: 'ULD Form Testi başlatılamadı',
        error: webResult.error
      });
    }
  } catch (error) {
    console.error('ULD Form Testi hatası:', error);
    res.status(500).json({
      success: false,
      message: 'ULD Form Testi başlatılamadı',
      error: error.message
    });
  }
});

// Test iptal et
app.post('/api/tests/:testId/cancel', (req, res) => {
  const { testId } = req.params;
  const cancelled = testOrchestration.cancelTest(testId);
  
  if (cancelled) {
    res.json({
      success: true,
      message: 'Test iptal edildi'
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Test bulunamadı'
    });
  }
});

// Aktif testleri getir
app.get('/api/tests/active', (req, res) => {
  const activeTests = testOrchestration.getActiveTests();
  res.json({
    success: true,
    activeTests
  });
});

// Demo Steps API - EventSource
app.get('/api/demo-steps', (req, res) => {
  // Demo log kaldırıldı
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Client'i kaydet
  const clientId = Date.now();
  demoStepClients.add({ id: clientId, res });
  
  // Bağlantı koptuğunda temizle
  req.on('close', () => {
    demoStepClients.delete({ id: clientId, res });
    // Demo log kaldırıldı
  });

  // İlk mesaj - sadece bağlantı kurulduğunu belirt
  res.write(`data: ${JSON.stringify({
    icon: '⏳',
    title: 'Demo Bekleniyor',
    description: 'Test başlatıldığında demo adımları burada görünecek...',
    type: 'waiting'
  })}\n\n`);
});

// Demo Step ekleme endpoint
app.post('/api/demo-steps', (req, res) => {
  const { icon, title, description, type = 'info' } = req.body;
  
  console.log(`🧪 [Demo] Adım eklendi: ${title}`);
  
  const stepData = {
    icon: icon || '📝',
    title,
    description,
    type
  };

  // Tüm bağlı client'lara gönder
  demoStepClients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify(stepData)}\n\n`);
    } catch (error) {
      console.error('Demo step gönderim hatası:', error);
      demoStepClients.delete(client);
    }
  });

  res.json({ success: true, message: 'Demo step eklendi' });
});

// Otomasyon Başlatma API
app.post('/api/automation/start', async (req, res) => {
  try {
    // Eğer zaten bir test çalışıyorsa, yeni test başlatma
    if (automationStatus.webStatus === 'running' || automationStatus.mobileStatus === 'running') {
      console.log('⚠️ [Automation] Zaten bir test çalışıyor, yeni test başlatılamıyor');
      return res.status(409).json({
        success: false,
        message: 'Zaten bir test çalışıyor',
        currentRun: automationStatus.currentRun
      });
    }
    
    const runId = `run_${Date.now()}`;
    
    // Otomasyon durumunu sıfırla
    automationStatus = {
      currentRun: runId,
      webStatus: 'idle',
      mobileStatus: 'idle',
      finalSummaryReady: false
    };
    
    console.log(`🚀 [Automation] Başlatıldı: ${runId}`);
    
    // Web testini başlat
    setTimeout(async () => {
      automationStatus.webStatus = 'running';
      console.log('🌐 [Automation] Web testi başladı');
      
      // GERÇEK BROWSER TESTİ
      try {
        const result = await browserTest.startWebTest();
        
        if (result.success) {
          console.log('✅ [Automation] Web testi tamamlandı - Browser PID:', result.browserPid);
          automationStatus.webStatus = 'done';
          
          // Chrome'u kapat
          try {
            await browserTest.stopWebTest();
            console.log('🔒 [Browser] Chrome kapatıldı');
          } catch (error) {
            console.log('⚠️ [Browser] Chrome kapatma hatası:', error.message);
          }
          
          // Mobil testini başlat (sadece web başarılıysa) - HEMEN
          setTimeout(async () => {
            automationStatus.mobileStatus = 'running';
            console.log('📱 [Automation] Mobil testi başladı');
            
            // Mobil testi simülasyonu (30 saniye)
            setTimeout(async () => {
              automationStatus.mobileStatus = 'done';
              automationStatus.finalSummaryReady = true;
              console.log('✅ [Automation] Mobil testi tamamlandı - Final summary hazır');
              
              // Dashboard'ı güncelle
              await updateDashboardSummary();
              
              console.log('📊 [Automation] final_summary_ready=true - Frontend dashboard güncelleyebilir');
              
            }, 30000); // 30 saniye mobil test
          }, 500); // 0.5 saniye bekle - HEMEN geçiş
          
        } else {
          console.error('❌ [Automation] Web testi başarısız:', result.error);
          automationStatus.webStatus = 'failed';
          automationStatus.finalSummaryReady = true; // Hata durumunda da summary gönder
          await updateDashboardSummary();
        }
      } catch (error) {
        console.error('❌ [Automation] Web testi hatası:', error);
        automationStatus.webStatus = 'failed';
        automationStatus.finalSummaryReady = true; // Hata durumunda da summary gönder
        await updateDashboardSummary();
      }
    }, 1000); // 1 saniye bekle
    
    res.json({
      success: true,
      runId,
      message: 'Otomasyon başlatıldı'
    });
  } catch (error) {
    console.error('Otomasyon başlatma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Otomasyon başlatılamadı',
      error: error.message
    });
  }
});

// Otomasyon Durumu API
app.get('/api/automation/status', (req, res) => {
  res.json({
    success: true,
    status: automationStatus
  });
});


// Demo modu için yeni endpoint'ler
app.post('/api/demo/start', (req, res) => {
  if (!DEMO_MODE) {
    return res.status(400).json({ error: 'Demo modu kapalı' });
  }

  const runId = `demo_${Date.now()}_${++demoRunCounter}`;
  const startTime = Date.now();
  
  // Demo run'ı kaydet - sayaçları sıfırla
  demoRuns.set(runId, {
    startTime,
    timer: null,
    demoInjected: false
  });

  // Demo sonuçlarını sıfırla
  demoResults.set(runId, {
    web_status: null,
    web_duration_ms: null,
    mobile_status: null,
    mobile_duration_ms: null
  });

  // Aggregate store'u sıfırla
  aggregateStore = {
    total: 0,
    passed: 0,
    failed: 0,
    web: { total: 0, passed: 0, failed: 0 },
    mobile: { total: 0, passed: 0, failed: 0 }
  };

  console.log(`🎯 [Demo] Run başlatıldı: ${runId}`);

  console.log(`🎬 [Demo] Run başlatıldı: ${runId}, 90s sonra sonuçlar düşecek`);
  
  res.json({ 
    runId, 
    message: 'Demo test başlatıldı - 90 saniye sonra sonuçlar düşecek',
    demoMode: true
  });
});

// Web Testi Bitir endpoint'i
app.post('/api/demo/web-complete', (req, res) => {
  if (!DEMO_MODE) {
    return res.status(400).json({ error: 'Demo modu kapalı' });
  }

  const { runId, status, duration_ms } = req.body;
  
  if (!demoRuns.has(runId)) {
    return res.status(404).json({ error: 'Demo run bulunamadı' });
  }

  // Web sonucunu kaydet
  const results = demoResults.get(runId) || {};
  results.web_status = status || 'passed';
  results.web_duration_ms = duration_ms || Math.floor(Math.random() * 3000) + 2000; // 2-5 saniye
  demoResults.set(runId, results);

  console.log(`🌐 [Demo] Web testi tamamlandı: ${runId}, status: ${results.web_status}, duration: ${results.web_duration_ms}ms`);

  res.json({ 
    success: true,
    message: 'Web testi tamamlandı',
    web_status: results.web_status,
    web_duration_ms: results.web_duration_ms
  });
});

// Mobil Testi Bitir endpoint'i - KRİTİK TETİKLEYİCİ
app.post('/api/demo/mobile-complete', (req, res) => {
  if (!DEMO_MODE) {
    return res.status(400).json({ error: 'Demo modu kapalı' });
  }

  const { runId, status, duration_ms } = req.body;
  
  if (!demoRuns.has(runId)) {
    return res.status(404).json({ error: 'Demo run bulunamadı' });
  }

  // Mobil sonucunu kaydet
  const results = demoResults.get(runId) || {};
  results.mobile_status = status || 'passed';
  results.mobile_duration_ms = duration_ms || Math.floor(Math.random() * 2000) + 1500; // 1.5-3.5 saniye
  demoResults.set(runId, results);

  console.log(`📱 [Demo] Mobil testi tamamlandı: ${runId}, status: ${results.mobile_status}, duration: ${results.mobile_duration_ms}ms`);

  // KRİTİK: Mobil Testi Bitir'e basınca Dashboard'a dummy özet düşer
  generateDemoSummary(runId);

  res.json({ 
    success: true,
    message: 'Mobil testi tamamlandı',
    mobile_status: results.mobile_status,
    mobile_duration_ms: results.mobile_duration_ms
  });
});

// Demo özet üretme fonksiyonu - Mobil Testi Bitir'de çağrılır
function generateDemoSummary(runId) {
  const results = demoResults.get(runId);
  if (!results) return;

  const { web_status, web_duration_ms, mobile_status, mobile_duration_ms } = results;
  
  // Tümü filtresi için hesaplama
  const total = 1; // Her run için +1
  const passed = (web_status === 'passed' && mobile_status === 'passed') ? 1 : 0;
  const failed = total - passed;

  // Web filtresi için hesaplama
  const webTotal = 1;
  const webPassed = (web_status === 'passed') ? 1 : 0;
  const webFailed = webTotal - webPassed;

  // Mobil filtresi için hesaplama
  const mobileTotal = 1;
  const mobilePassed = (mobile_status === 'passed') ? 1 : 0;
  const mobileFailed = mobileTotal - mobilePassed;

  // Aggregate store'u güncelle
  aggregateStore = {
    total: aggregateStore.total + total,
    passed: aggregateStore.passed + passed,
    failed: aggregateStore.failed + failed,
    web: {
      total: aggregateStore.web.total + webTotal,
      passed: aggregateStore.web.passed + webPassed,
      failed: aggregateStore.web.failed + webFailed
    },
    mobile: {
      total: aggregateStore.mobile.total + mobileTotal,
      passed: aggregateStore.mobile.passed + mobilePassed,
      failed: aggregateStore.mobile.failed + mobileFailed
    }
  };

  // Ortalama süreleri güncelle
  dashboardSummary.avg_duration_ms_all = web_duration_ms || 0;
  dashboardSummary.avg_duration_ms_web = web_duration_ms || 0;
  dashboardSummary.avg_duration_ms_mobile = mobile_duration_ms || 0;

  console.log(`📊 [Demo] Özet üretildi: ${runId}`, {
    total, passed, failed,
    web: { total: webTotal, passed: webPassed, failed: webFailed },
    mobile: { total: mobileTotal, passed: mobilePassed, failed: mobileFailed },
    durations: { web: web_duration_ms, mobile: mobile_duration_ms }
  });

  // WebSocket ile frontend'e bildir
  io.emit('demo_results', {
    runId,
    summary: aggregateStore,
    avg_duration_ms_all: dashboardSummary.avg_duration_ms_all,
    avg_duration_ms_web: dashboardSummary.avg_duration_ms_web,
    avg_duration_ms_mobile: dashboardSummary.avg_duration_ms_mobile,
    demoMode: true
  });
}

// Demo run'ı iptal et
app.post('/api/demo/cancel/:runId', (req, res) => {
  const { runId } = req.params;
  
  if (demoRuns.has(runId)) {
    const demoRun = demoRuns.get(runId);
    if (demoRun.timer) {
      clearTimeout(demoRun.timer);
    }
    demoRuns.delete(runId);
    console.log(`🎬 [Demo] Run iptal edildi: ${runId}`);
  }
  
  res.json({ message: 'Demo run iptal edildi' });
});

// Canlı koşum akışı - WebResult (30sn)
async function injectWebResult(runId) {
  console.log(`🌐 [Demo] WebResult enjekte ediliyor: ${runId}`);
  
  const webResult = {
    runId,
    platform: 'web',
    status: 'FAILED',
    reason: 'overweight_detected',
    duration_ms: 3500,
    timestamp: new Date().toISOString(),
    demo: true
  };

  // Event'i kaydet
  await database.addEvent(runId, {
    type: 'web_test_completed',
    payload: webResult,
    timestamp: new Date().toISOString()
  });

  // Aggregate store'u güncelle
  updateAggregateStore(webResult);

  // WebSocket ile frontend'e bildir
  io.emit('web_result', {
    runId,
    result: webResult,
    message: 'Web test tamamlandı'
  });

  console.log(`🌐 [Demo] WebResult enjekte edildi: ${runId}`);
}

// Web timeout - T+30s
async function injectWebTimeout(runId) {
  console.log(`⏰ [Demo] Web timeout enjekte ediliyor: ${runId}`);
  
  const webTimeout = {
    runId,
    platform: 'web',
    status: 'FAILED',
    reason: 'timeout',
    duration_ms: 30000,
    timestamp: new Date().toISOString(),
    demo: true
  };

  // Event'i kaydet
  await database.addEvent(runId, {
    type: 'web_test_timeout',
    payload: webTimeout,
    timestamp: new Date().toISOString()
  });

  // WebSocket ile bildir
  io.emit('test_event', {
    runId,
    type: 'WebTimeout',
    payload: webTimeout
  });
}

// Mobile timeout - T+60s
async function injectMobileTimeout(runId) {
  console.log(`⏰ [Demo] Mobile timeout enjekte ediliyor: ${runId}`);
  
  const mobileTimeout = {
    runId,
    platform: 'mobile',
    status: 'FAILED',
    reason: 'timeout',
    duration_ms: 60000,
    timestamp: new Date().toISOString(),
    demo: true
  };

  // Event'i kaydet
  await database.addEvent(runId, {
    type: 'mobile_test_timeout',
    payload: mobileTimeout,
    timestamp: new Date().toISOString()
  });

  // WebSocket ile bildir
  io.emit('test_event', {
    runId,
    type: 'MobileTimeout',
    payload: mobileTimeout
  });
}

// Canlı koşum akışı - MobileResult (60sn)
async function injectMobileResult(runId) {
  console.log(`📱 [Demo] MobileResult enjekte ediliyor: ${runId}`);
  
  const mobileResult = {
    runId,
    platform: 'mobile',
    status: 'PASSED',
    scanned_code: 'TEST-12345',
    duration_ms: 2200,
    timestamp: new Date().toISOString(),
    demo: true
  };

  // Event'i kaydet
  await database.addEvent(runId, {
    type: 'mobile_test_completed',
    payload: mobileResult,
    timestamp: new Date().toISOString()
  });

  // Aggregate store'u güncelle
  updateAggregateStore(mobileResult);

  // WebSocket ile frontend'e bildir
  io.emit('mobile_result', {
    runId,
    result: mobileResult,
    message: 'Mobile test tamamlandı'
  });

  console.log(`📱 [Demo] MobileResult enjekte edildi: ${runId}`);
}

// Canlı koşum akışı - RunCompleted (90sn)
async function injectRunCompleted(runId) {
  console.log(`🏁 [Demo] RunCompleted enjekte ediliyor: ${runId}`);
  
  // Run'ı tamamla
  await database.updateRunStatus(runId, 'completed', {
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // WebSocket ile frontend'e bildir
  io.emit('run_completed', {
    runId,
    status: 'completed',
    message: 'Test tamamlandı'
  });

  console.log(`🏁 [Demo] RunCompleted enjekte edildi: ${runId}`);
}

// Demo sonuçlarını enjekte et
function injectDemoResults(runId) {
  if (!demoRuns.has(runId) || demoRuns.get(runId).demoInjected) {
    return; // Zaten enjekte edilmiş veya run yok
  }

  const demoRun = demoRuns.get(runId);
  demoRun.demoInjected = true;

  console.log(`🎬 [Demo] Sonuçlar enjekte ediliyor: ${runId}`);

  // Web sonucu (FAILED)
  const webResult = {
    runId,
    platform: 'web',
    status: 'FAILED',
    reason: 'overweight_detected',
    duration_ms: 3500,
    timestamp: new Date().toISOString(),
    demo: true
  };

  // Mobil sonucu (PASSED)
  const mobileResult = {
    runId,
    platform: 'mobile',
    status: 'PASSED',
    scanned_code: 'TEST-12345',
    duration_ms: 2200,
    timestamp: new Date().toISOString(),
    demo: true
  };

  // Sonuçları kaydet (demo scope'da)
  if (!testResults.demo) {
    testResults.demo = [];
  }
  testResults.demo.push(webResult, mobileResult);

  // Aggregate store'u güncelle (demo verileriyle)
  updateAggregateStore(webResult);
  updateAggregateStore(mobileResult);

  // WebSocket ile frontend'e bildir
  io.emit('demo_results', {
    runId,
    webResult,
    mobileResult,
    message: 'Demo sonuçlar eklendi'
  });

  console.log(`🎬 [Demo] Sonuçlar enjekte edildi: ${runId} - Web: FAILED, Mobile: PASSED`);
}

// Dashboard API - Summary
app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const { platform = 'all', range = '7d' } = req.query;
    
    // Cache kontrolü
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Test orchestration'dan aggregate store'u al
    const aggregateStore = testOrchestration.aggregateStore;
    
    console.log('🔍 [Dashboard Summary] Aggregate store:', JSON.stringify(aggregateStore, null, 2));
    
    // KPI hesaplamaları - aggregate store'dan al
    console.log('🔍 [Dashboard] testResults.results length:', testResults.results?.length || 0);
    console.log('🔍 [Dashboard] Aggregate store totals:', aggregateStore.total, aggregateStore.passed, aggregateStore.failed);
    
    // Aggregate store'dan KPI'ları al
    const allKPIs = {
      total: aggregateStore.total || 0,
      passed: aggregateStore.passed || 0,
      failed: aggregateStore.failed || 0,
      avgDuration: aggregateStore.avg_duration_ms_all || null
    };
    
    const webKPIs = {
      total: aggregateStore.web?.total || 0,
      passed: aggregateStore.web?.passed || 0,
      failed: aggregateStore.web?.failed || 0,
      avgDuration: aggregateStore.avg_duration_ms_web || null
    };
    
    const mobileKPIs = {
      total: aggregateStore.mobile?.total || 0,
      passed: aggregateStore.mobile?.passed || 0,
      failed: aggregateStore.mobile?.failed || 0,
      avgDuration: aggregateStore.avg_duration_ms_mobile || null
    };
    
    // Yeni API sözleşmesi - tek kaynak
    const summaryData = {
      summary: allKPIs,
      totals: allKPIs,
       total: allKPIs.total,
      passed: allKPIs.passed,
      failed: allKPIs.failed,
      web: {
        ...webKPIs,
        avg_duration_ms: webKPIs.avgDuration
      },
      mobile: {
        ...mobileKPIs,
        avg_duration_ms: mobileKPIs.avgDuration
      }
    };
    
    // Dashboard summary'yi güncelle - yeni API sözleşmesi
    dashboardSummary.lastUpdated = new Date().toISOString();
    dashboardSummary.summary = summaryData; // Yeni format: { totals, web, mobile }
    dashboardSummary.cards = allKPIs; // Eski uyumluluk için - doğru KPI'ları kullan
    
    // Summary verilerini de ekle
    dashboardSummary.totals = summaryData.totals;
    dashboardSummary.web = summaryData.web;
    dashboardSummary.mobile = summaryData.mobile;
    
    // Aktif run kontrolü
    const activeRun = testOrchestration.getActiveRun();
    if (activeRun && activeRun.status === 'started') {
      // Aktif run sırasında ortalama süreleri null gönder
      dashboardSummary.avg_duration_ms_all = null;
      dashboardSummary.avg_duration_ms_web = null;
      dashboardSummary.avg_duration_ms_mobile = null;
      dashboardSummary.live_run = activeRun;
    } else {
      // Run tamamlandığında gerçek ortalama süreleri gönder
      dashboardSummary.avg_duration_ms_all = allKPIs.avgDuration;
      dashboardSummary.avg_duration_ms_web = webKPIs.avgDuration;
      dashboardSummary.avg_duration_ms_mobile = mobileKPIs.avgDuration;
      dashboardSummary.live_run = null;
    }
    
    // Trend verilerini gerçek verilerle hesapla - tek kaynak
    const buildTrendData = (results) => {
      const trend = [];
      const now = new Date();
      const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(utcNow);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayResults = results.filter(r => {
          const resultDate = new Date(r.timestamp);
          const resultDateStr = resultDate.toISOString().split('T')[0];
          return resultDateStr === dateStr;
        });
        
        const passed = dayResults.filter(r => r.result === 'passed').length;
        const failed = dayResults.filter(r => r.result === 'failed').length;
        const total = passed + failed;
        
        trend.push({
          date: dateStr,
          passed,
          failed,
          total
        });
      }
      return trend;
    };
    
    // Son 7 gün içindeki completed results
    const now = new Date();
    const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const sevenDaysAgo = new Date(utcNow.getTime() - (6 * 24 * 60 * 60 * 1000));
    
    const last7DaysResults = testResults.results.filter(r => {
      const resultDate = new Date(r.timestamp);
      return resultDate >= sevenDaysAgo && resultDate <= utcNow && 
             r.status === 'completed' && 
             (r.platform === 'web' || r.platform === 'mobile');
    });
    
    const webTrendResults = last7DaysResults.filter(r => r.platform === 'web');
    const mobileTrendResults = last7DaysResults.filter(r => r.platform === 'mobile');
    
    dashboardSummary.trend7d = {
      all: buildTrendData(last7DaysResults),
      web: buildTrendData(webTrendResults),
      mobile: buildTrendData(mobileTrendResults)
    };
    
    // Uyarıları da güncelle
    dashboardSummary.alerts = [
      { type: 'warning', text: 'Son 24 saatte 3 test başarısız oldu' },
      { type: 'info', text: 'Mobil test performansı %15 arttı' }
    ];
    
    console.log(`📊 [Dashboard] Summary döndürüldü - platform:${platform}, total:${summaryData.total}, passed:${summaryData.passed}, failed:${summaryData.failed}`);
    
    res.json(dashboardSummary);
  } catch (error) {
    console.error('Dashboard özet hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Dashboard verileri alınamadı',
      error: error.message
    });
  }
});

// Run Live Status API - Polling için
app.get('/runs/:runId/live', async (req, res) => {
  try {
    const { runId } = req.params;
    
    // Cache kontrolü
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    // Run durumunu kontrol et
    const run = testOrchestration.getRun(runId);
    if (!run) {
      return res.status(404).json({ error: 'Run bulunamadı' });
    }
    
    // Event zincirini kontrol et
    const events = await database.getEvents(runId);
    
    // WebResult kontrolü
    const webResult = events.find(e => e.type === 'web_test_completed');
    
    // MobileResult kontrolü  
    const mobileResult = events.find(e => e.type === 'mobile_test_completed');
    
    // RunCompleted kontrolü
    const runCompleted = events.find(e => e.type === 'run_completed');
    
    // Aggregate store'dan güncel verileri al
    const aggregateStore = testOrchestration.aggregateStore;
    
    // Yeni API sözleşmesi - şartnameye uygun
    const response = {
      runId,
      isActive: run.status !== 'COMPLETED',
      totals: {
        total: aggregateStore.total,
        passed: aggregateStore.passed,
        failed: aggregateStore.failed
      },
      web: {
        count: aggregateStore.web.total,
        passed: aggregateStore.web.passed,
        failed: aggregateStore.web.failed,
        avg_ms: runCompleted ? aggregateStore.avg_duration_ms_web : null
      },
      mobile: {
        count: aggregateStore.mobile.total,
        passed: aggregateStore.mobile.passed,
        failed: aggregateStore.mobile.failed,
        avg_ms: runCompleted ? aggregateStore.avg_duration_ms_mobile : null
      },
      lastEvent: runCompleted ? 'RunCompleted' : 
                mobileResult ? 'MobileResult' : 
                webResult ? 'WebResult' : 'RunStarted',
      completed: !!runCompleted
    };
    
    console.log(`📊 [Live] Run ${runId} durumu:`, response);
    
    res.json(response);
  } catch (error) {
    console.error('Live status hatası:', error);
    res.status(500).json({
      error: 'Run durumu alınamadı',
      message: error.message
    });
  }
});

// Dashboard API - Test trendi
app.get('/api/dashboard/trend', async (req, res) => {
  try {
    const { range = '7d', platform } = req.query;
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 7;
    
    const trend = await database.getTestTrend(days, platform);
    
    res.json({
      success: true,
      trend,
      range: `${days} days`,
      platform: platform || 'all'
    });
  } catch (error) {
    console.error('Dashboard trend hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Trend verileri alınamadı',
      error: error.message
    });
  }
});

// Yeni Trend API - /api/trend?from=YYYY-MM-DD&to=YYYY-MM-DD&platform=all|web|mobile
app.get('/api/trend', async (req, res) => {
  try {
    const { from, to, platform = 'all' } = req.query;
    
    // Tarih aralığı hesapla (7 günlük varsayılan)
    const endDate = to ? new Date(to) : new Date();
    const startDate = from ? new Date(from) : new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
    
    // 7 günlük dizi oluştur (her gün için bir kayıt)
    const trendData = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Demo veri - sabit değerler (her çağrıda aynı)
      const demoData = [
        { passed: 8, failed: 2 },
        { passed: 12, failed: 1 },
        { passed: 6, failed: 3 },
        { passed: 15, failed: 0 },
        { passed: 9, failed: 2 },
        { passed: 11, failed: 1 },
        { passed: 7, failed: 3 }
      ];
      
      const dayData = {
        date: dateStr,
        passed: demoData[i].passed,
        failed: demoData[i].failed
      };
      
      // Platform'a göre veriyi ayarla
      if (platform === 'web') {
        dayData.passed = Math.floor(demoData[i].passed * 0.6);
        dayData.failed = Math.floor(demoData[i].failed * 0.5);
      } else if (platform === 'mobile') {
        dayData.passed = Math.floor(demoData[i].passed * 0.4);
        dayData.failed = Math.floor(demoData[i].failed * 0.5);
      }
      
      trendData.push(dayData);
    }
    
    res.json(trendData);
  } catch (error) {
    console.error('Trend API hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Trend verileri alınamadı',
      error: error.message
    });
  }
});

// Dashboard API - Anomaliler
app.get('/api/dashboard/anomalies', async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 7;
    
    const anomalies = await database.getAnomalies(days);
    
    res.json({
      success: true,
      anomalies,
      range: `${days} days`
    });
  } catch (error) {
    console.error('Anomali verileri hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Anomali verileri alınamadı',
      error: error.message
    });
  }
});

// Test logları getir
app.get('/api/tests/:testId/logs', async (req, res) => {
  try {
    const { testId } = req.params;
    const { platform } = req.query;
    
    const logs = await database.getTestLogs(testId, platform);
    
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Test logları hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Test logları alınamadı',
      error: error.message
    });
  }
});

// Barkod senaryoları API
app.get('/api/barcode/scenarios', (req, res) => {
  const scenarios = barcodeScenarios.getMobileTestScenarios();
  res.json({
    success: true,
    scenarios
  });
});

// Barkod doğrulama API
app.post('/api/barcode/validate', (req, res) => {
  try {
    const { barcode } = req.body;
    const validation = barcodeScenarios.validateBarcode(barcode);
    
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Barkod doğrulama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Barkod doğrulanamadı',
      error: error.message
    });
  }
});

// Barkod tarama simülasyonu
app.post('/api/barcode/scan', async (req, res) => {
  try {
    const { barcode, deviceId } = req.body;
    const result = await barcodeScenarios.simulateBarcodeScan(barcode, deviceId);
    
    // Veritabanına kaydet
    await database.saveBarcodeScan(
      'demo-test',
      barcode,
      result.validation.type,
      result.success,
      result.message,
      deviceId
    );
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Barkod tarama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Barkod tarama başarısız',
      error: error.message
    });
  }
});

// Barkod istatistikleri
app.get('/api/barcode/stats', async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 7;
    
    const stats = await database.getBarcodeStats(days);
    
    res.json({
      success: true,
      stats,
      range: `${days} days`
    });
  } catch (error) {
    console.error('Barkod istatistik hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Barkod istatistikleri alınamadı',
      error: error.message
    });
  }
});

// ==================== WEBSOCKET BAĞLANTILARI ====================

io.on('connection', (socket) => {
  console.log('🔌 Yeni WebSocket bağlantısı:', socket.id);
  
  // Canlı kanala abone ol - runId ile
  socket.on('subscribe_run', (runId) => {
    if (!liveChannels.has(runId)) {
      liveChannels.set(runId, new Set());
    }
    liveChannels.get(runId).add(socket);
    console.log(`📡 Socket ${socket.id} run ${runId} canlı kanalına abone oldu`);
  });
  
  // Canlı kanaldan ayrıl
  socket.on('unsubscribe_run', (runId) => {
    const channel = liveChannels.get(runId);
    if (channel) {
      channel.delete(socket);
      if (channel.size === 0) {
        liveChannels.delete(runId);
      }
    }
    console.log(`📡 Socket ${socket.id} run ${runId} canlı kanalından ayrıldı`);
  });
  
  // Test güncellemelerini dinle (eski uyumluluk)
  socket.on('join_test', (testId) => {
    socket.join(`test_${testId}`);
    console.log(`👥 Socket ${socket.id} test ${testId} odasına katıldı`);
  });
  
  // Test odasından ayrıl (eski uyumluluk)
  socket.on('leave_test', (testId) => {
    socket.leave(`test_${testId}`);
    console.log(`👋 Socket ${socket.id} test ${testId} odasından ayrıldı`);
  });
  
  // Bağlantı kesildiğinde - tüm kanallardan çıkar
  socket.on('disconnect', () => {
    console.log('❌ WebSocket bağlantısı kesildi:', socket.id);
    
    // Tüm canlı kanallardan çıkar
    liveChannels.forEach((channel, runId) => {
      channel.delete(socket);
      if (channel.size === 0) {
        liveChannels.delete(runId);
      }
    });
  });
});

// ==================== MOBİL BAĞLANTI ENDPOINT'LERİ ====================

// Mobil uygulama bağlantısı
app.post('/api/mobile-connect', (req, res) => {
  try {
    const { runId } = req.body;
    
    if (!runId) {
      return res.status(400).json({ success: false, error: 'runId gerekli' });
    }
    
    // Run'ı kontrol et
    if (!activeRuns.has(runId)) {
      return res.status(404).json({ success: false, error: 'Run bulunamadı' });
    }
    
    console.log(`📱 Mobil uygulama bağlandı: ${runId}`);
    
    // Frontend'e bildir
    broadcastToRun(runId, {
      type: 'mobile_connect',
      runId: runId,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Mobil uygulama bağlandı' });
  } catch (error) {
    console.error('Mobil bağlantı hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

// Mobil test hazır
app.post('/api/mobile-ready', (req, res) => {
  try {
    const { runId } = req.body;
    
    if (!runId) {
      return res.status(400).json({ success: false, error: 'runId gerekli' });
    }
    
    // Run'ı kontrol et
    if (!activeRuns.has(runId)) {
      return res.status(404).json({ success: false, error: 'Run bulunamadı' });
    }
    
    console.log(`📱 Mobil test hazır: ${runId}`);
    
    // Run durumunu güncelle
    const runData = activeRuns.get(runId);
    runData.status = 'RUNNING_MOBILE';
    activeRuns.set(runId, runData);
    
    // Frontend'e bildir
    broadcastToRun(runId, {
      type: 'mobile_ready',
      runId: runId,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, message: 'Mobil test hazır' });
  } catch (error) {
    console.error('Mobil hazır hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

// Mobil test tamamlandı
app.post('/api/mobile-test-completed', async (req, res) => {
  try {
    const { runId, results } = req.body;
    
    if (!runId) {
      return res.status(400).json({ success: false, error: 'runId gerekli' });
    }
    
    // Run'ı kontrol et
    if (!activeRuns.has(runId)) {
      return res.status(404).json({ success: false, error: 'Run bulunamadı' });
    }
    
    console.log(`✅ Mobil test tamamlandı: ${runId}`, results);
    
    // Run durumunu güncelle
    const runData = activeRuns.get(runId);
    runData.status = 'COMPLETED';
    runData.mobileResults = results || {};
    activeRuns.set(runId, runData);
    
    // Dashboard summary oluştur
    const summary = {
      runId: runId,
      totals: {
        testsDelta: 1,
        passedDelta: results?.passed || 0,
        failedDelta: results?.failed || 0
      },
      web: {
        negatives: {
          overweight: runData.webResults?.overweight ? 1 : 0
        }
      },
      mobile: {
        barcodes: {
          ok: results?.passed || 0,
          fail: results?.failed || 0
        }
      },
      trend: {
        todayDelta: 1
      },
      alerts: runData.webResults?.overweight ? 
        ['Overweight denemesi engellendi'] : 
        ['Test başarıyla tamamlandı']
    };
    
    // run_completed olayını yayınla
    broadcastToRun(runId, {
      type: 'run_completed',
      runId: runId,
      summary: summary,
      timestamp: new Date().toISOString()
    });
    
    console.log(`🎉 Run completed yayınlandı: ${runId}`);
    
    res.json({ success: true, message: 'Mobil test tamamlandı' });
  } catch (error) {
    console.error('Mobil test tamamlandı hatası:', error);
    res.status(500).json({ success: false, error: 'Sunucu hatası' });
  }
});

// ==================== TEST ORCHESTRATION ENDPOINTS ====================

// Test başlatma - Orkestratör ile
app.post('/api/test/start', async (req, res) => {
  try {
    const { platform = 'both', runId } = req.body;
    
    console.log(`🚀 Test başlatma isteği: ${runId}, platform: ${platform}`);
    
    // Orkestratör ile test başlat
    const testResult = await testOrchestration.startTest(runId, platform);
    
    res.json({ 
      success: true, 
      runId: runId,
      startedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test başlatma hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Test başlatılamadı' 
    });
  }
});

// Test durumu sorgulama
app.get('/api/test/status/:testId', (req, res) => {
  try {
    const { testId } = req.params;
    const testStatus = testOrchestration.getTestStatus(testId);
    
    if (!testStatus) {
      return res.status(404).json({ 
        success: false, 
        error: 'Test bulunamadı' 
      });
    }
    
    res.json({ 
      success: true, 
      test: testStatus 
    });
    
  } catch (error) {
    console.error('Test durumu sorgulama hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Test durumu alınamadı' 
    });
  }
});

// Test iptal etme
app.post('/api/test/cancel/:testId', (req, res) => {
  try {
    const { testId } = req.params;
    const cancelled = testOrchestration.cancelTest(testId);
    
    if (!cancelled) {
      return res.status(404).json({ 
        success: false, 
        error: 'Test bulunamadı veya iptal edilemedi' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Test iptal edildi' 
    });
    
  } catch (error) {
    console.error('Test iptal etme hatası:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Test iptal edilemedi' 
    });
  }
});

// ==================== SERVER BAŞLAT ====================

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mock API sunucusu çalışıyor: http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket sunucusu aktif: ws://0.0.0.0:${PORT}`);
  console.log(`📱 Android Emülatör: http://10.0.2.2:${PORT}`);
  console.log(`🌐 Localhost: http://localhost:${PORT}`);
  console.log(`📊 Test sonuçları endpoint: http://localhost:${PORT}/api/test-results`);
  console.log(`⚠️  Anomaliler endpoint: http://localhost:${PORT}/api/test-results/anomalies`);
  console.log(`🔄 Manuel güncelleme: POST http://localhost:${PORT}/api/test-results/update`);
  console.log(`🎯 Test Orchestration: POST http://localhost:${PORT}/api/tests/start`);
  console.log(`📈 Dashboard API: GET http://localhost:${PORT}/api/dashboard/summary`);
  console.log(`📊 Barkod API: POST http://localhost:${PORT}/api/barcode/scan`);
  console.log(`📝 Events API: POST http://localhost:${PORT}/api/events`);
});

// ==================== HELPER FUNCTIONS ====================

// Run durumunu güncelle
async function updateRunState(runId, eventType, payload) {
  try {
    // Mevcut run durumunu al
    const currentRun = await database.getRun(runId);
    
    let newState = currentRun?.state || 'idle';
    
    // Durum makinesi: idle → web_done → mobile_ready → mobile_done → completed
    switch (eventType) {
      case 'web_test_completed':
        if (newState === 'idle') {
          newState = 'web_done';
          // WebSocket ile mobile_ready bilgisini gönder
          io.emit('run_update', {
            runId,
            state: 'mobile_ready',
            message: 'Web test tamamlandı, mobil test başlayabilir',
            timestamp: new Date().toISOString()
          });
        }
        break;
      case 'mobile_test_completed':
        if (newState === 'web_done') {
          newState = 'mobile_done';
        }
        break;
      case 'run_completed':
        if (newState === 'mobile_done') {
          newState = 'completed';
        } else {
          console.log(`⚠️ Run completed geçersiz durumda: ${newState}`);
          return; // Geçersiz durum, işleme
        }
        break;
      default:
        // Diğer event'ler (barcode_ok, barcode_fail) durumu değiştirmez
        break;
    }
    
    // Run'ı güncelle
    const runData = {
      runId,
      state: newState,
      lastEvent: eventType,
      lastEventTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await database.upsertRun(runData);
    
    // completed ise panel metriklerini atomik olarak güncelle
    if (newState === 'completed') {
      await updatePanelMetrics(runId);
    }
    
    console.log(`🔄 Run durumu güncellendi: ${runId} → ${newState}`);
    
  } catch (error) {
    console.error('❌ Run durumu güncelleme hatası:', error);
  }
}

// Panel metriklerini güncelle (run_completed tetikleyicisi) - Atomik işlem
async function updatePanelMetrics(runId) {
  try {
    console.log(`📊 Panel metrikleri güncelleniyor: ${runId}`);
    
    // Run'daki tüm eventleri al
    const events = await database.getRunEvents(runId);
    const run = await database.getRun(runId);
    
    // Metrikleri hesapla
    const metrics = {
      totalTests: 1,
      webOverweight: 0,
      mobileOk: 0,
      mobileFail: 0,
      success: 0,
      failed: 0,
      averageDuration: 0
    };
    
    // Event'leri analiz et
    events.forEach(event => {
      switch (event.type) {
        case 'web_test_completed':
          if (event.payload?.overweight) {
            metrics.webOverweight = 1;
          }
          break;
        case 'barcode_ok':
          metrics.mobileOk++;
          break;
        case 'barcode_fail':
          metrics.mobileFail++;
          break;
      }
    });
    
    // Başarı/başarısızlık hesapla
    // Web'de overweight yoksa ve mobilde en az bir başarılı barkod varsa başarılı
    if (metrics.webOverweight === 0 && metrics.mobileOk > 0) {
      metrics.success = 1;
    } else {
      metrics.failed = 1;
    }
    
    // Ortalama süre hesapla
    if (run?.startedAt && run?.completedAt) {
      const startTime = new Date(run.startedAt).getTime();
      const endTime = new Date(run.completedAt).getTime();
      metrics.averageDuration = Math.round((endTime - startTime) / 1000); // saniye
    }
    
    // Panel metriklerini atomik olarak güncelle
    await database.updatePanelMetrics(metrics);
    
    // WebSocket ile canlı yayın
    io.emit('dashboard_update', {
      type: 'run_completed',
      runId,
      metrics,
      timestamp: new Date().toISOString()
    });
    
    console.log(`📊 Panel metrikleri atomik güncellendi: ${JSON.stringify(metrics)}`);
    
  } catch (error) {
    console.error('❌ Panel metrikleri güncelleme hatası:', error);
  }
}

// Süre ölçümü sistemi - Monotonic saat kullanımı
const runTimers = new Map(); // runId -> { webStart, mobileStart, webSetup, mobileSetup }

// Demo Modu Endpoint'leri
app.post('/api/run/start', async (req, res) => {
  try {
    const { demoMode = false, tenantId = 'default' } = req.body;
    const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🚀 RunStarted: ${runId} (Demo: ${demoMode})`);
    
    // Run'ı başlat
    const runData = {
      runId,
      status: 'started',
      startedAt: new Date().toISOString(),
      demoMode,
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await database.upsertRun(runData);
    
    // Canlı koşum akışı: 5-7-10-14-15-18 saniye zamanlaması
    if (demoMode) {
      // 5-7 saniye sonra WebResult
      const webDelay = 5000 + Math.random() * 2000; // 5-7sn
      setTimeout(async () => {
        await injectWebResult(runId);
      }, webDelay);
      
      // 10-14 saniye sonra MobileResult  
      const mobileDelay = 10000 + Math.random() * 4000; // 10-14sn
      setTimeout(async () => {
        await injectMobileResult(runId);
      }, mobileDelay);
      
      // 15-18 saniye sonra RunCompleted
      const completeDelay = 15000 + Math.random() * 3000; // 15-18sn
      setTimeout(async () => {
        await injectRunCompleted(runId);
      }, completeDelay);
      
      // Timeout kontrolü - Web T+30s, Mobil T+60s
      setTimeout(async () => {
        await injectWebTimeout(runId);
      }, 30000); // Web T+30s
      
      setTimeout(async () => {
        await injectMobileTimeout(runId);
      }, 60000); // Mobil T+60s
    }
    
    res.json({ runId, status: 'started', demoMode });
    
  } catch (error) {
    console.error('❌ Run start hatası:', error);
    res.status(500).json({ error: 'Run başlatılamadı' });
  }
});

app.post('/api/run/complete', async (req, res) => {
  try {
    const { runId, status, completedAt } = req.body;
    
    console.log(`🏁 RunCompleted: ${runId}`);
    
    // Run'ı tamamla
    await database.updateRunStatus(runId, 'completed', {
      completedAt: completedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    res.json({ runId, status: 'completed' });
    
  } catch (error) {
    console.error('❌ Run complete hatası:', error);
    res.status(500).json({ error: 'Run tamamlanamadı' });
  }
});

app.post('/api/run/cancel', async (req, res) => {
  try {
    const { runId, status, cancelledAt } = req.body;
    
    console.log(`🛑 RunCancelled: ${runId}`);
    
    // Run'ı iptal et
    await database.updateRunStatus(runId, 'cancelled', {
      cancelledAt: cancelledAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    res.json({ runId, status: 'cancelled' });
    
  } catch (error) {
    console.error('❌ Run cancel hatası:', error);
    res.status(500).json({ error: 'Run iptal edilemedi' });
  }
});

// Süre ölçümü endpoint'leri
// Eski endpoint kaldırıldı - sadece /api/test/start kullan

// Web test tamamlama
app.post('/api/test/web/complete', async (req, res) => {
  try {
    const { runId, status, overweight = false, demoMode = false } = req.body;
    const timer = runTimers.get(runId);
    
    if (!timer || !timer.webStart) {
      throw new Error('Web test timer bulunamadı');
    }
    
    const now = Date.now();
    const caseDuration = now - timer.webStart;
    const timeoutThreshold = 30000; // 30s timeout (Web T+30s)
    
    // Timeout kontrolü
    const isTimeout = caseDuration > timeoutThreshold;
    const finalStatus = isTimeout ? 'failed_timeout' : status;
    const finalDuration = isTimeout ? timeoutThreshold : caseDuration;
    
    console.log(`🌐 WebTest.${finalStatus}: ${runId} (${finalDuration}ms)`);
    
    // Event kaydet
    await database.addEvent(runId, {
      type: 'web_test_completed',
      payload: {
        status: finalStatus,
        duration_ms: finalDuration,
        overweight,
        timeout: isTimeout,
        demoMode
      },
      timestamp: new Date().toISOString()
    });
    
    // WebSocket ile bildir
    io.emit('web_test_completed', {
      runId,
      status: finalStatus,
      duration_ms: finalDuration,
      overweight,
      timeout: isTimeout,
      timestamp: new Date().toISOString()
    });
    
    res.json({ runId, status: finalStatus, duration_ms: finalDuration });
    
  } catch (error) {
    console.error('❌ Web test complete hatası:', error);
    res.status(500).json({ error: 'Web test tamamlanamadı' });
  }
});

// Eski endpoint kaldırıldı - sadece /api/test/start kullan

// Mobil test tamamlama
app.post('/api/test/mobile/complete', async (req, res) => {
  try {
    const { runId, status, barcode, demoMode = false } = req.body;
    const timer = runTimers.get(runId);
    
    if (!timer || !timer.mobileStart) {
      throw new Error('Mobil test timer bulunamadı');
    }
    
    const now = Date.now();
    const caseDuration = now - timer.mobileStart;
    const timeoutThreshold = 60000; // 60s timeout (Mobil T+60s)
    
    // Timeout kontrolü
    const isTimeout = caseDuration > timeoutThreshold;
    const finalStatus = isTimeout ? 'failed_timeout' : status;
    const finalDuration = isTimeout ? timeoutThreshold : caseDuration;
    
    console.log(`📱 MobileTest.${finalStatus}: ${runId} (${finalDuration}ms)`);
    
    // Event kaydet
    await database.addEvent(runId, {
      type: 'mobile_test_completed',
      payload: {
        status: finalStatus,
        duration_ms: finalDuration,
        barcode,
        timeout: isTimeout,
        demoMode
      },
      timestamp: new Date().toISOString()
    });
    
    // WebSocket ile bildir
    io.emit('mobile_test_completed', {
      runId,
      status: finalStatus,
      duration_ms: finalDuration,
      barcode,
      timeout: isTimeout,
      timestamp: new Date().toISOString()
    });
    
    res.json({ runId, status: finalStatus, duration_ms: finalDuration });
    
  } catch (error) {
    console.error('❌ Mobil test complete hatası:', error);
    res.status(500).json({ error: 'Mobil test tamamlanamadı' });
  }
});

// Server'ı başlat
server.listen(PORT, () => {
  console.log(`🚀 Mock API server çalışıyor: http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

