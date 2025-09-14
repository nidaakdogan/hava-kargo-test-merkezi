const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  console.log('🏥 Health check alındı');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString()
  });
});

// Barkod işleme endpoint'i
app.post('/api/scan', (req, res) => {
  const { barcode, runId } = req.body;
  console.log(`📱 Barkod işleme: ${barcode} (runId: ${runId})`);
  
  // Basit validasyon
  if (!barcode || barcode.length < 5) {
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
});

// Events endpoint
app.post('/api/events', (req, res) => {
  const { runId, eventId, type, payload, source } = req.body;
  console.log(`📝 Event alındı: ${eventId} (${type}) - ${source}`);
  
  res.json({ 
    success: true, 
    eventId,
    message: 'Event kaydedildi' 
  });
});

// Dashboard summary
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

// Server başlat
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test Backend başlatıldı: http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobil erişim: http://10.0.2.2:${PORT}`);
  console.log(`🌐 Web erişim: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});
