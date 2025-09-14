import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Service
export class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'test-results.db');
  }

  // Veritabanını başlat
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Veritabanı bağlantı hatası:', err);
          reject(err);
        } else {
          console.log('✅ SQLite veritabanı bağlandı:', this.dbPath);
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  // Tabloları oluştur
  async createTables() {
    // Yeni tabloları oluştur
    await this.createEventsTable();
    await this.createRunsTable();
    await this.createPanelMetricsTable();
    
    const tables = [
      // Test sonuçları tablosu
      `CREATE TABLE IF NOT EXISTS test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        scope TEXT DEFAULT 'both',
        status TEXT NOT NULL,
        passed INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        started_at DATETIME NOT NULL,
        finished_at DATETIME,
        web_started_at DATETIME,
        web_finished_at DATETIME,
        web_duration_ms INTEGER DEFAULT 0,
        mobile_started_at DATETIME,
        mobile_finished_at DATETIME,
        mobile_duration_ms INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Test adımları tablosu
      `CREATE TABLE IF NOT EXISTS test_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        step_name TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        status TEXT NOT NULL,
        duration INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Test logları tablosu
      `CREATE TABLE IF NOT EXISTS test_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Barkod tarama sonuçları tablosu
      `CREATE TABLE IF NOT EXISTS barcode_scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id TEXT NOT NULL,
        barcode TEXT NOT NULL,
        type TEXT NOT NULL,
        valid BOOLEAN NOT NULL,
        message TEXT NOT NULL,
        device_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Dashboard metrikleri tablosu
      `CREATE TABLE IF NOT EXISTS dashboard_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        platform TEXT NOT NULL,
        total_tests INTEGER DEFAULT 0,
        passed_tests INTEGER DEFAULT 0,
        failed_tests INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0,
        avg_duration REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, platform)
      )`
    ];

    for (const table of tables) {
      await this.runQuery(table);
    }

    console.log('✅ Veritabanı tabloları oluşturuldu');
  }

  // SQL sorgusu çalıştır
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('SQL hatası:', err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  // SQL sorgusu ile veri getir
  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('SQL hatası:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Test sonucu kaydet
  async saveTestResult(testId, platform, status, passed, failed, duration_ms, started_at, finished_at = null, web_started_at = null, web_finished_at = null, web_duration_ms = 0, mobile_started_at = null, mobile_finished_at = null, mobile_duration_ms = 0) {
    const sql = `
      INSERT INTO test_results (test_id, platform, status, passed, failed, duration_ms, started_at, finished_at, web_started_at, web_finished_at, web_duration_ms, mobile_started_at, mobile_finished_at, mobile_duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return await this.runQuery(sql, [testId, platform, status, passed, failed, duration_ms, started_at, finished_at, web_started_at, web_finished_at, web_duration_ms, mobile_started_at, mobile_finished_at, mobile_duration_ms]);
  }

  // Test adımı kaydet
  async saveTestStep(testId, platform, stepName, stepIndex, status, duration) {
    const sql = `
      INSERT INTO test_steps (test_id, platform, step_name, step_index, status, duration)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    return await this.runQuery(sql, [testId, platform, stepName, stepIndex, status, duration]);
  }

  // Test logu kaydet
  async saveTestLog(testId, platform, level, message) {
    const sql = `
      INSERT INTO test_logs (test_id, platform, level, message)
      VALUES (?, ?, ?, ?)
    `;
    
    return await this.runQuery(sql, [testId, platform, level, message]);
  }

  // Barkod tarama sonucu kaydet
  async saveBarcodeScan(testId, barcode, type, valid, message, deviceId = null) {
    const sql = `
      INSERT INTO barcode_scans (test_id, barcode, type, valid, message, device_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    return await this.runQuery(sql, [testId, barcode, type, valid ? 1 : 0, message, deviceId]);
  }

  // Dashboard metrikleri güncelle
  async updateDashboardMetrics(date, platform, totalTests, passedTests, failedTests, avgDuration) {
    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
    
    const sql = `
      INSERT OR REPLACE INTO dashboard_metrics (date, platform, total_tests, passed_tests, failed_tests, success_rate, avg_duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    return await this.runQuery(sql, [date, platform, totalTests, passedTests, failedTests, successRate, avgDuration]);
  }

  // Son 7 gün test trendi getir
  async getTestTrend(days = 7, platform = null) {
    let sql = `
      SELECT 
        date,
        platform,
        total_tests,
        passed_tests,
        failed_tests,
        success_rate,
        avg_duration
      FROM dashboard_metrics
      WHERE date >= date('now', '-${days} days')
    `;
    
    const params = [];
    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    
    sql += ' ORDER BY date ASC';
    
    return await this.getQuery(sql, params);
  }

  // Test özeti getir
  async getTestSummary(days = 7, platform = null) {
    let sql = `
      SELECT 
        platform,
        SUM(total_tests) as total_tests,
        SUM(passed_tests) as passed_tests,
        SUM(failed_tests) as failed_tests,
        AVG(success_rate) as avg_success_rate,
        AVG(avg_duration) as avg_duration
      FROM dashboard_metrics
      WHERE date >= date('now', '-${days} days')
    `;
    
    const params = [];
    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    
    sql += ' GROUP BY platform';
    
    return await this.getQuery(sql, params);
  }

  // Test logları getir
  async getTestLogs(testId, platform = null) {
    let sql = `
      SELECT * FROM test_logs
      WHERE test_id = ?
    `;
    
    const params = [testId];
    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }
    
    sql += ' ORDER BY created_at ASC';
    
    return await this.getQuery(sql, params);
  }

  // Barkod tarama istatistikleri getir
  async getBarcodeStats(days = 7) {
    const sql = `
      SELECT 
        type,
        COUNT(*) as total_scans,
        SUM(CASE WHEN valid = 1 THEN 1 ELSE 0 END) as successful_scans,
        SUM(CASE WHEN valid = 0 THEN 1 ELSE 0 END) as failed_scans,
        ROUND(AVG(CASE WHEN valid = 1 THEN 1.0 ELSE 0.0 END) * 100, 2) as success_rate
      FROM barcode_scans
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY type
      ORDER BY total_scans DESC
    `;
    
    return await this.getQuery(sql);
  }

  // Anomalileri getir
  async getAnomalies(days = 7) {
    const sql = `
      SELECT 
        'TEST_FAILURE' as type,
        'HIGH' as severity,
        CONCAT(platform, ' testi başarısız: ', failed, ' hata') as message,
        start_time as timestamp,
        platform as test_type
      FROM test_results
      WHERE status = 'failed' 
        AND start_time >= datetime('now', '-${days} days')
      ORDER BY start_time DESC
      LIMIT 10
    `;
    
    return await this.getQuery(sql);
  }

  // Dashboard summary getir
  async getDashboardSummary(platform = 'all') {
    // Tamamlanmış koşular için ortalama hesapla (canlı koşu hariç)
    let sql = `
      SELECT
        COUNT(*) as total_runs,
        SUM(passed) as total_passed,
        SUM(failed) as total_failed,
        AVG(duration_ms) as avg_duration_ms_all,
        AVG(web_duration_ms) as avg_duration_ms_web,
        AVG(mobile_duration_ms) as avg_duration_ms_mobile
      FROM test_results
      WHERE finished_at IS NOT NULL
        AND started_at >= datetime('now', '-7 days')
    `;

    const params = [];
    if (platform === 'web') {
      sql += ' AND web_finished_at IS NOT NULL';
    } else if (platform === 'mobile') {
      sql += ' AND mobile_finished_at IS NOT NULL';
    }

    const result = await this.getQuery(sql, params);
    const data = result[0] || {};

    // Canlı koşuyu kontrol et
    const liveRunSql = `
      SELECT id, started_at, scope
      FROM test_results
      WHERE finished_at IS NULL
        AND started_at >= datetime('now', '-1 hour')
      ORDER BY started_at DESC
      LIMIT 1
    `;
    const liveRunResult = await this.getQuery(liveRunSql, []);
    const liveRun = liveRunResult[0] || null;

    return {
      cards: {
        total: data.total_runs || 0,
        passed: data.total_passed || 0,
        failed: data.total_failed || 0,
        successRate: data.total_runs > 0 ? Math.round((data.total_passed / data.total_runs) * 100) : 0
      },
      avg_duration_ms_all: Math.round(data.avg_duration_ms_all || 0),
      avg_duration_ms_web: Math.round(data.avg_duration_ms_web || 0),
      avg_duration_ms_mobile: Math.round(data.avg_duration_ms_mobile || 0),
      live_run: liveRun ? {
        id: liveRun.id,
        started_at: liveRun.started_at,
        scope: liveRun.scope
      } : null,
      trend7d: {
        all: [],
        web: [],
        mobile: []
      },
      alerts: []
    };
  }

  // Events tablosu oluştur
  async createEventsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS events (
          eventId TEXT PRIMARY KEY,
          runId TEXT NOT NULL,
          type TEXT NOT NULL,
          payload TEXT,
          source TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      this.db.run(sql, (err) => {
        if (err) {
          console.error('Events tablosu oluşturma hatası:', err);
          reject(err);
        } else {
          console.log('✅ Events tablosu oluşturuldu');
          resolve();
        }
      });
    });
  }

  // Runs tablosu oluştur
  async createRunsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS runs (
          runId TEXT PRIMARY KEY,
          state TEXT NOT NULL DEFAULT 'IDLE',
          lastEvent TEXT,
          lastEventTime TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      this.db.run(sql, (err) => {
        if (err) {
          console.error('Runs tablosu oluşturma hatası:', err);
          reject(err);
        } else {
          console.log('✅ Runs tablosu oluşturuldu');
          resolve();
        }
      });
    });
  }

  // Panel metrikleri tablosu oluştur
  async createPanelMetricsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS panel_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          totalTests INTEGER DEFAULT 0,
          webOverweight INTEGER DEFAULT 0,
          mobileOk INTEGER DEFAULT 0,
          mobileFail INTEGER DEFAULT 0,
          success INTEGER DEFAULT 0,
          failed INTEGER DEFAULT 0,
          lastUpdated TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      this.db.run(sql, (err) => {
        if (err) {
          console.error('Panel metrics tablosu oluşturma hatası:', err);
          reject(err);
        } else {
          console.log('✅ Panel metrics tablosu oluşturuldu');
          resolve();
        }
      });
    });
  }

  // Event kaydet/güncelle (idempotent)
  async upsertEvent(event) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO events 
        (eventId, runId, type, payload, source, timestamp, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        event.eventId,
        event.runId,
        event.type,
        JSON.stringify(event.payload),
        event.source,
        event.timestamp,
        event.createdAt,
        new Date().toISOString()
      ];
      
      this.db.run(sql, params, (err) => {
        if (err) {
          console.error('Event kaydetme hatası:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Run kaydet/güncelle
  async upsertRun(runData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO runs 
        (runId, state, lastEvent, lastEventTime, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        runData.runId,
        runData.state,
        runData.lastEvent,
        runData.lastEventTime,
        runData.createdAt || new Date().toISOString(),
        runData.updatedAt
      ];
      
      this.db.run(sql, params, (err) => {
        if (err) {
          console.error('Run kaydetme hatası:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Run getir
  async getRun(runId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM runs WHERE runId = ?';
      
      this.db.get(sql, [runId], (err, row) => {
        if (err) {
          console.error('Run getirme hatası:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // Run eventlerini getir
  async getRunEvents(runId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM events WHERE runId = ? ORDER BY timestamp';
      
      this.db.all(sql, [runId], (err, rows) => {
        if (err) {
          console.error('Run events getirme hatası:', err);
          reject(err);
        } else {
          const events = rows.map(row => ({
            ...row,
            payload: JSON.parse(row.payload || '{}')
          }));
          resolve(events);
        }
      });
    });
  }

  // Panel metriklerini güncelle
  async updatePanelMetrics(metrics) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO panel_metrics 
        (id, totalTests, webOverweight, mobileOk, mobileFail, success, failed, lastUpdated)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const params = [
        metrics.totalTests,
        metrics.webOverweight,
        metrics.mobileOk,
        metrics.mobileFail,
        metrics.success,
        metrics.failed,
        new Date().toISOString()
      ];
      
      this.db.run(sql, params, (err) => {
        if (err) {
          console.error('Panel metrics güncelleme hatası:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Panel metriklerini getir
  async getPanelMetrics() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM panel_metrics WHERE id = 1';
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          console.error('Panel metrics getirme hatası:', err);
          reject(err);
        } else {
          resolve(row || {
            totalTests: 0,
            webOverweight: 0,
            mobileOk: 0,
            mobileFail: 0,
            success: 0,
            failed: 0
          });
        }
      });
    });
  }

  // Panel metriklerini topla (incremental update)
  async updatePanelMetrics(metrics) {
    return new Promise((resolve, reject) => {
      // Önce mevcut metrikleri al
      this.getPanelMetrics().then(currentMetrics => {
        const updatedMetrics = {
          totalTests: (currentMetrics.totalTests || 0) + (metrics.totalTests || 0),
          webOverweight: (currentMetrics.webOverweight || 0) + (metrics.webOverweight || 0),
          mobileOk: (currentMetrics.mobileOk || 0) + (metrics.mobileOk || 0),
          mobileFail: (currentMetrics.mobileFail || 0) + (metrics.mobileFail || 0),
          success: (currentMetrics.success || 0) + (metrics.success || 0),
          failed: (currentMetrics.failed || 0) + (metrics.failed || 0)
        };

        const sql = `
          INSERT OR REPLACE INTO panel_metrics 
          (id, totalTests, webOverweight, mobileOk, mobileFail, success, failed, lastUpdated)
          VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
          updatedMetrics.totalTests,
          updatedMetrics.webOverweight,
          updatedMetrics.mobileOk,
          updatedMetrics.mobileFail,
          updatedMetrics.success,
          updatedMetrics.failed,
          new Date().toISOString()
        ];
        
        this.db.run(sql, params, (err) => {
          if (err) {
            console.error('Panel metrics güncelleme hatası:', err);
            reject(err);
          } else {
            resolve(updatedMetrics);
          }
        });
      }).catch(reject);
    });
  }

  // Veritabanını kapat
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Veritabanı kapatma hatası:', err);
        } else {
          console.log('✅ Veritabanı bağlantısı kapatıldı');
        }
      });
    }
  }
}

export default DatabaseService;
