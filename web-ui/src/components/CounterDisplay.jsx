import React, { useState, useEffect } from 'react';
import { counterSync } from '../services/CounterSyncService';

const CounterDisplay = ({ className = '' }) => {
  const [counters, setCounters] = useState({
    Q: 0,     // Kuyruk
    P: 0,     // İşleniyor
    T: 0,     // Toplam
    offline: false
  });

  useEffect(() => {
    // İlk yükleme
    const loadCounters = async () => {
      const apiCounters = await counterSync.getCounters();
      if (apiCounters) {
        setCounters(apiCounters);
      }
    };
    
    loadCounters();
    
    // Otomatik senkronizasyon başlat
    counterSync.startAutoSync(2000);
    
    // API değişikliklerini dinle
    const unsubscribe = counterSync.addListener((newCounters) => {
      setCounters(newCounters);
    });
    
    return () => {
      counterSync.stopAutoSync();
      unsubscribe();
    };
  }, []);

  return (
    <div className={`counter-display ${className}`}>
      <h3>📊 Mobil Senkronizasyon</h3>
      <div className="counter-grid">
        <div className="counter-item">
          <div className="counter-value">{counters.Q}</div>
          <div className="counter-label">Kuyruk</div>
        </div>
        <div className="counter-item">
          <div className="counter-value">{counters.P}</div>
          <div className="counter-label">İşleniyor</div>
        </div>
        <div className="counter-item">
          <div className="counter-value">{counters.T}</div>
          <div className="counter-label">Toplam</div>
        </div>
        <div className="counter-item">
          <div className={`counter-status ${counters.offline ? 'offline' : 'online'}`}>
            {counters.offline ? '📱 Offline' : '🌐 Online'}
          </div>
          <div className="counter-label">Mod</div>
        </div>
      </div>
      
      <style jsx>{`
        .counter-display {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
        
        .counter-display h3 {
          margin: 0 0 15px 0;
          color: #374151;
        }
        
        .counter-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
        }
        
        .counter-item {
          text-align: center;
          padding: 10px;
          background: #f9fafb;
          border-radius: 6px;
        }
        
        .counter-value {
          font-size: 24px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 5px;
        }
        
        .counter-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .counter-status {
          font-size: 14px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 4px;
          margin-bottom: 5px;
        }
        
        .counter-status.online {
          background: #dcfce7;
          color: #166534;
        }
        
        .counter-status.offline {
          background: #fed7d7;
          color: #c53030;
        }
        
        @media (max-width: 768px) {
          .counter-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default CounterDisplay;
