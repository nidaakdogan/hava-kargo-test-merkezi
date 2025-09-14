import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FaClipboardCheck, FaPlane, FaRuler, FaSave, FaPlus } from 'react-icons/fa';
import './AwbAcceptance.css';

const AwbAcceptance = ({ offlineQueue }) => {
  const [formData, setFormData] = useState({
    awbNumber: '',
    origin: '',
    destination: '',
    weight: '',
    pieces: '',
    flightNo: '',
    dimensions: ''
  });
  const [errors, setErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({}); // Yeni: Hangi alanlar dokunuldu
  const [showOptional, setShowOptional] = useState(false);

  // AWB numarası validasyonu: ^\d{3}-\d{8}$
  const validateAwbNumber = (value) => {
    const regex = /^\d{3}-\d{8}$/;
    return regex.test(value);
  };

  // Ağırlık validasyonu: 0-2 ondalık
  const validateWeight = (value) => {
    const regex = /^\d+(\.\d{1,2})?$/;
    return regex.test(value) && parseFloat(value) > 0;
  };

  // Parça sayısı validasyonu: ≥1
  const validatePieces = (value) => {
    const num = parseInt(value);
    return num >= 1 && Number.isInteger(num);
  };

  // Form validasyonu
  const validateForm = () => {
    const newErrors = {};

    if (!formData.awbNumber.trim()) {
      newErrors.awbNumber = 'AWB numarası zorunludur';
    } else if (!validateAwbNumber(formData.awbNumber)) {
      newErrors.awbNumber = 'Geçersiz format';
    }

    if (!formData.origin.trim()) {
      newErrors.origin = 'Kalkış yeri zorunludur';
    }

    if (!formData.destination.trim()) {
      newErrors.destination = 'Varış yeri zorunludur';
    }

    if (!formData.weight.trim()) {
      newErrors.weight = 'Ağırlık zorunludur';
    } else if (!validateWeight(formData.weight)) {
      newErrors.weight = 'Sadece sayısal, en fazla 2 ondalık';
    }

    if (!formData.pieces.trim()) {
      newErrors.pieces = 'Parça sayısı zorunludur';
    } else if (!validatePieces(formData.pieces)) {
      newErrors.pieces = 'Pozitif tam sayı olmalı';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form gönderimi
  const handleSubmit = async (saveAndNew = false) => {
    if (!validateForm()) return;

    const awbData = {
      ...formData,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    try {
      // Online mod - backend'e gönder
      const response = await fetch('/api/awb/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(awbData)
      });

      if (response.ok) {
        toast.success('✅ AWB kaydedildi');
        if (saveAndNew) {
          resetForm();
        }
      } else {
        throw new Error('Backend error');
      }
    } catch (error) {
      // Offline mod - kuyruğa ekle
      if (offlineQueue) {
        await offlineQueue.addToQueue('awb_create', awbData);
        toast.info('ℹ️ Taslak olarak kaydedildi, internet gelince gönderilecek');
        if (saveAndNew) {
          resetForm();
        }
      } else {
        toast.error('❌ İşlem tamamlanamadı. Tekrar deneyin.');
      }
    }
  };

  // Form temizleme
  const resetForm = () => {
    setFormData({
      awbNumber: '',
      origin: '',
      destination: '',
      weight: '',
      pieces: '',
      flightNo: '',
      dimensions: ''
    });
    setErrors({});
    setTouchedFields({});
    setShowOptional(false);
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
      case 'awbNumber':
        if (!value.trim()) {
          error = 'AWB numarası zorunludur';
        } else if (!validateAwbNumber(value)) {
          error = 'Geçersiz format';
        }
        break;
      case 'origin':
        if (!value.trim()) {
          error = 'Kalkış yeri zorunludur';
        }
        break;
      case 'destination':
        if (!value.trim()) {
          error = 'Varış yeri zorunludur';
        }
        break;
      case 'weight':
        if (!value.trim()) {
          error = 'Ağırlık zorunludur';
        } else if (!validateWeight(value)) {
          error = 'Sadece sayısal, en fazla 2 ondalık';
        }
        break;
      case 'pieces':
        if (!value.trim()) {
          error = 'Parça sayısı zorunludur';
        } else if (!validatePieces(value)) {
          error = 'Pozitif tam sayı olmalı';
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

  return (
    <div className="awb-acceptance">
      <div className="awb-header">
        <h2>AWB Yönetimi (Hızlı Giriş)</h2>
        <p className="awb-subtitle">Sahada temel AWB girişini hızlıca yapmak</p>
      </div>

      {/* Zorunlu Bilgiler */}
      <div className="form-section">
        <h3>Zorunlu Bilgiler</h3>
        
        <div className="form-group">
          <label htmlFor="awbNumber">AWB Numarası</label>
          <input
            id="awbNumber"
            type="text"
            value={formData.awbNumber}
            onChange={(e) => handleInputChange('awbNumber', e.target.value)}
            onBlur={(e) => handleInputBlur('awbNumber', e.target.value)}
            className={errors.awbNumber ? 'error' : ''}
            autoComplete="off"
          />
          {errors.awbNumber && (
            <span className="error-message">{errors.awbNumber}</span>
          )}
          <div className="field-help">
            Format: 3 haneli prefix + 8 haneli seri
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="origin">Kalkış Yeri</label>
          <input
            id="origin"
            type="text"
            value={formData.origin}
            onChange={(e) => handleInputChange('origin', e.target.value)}
            onBlur={(e) => handleInputBlur('origin', e.target.value)}
            className={errors.origin ? 'error' : ''}
            autoComplete="off"
          />
          {errors.origin && (
            <span className="error-message">{errors.origin}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="destination">Varış Yeri</label>
          <input
            id="destination"
            type="text"
            value={formData.destination}
            onChange={(e) => handleInputChange('destination', e.target.value)}
            onBlur={(e) => handleInputBlur('destination', e.target.value)}
            className={errors.destination ? 'error' : ''}
            autoComplete="off"
          />
          {errors.destination && (
            <span className="error-message">{errors.destination}</span>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="weight">Ağırlık (kg)</label>
            <input
              id="weight"
              type="number"
              step="0.01"
              value={formData.weight}
              onChange={(e) => handleInputChange('weight', e.target.value)}
              onBlur={(e) => handleInputBlur('weight', e.target.value)}
              className={errors.weight ? 'error' : ''}
              autoComplete="off"
            />
            {errors.weight && (
              <span className="error-message">{errors.weight}</span>
            )}
            <div className="field-help">
              En fazla 2 ondalık
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="pieces">Parça Sayısı (pcs)</label>
            <input
              id="pieces"
              type="number"
              value={formData.pieces}
              onChange={(e) => handleInputChange('pieces', e.target.value)}
              onBlur={(e) => handleInputBlur('pieces', e.target.value)}
              className={errors.pieces ? 'error' : ''}
              autoComplete="off"
            />
            {errors.pieces && (
              <span className="error-message">{errors.pieces}</span>
            )}
            <div className="field-help">
              Pozitif tam sayı
            </div>
          </div>
        </div>
      </div>

      {/* Opsiyonel Bilgiler */}
      <div className="form-section">
        <button
          className="section-toggle"
          onClick={() => setShowOptional(!showOptional)}
        >
          <span>Opsiyonel</span>
          <FaPlus className={`toggle-icon ${showOptional ? 'expanded' : ''}`} />
        </button>

        {showOptional && (
          <div className="optional-fields">
            <div className="form-group">
              <label htmlFor="flightNo">Uçuş No</label>
              <input
                id="flightNo"
                type="text"
                value={formData.flightNo}
                onChange={(e) => handleInputChange('flightNo', e.target.value)}
                onBlur={(e) => handleInputBlur('flightNo', e.target.value)}
                className={errors.flightNo ? 'error' : ''}
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="dimensions">Boyutlar</label>
              <input
                id="dimensions"
                type="text"
                value={formData.dimensions}
                onChange={(e) => handleInputChange('dimensions', e.target.value)}
                onBlur={(e) => handleInputBlur('dimensions', e.target.value)}
                className={errors.dimensions ? 'error' : ''}
                autoComplete="off"
              />
            </div>
          </div>
        )}
      </div>

      {/* Butonlar */}
      <div className="form-actions">
        <button
          className="btn btn-primary"
          onClick={() => handleSubmit(false)}
        >
          <FaSave />
          Kaydet
        </button>

        <button
          className="btn btn-outline"
          onClick={() => handleSubmit(true)}
        >
          <FaPlus />
          Kaydet & Yeni
        </button>
      </div>
    </div>
  );
};

export default AwbAcceptance;
