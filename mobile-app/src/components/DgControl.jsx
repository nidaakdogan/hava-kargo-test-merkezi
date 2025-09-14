import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FaExclamationTriangle, FaFlask, FaBox, FaSave, FaHistory, FaTrash } from 'react-icons/fa';
import './DgControl.css';

const DgControl = ({ offlineQueue }) => {
  const [dgData, setDgData] = useState({
    unNumber: '',
    dgClass: '',
    packingGroup: '',
    quantity: '',
    unit: 'kg',
    description: '',
    notes: ''
  });

  const [dgHistory, setDgHistory] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // DG sınıfları
  const dgClasses = [
    { class: '1', name: 'Sınıf 1 - Patlayıcılar' },
    { class: '2', name: 'Sınıf 2 - Gazlar' },
    { class: '3', name: 'Sınıf 3 - Yanıcı Sıvılar' },
    { class: '4', name: 'Sınıf 4 - Yanıcı Katılar' },
    { class: '5', name: 'Sınıf 5 - Oksitleyici Maddeler' },
    { class: '6', name: 'Sınıf 6 - Zehirli Maddeler' },
    { class: '7', name: 'Sınıf 7 - Radyoaktif Maddeler' },
    { class: '8', name: 'Sınıf 8 - Aşındırıcı Maddeler' },
    { class: '9', name: 'Sınıf 9 - Diğer Tehlikeli Maddeler' }
  ];

  // Paketleme grupları
  const packingGroups = [
    { group: 'I', name: 'Grup I - Yüksek Tehlike' },
    { group: 'II', name: 'Grup II - Orta Tehlike' },
    { group: 'III', name: 'Grup III - Düşük Tehlike' }
  ];

  // Form değişikliklerini handle et
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setDgData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // DG kaydet
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasyon
    if (!dgData.unNumber || !dgData.dgClass || !dgData.packingGroup || !dgData.quantity) {
      toast.error('❌ Lütfen zorunlu alanları doldurun');
      return;
    }

    setIsSubmitting(true);

    try {
      const newDg = {
        id: Date.now(),
        ...dgData,
        timestamp: new Date().toLocaleString('tr-TR'),
        status: 'declared',
        operator: 'Saha Operatörü'
      };

      // Geçmişe ekle
      setDgHistory(prev => [newDg, ...prev]);

      // Offline queue'ya ekle
      if (offlineQueue) {
        offlineQueue.addToQueue('dg_control', newDg);
      }

      // Formu temizle
      setDgData({
        unNumber: '',
        dgClass: '',
        packingGroup: '',
        quantity: '',
        unit: 'kg',
        description: '',
        notes: ''
      });

      toast.success('✅ DG beyanı başarıyla kaydedildi');
    } catch (error) {
      toast.error('❌ DG beyanı kaydedilirken hata oluştu');
      console.error('DG save error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Geçmişi temizle
  const clearHistory = () => {
    setDgHistory([]);
    toast.info('🗑️ DG geçmişi temizlendi');
  };

  // DG sınıfına göre renk belirle
  const getDgClassColor = (dgClass) => {
    const colors = {
      '1': 'danger',
      '2': 'warning',
      '3': 'danger',
      '4': 'warning',
      '5': 'danger',
      '6': 'danger',
      '7': 'danger',
      '8': 'warning',
      '9': 'info'
    };
    return colors[dgClass] || 'info';
  };

  return (
    <div className="dg-control">
      <div className="dg-header">
        <h2>⚠️ DG Kontrol</h2>
        <p className="dg-subtitle">Tehlikeli madde beyanı - Temel bilgiler</p>
      </div>

      {/* DG Formu */}
      <form onSubmit={handleSubmit} className="dg-form">
        <h3>🚨 Zorunlu Bilgiler</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="unNumber">UN Numarası *</label>
            <input
              type="text"
              id="unNumber"
              name="unNumber"
              value={dgData.unNumber}
              onChange={handleInputChange}
              
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="dgClass">DG Sınıfı *</label>
            <select
              id="dgClass"
              name="dgClass"
              value={dgData.dgClass}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="">Sınıf Seçin</option>
              {dgClasses.map((dgClass, index) => (
                <option key={index} value={dgClass.class}>
                  {dgClass.class} - {dgClass.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="packingGroup">Paketleme Grubu *</label>
            <select
              id="packingGroup"
              name="packingGroup"
              value={dgData.packingGroup}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="">Grup Seçin</option>
              {packingGroups.map((group, index) => (
                <option key={index} value={group.group}>
                  {group.group} - {group.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="quantity">Miktar *</label>
            <div className="quantity-input">
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={dgData.quantity}
                onChange={handleInputChange}
                
                step="0.01"
                min="0"
                className="form-input"
                required
              />
              <select
                name="unit"
                value={dgData.unit}
                onChange={handleInputChange}
                className="unit-select"
              >
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="pieces">adet</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label htmlFor="description">Madde Açıklaması</label>
            <input
              type="text"
              id="description"
              name="description"
              value={dgData.description}
              onChange={handleInputChange}
              
              className="form-input"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full-width">
            <label htmlFor="notes">Notlar</label>
            <textarea
              id="notes"
              name="notes"
              value={dgData.notes}
              onChange={handleInputChange}
              
              className="form-textarea"
              rows="3"
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <FaSave className="spinning" />
              Kaydediliyor...
            </>
          ) : (
            <>
              <FaSave />
              DG Beyanı Kaydet
            </>
          )}
        </button>
      </form>

      {/* DG Geçmişi */}
      <div className="dg-history">
        <div className="history-header">
          <h3>📚 DG Geçmişi</h3>
          <button onClick={clearHistory} className="clear-btn">
            <FaTrash /> Temizle
          </button>
        </div>
        
        {dgHistory.length === 0 ? (
          <div className="empty-history">
            <FaExclamationTriangle className="empty-icon" />
            <p>Henüz DG beyanı yapılmadı</p>
          </div>
        ) : (
          <div className="history-list">
            {dgHistory.map((dg) => (
              <div key={dg.id} className="dg-item">
                <div className="dg-header-info">
                  <div className="dg-un">UN {dg.unNumber}</div>
                  <div className={`dg-class ${getDgClassColor(dg.dgClass)}`}>
                    Sınıf {dg.dgClass}
                  </div>
                  <div className="dg-status declared">Beyan Edildi</div>
                </div>
                
                <div className="dg-details">
                  <div className="detail-item">
                    <FaFlask />
                    <span>Grup {dg.packingGroup}</span>
                  </div>
                  <div className="detail-item">
                    <FaBox />
                    <span>{dg.quantity} {dg.unit}</span>
                  </div>
                  {dg.description && (
                    <div className="detail-item">
                      <FaExclamationTriangle />
                      <span>{dg.description}</span>
                    </div>
                  )}
                </div>

                <div className="dg-meta">
                  <span className="timestamp">{dg.timestamp}</span>
                  <span className="operator">{dg.operator}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Uyarı Mesajı */}
      <div className="dg-warning">
        <div className="warning-content">
          <FaExclamationTriangle className="warning-icon" />
          <div className="warning-text">
            <h4>⚠️ Önemli Uyarı</h4>
            <p>Tehlikeli madde beyanları detaylı bilgi ve uzman kontrolü gerektirir. 
            Bu ekran sadece temel bilgiler için kullanılmalıdır.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DgControl;
