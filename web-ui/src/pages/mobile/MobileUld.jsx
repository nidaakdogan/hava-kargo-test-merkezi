import React, { useState, useEffect } from 'react'
import { useOffline } from '../../contexts/OfflineContext'
import './MobileUld.css'

const MobileUld = () => {
  // ULD Tipleri - Güncellenmiş metrikler
  const ULD_TYPES = {
    'AKE': { mgw: 1588, tare: 82, volume: 4.4, name: 'AKE - LD3 Container', description: 'Taban 156,2×153,4 cm, yükseklik ~162,5 cm' },
    'AKH': { mgw: 1135, tare: 88, volume: 3.6, name: 'AKH - LD3 (alçak) Container', description: 'AKE ile aynı taban, yükseklik ~113 cm' },
    'DPE': { mgw: 1179, tare: 83, volume: 3.45, name: 'DPE - LD2 Container', description: '767 ailesinde yaygın; AKE\'den daha dar' },
    'DPW': { mgw: 1588, tare: 80, volume: 4.4, name: 'DPW - LD3 Container (varyant)', description: 'LD-3 ailesiyle aynı geometri' },
    'AMJ': { mgw: 6804, tare: 340, volume: 9.5, name: 'AMJ - LD9 (10-ft) Container', description: 'Taban 125"×96" (317,5×243,8 cm), yükseklik 96"' },
    'AMA': { mgw: 6804, tare: 410, volume: 9.5, name: 'AMA - LD9 / GM1 Container', description: 'AMJ ile aynı boyut sınıfı' },
    'AAF': { mgw: 5329, tare: 271, volume: 13.6, name: 'AAF - LD26 Container', description: 'Taban 125"×88" (317,5×223,5 cm), yükseklik ~162,6 cm' },
    'AMF': { mgw: 3175, tare: 192, volume: 7.3, name: 'AMF - LD11 Container', description: 'Taban 125"×88", yükseklik ~162,6 cm' },
    'PMC': { mgw: 6800, tare: 102, volume: null, name: 'PMC - 96×125 Palet (P6P)', description: 'Ana güvertede MGW genelde 6.800 kg', type: 'pallet' },
    'PLA': { mgw: 3175, tare: 93, volume: null, name: 'PLA - 60,4×125 Palet', description: 'Dar tabanlı palet', type: 'pallet' },
    'PAG': { mgw: 5715, tare: 96, volume: null, name: 'PAG - 88×125 Palet', description: 'Ana güvertede ~6.000-6.804 kg, alt güvertede ~4.626 kg', type: 'pallet' },
    'PAJ': { mgw: 6800, tare: 102, volume: null, name: 'PAJ - 96×125 Palet', description: 'PMC ile aynı sınıf', type: 'pallet' }
  }

  // Form State - Web ile aynı
  const [formData, setFormData] = useState({
    uldCode: '',
    uldType: '',
    mgw: '',
    tare: '',
    loadableWeight: '',
    currentWeight: '',
    volume: '',
    remainingWeight: '',
    capacityUsage: ''
  })

  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)
  const { isOffline } = useOffline()
  const [showUldTypeDropdown, setShowUldTypeDropdown] = useState(false)
  const [uldTypeSearch, setUldTypeSearch] = useState('')
  const [isOverloaded, setIsOverloaded] = useState(false)

  // ULD Kodu maskesi - Web ile aynı
  const handleUldCodeChange = (value) => {
    // Sadece harf ve rakam kabul et
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    
    // XXX99999XX formatına göre maskele
    if (cleaned.length <= 3) {
      setFormData(prev => ({ ...prev, uldCode: cleaned }))
    } else if (cleaned.length <= 8) {
      const prefix = cleaned.substring(0, 3)
      const numbers = cleaned.substring(3, 8)
      setFormData(prev => ({ ...prev, uldCode: prefix + numbers }))
    } else if (cleaned.length <= 10) {
      const prefix = cleaned.substring(0, 3)
      const numbers = cleaned.substring(3, 8)
      const suffix = cleaned.substring(8, 10)
      setFormData(prev => ({ ...prev, uldCode: prefix + numbers + suffix }))
    }
  }

  // Türkçe sayı formatlaması
  const formatTurkishNumber = (value) => {
    if (!value || isNaN(value)) return '';
    return parseFloat(value).toLocaleString('tr-TR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  // Mevcut Ağırlık maskesi - Türkçe format ile
  const handleCurrentWeightChange = (value) => {
    // Sadece rakam, nokta ve virgül kabul et
    const cleaned = value.replace(/[^\d.,]/g, '')
    
    // Virgülü noktaya çevir
    const normalized = cleaned.replace(',', '.')
    
    // Maksimum 2 ondalık kontrolü
    const parts = normalized.split('.')
    if (parts.length === 1) {
      setFormData(prev => ({ ...prev, currentWeight: normalized }))
    } else if (parts.length === 2 && parts[1].length <= 2) {
      setFormData(prev => ({ ...prev, currentWeight: normalized }))
    }
  }

  // ULD Tipi seçimi - Güncellenmiş metriklerle
  const handleUldTypeSelect = (type) => {
    setFormData(prev => ({ ...prev, uldType: type }))
    setUldTypeSearch(type)
    setShowUldTypeDropdown(false)
    
    // Otomatik alanları doldur
    if (ULD_TYPES[type]) {
      const typeData = ULD_TYPES[type]
      const loadable = typeData.mgw - typeData.tare
      const isPallet = typeData.type === 'pallet'
      
      setFormData(prev => ({
        ...prev,
        mgw: typeData.mgw.toString(),
        tare: typeData.tare.toString(),
        volume: isPallet ? '' : (typeData.volume ? typeData.volume.toString() : ''),
        loadableWeight: loadable.toString(),
        currentWeight: '',
        remainingWeight: '',
        capacityUsage: ''
      }))
    }
  }

  // Filtrelenmiş ULD tipleri
  const filteredUldTypes = Object.entries(ULD_TYPES).filter(([code, data]) =>
    code.toLowerCase().includes(uldTypeSearch.toLowerCase()) ||
    data.name.toLowerCase().includes(uldTypeSearch.toLowerCase())
  )


  // Hesaplamalar - Web ile aynı
  useEffect(() => {
    if (formData.loadableWeight && formData.currentWeight) {
      const loadable = parseFloat(formData.loadableWeight)
      const current = parseFloat(formData.currentWeight)
      
      if (!isNaN(loadable) && !isNaN(current)) {
        const remaining = loadable - current
        const usage = loadable > 0 ? (current / loadable) * 100 : 0
        
        setFormData(prev => ({
          ...prev,
          remainingWeight: remaining.toFixed(2),
          capacityUsage: usage.toFixed(1)
        }))
        
        // Aşım kontrolü
        setIsOverloaded(remaining < 0)
      }
    }
  }, [formData.loadableWeight, formData.currentWeight])

  // Validasyon - Web ile aynı
  const validateForm = () => {
    const newErrors = {}
    
    // ULD Kodu validasyonu
    if (!formData.uldCode) {
      newErrors.uldCode = 'ULD kodu zorunludur'
    } else if (!/^[A-Z]{3}\d{5}[A-Z]{2}$/.test(formData.uldCode)) {
      newErrors.uldCode = 'Geçersiz ULD kodu formatı'
    }
    
    // ULD Tipi validasyonu
    if (!formData.uldType) {
      newErrors.uldType = 'ULD tipi seçmelisiniz'
    }
    
    // Mevcut Ağırlık validasyonu
    if (!formData.currentWeight) {
      newErrors.currentWeight = 'Mevcut ağırlık zorunludur'
    } else if (!/^\d+(\.\d{1,2})?$/.test(formData.currentWeight)) {
      newErrors.currentWeight = 'En fazla 2 ondalık girilebilir'
    } else if (parseFloat(formData.currentWeight) < 0) {
      newErrors.currentWeight = 'Ağırlık negatif olamaz'
    }
    
    // Aşım kontrolü
    if (isOverloaded) {
      newErrors.currentWeight = `Kapasite aşıldı. Yüklenebilir: ${formData.loadableWeight} kg, Mevcut: ${formData.currentWeight} kg`
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Form gönderimi
  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    if (isOffline) {
      showToast('info', 'ULD offline kuyruğa eklendi')
    } else {
      showToast('success', 'ULD başarıyla kaydedildi')
    }
  }

  // Form temizleme
  const handleClear = () => {
    setFormData({
      uldCode: '',
      uldType: '',
      mgw: '',
      tare: '',
      loadableWeight: '',
      currentWeight: '',
      volume: '',
      remainingWeight: '',
      capacityUsage: ''
    })
    setErrors({})
    setUldTypeSearch('')
    setIsOverloaded(false)
  }

  // Toast gösterimi
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // Mevcut Ağırlık Helper - Web ile aynı
  const getCurrentWeightHelper = () => {
    // ULD Tipi seçilmemişse - tek koşul
    if (!formData.uldType) {
      return {
        type: 'disabled',
        text: 'Önce ULD Tipi seçiniz'
      };
    }
    
    // MGW ve Tare sayısal + NaN guard
    const mgw = Number(formData.mgw) || 0;
    const tare = Number(formData.tare) || 0;
    const current = Number(formData.currentWeight) || 0;
    
    // usable = Math.max((Number(mgw) - Number(tare)), 0)
    const usable = Math.max((mgw - tare), 0);
    
    // Hesaplanamadıysa helper uyarısı (input yine enabled)
    if (usable <= 0 || isNaN(usable)) {
      return {
        type: 'error',
        text: 'Hesaplanamadı – ULD bilgilerini kontrol edin'
      };
    }
    
    // Mevcut ağırlık girilmemişse
    if (!formData.currentWeight || current === 0) {
      return {
        type: 'normal',
        text: `Geçerli aralık: 0–${usable.toFixed(0)} kg`
      };
    }
    
    // Negatif değer kontrolü
    if (current < 0) {
      return {
        type: 'error',
        text: 'Sıfırdan büyük bir değer giriniz'
      };
    }
    
    const usage = (current / usable) * 100;
    const remaining = usable - current;
    
    // Limit aşımı kontrolü (kapasite aşımı)
    if (current > usable) {
      return {
        type: 'error',
        text: '❌ Limit aşıldı'
      };
    }
    
    // %100 doluluk
    if (usage >= 100) {
      return {
        type: 'error',
        text: '❌ Limit aşıldı'
      };
    }
    
    // %95-100 arası (kritik seviye)
    if (usage >= 95) {
      return {
        type: 'critical',
        text: `Kritik seviye! Kapasite %${usage.toFixed(0)} doldu`
      };
    }
    
    // %70-95 arası (uyarı)
    if (usage >= 70) {
      return {
        type: 'warning',
        text: `Kapasite yaklaşıyor (%${usage.toFixed(0)})`
      };
    }
    
    // Normal durum (≤ %70)
    return {
      type: 'normal',
      text: `Geçerli aralık: 0–${usable.toFixed(0)} kg • Kalan: ${remaining.toFixed(0)} kg`
    };
  };

  // Progress bar rengi - Web ile aynı
  const getProgressColor = (usage) => {
    if (usage >= 90) return '#dc2626' // Kırmızı
    if (usage >= 70) return '#f59e0b' // Turuncu
    return '#10b981' // Yeşil
  }

  // Aşım kontrolü ve uyarı mesajı
  const getOverflowWarning = () => {
    if (!formData.uldType || !formData.currentWeight || !formData.loadableWeight) {
      return null;
    }
    
    const current = parseFloat(formData.currentWeight);
    const loadable = parseFloat(formData.loadableWeight);
    
    if (current > loadable) {
      const overflow = current - loadable;
      return {
        message: `Kapasite aşıldı (+${formatTurkishNumber(overflow)} kg)`,
        isOverflow: true
      };
    }
    
    return null;
  };

  // Progress bar yüzdesi
  const getProgressPercentage = () => {
    if (!formData.uldType || !formData.currentWeight || !formData.loadableWeight) {
      return 0;
    }
    
    const current = parseFloat(formData.currentWeight);
    const loadable = parseFloat(formData.loadableWeight);
    
    if (loadable <= 0) return 0;
    
    return Math.min((current / loadable) * 100, 100);
  };

  return (
    <div className="mobile-uld">
      {/* Offline göstergesi */}
      {isOffline && (
        <div className="mobile-offline-indicator">
          Offline - Yerel kaydedildi
        </div>
      )}
      
      <div className="mobile-container">
        {/* Header Card - Web ile aynı */}
        <div className="mobile-card mobile-header-card">
          <h2 className="mobile-card-title">ULD Kapasite Yönetimi</h2>
          <p className="mobile-card-subtitle">ULD (Unit Load Device) kapasite ve hacim hesaplamaları</p>
        </div>

        {/* Form Card - Web ile aynı */}
        <div className="mobile-card">
          <form onSubmit={handleSubmit} className="mobile-uld-form">
            {/* 1. ULD Bilgileri */}
            <div className="mobile-form-section">
              <h3 className="mobile-form-section-title">ULD BİLGİLERİ</h3>
            
            {/* ULD Kodu */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">
                ULD Kodu <span className="required">*</span>
              </label>
              <input
                type="text"
                value={formData.uldCode}
                onChange={(e) => handleUldCodeChange(e.target.value)}
                className={`mobile-input ${errors.uldCode ? 'error' : ''}`}
                autoComplete="off"
                maxLength="10"
              />
              {errors.uldCode && (
                <div className="mobile-form-error">{errors.uldCode}</div>
              )}
              <div className="mobile-form-help">
                ULD kodu giriniz (örn: AKE12345AB)
              </div>
            </div>

            {/* ULD Tipi */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">
                ULD Tipi <span className="required">*</span>
              </label>
              
              <div className="mobile-dropdown-container">
                <input
                  type="text"
                  value={uldTypeSearch}
                  onChange={(e) => {
                    setUldTypeSearch(e.target.value)
                    setShowUldTypeDropdown(true)
                  }}
                  onFocus={() => setShowUldTypeDropdown(true)}
                  placeholder="ULD tipi arayın veya seçin"
                  className={`mobile-input ${errors.uldType ? 'error' : ''}`}
                  autoComplete="off"
                />
                {showUldTypeDropdown && (
                  <div className="mobile-dropdown-list">
                    {filteredUldTypes.slice(0, 10).map(([code, data]) => (
                      <div
                        key={code}
                        className="mobile-dropdown-item"
                        onClick={() => handleUldTypeSelect(code)}
                      >
                        <div className="mobile-dropdown-code">{code}</div>
                        <div className="mobile-dropdown-details">
                          <div className="mobile-dropdown-name">{data.name}</div>
                          <div className="mobile-dropdown-specs">
                            MGW: {formatTurkishNumber(data.mgw)} kg | Tare: {formatTurkishNumber(data.tare)} kg{data.type !== 'pallet' && data.volume ? ` | Vol: ${data.volume} m³` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {errors.uldType && (
                <div className="mobile-form-error">{errors.uldType}</div>
              )}
              <div className="mobile-form-help">
                ULD tipini seçin
              </div>
            </div>
            </div>

            {/* 2. Ağırlık Bilgileri */}
            <div className="mobile-form-section">
              <h3 className="mobile-form-section-title">AĞIRLIK BİLGİLERİ</h3>
            
            {/* Maksimum Ağırlık (MGW) */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">Maksimum Ağırlık (kg)</label>
              <input
                type="text"
                value={formData.mgw}
                className="mobile-input readonly"
                readOnly
              />
              <div className="mobile-form-help">
                ULD tipine göre otomatik hesaplanır
              </div>
            </div>

            {/* Tare */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">Tare (kg)</label>
              <input
                type="text"
                value={formData.tare}
                className="mobile-input readonly"
                readOnly
              />
              <div className="mobile-form-help">
                ULD tipine göre otomatik hesaplanır
              </div>
            </div>

            {/* Yüklenebilir Ağırlık */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">Yüklenebilir Ağırlık (kg)</label>
              <input
                type="text"
                value={formData.loadableWeight}
                className="mobile-input readonly"
                readOnly
              />
              <div className="mobile-form-help">
                Hesap: MGW - Tare
              </div>
            </div>

            {/* Mevcut Ağırlık */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">
                Mevcut Ağırlık (kg) <span className="required">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.currentWeight}
                onChange={(e) => handleCurrentWeightChange(e.target.value)}
                placeholder="0,00"
                className={`mobile-input ${errors.currentWeight ? 'error' : ''} ${getCurrentWeightHelper().type === 'error' ? 'error' : ''} ${getOverflowWarning()?.isOverflow ? 'error' : ''}`}
                autoComplete="off"
                disabled={!formData.uldType}
              />
              {/* Helper - Web ile aynı */}
              <div 
                className={`mobile-form-helper ${getCurrentWeightHelper().type}`}
                aria-live="polite"
                role={getCurrentWeightHelper().type === 'error' ? 'alert' : undefined}
              >
                <span className="helper-icon">
                  {getCurrentWeightHelper().type === 'disabled' && 'ⓘ'}
                  {getCurrentWeightHelper().type === 'normal' && 'ⓘ'}
                  {getCurrentWeightHelper().type === 'warning' && '⚠'}
                  {getCurrentWeightHelper().type === 'critical' && '⚠'}
                  {getCurrentWeightHelper().type === 'error' && '⛔'}
                </span>
                <span className="helper-text">
                  {getCurrentWeightHelper().text}
                </span>
              </div>
              {/* Aşım uyarısı */}
              {getOverflowWarning() && (
                <div className="mobile-form-error overflow-warning">
                  {getOverflowWarning().message}
                </div>
              )}
            </div>
            </div>

            {/* 3. Kapasite ve Hacim */}
            <div className="mobile-form-section">
              <h3 className="mobile-form-section-title">KAPASİTE VE HACİM</h3>
            
            {/* Hacim */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">Hacim (m³)</label>
              <input
                type="text"
                value={formData.volume}
                className="mobile-input readonly"
                readOnly
              />
              <div className="mobile-form-help">
                ULD tipine göre otomatik hesaplanır
              </div>
            </div>

            {/* Kalan Ağırlık */}
            <div className="mobile-form-group">
              <label className="mobile-form-label">Kalan Ağırlık (kg)</label>
              <div className="mobile-weight-display">
                <div className={`mobile-weight-value ${isOverloaded ? 'overloaded' : ''}`}>
                  {formatTurkishNumber(formData.remainingWeight || '0')}
                </div>
                <div className="mobile-weight-unit">kg</div>
              </div>
              <div className="mobile-form-help">
                Hesap: Yüklenebilir - Mevcut
              </div>
            </div>

            {/* Doluluk Oranı ve Progress Bar */}
            {formData.capacityUsage && (
              <div className="mobile-form-group">
                <label className="mobile-form-label">Doluluk Oranı</label>
                <div className="mobile-capacity-display">
                  <div className="mobile-capacity-percentage">
                    %{parseFloat(formData.capacityUsage).toFixed(1)}
                  </div>
                  <div className="mobile-progress-bar">
                    <div 
                      className="mobile-progress-fill"
                      style={{
                        width: `${Math.min(parseFloat(formData.capacityUsage), 100)}%`,
                        backgroundColor: getProgressColor(parseFloat(formData.capacityUsage))
                      }}
                    />
                  </div>
                </div>
                {isOverloaded && (
                  <div className="mobile-overload-warning">
                    Kapasite aşıldı (+{Math.abs(parseFloat(formData.remainingWeight)).toFixed(2)} kg)
                  </div>
                )}
              </div>
            )}
            </div>

            {/* Action Buttons */}
            <div className="mobile-form-actions">
            <button 
              type="submit"
              className="mobile-btn mobile-btn-primary mobile-btn-full"
              disabled={isOverloaded || getOverflowWarning()?.isOverflow}
            >
              {isOverloaded || getOverflowWarning()?.isOverflow ? 
                'Kapasite Aşıldı - Kaydetme Devre Dışı' : 
                isOffline ? 'ULD Kaydet (Offline)' : 'ULD Kaydet'}
            </button>

            <button 
              type="button"
              className="mobile-btn mobile-btn-secondary mobile-btn-full"
              onClick={handleClear}
            >
              Formu Temizle
            </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mobile-toast mobile-toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default MobileUld