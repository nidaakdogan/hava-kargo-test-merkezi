import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, ArrowLeft, AlertTriangle } from 'lucide-react';
import { eventBus } from '../services/ToastManager';
import './BarcodeBlockedPage.css';

const BarcodeBlockedPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Warning toast göster
    eventBus.emit('barcode:blocked');
    
    // 3 saniye sonra dashboard'a yönlendir
    const timer = setTimeout(() => {
      navigate('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return (
    <div className="barcode-blocked-page">
      <div className="blocked-container">
        <div className="blocked-icon">
          <Smartphone size={64} />
        </div>
        
        <h1 className="blocked-title">
          Bu Test Yalnız Emülatörde Çalışır
        </h1>
        
        <p className="blocked-message">
          Mobil testler ve barkod simülasyonu sadece Android emülatörde kullanılabilir. 
          Web arayüzünde bu özellik devre dışı bırakılmıştır.
        </p>
        
        <div className="blocked-info">
          <AlertTriangle size={20} />
          <span>Mobil test için emülatörü açın ve mobil uygulamayı kullanın.</span>
        </div>
        
        <div className="blocked-actions">
          <button 
            className="blocked-btn primary"
            onClick={handleGoToDashboard}
          >
            <ArrowLeft size={16} />
            Gösterge Paneline Dön
          </button>
        </div>
        
        <div className="blocked-timer">
          <span>3 saniye sonra otomatik olarak yönlendirileceksiniz...</span>
        </div>
      </div>
    </div>
  );
};

export default BarcodeBlockedPage;
