import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaBoxes, FaWeightHanging, FaExclamationTriangle, FaCheck, FaSave } from 'react-icons/fa';
import './UldLoading.css';

const UldLoading = ({ offlineQueue }) => {
  const [formData, setFormData] = useState({
    uldCode: '',
    uldType: '',
    currentWeight: ''
  });
  const [errors, setErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({}); // Yeni: Hangi alanlar dokunuldu
  const [maxWeight, setMaxWeight] = useState('');
  const [capacityUsage, setCapacityUsage] = useState('');

  // ULD tipleri ve maksimum ağırlıkları
  const uldTypes = [
    { value: 'AKE', name: 'AKE - Container', maxWeight: 1587 },
    { value: 'AKH', name: 'AKH - Container', maxWeight: 1587 },
    { value: 'PMC', name: 'PMC - Pallet', maxWeight: 6804 },
    { value: 'PAG', name: 'PAG - Pallet', maxWeight: 6804 },
    { value: 'PAJ', name: 'PAJ - Pallet', maxWeight: 6804 },
    { value: 'AKW', name: 'AKW - Container', maxWeight: 1587 }
  ];

  // ULD kod formatı validasyonu: 3 harf + 5 rakam + 2 harf
  const validateUldCode = (value) => {
    const regex = /^[A-Z]{3}\d{5}[A-Z]{2}$/;
    return regex.test(value);
  };

  // Ağırlık validasyonu
  const validateWeight = (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= maxWeight;
  };

  // ULD tipi değiştiğinde maksimum ağırlığı güncelle
  useEffect(() => {
    if (formData.uldType && uldTypes.find(type => type.value === formData.uldType)) {
      const selectedType = uldTypes.find(type => type.value === formData.uldType);
      setMaxWeight(selectedType ? selectedType.maxWeight.toString() : '0');
    } else {
      setMaxWeight(0);
    }
  }, [formData.uldType]);

  // Mevcut ağırlık değiştiğinde kapasite kullanımını hesapla
  useEffect(() => {
    if (maxWeight > 0 && formData.currentWeight) {
      const usage = (parseFloat(formData.currentWeight) / parseFloat(maxWeight)) * 100;
      setCapacityUsage(Math.min(usage, 100));
    } else {
      setCapacityUsage(0);
    }
  }, [formData.currentWeight, maxWeight]);

  // Kapasite uyarı seviyesi
  const getCapacityWarning = () => {
    if (capacityUsage >= 100) return { level: 'critical', text: 'Kapasite aşıldı', color: '#EB5757' };
    if (capacityUsage >= 90) return { level: 'high', text: 'Kapasite aşığı riski', color: '#EB5757' };
    if (capacityUsage >= 80) return { level: 'medium', text: 'Uyarı', color: '#F2C94C' };
    return { level: 'low', text: 'Normal', color: '#28a745' };
  };

  // Form validasyonu
  const validateForm = () => {
    const newErrors = {};

    if (!formData.uldCode.trim()) {
      newErrors.uldCode = 'ULD kodu zorunludur';
    } else if (!validateUldCode(formData.uldCode)) {
      newErrors.uldCode = 'Format: 3 harf + 5 rakam + 2 harf';
    }

    if (!formData.uldType) {
      newErrors.uldType = 'ULD tipi seçilmelidir';
    }

    if (!formData.currentWeight.trim()) {
      newErrors.currentWeight = 'Mevcut ağırlık zorunludur';
    } else if (!validateWeight(formData.currentWeight)) {
      newErrors.currentWeight = 'Geçersiz ağırlık';
    }

    // Kapasite aşımı kontrolü
    if (capacityUsage > 100) {
      newErrors.currentWeight = 'Mevcut ağırlık maksimumu aşıyor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form gönderimi
  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Kapasite aşımı kontrolü
    if (capacityUsage > 100) {
      toast.error('❌ Mevcut ağırlık maksimumu aşıyor');
      return;
    }

    const uldData = {
      ...formData,
      maxWeight,
      capacityUsage: Math.round(capacityUsage * 100) / 100,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    try {
      // Online mod - backend'e gönder
      const response = await fetch('/api/uld/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uldData)
      });

      if (response.ok) {
        toast.success('✅ Kapasite bilgisi güncellendi');
        resetForm();
      } else {
        throw new Error('Backend error');
      }
    } catch (error) {
      // Offline mod - kuyruğa ekle
      if (offlineQueue) {
        await offlineQueue.addToQueue('uld_update', uldData);
        toast.info('ℹ️ Taslak olarak kaydedildi, internet gelince gönderilecek');
        resetForm();
      } else {
        toast.error('❌ İşlem tamamlanamadı. Tekrar deneyin.');
      }
    }
  };

  // Form temizleme
  const resetForm = () => {
    setFormData({
      uldCode: '',
      uldType: '',
      currentWeight: ''
    });
    setErrors({});
    setTouchedFields({});
    setMaxWeight('');
    setCapacityUsage('');
  };

  // Input değişikliği
  const handleInputChange = (field, value) => {
    // Alan dokunuldu olarak işaretle
    setTouchedFields(prev => ({
      ...prev,
      [field]: true
    }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Hataları temizle
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }

    // ULD tipi değiştiğinde maksimum ağırlığı güncelle
    if (field === 'uldType') {
      const selectedType = uldTypes.find(type => type.value === value);
      if (selectedType) {
        setMaxWeight(selectedType.maxWeight.toString());
      } else {
        setMaxWeight('');
      }
      setCapacityUsage('');
    }

    // Mevcut ağırlık değiştiğinde kapasite kullanımını hesapla
    if (field === 'currentWeight' && value && maxWeight) {
      const usage = ((parseFloat(value) / parseFloat(maxWeight)) * 100).toFixed(1);
      setCapacityUsage(usage);
    } else if (field === 'currentWeight' && !value) {
      setCapacityUsage('');
    }
  };

  // Input blur handler'ı - sadece blur'da hata göster
  const handleInputBlur = (field, value) => {
    // Alan dokunuldu olarak işaretle
    setTouchedFields(prev => ({
      ...prev,
      [field]: true
    }));

    // Blur'da validasyon yap
    let error = '';
    
    switch (field) {
      case 'uldCode':
        if (!value.trim()) {
          error = 'ULD kodu zorunludur';
        } else if (!validateUldCode(value)) {
          error = 'Geçersiz format';
        }
        break;
      case 'uldType':
        if (!value.trim()) {
          error = 'ULD tipi zorunludur';
        }
        break;
      case 'currentWeight':
        if (!value.trim()) {
          error = 'Mevcut ağırlık zorunludur';
        } else if (!validateWeight(value)) {
          error = 'Sadece sayısal, en fazla 2 ondalık';
        } else if (maxWeight && parseFloat(value) > parseFloat(maxWeight)) {
          error = 'Maksimum ağırlığı aşıyor';
        }
        break;
      default:
        break;
    }

    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const warning = getCapacityWarning();

  return (
    <div className="uld-loading">
      <div className="uld-header">
        <h2>ULD Kapasite</h2>
        <p className="uld-subtitle">Sahada hızlı ULD doğrulama: kod, tip, mevcut ağırlık, kullanım oranı ve uyarı</p>
      </div>

      {/* ULD Bilgileri */}
      <div className="form-section">
        <h3>ULD Bilgileri</h3>
        
        <div className="form-group">
          <label htmlFor="uldCode">ULD Kodu</label>
          <input
            id="uldCode"
            type="text"
            value={formData.uldCode}
            onChange={(e) => handleInputChange('uldCode', e.target.value.toUpperCase())}
            onBlur={(e) => handleInputBlur('uldCode', e.target.value)}
            className={errors.uldCode || touchedFields.uldCode ? 'error' : ''}
            maxLength={10}
            autoComplete="off"
          />
          {errors.uldCode && (
            <span className="error-message">{errors.uldCode}</span>
          )}
          <div className="field-help">
            Format: 3 harf + 5 rakam + 2 harf
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="uldType">ULD Tipi</label>
          <select
            id="uldType"
            value={formData.uldType}
            onChange={(e) => handleInputChange('uldType', e.target.value)}
            onBlur={(e) => handleInputBlur('uldType', e.target.value)}
            className={errors.uldType || touchedFields.uldType ? 'error' : ''}
            autoComplete="off"
          >
            <option value="">ULD tipi seçin</option>
            {uldTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.name}
              </option>
            ))}
          </select>
          {errors.uldType && (
            <span className="error-message">{errors.uldType}</span>
          )}
        </div>
      </div>

      {/* Ağırlık & Kapasite */}
      <div className="form-section">
        <h3>Ağırlık & Kapasite</h3>
        
        <div className="weight-display">
          <div className="weight-item">
            <label>Maksimum Ağırlık (kg)</label>
            <div className="weight-value display-only">
              {maxWeight > 0 ? maxWeight.toLocaleString() : '-'}
            </div>
          </div>

          <div className="weight-item">
            <label htmlFor="currentWeight">Mevcut Ağırlık (kg)</label>
            <input
              id="currentWeight"
              type="number"
              step="0.01"
              value={formData.currentWeight}
              onChange={(e) => handleInputChange('currentWeight', e.target.value)}
              onBlur={(e) => handleInputBlur('currentWeight', e.target.value)}
              className={errors.currentWeight || touchedFields.currentWeight ? 'error' : ''}
              autoComplete="off"
            />
            {errors.currentWeight && (
              <span className="error-message">{errors.currentWeight}</span>
            )}
          </div>
        </div>

        {/* Kapasite Kullanımı */}
        <div className="capacity-section">
          <div className="capacity-header">
            <label>Kapasite Kullanımı</label>
            <span className={`capacity-badge ${warning.level}`}>
              {warning.text}
            </span>
          </div>
          
          <div className="capacity-bar">
            <div 
              className="capacity-fill"
              style={{ 
                width: `${Math.min(capacityUsage, 100)}%`,
                backgroundColor: warning.color
              }}
            />
          </div>
          
          <div className="capacity-percentage">
            {capacityUsage > 0 ? `${Math.round(capacityUsage * 100) / 100}%` : '0%'}
          </div>

          {/* Kapasite aşımı uyarısı */}
          {capacityUsage >= 100 && (
            <div className="capacity-warning critical">
              <FaExclamationTriangle />
              <span>Kapasite aşıldı - kaydetme engellendi</span>
            </div>
          )}
        </div>
      </div>

      {/* Buton */}
      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={capacityUsage > 100}
        >
          <FaSave />
          Güncelle
        </button>
      </div>
    </div>
  );
};

export default UldLoading;
