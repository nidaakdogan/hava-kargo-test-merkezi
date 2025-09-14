const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Veritabanı bağlantısı
const dbPath = path.join(__dirname, 'test-results.db');
const db = new sqlite3.Database(dbPath);

// WebSocket sunucusu
let wss = null;

// In-memory cache - Tenant bazlı
const cache = {
  // Tenant bazlı veri yapısı
  tenants: new Map(),
  // Run durum makinesi
  runStates: {
    WEB_IN_PROGRESS: 'web_in_progress',
    WEB_DONE: 'web_done',
    MOBILE_IN_PROGRESS: 'mobile_in_progress',
    MOBILE_PAUSED: 'mobile_paused',
    MOBILE_DONE: 'mobile_done',
    COMPLETED: 'completed'
  },
  // Grace window için pending runs
  pendingCompletions: new Map()
};

// Tenant oluşturma fonksiyonu
function getOrCreateTenant(tenantId) {
  if (!cache.tenants.has(tenantId)) {
    cache.tenants.set(tenantId, {
      runs: new Map(),
      events: new Map(),
      dashboard: {
        total: 0,
        success: 0,
        failed: 0,
        web_overweight: 0,
        mobile_ok: 0,
        mobile_fail: 0,
        trend: []
      }
    });
  }
  return cache.tenants.get(tenantId);
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400'
};

// Utility functions
function sendResponse(res, statusCode, data, contentType = 'application/json') {
  res.writeHead(statusCode, { ...corsHeaders, 'Content-Type': contentType });
  res.end(JSON.stringify(data));
}

// Tenant ID'yi URL'den al
function getTenantFromUrl(url) {
  const urlObj = new URL(url, 'http://localhost:3001');
  return urlObj.searchParams.get('tenant') || 'default';
}

function logRequest(req, runId, eventId, type, accepted, latency) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | runId: ${runId || 'N/A'} | eventId: ${eventId || 'N/A'} | type: ${type || 'N/A'} | accepted: ${accepted} | latency: ${latency}ms`);
}

function broadcastUpdate(type, data) {
  if (wss) {
    const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Veritabanı tablolarını oluştur
function initDatabase() {
  db.serialize(() => {
    // Runs tablosu
    db.run(`
      CREATE TABLE IF NOT EXISTS runs (
        runId TEXT PRIMARY KEY,
        tenantId TEXT NOT NULL DEFAULT 'default',
        status TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'web_in_progress',
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        progress TEXT,
        meta TEXT,
        queueCount INTEGER DEFAULT 0
      )
    `);

    // Events tablosu
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        eventId TEXT PRIMARY KEY,
        runId TEXT NOT NULL,
        tenantId TEXT NOT NULL DEFAULT 'default',
        type TEXT NOT NULL,
        source TEXT,
        data TEXT,
        timestamp TEXT NOT NULL,
        processed BOOLEAN DEFAULT 0,
        FOREIGN KEY (runId) REFERENCES runs (runId)
      )
    `);

    // Mobile queue tablosu (offline olaylar için)
    db.run(`
      CREATE TABLE IF NOT EXISTS mobile_queue (
        eventId TEXT PRIMARY KEY,
        runId TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        ts TEXT NOT NULL,
        retryCount INTEGER DEFAULT 0,
        lastRetry TEXT,
        status TEXT DEFAULT 'pending',
        FOREIGN KEY (runId) REFERENCES runs (runId)
      )
    `);

    // Dashboard KPI tablosu
    db.run(`
      CREATE TABLE IF NOT EXISTS dashboard_kpi (
        dateBucket TEXT,
        tenantId TEXT NOT NULL DEFAULT 'default',
        total INTEGER DEFAULT 0,
        success INTEGER DEFAULT 0,
        failed INTEGER DEFAULT 0,
        web_overweight INTEGER DEFAULT 0,
        mobile_ok INTEGER DEFAULT 0,
        mobile_fail INTEGER DEFAULT 0,
        trend TEXT,
        lastUpdated TEXT NOT NULL,
        PRIMARY KEY (dateBucket, tenantId)
      )
    `);

    console.log('✅ Veritabanı tabloları oluşturuldu');
  });
}

// Dashboard KPI'ları güncelle
function updateDashboardKPIs(tenant, runProgress, status) {
  const today = new Date().toISOString().split('T')[0];
  
  // Tenant bazlı KPI güncelleme
  if (status === 'web_try') {
    tenant.dashboard.web_overweight++;
  } else if (status === 'barcode_ok') {
    tenant.dashboard.mobile_ok++;
  } else if (status === 'barcode_fail') {
    tenant.dashboard.mobile_fail++;
  } else if (status === 'completed') {
    tenant.dashboard.total++;
    if (runProgress.web_ok > 0 || runProgress.mob_ok > 0) {
      tenant.dashboard.success++;
    } else {
      tenant.dashboard.failed++;
    }
  }
  
  // DB'ye kaydet (tenant bazlı)
  db.get('SELECT * FROM dashboard_kpi WHERE dateBucket = ? AND tenantId = ?', [today, tenant.tenantId || 'default'], (err, row) => {
    if (err) {
      console.error('Dashboard KPI güncelleme hatası:', err);
      return;
    }

    const current = row || {
      dateBucket: today,
      tenantId: tenant.tenantId || 'default',
      total: 0,
      success: 0,
      failed: 0,
      web_overweight: 0,
      mobile_ok: 0,
      mobile_fail: 0,
      trend: '[]',
      lastUpdated: new Date().toISOString()
    };

    const updated = {
      ...current,
      total: current.total + 1,
      success: status === 'success' ? current.success + 1 : current.success,
      failed: status === 'failed' ? current.failed + 1 : current.failed,
      web_overweight: current.web_overweight + (runProgress.web_overweight || 0),
      mobile_ok: current.mobile_ok + (runProgress.mob_ok || 0),
      mobile_fail: current.mobile_fail + (runProgress.mob_fail || 0),
      lastUpdated: new Date().toISOString()
    };

    db.run(`
      INSERT OR REPLACE INTO dashboard_kpi 
      (dateBucket, total, success, failed, web_overweight, mobile_ok, mobile_fail, trend, lastUpdated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      updated.dateBucket,
      updated.total,
      updated.success,
      updated.failed,
      updated.web_overweight,
      updated.mobile_ok,
      updated.mobile_fail,
      updated.trend,
      updated.lastUpdated
    ], (err) => {
      if (err) {
        console.error('Dashboard KPI kaydetme hatası:', err);
      } else {
        console.log('📊 Dashboard KPI güncellendi:', updated);
        // Cache'i güncelle
        cache.dashboard = {
          total: updated.total,
          success: updated.success,
          failed: updated.failed,
          web_overweight: updated.web_overweight,
          mobile_ok: updated.mobile_ok,
          mobile_fail: updated.mobile_fail,
          trend: JSON.parse(updated.trend)
        };
        broadcastUpdate('dashboard_update', cache.dashboard);
      }
    });
  });
}

// 7-günlük trend verilerini al
function getTrendData(callback) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];

  db.all(`
    SELECT dateBucket, total, success, failed 
    FROM dashboard_kpi 
    WHERE dateBucket >= ? 
    ORDER BY dateBucket ASC
  `, [startDate], (err, rows) => {
    if (err) {
      console.error('Trend verisi alma hatası:', err);
      callback([]);
      return;
    }
    callback(rows || []);
  });
}

// Run durumunu güncelle
function updateRunState(runId, newState, callback) {
  const run = cache.runs.get(runId);
  if (!run) {
    callback(new Error('Run bulunamadı'));
    return;
  }

  run.state = newState;
  run.progress.lastUpdateAt = new Date().toISOString();

  db.run(`
    UPDATE runs 
    SET state = ?, progress = ?
    WHERE runId = ?
  `, [newState, JSON.stringify(run.progress), runId], (err) => {
    if (err) {
      console.error('Run state güncelleme hatası:', err);
      callback(err);
      return;
    }

    // Real-time güncelleme yayınla
    broadcastUpdate('run_update', {
      runId,
      state: newState,
      progress: run.progress,
      queueCount: run.queueCount || 0
    });

    console.log(`🔄 Run ${runId} durumu: ${newState}`);
    callback(null, run);
  });
}

// Grace window için pending completion
function scheduleGraceWindowCompletion(runId, graceWindowMs = 30000) {
  if (cache.pendingCompletions.has(runId)) {
    return; // Zaten pending
  }

  const timeoutId = setTimeout(() => {
    console.log(`⏰ Grace window doldu, run ${runId} tamamlanıyor`);
    completeRunGracefully(runId);
    cache.pendingCompletions.delete(runId);
  }, graceWindowMs);

  cache.pendingCompletions.set(runId, timeoutId);
  console.log(`⏳ Grace window başlatıldı: ${runId} (${graceWindowMs}ms)`);
}

// Grace window ile run tamamlama
function completeRunGracefully(runId) {
  const run = cache.runs.get(runId);
  if (!run) return;

  // Mobile queue'daki pending olayları işle
  db.all(`
    SELECT * FROM mobile_queue 
    WHERE runId = ? AND status = 'pending'
    ORDER BY ts ASC
  `, [runId], (err, pendingEvents) => {
    if (err) {
      console.error('Pending events alma hatası:', err);
      return;
    }

    if (pendingEvents.length > 0) {
      console.log(`📦 Grace window'da ${pendingEvents.length} pending event işleniyor`);
      processBulkEvents(runId, pendingEvents, () => {
        finalizeRun(runId, 'success');
      });
    } else {
      finalizeRun(runId, 'success');
    }
  });
}

// Run'ı finalize et
function finalizeRun(runId, status) {
  const run = cache.runs.get(runId);
  if (!run) return;

  run.status = 'completed';
  run.state = cache.runStates.COMPLETED;
  run.completedAt = new Date().toISOString();

  db.run(`
    UPDATE runs 
    SET status = ?, state = ?, completedAt = ?, progress = ?
    WHERE runId = ?
  `, [run.status, run.state, run.completedAt, JSON.stringify(run.progress), runId], (err) => {
    if (err) {
      console.error('Run finalize hatası:', err);
      return;
    }

    // Dashboard KPI'ları güncelle
    updateDashboardKPIs(run.progress, status);

    // Real-time güncelleme - run bitti
    broadcastUpdate('run_update', {
      runId,
      state: run.state,
      status: run.status,
      progress: run.progress,
      ended: true,
      message: 'Koşum bitti – yeni test başlatın'
    });

    // Dashboard güncellemesi - KPI kartları artar
    broadcastUpdate('dashboard_update', {
      runId,
      status,
      message: 'KPI kartları güncellendi'
    });

    console.log(`✅ Run ${runId} finalize edildi: ${status}`);
    console.log(`📊 Dashboard KPI güncellemesi yayınlandı`);
  });
}

// Bulk events işleme
function processBulkEvents(runId, events, callback) {
  if (!events || events.length === 0) {
    callback();
    return;
  }

  const run = cache.runs.get(runId);
  if (!run) {
    callback(new Error('Run bulunamadı'));
    return;
  }

  let processedCount = 0;
  let hasErrors = false;

  events.forEach((event, index) => {
    // Event'i işle
    processEvent(runId, event.type, JSON.parse(event.payload), (err) => {
      if (err) {
        console.error(`Bulk event işleme hatası: ${event.eventId}`, err);
        hasErrors = true;
      } else {
        // Event'i processed olarak işaretle
        db.run(`
          UPDATE mobile_queue 
          SET status = 'processed', processed = 1
          WHERE eventId = ?
        `, [event.eventId], (err) => {
          if (err) console.error('Event processed işaretleme hatası:', err);
        });
      }

      processedCount++;
      if (processedCount === events.length) {
        if (hasErrors) {
          console.log(`⚠️ Bulk events işlendi (${processedCount}/${events.length}) - bazı hatalar var`);
        } else {
          console.log(`✅ Bulk events başarıyla işlendi (${processedCount})`);
        }
        callback();
      }
    });
  });
}

// Event işleme (idempotent)
function processEvent(runId, type, payload, callback) {
  const run = cache.runs.get(runId);
  if (!run) {
    callback(new Error('Run bulunamadı'));
    return;
  }

  let updated = false;
  switch (type) {
    case 'web_try':
      if (payload.valid) {
        run.progress.web_ok++;
      } else {
        run.progress.web_fail++;
      }
      updated = true;
      break;
    case 'barcode_ok':
      run.progress.mob_ok++;
      updated = true;
      break;
    case 'barcode_fail':
      run.progress.mob_fail++;
      updated = true;
      break;
    case 'web_overweight':
      run.progress.web_overweight++;
      updated = true;
      break;
    case 'mobile_heartbeat':
      // Heartbeat - sadece log
      console.log(`💓 Mobile heartbeat: ${runId}`);
      break;
  }

  if (updated) {
    run.progress.lastUpdateAt = new Date().toISOString();
    
    db.run(`
      UPDATE runs SET progress = ? WHERE runId = ?
    `, [JSON.stringify(run.progress), runId], (err) => {
      if (err) {
        console.error('Run progress güncelleme hatası:', err);
        callback(err);
        return;
      }

      // Real-time güncelleme
      broadcastUpdate('run_update', {
        runId,
        state: run.state,
        progress: run.progress,
        queueCount: run.queueCount || 0
      });

      callback(null);
    });
  } else {
    callback(null);
  }
}

// HTTP sunucusu
const server = http.createServer((req, res) => {
  const startTime = Date.now();
  
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/health') {
    const latency = Date.now() - startTime;
    logRequest(req, null, null, 'health', true, latency);
    sendResponse(res, 200, { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      websocket: wss ? wss.clients.size : 0
    });
    return;
  }

  // Run başlatma
  if (pathname === '/runs/start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const runId = uuidv4();
      const run = {
        runId,
        status: 'running',
        state: cache.runStates.WEB_IN_PROGRESS,
        startedAt: new Date().toISOString(),
        completedAt: null,
        progress: {
          web_ok: 0,
          web_fail: 0,
          mob_ok: 0,
          mob_fail: 0,
          web_overweight: 0,
          durations: {
            web_ms: 0,
            mobile_ms: 0,
            total_ms: 0
          },
          lastUpdateAt: new Date().toISOString()
        },
        meta: {
          client: 'test-lab',
          version: '1.0.0'
        },
        queueCount: 0
      };

      cache.runs.set(runId, run);
      
      db.run(`
        INSERT INTO runs (runId, status, state, startedAt, completedAt, progress, meta, queueCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [runId, run.status, run.state, run.startedAt, run.completedAt, JSON.stringify(run.progress), JSON.stringify(run.meta), run.queueCount], (err) => {
        if (err) {
          console.error('Run kaydetme hatası:', err);
          sendResponse(res, 500, { error: 'Run kaydedilemedi' });
          return;
        }

        const latency = Date.now() - startTime;
        logRequest(req, runId, null, 'run_start', true, latency);
        sendResponse(res, 201, { runId, state: run.state });
        broadcastUpdate('run_update', { 
          runId, 
          state: run.state, 
          progress: run.progress, 
          queueCount: run.queueCount 
        });
      });
    });
    return;
  }

  // Run tamamlama
  if (pathname === '/runs/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { runId, status } = JSON.parse(body);
        
        if (!runId || !status) {
          sendResponse(res, 400, { error: 'runId ve status gerekli' });
          return;
        }

        const run = cache.runs.get(runId);
        if (!run) {
          sendResponse(res, 404, { error: 'Run bulunamadı' });
          return;
        }

        if (run.status === 'completed') {
          const latency = Date.now() - startTime;
          logRequest(req, runId, null, 'run_complete', false, latency);
          sendResponse(res, 200, { message: 'Run zaten tamamlanmış (idempotent)' });
          return;
        }

        run.status = 'completed';
        run.completedAt = new Date().toISOString();

        db.run(`
          UPDATE runs 
          SET status = ?, completedAt = ?, progress = ?
          WHERE runId = ?
        `, [run.status, run.completedAt, JSON.stringify(run.progress), runId], (err) => {
          if (err) {
            console.error('Run güncelleme hatası:', err);
            sendResponse(res, 500, { error: 'Run güncellenemedi' });
            return;
          }

          // Dashboard KPI'ları güncelle
          updateDashboardKPIs(run.progress, status);

          const latency = Date.now() - startTime;
          logRequest(req, runId, null, 'run_complete', true, latency);
          sendResponse(res, 200, { message: 'Run tamamlandı', runId, status });
          broadcastUpdate('run_update', { runId, status: 'completed', progress: run.progress });
        });
      } catch (error) {
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Event gönderme
  if (pathname === '/events' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        const { runId, type, payload } = event;
        const eventId = uuidv4();

        if (!runId || !type) {
          sendResponse(res, 400, { error: 'runId ve type gerekli' });
          return;
        }

        const run = cache.runs.get(runId);
        if (!run) {
          sendResponse(res, 404, { error: 'Run bulunamadı' });
          return;
        }

        // Run state kontrolü - sadece IN_PROGRESS run'lar için event kabul et
        if (run.state === cache.runStates.COMPLETED || run.status === 'completed') {
          const latency = Date.now() - startTime;
          logRequest(req, runId, eventId, type, false, latency);
          sendResponse(res, 409, { 
            error: 'Test sonlandırıldı', 
            reason: 'run_completed',
            runId,
            state: run.state,
            message: 'Koşum bitti – yeni test başlatın'
          });
          return;
        }

        if (run.state === cache.runStates.MOBILE_PAUSED) {
          const latency = Date.now() - startTime;
          logRequest(req, runId, eventId, type, false, latency);
          sendResponse(res, 410, { 
            error: 'Test duraklatıldı', 
            reason: 'run_paused',
            runId,
            state: run.state,
            message: 'Bağlantı kesildi – yeniden bağlanın'
          });
          return;
        }

        // Event'i kaydet
        db.run(`
          INSERT INTO events (eventId, runId, type, payload, ts, processed)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [eventId, runId, type, JSON.stringify(payload), new Date().toISOString(), 1], (err) => {
          if (err) {
            console.error('Event kaydetme hatası:', err);
            sendResponse(res, 500, { error: 'Event kaydedilemedi' });
            return;
          }

          // Event'i işle
          processEvent(runId, type, payload, (err) => {
            if (err) {
              console.error('Event işleme hatası:', err);
              sendResponse(res, 500, { error: 'Event işlenemedi' });
              return;
            }

            // Durum geçişleri
            if (type === 'web_test_completed' && run.state === cache.runStates.WEB_IN_PROGRESS) {
              updateRunState(runId, cache.runStates.WEB_DONE, (err) => {
                if (err) console.error('Web done state güncelleme hatası:', err);
              });
            } else if (type === 'barcode_ok' || type === 'barcode_fail') {
              if (run.state === cache.runStates.WEB_DONE) {
                updateRunState(runId, cache.runStates.MOBILE_IN_PROGRESS, (err) => {
                  if (err) console.error('Mobile in progress state güncelleme hatası:', err);
                });
              }
            } else if (type === 'mobile_test_completed' && run.state === cache.runStates.MOBILE_IN_PROGRESS) {
              updateRunState(runId, cache.runStates.MOBILE_DONE, (err) => {
                if (err) console.error('Mobile done state güncelleme hatası:', err);
                // Otomatik finalize
                setTimeout(() => {
                  finalizeRun(runId, 'success');
                }, 1000);
              });
            }

            const latency = Date.now() - startTime;
            logRequest(req, runId, eventId, type, true, latency);
            sendResponse(res, 201, { eventId, runId, type, accepted: true });
          });
        });
      } catch (error) {
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Bulk events gönderme (mobil offline sync)
  if (pathname === '/events/bulk' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { runId, events } = JSON.parse(body);

        if (!runId || !events || !Array.isArray(events)) {
          sendResponse(res, 400, { error: 'runId ve events array gerekli' });
          return;
        }

        const run = cache.runs.get(runId);
        if (!run) {
          sendResponse(res, 404, { error: 'Run bulunamadı' });
          return;
        }

        // Bulk events'i işle
        processBulkEvents(runId, events, (err) => {
          if (err) {
            console.error('Bulk events işleme hatası:', err);
            sendResponse(res, 500, { error: 'Bulk events işlenemedi' });
            return;
          }

          const latency = Date.now() - startTime;
          logRequest(req, runId, null, 'bulk_events', true, latency);
          sendResponse(res, 201, { 
            runId, 
            processed: events.length, 
            accepted: true 
          });
        });
      } catch (error) {
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Run progress sorgulama
  if (pathname === '/runs/progress' && req.method === 'GET') {
    const runId = url.searchParams.get('runId');
    
    if (!runId) {
      sendResponse(res, 400, { error: 'runId gerekli' });
      return;
    }

    const run = cache.runs.get(runId);
    if (!run) {
      sendResponse(res, 404, { error: 'Run bulunamadı' });
      return;
    }

    const latency = Date.now() - startTime;
    logRequest(req, runId, null, 'run_progress', true, latency);
    sendResponse(res, 200, {
      runId,
      state: run.state,
      status: run.status,
      progress: run.progress,
      queueCount: run.queueCount || 0,
      startedAt: run.startedAt,
      completedAt: run.completedAt
    });
    return;
  }

  // Web test tamamlama (durum geçişi)
  if (pathname === '/runs/web-done' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { runId } = JSON.parse(body);
        
        if (!runId) {
          sendResponse(res, 400, { error: 'runId gerekli' });
          return;
        }

        updateRunState(runId, cache.runStates.WEB_DONE, (err, run) => {
          if (err) {
            sendResponse(res, 404, { error: 'Run bulunamadı veya güncellenemedi' });
            return;
          }

          const latency = Date.now() - startTime;
          logRequest(req, runId, null, 'web_done', true, latency);
          sendResponse(res, 200, { 
            runId, 
            state: run.state, 
            message: 'Web test tamamlandı, mobil teste geçildi' 
          });
        });
      } catch (error) {
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Mobile test başlatma (durum geçişi)
  if (pathname === '/runs/mobile-start' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { runId } = JSON.parse(body);
        
        if (!runId) {
          sendResponse(res, 400, { error: 'runId gerekli' });
          return;
        }

        updateRunState(runId, cache.runStates.MOBILE_IN_PROGRESS, (err, run) => {
          if (err) {
            sendResponse(res, 404, { error: 'Run bulunamadı veya güncellenemedi' });
            return;
          }

          const latency = Date.now() - startTime;
          logRequest(req, runId, null, 'mobile_start', true, latency);
          sendResponse(res, 200, { 
            runId, 
            state: run.state, 
            message: 'Mobil test başlatıldı' 
          });
        });
      } catch (error) {
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Mobile test tamamlama (grace window ile)
  if (pathname === '/runs/mobile-done' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { runId, forceComplete = false } = JSON.parse(body);
        
        if (!runId) {
          sendResponse(res, 400, { error: 'runId gerekli' });
          return;
        }

        const run = cache.runs.get(runId);
        if (!run) {
          sendResponse(res, 404, { error: 'Run bulunamadı' });
          return;
        }

        if (forceComplete) {
          // Zorla tamamlama - grace window beklemeden
          finalizeRun(runId, 'success');
          sendResponse(res, 200, { 
            runId, 
            message: 'Mobil test zorla tamamlandı' 
          });
        } else {
          // Grace window ile tamamlama
          updateRunState(runId, cache.runStates.MOBILE_DONE, (err) => {
            if (err) {
              sendResponse(res, 404, { error: 'Run güncellenemedi' });
              return;
            }

            // Grace window başlat
            scheduleGraceWindowCompletion(runId);

            const latency = Date.now() - startTime;
            logRequest(req, runId, null, 'mobile_done', true, latency);
            sendResponse(res, 200, { 
              runId, 
              state: cache.runStates.MOBILE_DONE,
              message: 'Mobil test tamamlandı, grace window başlatıldı' 
            });
          });
        }
      } catch (error) {
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
                                                                                                                                          8  // Test tamamlama (Shadow Runner için)
  if (pathname === '/api/tests/complete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { testId } = JSON.parse(body);
        
        if (!testId) {
          sendResponse(res, 400, { error: 'testId gerekli' });
          return;
        }

        const run = cache.runs.get(testId);
        if (!run) {
          sendResponse(res, 404, { error: 'Test bulunamadı' });
          return;
        }

        // Test'i tamamla
        run.status = 'completed';
        run.state = cache.runStates.COMPLETED;
        run.completedAt = new Date().toISOString();

        // Veritabanını güncelle
        db.run(`
          UPDATE runs
          SET status = ?, state = ?, completedAt = ?, progress = ?
          WHERE runId = ?
        `, [run.status, run.state, run.completedAt, JSON.stringify(run.progress), testId], (err) => {
          if (err) {
            console.error('Test tamamlama hatası:', err);
            sendResponse(res, 500, { error: 'Test tamamlanamadı' });
            return;
          }

          // KPI'ları güncelle
          updateDashboardKPIs(run.progress, 'completed');

          // WebSocket güncellemeleri
          broadcastUpdate('run_update', {
            runId: testId,
            state: run.state,
            status: run.status,
            progress: run.progress,
            ended: true,
            message: 'Test tamamlandı - KPI güncellendi'
          });

          broadcastUpdate('dashboard_update', {
            runId: testId,
            status: 'completed',
            message: 'KPI kartları güncellendi'
          });

          console.log(`✅ Test ${testId} tamamlandı - KPI güncellendi`);
          console.log(`📊 Dashboard KPI güncellemesi yayınlandı`);

          sendResponse(res, 200, {
            success: true,
            message: 'Test başarıyla tamamlandı',
            runId: testId,
            status: 'completed',
            kpiUpdated: true
          });
        });

      } catch (err) {
        console.error('Test tamamlama JSON hatası:', err);
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Test sıfırlama (mobil için)
  if (pathname === '/runs/reset' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { runId } = JSON.parse(body);
        
        if (!runId) {
          sendResponse(res, 400, { error: 'runId gerekli' });
          return;
        }

        const run = cache.runs.get(runId);
        if (!run) {
          sendResponse(res, 404, { error: 'Run bulunamadı' });
          return;
        }

        // Mobile queue'yu temizle
        db.run(`
          DELETE FROM mobile_queue WHERE runId = ?
        `, [runId], (err) => {
          if (err) {
            console.error('Mobile queue temizleme hatası:', err);
          }
        });

        // Run'ı IDLE durumuna getir
        run.state = 'idle';
        run.status = 'idle';
        run.progress = {
          web_ok: 0,
          web_fail: 0,
          mob_ok: 0,
          mob_fail: 0,
          web_overweight: 0,
          durations: {
            web_ms: 0,
            mobile_ms: 0,
            total_ms: 0
          },
          lastUpdateAt: new Date().toISOString()
        };
        run.queueCount = 0;

        // Cache'den kaldır
        cache.runs.delete(runId);

        // Pending completion'ı iptal et
        if (cache.pendingCompletions.has(runId)) {
          clearTimeout(cache.pendingCompletions.get(runId));
          cache.pendingCompletions.delete(runId);
        }

        const latency = Date.now() - startTime;
        logRequest(req, runId, null, 'run_reset', true, latency);
        sendResponse(res, 200, { 
          runId, 
          state: 'idle',
          message: 'Test sıfırlandı – yeni test başlatabilirsiniz' 
        });

        // Real-time güncelleme
        broadcastUpdate('run_reset', {
          runId,
          state: 'idle',
          message: 'Test sıfırlandı – yeni test başlatabilirsiniz'
        });

        console.log(`🔄 Run ${runId} sıfırlandı`);
      } catch (error) {
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Dashboard summary
  if (pathname === '/dashboard/summary' && req.method === 'GET') {
    const filter = url.searchParams.get('filter') || 'all';
    
    getTrendData((trendData) => {
      let summary = { ...cache.dashboard, trend: trendData };
      
      // Filtreleme
      if (filter === 'web') {
        summary = {
          total: summary.web_overweight,
          success: summary.web_overweight,
          failed: 0,
          web_overweight: summary.web_overweight,
          mobile_ok: 0,
          mobile_fail: 0,
          trend: trendData.map(d => ({ ...d, mobile_ok: 0, mobile_fail: 0 }))
        };
      } else if (filter === 'mobile') {
        summary = {
          total: summary.mobile_ok + summary.mobile_fail,
          success: summary.mobile_ok,
          failed: summary.mobile_fail,
          web_overweight: 0,
          mobile_ok: summary.mobile_ok,
          mobile_fail: summary.mobile_fail,
          trend: trendData.map(d => ({ ...d, web_overweight: 0 }))
        };
      }

      const latency = Date.now() - startTime;
      logRequest(req, null, null, 'dashboard_summary', true, latency);
      sendResponse(res, 200, summary);
    });
    return;
  }

  // Test başlatma (Shadow Runner için)
  if (pathname === '/api/tests/start' && req.method === 'POST') {
    const tenantId = getTenantFromUrl(req.url);
    const tenant = getOrCreateTenant(tenantId);
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const run = {
        runId,
        tenantId,
        status: 'running',
        state: cache.runStates.WEB_IN_PROGRESS,
        startedAt: new Date().toISOString(),
        completedAt: null,
        progress: {
          web_ok: 0,
          web_fail: 0,
          mob_ok: 0,
          mob_fail: 0,
          web_overweight: 0,
          durations: {
            web_ms: 0,
            mobile_ms: 0,
            total_ms: 0
          }
        }
      };
      
      tenant.runs.set(runId, run);
      
      // DB'ye kaydet
      db.run(`
        INSERT INTO runs (runId, tenantId, status, state, startedAt, progress)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [runId, tenantId, run.status, run.state, run.startedAt, JSON.stringify(run.progress)], (err) => {
        if (err) {
          console.error('Run kaydetme hatası:', err);
          sendResponse(res, 500, { error: 'Run kaydedilemedi' });
          return;
        }
        
        const latency = Date.now() - startTime;
        logRequest(req, runId, null, 'test_start', true, latency);
        console.log(`🚀 [${tenantId}] Yeni run başlatıldı: ${runId}`);
        sendResponse(res, 201, { testId: runId, state: run.state, tenantId });
      });
    });
    return;
  }

  // Test tamamlama (Shadow Runner için)
  if (pathname === '/api/tests/complete' && req.method === 'POST') {
    const tenantId = getTenantFromUrl(req.url);
    const tenant = getOrCreateTenant(tenantId);
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { testId } = JSON.parse(body);
        if (!testId) { 
          sendResponse(res, 400, { error: 'testId gerekli' }); 
          return; 
        }
        
        const run = tenant.runs.get(testId);
        if (!run) { 
          sendResponse(res, 404, { error: 'Test bulunamadı' }); 
          return; 
        }
        
        run.status = 'completed';
        run.state = cache.runStates.COMPLETED;
        run.completedAt = new Date().toISOString();
        
        // DB'yi güncelle
        db.run(`
          UPDATE runs
          SET status = ?, state = ?, completedAt = ?, progress = ?
          WHERE runId = ? AND tenantId = ?
        `, [run.status, run.state, run.completedAt, JSON.stringify(run.progress), testId, tenantId], (err) => {
          if (err) { 
            console.error('Test tamamlama hatası:', err); 
            sendResponse(res, 500, { error: 'Test tamamlanamadı' }); 
            return; 
          }
          
          // KPI'ları güncelle
          updateDashboardKPIs(tenant, run.progress, 'completed');
          
          // WebSocket yayını
          broadcastUpdate('run_update', { 
            runId: testId, 
            tenantId,
            state: run.state, 
            status: run.status, 
            progress: run.progress, 
            ended: true, 
            message: 'Test tamamlandı - KPI güncellendi' 
          });
          broadcastUpdate('dashboard_update', { 
            runId: testId, 
            tenantId,
            status: 'completed', 
            message: 'KPI kartları güncellendi' 
          });
          
          const latency = Date.now() - startTime;
          logRequest(req, testId, null, 'test_complete', true, latency);
          console.log(`✅ [${tenantId}] Test ${testId} tamamlandı - KPI güncellendi`);
          sendResponse(res, 200, { 
            success: true, 
            message: 'Test başarıyla tamamlandı', 
            runId: testId, 
            tenantId,
            status: 'completed', 
            kpiUpdated: true 
          });
        });
      } catch (err) { 
        console.error('Test tamamlama JSON hatası:', err); 
        sendResponse(res, 400, { error: 'Geçersiz JSON' }); 
      }
    });
    return;
  }

  // Events endpoint (Shadow Runner için)
  if (pathname === '/api/events' && req.method === 'POST') {
    const tenantId = getTenantFromUrl(req.url);
    const tenant = getOrCreateTenant(tenantId);
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { runId, eventId, type, source, data } = JSON.parse(body);
        
        if (!runId || !eventId || !type) {
          sendResponse(res, 400, { error: 'runId, eventId ve type gerekli' });
          return;
        }
        
        // Run kontrolü
        const run = tenant.runs.get(runId);
        if (!run) {
          sendResponse(res, 404, { error: 'Run bulunamadı' });
          return;
        }
        
        // Event kaydet
        const event = {
          eventId,
          runId,
          tenantId,
          type,
          source,
          data,
          timestamp: new Date().toISOString()
        };
        
        tenant.events.set(eventId, event);
        
        // DB'ye kaydet
        db.run(`
          INSERT INTO events (eventId, runId, tenantId, type, source, data, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [eventId, runId, tenantId, type, source, JSON.stringify(data), event.timestamp], (err) => {
          if (err) {
            console.error('Event kaydetme hatası:', err);
            sendResponse(res, 500, { error: 'Event kaydedilemedi' });
            return;
          }
          
          // KPI'ları güncelle
          updateDashboardKPIs(tenant, run.progress, type);
          
          // WebSocket yayını
          broadcastUpdate('run_update', { 
            runId, 
            tenantId,
            state: run.state, 
            status: run.status, 
            progress: run.progress, 
            message: 'Event işlendi' 
          });
          
          const latency = Date.now() - startTime;
          logRequest(req, runId, eventId, type, true, latency);
          console.log(`📝 [${tenantId}] Event kaydedildi: ${eventId} (${type}) - ${source}`);
          sendResponse(res, 200, { success: true, message: 'Event kaydedildi' });
        });
      } catch (err) {
        console.error('Event JSON hatası:', err);
        sendResponse(res, 400, { error: 'Geçersiz JSON' });
      }
    });
    return;
  }

  // Dashboard summary (tenant bazlı)
  if (pathname === '/api/dashboard/summary' && req.method === 'GET') {
    const tenantId = getTenantFromUrl(req.url);
    const tenant = getOrCreateTenant(tenantId);
    
    const latency = Date.now() - startTime;
    logRequest(req, null, null, 'dashboard_summary', true, latency);
    
    sendResponse(res, 200, {
      success: true,
      data: {
        cards: {
          total: tenant.dashboard.total,
          passed: tenant.dashboard.success,
          failed: tenant.dashboard.failed,
          successRate: tenant.dashboard.total > 0 ? Math.round((tenant.dashboard.success / tenant.dashboard.total) * 100) : 0
        },
        avg_duration_ms_all: 1500,
        avg_duration_ms_web: 800,
        avg_duration_ms_mobile: 700,
        live_run: null,
        trend7d: { all: [], web: [], mobile: [] },
        lastUpdate: new Date().toISOString(),
        tenantId
      }
    });
    return;
  }

  // Admin reset (tenant bazlı)
  if (pathname === '/api/admin/reset' && req.method === 'POST') {
    const tenantId = getTenantFromUrl(req.url);
    const tenant = getOrCreateTenant(tenantId);
    
    // Tenant verilerini sıfırla
    tenant.runs.clear();
    tenant.events.clear();
    tenant.dashboard = {
      total: 0,
      success: 0,
      failed: 0,
      web_overweight: 0,
      mobile_ok: 0,
      mobile_fail: 0,
      trend: []
    };
    
    // DB'den tenant verilerini sil
    db.run(`DELETE FROM runs WHERE tenantId = ?`, [tenantId]);
    db.run(`DELETE FROM events WHERE tenantId = ?`, [tenantId]);
    
    const latency = Date.now() - startTime;
    logRequest(req, null, null, 'admin_reset', true, latency);
    console.log(`🗑️ [${tenantId}] Tenant sıfırlandı`);
    
    sendResponse(res, 200, { 
      success: true, 
      message: 'Tenant sıfırlandı', 
      tenantId 
    });
    return;
  }

  // Diğer endpoint'ler
  if (pathname.startsWith('/api/')) {
    const latency = Date.now() - startTime;
    logRequest(req, null, null, 'api_other', true, latency);
    sendResponse(res, 200, { message: 'Backend çalışıyor!', endpoint: pathname });
    return;
  }

  // 404
  sendResponse(res, 404, { error: 'Endpoint bulunamadı' });
});

// WebSocket sunucusu
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/events') {
    wss = new WebSocket.Server({ noServer: true });
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// WebSocket bağlantı yönetimi
if (wss) {
  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket bağlantısı kuruldu');
    
    ws.on('close', () => {
      console.log('🔌 WebSocket bağlantısı kapatıldı');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket hatası:', error);
    });
  });
}

// Sunucuyu başlat
const PORT = 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Mock API sunucusu çalışıyor: http://0.0.0.0:3001');
  console.log('🔌 WebSocket sunucusu aktif: ws://0.0.0.0:3001');
  console.log('📱 Android Emülatör: http://10.0.2.2:3001');
  console.log('🌐 Localhost: http://localhost:3001');
  console.log('📊 Test sonuçları endpoint: http://localhost:3001/api/test-results');
  console.log('⚠️  Anomaliler endpoint: http://localhost:3001/api/test-results/anomalies');
  console.log('🔄 Manuel güncelleme: POST http://localhost:3001/api/test-results/update');
  console.log('🗑️  Sıfırlama: POST http://localhost:3001/api/test-results/reset');
  console.log('🎯 Test Orchestration: POST http://localhost:3001/api/tests/start');
  console.log('📈 Dashboard API: GET http://localhost:3001/api/dashboard/summary');
  console.log('📊 Barkod API: POST http://localhost:3001/api/barcode/scan');
  console.log('📝 Events API: POST http://localhost:3001/api/events');
  console.log('✅ SQLite veritabanı bağlandı:', dbPath);
  
  initDatabase();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Sunucu kapatılıyor...');
  db.close((err) => {
    if (err) {
      console.error('Veritabanı kapatma hatası:', err);
    } else {
      console.log('✅ Veritabanı kapatıldı');
    }
    process.exit(0);
  });
});
