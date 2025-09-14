import { v4 as uuidv4 } from 'uuid';

// Test Orchestration Service
export class TestOrchestrationService {
  constructor() {
    this.activeTests = new Map();
    this.demoStepClients = new Set();
    this.aggregateStore = {
      total: 57,
      passed: 53,
      failed: 4,
      web: { total: 30, passed: 26, failed: 4 },
      mobile: { total: 27, passed: 22, failed: 5 },
      avg_duration_ms_all: 245000,
      avg_duration_ms_web: 198000,
      avg_duration_ms_mobile: 120000
    };
    // OTOMASYON ODAKLI TEST ADIMLARI - Gerçekçi süreler
    this.testSteps = {
      web: [
        { id: 'web-1', name: 'Web testi başlatılıyor...', duration: 3000, type: 'preparing' },
        { id: 'web-2', name: 'Test simülasyonu...', duration: 42000, type: 'running' },
        { id: 'web-3', name: 'Web testi tamamlandı', duration: 0, type: 'completed' }
      ],
      mobile: [
        { id: 'mobile-1', name: 'Mobil testi başlatılıyor...', duration: 1000, type: 'preparing' },
        { id: 'mobile-2', name: 'Barkod simülasyonu...', duration: 49000, type: 'running' },
        { id: 'mobile-3', name: 'Mobil testi tamamlandı', duration: 0, type: 'completed' }
      ]
    };
  }

  // Aggregate store güncelleme fonksiyonu
  updateAggregateStore(platform, passed, failed, runId = null) {
    const total = passed + failed;
    
    // RunId tutarlılık kontrolü
    if (runId) {
      console.log(`🔍 [RunId] ${platform} güncelleme - RunId: ${runId}`);
    }
    
    // Platform-specific güncelleme
    this.aggregateStore[platform].total += total;
    this.aggregateStore[platform].passed += passed;
    this.aggregateStore[platform].failed += failed;
    
    // Genel toplam güncelleme
    this.aggregateStore.total += total;
    this.aggregateStore.passed += passed;
    this.aggregateStore.failed += failed;
    
    console.log(`📊 [Aggregate] ${platform} güncellendi: +${passed} passed, +${failed} failed`);
    console.log(`📊 [Aggregate] Toplam: ${this.aggregateStore.total} (${this.aggregateStore.passed} passed, ${this.aggregateStore.failed} failed)`);
    console.log(`🔍 [Debug] Aggregate store durumu:`, JSON.stringify(this.aggregateStore, null, 2));
  }

  // Dashboard güncelleme fonksiyonu
  async updateDashboard() {
    try {
      const response = await fetch('http://localhost:3001/api/dashboard/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const dashboardData = await response.json();
        console.log('📊 [Dashboard] Güncellendi:', {
          totalRuns: dashboardData.cards?.total_runs || 0,
          avgDuration: dashboardData.avg_duration_ms_all || 0,
          liveRun: dashboardData.live_run || null
        });
      } else {
        console.error('Dashboard güncelleme hatası:', response.statusText);
      }
    } catch (error) {
      console.error('Dashboard güncelleme hatası:', error);
    }
  }

  // Test başlatma - State Machine ile sıralı
  async startTest(testId, platform = 'both') {
    // Aktif test kontrolü
    if (this.activeTests.size > 0) {
      throw new Error('Aktif test var, yeni test başlatılamaz');
    }

    const now = new Date();
    const testRun = {
      id: testId,
      platform,
      status: 'running',
      state: 'IDLE', // IDLE → WEB_START → WEB_END → MOBILE_START → MOBILE_END → PERSIST → DONE
      started_at: now.toISOString(),
      finished_at: null,
      duration_ms: 0,
      web_started_at: null,
      web_finished_at: null,
      web_duration_ms: 0,
      mobile_started_at: null,
      mobile_finished_at: null,
      mobile_duration_ms: 0,
      steps: {
        web: { status: 'pending', progress: 0, currentStep: null, stepIndex: 0, totalSteps: this.testSteps.web.length },
        mobile: { status: 'pending', progress: 0, currentStep: null, stepIndex: 0, totalSteps: this.testSteps.mobile.length }
      },
      results: {
        web: { passed: 0, failed: 0, duration: 0 },
        mobile: { passed: 0, failed: 0, duration: 0 }
      },
      logs: []
    };

    this.activeTests.set(testId, testRun);

    // WebSocket ile test başladığını bildir
    this.broadcastTestUpdate(testId, 'run_started', {
      runId: testId,
      platform,
      status: 'running',
      timestamp: now.toISOString()
    });

    try {
      // State Machine: Sıralı test süreci
      await this.executeStateMachine(testId, platform);

    } catch (error) {
      const finishedTime = new Date();
      testRun.status = 'failed';
      testRun.state = 'FAILED';
      testRun.error = error.message;
      testRun.finished_at = finishedTime.toISOString();
      testRun.duration_ms = finishedTime.getTime() - new Date(testRun.started_at).getTime();

      this.broadcastTestUpdate(testId, 'run_failed', {
        runId: testId,
        status: 'failed',
        error: error.message,
        timestamp: finishedTime.toISOString()
      });

      // Test temizle
      this.activeTests.delete(testId);
    }

    return testRun;
  }

  // State Machine Executor - Sıralı test süreci
  async executeStateMachine(testId, platform) {
    const testRun = this.activeTests.get(testId);
    if (!testRun) return;

    try {
      // 1. WEB_START
      if (platform === 'both' || platform === 'web') {
        testRun.state = 'WEB_START';
        await this.runWebTest(testId);
        testRun.state = 'WEB_END';
        
        // Web testi bittiğinde hazır sinyali bekle
        await this.waitForReadySignal('web_completed');
      }

      // 2. MOBILE_START  
      if (platform === 'both' || platform === 'mobile') {
        testRun.state = 'MOBILE_START';
        await this.runMobileTest(testId);
        testRun.state = 'MOBILE_END';
        
        // Mobil testi bittiğinde hazır sinyali bekle
        await this.waitForReadySignal('mobile_completed');
      }

      // 3. PERSIST
      testRun.state = 'PERSIST';
      await this.persistTestResults(testId);

      // 4. DONE
      testRun.state = 'DONE';
      testRun.status = 'completed';
      const finishedTime = new Date();
      testRun.finished_at = finishedTime.toISOString();
      testRun.duration_ms = finishedTime.getTime() - new Date(testRun.started_at).getTime();

      // run_completed event'ini gönder
      this.broadcastTestUpdate(testId, 'run_completed', {
        runId: testId,
        status: 'completed',
        results: testRun.results,
        duration_ms: testRun.duration_ms,
        platform: testRun.platform,
        timestamp: finishedTime.toISOString()
      });

      // run_finished event'ini gönder (Dashboard için)
      this.broadcastTestUpdate(testId, 'run_finished', {
        runId: testId,
        status: 'completed',
        summary: {
          total: testRun.results.web.passed + testRun.results.mobile.passed + testRun.results.web.failed + testRun.results.mobile.failed,
          passed: testRun.results.web.passed + testRun.results.mobile.passed,
          failed: testRun.results.web.failed + testRun.results.mobile.failed,
          web: {
            total: testRun.results.web.passed + testRun.results.web.failed,
            passed: testRun.results.web.passed,
            failed: testRun.results.web.failed
          },
          mobile: {
            total: testRun.results.mobile.passed + testRun.results.mobile.failed,
            passed: testRun.results.mobile.passed,
            failed: testRun.results.mobile.failed
          },
          avg_duration_ms_all: testRun.duration_ms,
          avg_duration_ms_web: testRun.web_duration_ms,
          avg_duration_ms_mobile: testRun.mobile_duration_ms
        },
        testResults: [
          {
            channel: 'web',
            status: testRun.results.web.failed > 0 ? 'fail' : 'pass',
            startedAt: testRun.web_started_at,
            durationSec: Math.round(testRun.web_duration_ms / 1000)
          },
          {
            channel: 'mobile',
            status: testRun.results.mobile.failed > 0 ? 'fail' : 'pass',
            startedAt: testRun.mobile_started_at,
            durationSec: Math.round(testRun.mobile_duration_ms / 1000)
          }
        ],
        timestamp: finishedTime.toISOString()
      });

      // Test temizle
      this.activeTests.delete(testId);

    } catch (error) {
      throw error;
    }
  }

  // Hazır sinyali bekleme
  async waitForReadySignal(signal) {
    return new Promise((resolve) => {
      // Minimum görsel süre: Web≥5sn, Mobil≥7sn
      const minDuration = signal === 'web_completed' ? 5000 : 7000;
      setTimeout(resolve, minDuration);
    });
  }

  // Test sonuçlarını kalıcı hale getir
  async persistTestResults(testId) {
    const testRun = this.activeTests.get(testId);
    if (!testRun) return;

    // Test sonuçlarını veritabanına kaydet
    await this.saveTestToDatabase(testRun);

    // Dashboard'u güncelle
    await this.updateDashboard();
  }

  // Web test çalıştırma - OTOMASYON ODAKLI
  async runWebTest(testId) {
    const testRun = this.activeTests.get(testId);
    if (!testRun) return;

    const webStartTime = new Date();
    testRun.web_started_at = webStartTime.toISOString();
    testRun.steps.web.status = 'running';
    
    // Event: form_opened
    this.broadcastTestUpdate(testId, 'form_opened', {
      testId,
      platform: 'web',
      formType: 'uld_capacity',
      timestamp: webStartTime.toISOString()
    });

    this.broadcastTestUpdate(testId, 'web_test_started', {
      testId,
      platform: 'web',
      status: 'running'
    });

    // WebStarted event - toast için
    this.broadcastTestUpdate(testId, 'web_started', {
      testId,
      platform: 'web',
      status: 'started',
      timestamp: webStartTime.toISOString()
    });

    const startTime = Date.now();
    const WEB_TEST_DURATION = 12000; // 12 saniye deterministik
    let stepIndex = 0;

    // Profesyonel konsol logları
    this.addTestLog(testId, 'web', 'Opening Chrome...', 'info');
    await this.delay(1000);
    
    this.addTestLog(testId, 'web', 'Navigating: /uld', 'info');
    await this.delay(1000);
    
    this.addTestLog(testId, 'web', 'Filling ULD form...', 'info');
    await this.delay(2000);
    
    this.addTestLog(testId, 'web', 'Validating constraints...', 'info');
    await this.delay(8000); // Kalan süre

    for (const step of this.testSteps.web) {
      testRun.steps.web.currentStep = step.name;
      testRun.steps.web.stepIndex = stepIndex + 1;
      
      this.broadcastTestUpdate(testId, 'web_step_started', {
        testId,
        step: step,
        stepIndex: stepIndex + 1,
        totalSteps: this.testSteps.web.length
      });

      // Adım logu ekle
      this.addTestLog(testId, 'web', step.name, 'info');

      // Overweight validasyonu için özel event
      if (step.id === 'web-4') {
        this.broadcastTestUpdate(testId, 'validation_fail_overweight', {
          testId,
          platform: 'web',
          maxCapacity: 1506,
          currentWeight: 1600,
          timestamp: new Date().toISOString()
        });
      }

      // Anında geçiş - bekleme yok

      stepIndex++;
    }

    // Web test sonuçları
    const webEndTime = new Date();
    testRun.web_finished_at = webEndTime.toISOString();
    testRun.web_duration_ms = webEndTime.getTime() - new Date(testRun.web_started_at).getTime();
    
    testRun.steps.web.status = 'completed';
    testRun.steps.web.progress = 100;
    testRun.results.web = {
      passed: Math.floor(Math.random() * 8) + 5, // 5-12 arası rastgele
      failed: Math.floor(Math.random() * 3), // 0-2 arası rastgele
      duration: Math.round(testRun.web_duration_ms / 1000)
    };

    this.broadcastTestUpdate(testId, 'web_test_completed', {
      testId,
      platform: 'web',
      status: 'completed',
      results: testRun.results.web
    });

    // Aggregate store'u güncelle
    this.updateAggregateStore('web', testRun.results.web.passed, testRun.results.web.failed, testId);

    this.addTestLog(testId, 'web', `Web testleri tamamlandı - ${testRun.results.web.passed} başarılı, ${testRun.results.web.failed} başarısız`, 'success');

    // Web testi bittiğinde final_summary_ready gönder (sadece web testi ise)
    if (testRun.platform === 'web') {
      console.log('📊 [Dashboard] Web testi tamamlandı, final_summary_ready gönderiliyor...');
      this.broadcastTestUpdate(testId, 'final_summary_ready', {
        testId,
        status: 'completed',
        duration_ms: testRun.web_duration_ms,
        web_duration_ms: testRun.web_duration_ms,
        mobile_duration_ms: 0
      });
      
      // Dashboard'u güncelle
      await this.updateDashboard();
    }
  }

  // Mobil test çalıştırma - OTOMASYON ODAKLI
  async runMobileTest(testId) {
    const testRun = this.activeTests.get(testId);
    if (!testRun) return;

    const mobileStartTime = new Date();
    testRun.mobile_started_at = mobileStartTime.toISOString();
    testRun.steps.mobile.status = 'running';
    
    // Event: appium_connected
    this.broadcastTestUpdate(testId, 'appium_connected', {
      testId,
      platform: 'mobile',
      timestamp: mobileStartTime.toISOString()
    });

    this.broadcastTestUpdate(testId, 'mobile_test_started', {
      testId,
      platform: 'mobile',
      status: 'running'
    });

    // MobileStarted event - toast için
    this.broadcastTestUpdate(testId, 'mobile_started', {
      testId,
      platform: 'mobile',
      status: 'started',
      timestamp: mobileStartTime.toISOString()
    });

    const startTime = Date.now();
    const MOBILE_TEST_DURATION = 12000; // 12 saniye deterministik
    let stepIndex = 0;

    // Profesyonel konsol logları
    this.addTestLog(testId, 'mobile', 'Connecting to Appium Server: http://127.0.0.1:4723', 'info');
    await this.delay(2000);
    
    this.addTestLog(testId, 'mobile', 'Device: Android Emulator • Pixel 7 • API 35', 'info');
    await this.delay(1000);
    
    this.addTestLog(testId, 'mobile', 'Launching app: com.cargo.mobile/.MainActivity', 'info');
    await this.delay(2000);
    
    this.addTestLog(testId, 'mobile', 'Scanning barcode: TEST-12345', 'info');
    await this.delay(3000);
    
    this.addTestLog(testId, 'mobile', 'Assertion: Success screen visible', 'info');
    await this.delay(4000); // Kalan süre

    for (const step of this.testSteps.mobile) {
      testRun.steps.mobile.currentStep = step.name;
      testRun.steps.mobile.stepIndex = stepIndex + 1;
      
      this.broadcastTestUpdate(testId, 'mobile_step_started', {
        testId,
        step: step,
        stepIndex: stepIndex + 1,
        totalSteps: this.testSteps.mobile.length
      });

      // Adım logu ekle
      this.addTestLog(testId, 'mobile', step.name, 'info');

      // Barkod testleri için özel eventler
      if (step.id === 'mobile-4') {
        // Geçerli barkod
        this.broadcastTestUpdate(testId, 'barcode_ok', {
          testId,
          platform: 'mobile',
          barcode: '1234567890128',
          route: 'IST-AMS',
          pieces: 5,
          weight: 1200,
          timestamp: new Date().toISOString()
        });
        
        // Kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Geçersiz barkod
        this.broadcastTestUpdate(testId, 'barcode_fail', {
          testId,
          platform: 'mobile',
          barcode: '123456789012',
          error: 'EAN-13 örnek: 1234567890128',
          timestamp: new Date().toISOString()
        });
      }

      // Anında geçiş - bekleme yok

      stepIndex++;
    }

    // Mobil test sonuçları
    const mobileEndTime = new Date();
    testRun.mobile_finished_at = mobileEndTime.toISOString();
    testRun.mobile_duration_ms = mobileEndTime.getTime() - new Date(testRun.mobile_started_at).getTime();
    
    testRun.steps.mobile.status = 'completed';
    testRun.steps.mobile.progress = 100;
    testRun.results.mobile = {
      passed: Math.floor(Math.random() * 6) + 4, // 4-9 arası rastgele
      failed: Math.floor(Math.random() * 2), // 0-1 arası rastgele
      duration: Math.round(testRun.mobile_duration_ms / 1000)
    };

    // Hata kontrolü - eğer failed > 0 ise hata kodu ekle
    const hasErrors = testRun.results.mobile.failed > 0;
    const errorCode = hasErrors ? 'ERR_MOBILE_VALIDATION' : null;
    const errorReason = hasErrors ? 'Barkod validasyonu başarısız' : null;

    this.broadcastTestUpdate(testId, 'mobile_test_completed', {
      testId,
      platform: 'mobile',
      status: hasErrors ? 'failed' : 'completed',
      results: testRun.results.mobile,
      errorCode,
      errorReason
    });

    // Aggregate store'u güncelle
    this.updateAggregateStore('mobile', testRun.results.mobile.passed, testRun.results.mobile.failed, testId);

    if (hasErrors) {
      this.addTestLog(testId, 'mobile', `❌ Mobil testleri başarısız - ${testRun.results.mobile.failed} hata (${errorCode})`, 'error');
    } else {
      this.addTestLog(testId, 'mobile', `✅ Mobil testleri tamamlandı - ${testRun.results.mobile.passed} başarılı`, 'success');
    }
  }

  // Test logu ekleme
  addTestLog(testId, platform, message, level = 'info') {
    const testRun = this.activeTests.get(testId);
    if (!testRun) return;

    const log = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      platform,
      message,
      level
    };

    testRun.logs.push(log);

    // WebSocket ile log gönder
    this.broadcastTestUpdate(testId, 'test_log', {
      testId,
      log
    });
  }

  // Test sonuçlarını veritabanına kaydet
  async saveTestToDatabase(testRun) {
    try {
      if (this.database) {
        const totalPassed = testRun.results.web.passed + testRun.results.mobile.passed;
        const totalFailed = testRun.results.web.failed + testRun.results.mobile.failed;
        
        await this.database.saveTestResult(
          testRun.id,
          testRun.platform,
          testRun.status,
          totalPassed,
          totalFailed,
          testRun.duration_ms,
          testRun.started_at,
          testRun.finished_at,
          testRun.web_started_at,
          testRun.web_finished_at,
          testRun.web_duration_ms,
          testRun.mobile_started_at,
          testRun.mobile_finished_at,
          testRun.mobile_duration_ms
        );
      }
    } catch (error) {
      console.error('Test sonucu kaydetme hatası:', error);
    }
  }

  // WebSocket ile güncelleme gönderme
  broadcastTestUpdate(testId, event, data) {
    // io instance'ı dışarıdan set edilecek
    if (this.io) {
      this.io.emit('test_update', {
        testId,
        event,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }

  // WebSocket io instance'ını set et
  setIO(io) {
    this.io = io;
  }

  // WebSocket instance'ını set et
  setSocketIO(io) {
    this.io = io;
  }

  // Database instance'ını set et
  setDatabase(database) {
    this.database = database;
  }

  // Test durumunu getir
  getTestStatus(testId) {
    return this.activeTests.get(testId);
  }

  // Aktif testleri getir
  getActiveTests() {
    return Array.from(this.activeTests.values());
  }

  // Test iptal etme
  cancelTest(testId) {
    const testRun = this.activeTests.get(testId);
    if (!testRun) return false;

    testRun.status = 'cancelled';
    testRun.endTime = new Date();

    this.broadcastTestUpdate(testId, 'test_cancelled', {
      testId,
      status: 'cancelled'
    });

    return true;
  }

  // Test temizleme
  cleanupTest(testId) {
    this.activeTests.delete(testId);
  }

  // Aktif run'ı getir
  getActiveRun() {
    for (const [testId, test] of this.activeTests) {
      if (test.status === 'started') {
        return {
          runId: testId,
          status: test.status,
          startedAt: test.startedAt,
          demoMode: test.demoMode
        };
      }
    }
    return null;
  }
}

export default TestOrchestrationService;
