import React, { useState, useEffect } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import './AwbAcceptance.css';

const AwbAcceptance = () => {
  const [formData, setFormData] = useState({
    awbNumber: '',
    departure: '',
    arrival: '',
    flightNumber: '',
    weight: '',
    pieces: '',
    departureDate: '',
    arrivalDate: '',
    cargoType: '',
    // Opsiyonel alanlar
    dimensions: '',
    volume: '',
    sender: '',
    receiver: '',
    specialHandling: '',
    declaredValue: ''
  });

  const [errors, setErrors] = useState({});
  const [showOptional, setShowOptional] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const { showSuccess, showError } = useNotification();

  // Responsive breakpoint detection
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // AWB numarası validasyonu
  const validateAwbNumber = (value) => {
    const awbRegex = /^\d{3}-\d{8}$/;
    if (!value) return 'AWB numarası zorunludur';
    if (!awbRegex.test(value)) return 'Format: 3 haneli prefix + 8 haneli seri (örn: 123-45678901)';
    return null;
  };

  // Ağırlık validasyonu
  const validateWeight = (value) => {
    if (!value) return 'Ağırlık zorunludur';
    const weight = parseFloat(value);
    if (isNaN(weight) || weight <= 0) return 'Geçerli bir ağırlık giriniz';
    if (value.includes('.') && value.split('.')[1].length > 2) return 'En fazla 2 ondalık basamak';
    return null;
  };

  // Parça sayısı validasyonu
  const validatePieces = (value) => {
    if (!value) return 'Parça sayısı zorunludur';
    const pieces = parseInt(value);
    if (isNaN(pieces) || pieces < 1) return 'Pozitif tam sayı olmalı';
    return null;
  };

  // Form validasyonu
  const validateForm = () => {
    const newErrors = {};
    
    const awbError = validateAwbNumber(formData.awbNumber);
    if (awbError) newErrors.awbNumber = awbError;
    
    if (!formData.departure) newErrors.departure = 'Kalkış yeri zorunludur';
    if (!formData.arrival) newErrors.arrival = 'Varış yeri zorunludur';
    if (!formData.flightNumber) newErrors.flightNumber = 'Uçuş numarası zorunludur';
    
    const weightError = validateWeight(formData.weight);
    if (weightError) newErrors.weight = weightError;
    
    const piecesError = validatePieces(formData.pieces);
    if (piecesError) newErrors.pieces = piecesError;
    
    if (!formData.departureDate) newErrors.departureDate = 'Kalkış tarihi zorunludur';
    if (!formData.arrivalDate) newErrors.arrivalDate = 'Varış tarihi zorunludur';
    if (!formData.cargoType) newErrors.cargoType = 'Kargo türü zorunludur';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form gönderimi
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      // API çağrısı simülasyonu
      await new Promise(resolve => setTimeout(resolve, 1000));
      showSuccess('AWB başarıyla kaydedildi!', 'Kayıt Başarılı');
      resetForm();
    } catch (error) {
      showError('AWB kaydedilemedi. Lütfen tekrar deneyin.', 'Kayıt Hatası');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form sıfırlama
  const resetForm = () => {
    setFormData({
      awbNumber: '',
      departure: '',
      arrival: '',
      flightNumber: '',
      weight: '',
      pieces: '',
      departureDate: '',
      arrivalDate: '',
      cargoType: '',
      dimensions: '',
      volume: '',
      sender: '',
      receiver: '',
      specialHandling: '',
      declaredValue: ''
    });
    setErrors({});
    setShowOptional(false);
  };

  // Input değişiklikleri
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Hata mesajını temizle
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Desktop Layout - Tüm alanlar tek bakışta
  const renderDesktopLayout = () => (
    <div className="awb-container awb-desktop">
      <div className="awb-header">
        <h1 className="awb-title">✈️ AWB Yönetimi</h1>
        <p className="awb-subtitle">Hızlı AWB girişi ve yönetimi</p>
      </div>

      <form onSubmit={handleSubmit} className="awb-form">
        <div className="form-sections-container">
          {/* Zorunlu Bilgiler */}
          <div className="form-section required-section">
            <div className="section-header">
              <h2 className="section-title">📋 Zorunlu Bilgiler</h2>
              <span className="required-badge">Zorunlu</span>
            </div>
            
            <div className="form-grid desktop-grid">
              <div className="form-group">
                <label htmlFor="awbNumber" className="form-label">
                  AWB Numarası <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="awbNumber"
                  value={formData.awbNumber}
                  onChange={(e) => handleInputChange('awbNumber', e.target.value)}
                  className={`form-input ${errors.awbNumber ? 'error' : ''}`}

                  maxLength="12"
                />
                {errors.awbNumber && <div className="error-message">{errors.awbNumber}</div>}
                <div className="field-help">Format: 3 haneli prefix + 8 haneli seri</div>
              </div>

              <div className="form-group">
                <label htmlFor="departure" className="form-label">
                  Kalkış Yeri <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="departure"
                  value={formData.departure}
                  onChange={(e) => handleInputChange('departure', e.target.value)}
                  className={`form-input ${errors.departure ? 'error' : ''}`}

                />
                {errors.departure && <div className="error-message">{errors.departure}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="arrival" className="form-label">
                  Varış Yeri <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="arrival"
                  value={formData.arrival}
                  onChange={(e) => handleInputChange('arrival', e.target.value)}
                  className={`form-input ${errors.arrival ? 'error' : ''}`}

                />
                {errors.arrival && <div className="error-message">{errors.arrival}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="flightNumber" className="form-label">
                  Uçuş No <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="flightNumber"
                  value={formData.flightNumber}
                  onChange={(e) => handleInputChange('flightNumber', e.target.value)}
                  className={`form-input ${errors.flightNumber ? 'error' : ''}`}

                />
                {errors.flightNumber && <div className="error-message">{errors.flightNumber}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="weight" className="form-label">
                  Ağırlık (kg) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="weight"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className={`form-input ${errors.weight ? 'error' : ''}`}

                  step="0.01"
                  min="0"
                />
                {errors.weight && <div className="error-message">{errors.weight}</div>}
                <div className="field-help">En fazla 2 ondalık basamak</div>
              </div>

              <div className="form-group">
                <label htmlFor="pieces" className="form-label">
                  Parça Sayısı <span className="required">*</span>
                </label>
                <input
                  type="number"
                  id="pieces"
                  value={formData.pieces}
                  onChange={(e) => handleInputChange('pieces', e.target.value)}
                  className={`form-input ${errors.pieces ? 'error' : ''}`}

                  min="1"
                />
                {errors.pieces && <div className="error-message">{errors.pieces}</div>}
                <div className="field-help">Pozitif tam sayı</div>
              </div>

              <div className="form-group">
                <label htmlFor="departureDate" className="form-label">
                  Kalkış Tarihi <span className="required">*</span>
                </label>
                <input
                  type="date"
                  id="departureDate"
                  value={formData.departureDate}
                  onChange={(e) => handleInputChange('departureDate', e.target.value)}
                  className={`form-input ${errors.departureDate ? 'error' : ''}`}
                />
                {errors.departureDate && <div className="error-message">{errors.departureDate}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="arrivalDate" className="form-label">
                  Varış Tarihi <span className="required">*</span>
                </label>
                <input
                  type="date"
                  id="arrivalDate"
                  value={formData.arrivalDate}
                  onChange={(e) => handleInputChange('arrivalDate', e.target.value)}
                  className={`form-input ${errors.arrivalDate ? 'error' : ''}`}
                />
                {errors.arrivalDate && <div className="error-message">{errors.arrivalDate}</div>}
              </div>

              <div className="form-group">
                <label htmlFor="cargoType" className="form-label">
                  Kargo Türü <span className="required">*</span>
                </label>
                <select
                  id="cargoType"
                  value={formData.cargoType}
                  onChange={(e) => handleInputChange('cargoType', e.target.value)}
                  className={`form-select ${errors.cargoType ? 'error' : ''}`}
                >
                  <option value="">Seçiniz</option>
                  <option value="general">Genel Kargo</option>
                  <option value="express">Express Kargo</option>
                  <option value="perishable">Bozulabilir</option>
                  <option value="dangerous">Tehlikeli Madde</option>
                  <option value="valuable">Değerli Kargo</option>
                </select>
                {errors.cargoType && <div className="error-message">{errors.cargoType}</div>}
              </div>
            </div>
          </div>

          {/* Opsiyonel Bilgiler - Desktop'ta tam görünüm */}
          <div className="form-section optional-section">
            <div className="section-header">
              <h2 className="section-title">🔧 Opsiyonel Bilgiler</h2>
              <span className="optional-badge">Opsiyonel</span>
            </div>
            
            <div className="form-grid desktop-grid">
              <div className="form-group">
                <label htmlFor="dimensions" className="form-label">Boyutlar (UxGxY)</label>
                <input
                  type="text"
                  id="dimensions"
                  value={formData.dimensions}
                  onChange={(e) => handleInputChange('dimensions', e.target.value)}
                  className="form-input"

                />
                <div className="field-help">Uzunluk x Genişlik x Yükseklik</div>
              </div>

              <div className="form-group">
                <label htmlFor="volume" className="form-label">Hacim (m³)</label>
                <input
                  type="number"
                  id="volume"
                  value={formData.volume}
                  onChange={(e) => handleInputChange('volume', e.target.value)}
                  className="form-input"
                  
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="sender" className="form-label">Gönderici</label>
                <input
                  type="text"
                  id="sender"
                  value={formData.sender}
                  onChange={(e) => handleInputChange('sender', e.target.value)}
                  className="form-input"

                />
              </div>

              <div className="form-group">
                <label htmlFor="receiver" className="form-label">Alıcı</label>
                <input
                  type="text"
                  id="receiver"
                  value={formData.receiver}
                  onChange={(e) => handleInputChange('receiver', e.target.value)}
                  className="form-input"

                />
              </div>

              <div className="form-group">
                <label htmlFor="specialHandling" className="form-label">Özel İşlem</label>
                <input
                  type="text"
                  id="specialHandling"
                  value={formData.specialHandling}
                  onChange={(e) => handleInputChange('specialHandling', e.target.value)}
                  className="form-input"

                />
              </div>

              <div className="form-group">
                <label htmlFor="declaredValue" className="form-label">Beyan Edilen Değer</label>
                <input
                  type="number"
                  id="declaredValue"
                  value={formData.declaredValue}
                  onChange={(e) => handleInputChange('declaredValue', e.target.value)}
                  className="form-input"
                  
                  step="0.01"
                  min="0"
                />
                <div className="field-help">USD cinsinden</div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop CTA - Normal butonlar */}
        <div className="desktop-cta">
          <button
            type="button"
            onClick={resetForm}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            🔄 Temizle
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? '⏳ Kaydediliyor...' : '💾 AWB Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );

  // Mobile Layout - Accordion + Sticky CTA
  const renderMobileLayout = () => (
    <div className="awb-container awb-mobile">
      <div className="awb-header">
        <h1 className="awb-title">✈️ AWB Yönetimi</h1>
        <p className="awb-subtitle">Hızlı AWB girişi ve yönetimi</p>
      </div>

      <form onSubmit={handleSubmit} className="awb-form">
        {/* Zorunlu Bilgiler - İlk ekranda kısa */}
        <div className="form-section required-section">
          <div className="section-header">
            <h2 className="section-title">📋 Zorunlu Bilgiler</h2>
            <span className="required-badge">Zorunlu</span>
          </div>
          
          <div className="form-grid mobile-grid">
            <div className="form-group">
              <label htmlFor="awbNumber" className="form-label">
                AWB Numarası <span className="required">*</span>
              </label>
              <input
                type="text"
                id="awbNumber"
                value={formData.awbNumber}
                onChange={(e) => handleInputChange('awbNumber', e.target.value)}
                className={`form-input ${errors.awbNumber ? 'error' : ''}`}
                
                maxLength="12"
              />
              {errors.awbNumber && <div className="error-message">{errors.awbNumber}</div>}
              <div className="field-help">Format: 3 haneli prefix + 8 haneli seri</div>
            </div>

            <div className="form-group">
              <label htmlFor="departure" className="form-label">
                Kalkış Yeri <span className="required">*</span>
              </label>
              <input
                type="text"
                id="departure"
                value={formData.departure}
                onChange={(e) => handleInputChange('departure', e.target.value)}
                className={`form-input ${errors.departure ? 'error' : ''}`}
                
              />
              {errors.departure && <div className="error-message">{errors.departure}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="arrival" className="form-label">
                Varış Yeri <span className="required">*</span>
              </label>
              <input
                type="text"
                id="arrival"
                value={formData.arrival}
                onChange={(e) => handleInputChange('arrival', e.target.value)}
                className={`form-input ${errors.arrival ? 'error' : ''}`}
                
              />
              {errors.arrival && <div className="error-message">{errors.arrival}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="flightNumber" className="form-label">
                Uçuş No <span className="required">*</span>
              </label>
              <input
                type="text"
                id="flightNumber"
                value={formData.flightNumber}
                onChange={(e) => handleInputChange('flightNumber', e.target.value)}
                className={`form-input ${errors.flightNumber ? 'error' : ''}`}
                
              />
              {errors.flightNumber && <div className="error-message">{errors.flightNumber}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="weight" className="form-label">
                Ağırlık (kg) <span className="required">*</span>
              </label>
              <input
                type="number"
                id="weight"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                className={`form-input ${errors.weight ? 'error' : ''}`}
                
                step="0.01"
                min="0"
              />
              {errors.weight && <div className="error-message">{errors.weight}</div>}
              <div className="field-help">En fazla 2 ondalık basamak</div>
            </div>

            <div className="form-group">
              <label htmlFor="pieces" className="form-label">
                Parça Sayısı <span className="required">*</span>
              </label>
              <input
                type="number"
                id="pieces"
                value={formData.pieces}
                onChange={(e) => handleInputChange('pieces', e.target.value)}
                className={`form-input ${errors.pieces ? 'error' : ''}`}
                
                min="1"
              />
              {errors.pieces && <div className="error-message">{errors.pieces}</div>}
              <div className="field-help">Pozitif tam sayı</div>
            </div>

            <div className="form-group">
              <label htmlFor="departureDate" className="form-label">
                Kalkış Tarihi <span className="required">*</span>
              </label>
              <input
                type="date"
                id="departureDate"
                value={formData.departureDate}
                onChange={(e) => handleInputChange('departureDate', e.target.value)}
                className={`form-input ${errors.departureDate ? 'error' : ''}`}
              />
              {errors.departureDate && <div className="error-message">{errors.departureDate}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="arrivalDate" className="form-label">
                Varış Tarihi <span className="required">*</span>
              </label>
              <input
                type="date"
                id="arrivalDate"
                value={formData.arrivalDate}
                onChange={(e) => handleInputChange('arrivalDate', e.target.value)}
                className={`form-input ${errors.arrivalDate ? 'error' : ''}`}
              />
              {errors.arrivalDate && <div className="error-message">{errors.arrivalDate}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="cargoType" className="form-label">
                Kargo Türü <span className="required">*</span>
              </label>
              <select
                id="cargoType"
                value={formData.cargoType}
                onChange={(e) => handleInputChange('cargoType', e.target.value)}
                className={`form-select ${errors.cargoType ? 'error' : ''}`}
              >
                <option value="">Seçiniz</option>
                <option value="general">Genel Kargo</option>
                <option value="express">Express Kargo</option>
                <option value="perishable">Bozulabilir</option>
                <option value="dangerous">Tehlikeli Madde</option>
                <option value="valuable">Değerli Kargo</option>
              </select>
              {errors.cargoType && <div className="error-message">{errors.cargoType}</div>}
            </div>
          </div>
        </div>

        {/* Opsiyonel Bilgiler - Mobile'da accordion */}
        <div className="form-section optional-section">
          <div 
            className="section-header collapsible"
            onClick={() => setShowOptional(!showOptional)}
          >
            <h2 className="section-title">🔧 Opsiyonel Bilgiler</h2>
            <div className="section-toggle">
              <span className="optional-badge">Opsiyonel</span>
              <span className={`toggle-icon ${showOptional ? 'expanded' : ''}`}>
                {showOptional ? '−' : '+'}
              </span>
            </div>
          </div>
          
          {showOptional && (
            <div className="optional-fields">
              <div className="form-grid mobile-grid">
                <div className="form-group">
                  <label htmlFor="dimensions" className="form-label">Boyutlar (UxGxY)</label>
                  <input
                    type="text"
                    id="dimensions"
                    value={formData.dimensions}
                    onChange={(e) => handleInputChange('dimensions', e.target.value)}
                    className="form-input"
                    
                  />
                  <div className="field-help">Uzunluk x Genişlik x Yükseklik</div>
                </div>

                <div className="form-group">
                  <label htmlFor="volume" className="form-label">Hacim (m³)</label>
                  <input
                    type="number"
                    id="volume"
                    value={formData.volume}
                    onChange={(e) => handleInputChange('volume', e.target.value)}
                    className="form-input"
                    
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="sender" className="form-label">Gönderici</label>
                  <input
                    type="text"
                    id="sender"
                    value={formData.sender}
                    onChange={(e) => handleInputChange('sender', e.target.value)}
                    className="form-input"
                    
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="receiver" className="form-label">Alıcı</label>
                  <input
                    type="text"
                    id="receiver"
                    value={formData.receiver}
                    onChange={(e) => handleInputChange('receiver', e.target.value)}
                    className="form-input"
                    
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="specialHandling" className="form-label">Özel İşlem</label>
                  <input
                    type="text"
                    id="specialHandling"
                    value={formData.specialHandling}
                    onChange={(e) => handleInputChange('specialHandling', e.target.value)}
                    className="form-input"
                    
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="declaredValue" className="form-label">Beyan Edilen Değer</label>
                  <input
                    type="number"
                    id="declaredValue"
                    value={formData.declaredValue}
                    onChange={(e) => handleInputChange('declaredValue', e.target.value)}
                    className="form-input"
                    
                    step="0.01"
                    min="0"
                  />
                  <div className="field-help">USD cinsinden</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Sticky CTA - Sadece mobile'da */}
        <div className="mobile-sticky-cta">
          <div className="cta-content">
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              🔄 Temizle
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? '⏳ Kaydediliyor...' : '💾 AWB Kaydet'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  // Mod bazlı render
  return isMobile ? renderMobileLayout() : renderDesktopLayout();
};

export default AwbAcceptance;
