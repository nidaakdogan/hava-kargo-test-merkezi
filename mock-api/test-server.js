import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
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

// Events endpoint - idempotent olay kaydetme
app.post('/api/events', async (req, res) => {
  try {
    const { runId, eventId, type, payload, source } = req.body;
    
    console.log(`📝 Event alındı: ${eventId} (${type}) - ${source}`);
    
    // WebSocket ile yayınla
    io.emit('dashboard_update', {
      type: 'event_received',
      runId,
      eventId,
      timestamp: new Date().toISOString()
    });
    
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

// Dashboard summary endpoint
app.get('/api/dashboard/summary', (req, res) => {
  res.json({
    success: true,
    data: {
      totalTests: 0,
      success: 0,
      failed: 0,
      webOverweight: 0,
      mobileOk: 0,
      mobileFail: 0,
      averageDuration: 0
    },
    timestamp: new Date().toISOString()
  });
});

// WebSocket bağlantıları
io.on('connection', (socket) => {
  console.log('🔌 WebSocket bağlantısı kuruldu:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket bağlantısı kesildi:', socket.id);
  });
});

// Server başlat
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test Backend başlatıldı: http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobil erişim: http://10.0.2.2:${PORT}`);
  console.log(`🌐 Web erişim: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});
