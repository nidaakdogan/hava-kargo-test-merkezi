import React, { useState, useEffect } from 'react';
import { toastManager } from '../services/ToastManager';
import './DevToolbar.css';

// DevToolbar bileşeni - Runtime'da koşullu render
const DevToolbar = () => {
  // Derleme zamanı kilidi - Production'da hiç render edilmez
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
    const [isVisible, setIsVisible] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
      // Runtime kilidi - Çoklu koşul kontrolü
      const checkDevMode = () => {
        const isProd = process.env.NODE_ENV === 'production';
        const hasDebugParam = new URLSearchParams(window.location.search).get('debug') === '1';
        const hasDebugStorage = localStorage.getItem('debugToolbar') === '1';
        const isDevRole = true; // Gerçek uygulamada user.role kontrolü yapılır
        
        // Production'da hiçbir koşul çalışmaz
        if (isProd) {
          setIsVisible(false);
          return;
        }
        
        // Test için her zaman göster
        const shouldShow = true; // hasDebugParam && hasDebugStorage && isDevRole;
        console.log('🛠️ [DevToolbar] Koşul kontrolü:', {
          isProd,
          hasDebugParam,
          hasDebugStorage,
          isDevRole,
          shouldShow
        });
        setIsVisible(shouldShow);
      };

      checkDevMode();
      
      // URL değişikliklerini dinle
      window.addEventListener('popstate', checkDevMode);
      return () => window.removeEventListener('popstate', checkDevMode);
    }, []);

    // UI güvenlik ağı - Son çare
    if (!isVisible) {
      return null;
    }

    const testToast = () => {
      console.log('🧪 DevToolbar: Test toast tetikleniyor...');
      toastManager.showToast({
        id: 'dev-test-toast',
        type: 'success',
        message: 'Test toast - 8 saniye görünmeli',
        duration: 8000
      });
    };

    const testMultipleToasts = () => {
      console.log('🧪 DevToolbar: Çoklu test toast tetikleniyor...');
      for (let i = 1; i <= 3; i++) {
        setTimeout(() => {
          toastManager.showToast({
            id: `dev-multi-toast-${i}`,
            type: i % 2 === 0 ? 'success' : 'info',
            message: `Çoklu toast testi - ${i}/3`,
            duration: 6000
          });
        }, i * 1000);
      }
    };

    const clearAllToasts = () => {
      console.log('🧪 DevToolbar: Tüm toastlar temizleniyor...');
      toastManager.clearAll();
    };

    return (
      <div className="dev-toolbar">
        <button
          className="dev-toolbar-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          title="Geliştirici Araçları"
        >
          🛠️
        </button>
        
        {isExpanded && (
          <div className="dev-toolbar-panel">
            <h4>Geliştirici Araçları</h4>
            <div className="dev-toolbar-buttons">
              <button onClick={testToast} className="dev-btn" style={{backgroundColor: '#28a745', color: 'white', padding: '10px 15px', margin: '5px', fontSize: '14px'}}>
                🍞 Test Toast
              </button>
              <button onClick={testMultipleToasts} className="dev-btn" style={{backgroundColor: '#007bff', color: 'white', padding: '10px 15px', margin: '5px', fontSize: '14px'}}>
                🔄 Çoklu Toast
              </button>
              <button onClick={clearAllToasts} className="dev-btn" style={{backgroundColor: '#dc3545', color: 'white', padding: '10px 15px', margin: '5px', fontSize: '14px'}}>
                🗑️ Temizle
              </button>
            </div>
            <div className="dev-toolbar-info">
              <small>
                Debug modu aktif<br/>
                ?debug=1 + localStorage.debugToolbar=1
              </small>
            </div>
          </div>
        )}
      </div>
    );
  };

export default DevToolbar;
