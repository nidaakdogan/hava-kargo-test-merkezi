import React, { useState } from 'react';
import axios from 'axios';
import { useOffline } from '../contexts/OfflineContext';
import '../styles/forms.css';

// IATA Airport Codes - Alfabetik Sıralı
const iataCodes = [
  // Türkiye Şehirleri (Alfabetik)
  { code: 'ADA', city: 'Adana', country: 'Türkiye' },
  { code: 'ADB', city: 'İzmir', country: 'Türkiye' },
  { code: 'ASR', city: 'Kayseri', country: 'Türkiye' },
  { code: 'AYT', city: 'Antalya', country: 'Türkiye' },
  { code: 'BAL', city: 'Batman', country: 'Türkiye' },
  { code: 'BJV', city: 'Bodrum', country: 'Türkiye' },
  { code: 'DLM', city: 'Dalaman', country: 'Türkiye' },
  { code: 'DNZ', city: 'Denizli', country: 'Türkiye' },
  { code: 'ERZ', city: 'Erzurum', country: 'Türkiye' },
  { code: 'ESB', city: 'Ankara', country: 'Türkiye' },
  { code: 'EZS', city: 'Elazığ', country: 'Türkiye' },
  { code: 'GZT', city: 'Gaziantep', country: 'Türkiye' },
  { code: 'IST', city: 'İstanbul', country: 'Türkiye' },
  { code: 'KCM', city: 'Kahramanmaraş', country: 'Türkiye' },
  { code: 'KYS', city: 'Konya', country: 'Türkiye' },
  { code: 'MQM', city: 'Mardin', country: 'Türkiye' },
  { code: 'SAW', city: 'İstanbul-Sabiha Gökçen', country: 'Türkiye' },
  { code: 'SXZ', city: 'Siirt', country: 'Türkiye' },
  { code: 'SZF', city: 'Samsun', country: 'Türkiye' },
  { code: 'TZX', city: 'Trabzon', country: 'Türkiye' },
  { code: 'VAN', city: 'Van', country: 'Türkiye' },
  
  // Avrupa Şehirleri (Alfabetik)
  { code: 'AMS', city: 'Amsterdam', country: 'Hollanda' },
  { code: 'ATH', city: 'Atina', country: 'Yunanistan' },
  { code: 'BCN', city: 'Barselona', country: 'İspanya' },
  { code: 'BUD', city: 'Budapeşte', country: 'Macaristan' },
  { code: 'CDG', city: 'Paris-Charles de Gaulle', country: 'Fransa' },
  { code: 'FCO', city: 'Roma', country: 'İtalya' },
  { code: 'FRA', city: 'Frankfurt', country: 'Almanya' },
  { code: 'LGW', city: 'Londra-Gatwick', country: 'İngiltere' },
  { code: 'LHR', city: 'Londra-Heathrow', country: 'İngiltere' },
  { code: 'MAD', city: 'Madrid', country: 'İspanya' },
  { code: 'MUC', city: 'Münih', country: 'Almanya' },
  { code: 'MXP', city: 'Milano-Malpensa', country: 'İtalya' },
  { code: 'ORY', city: 'Paris-Orly', country: 'Fransa' },
  { code: 'OTP', city: 'Bükreş', country: 'Romanya' },
  { code: 'PRG', city: 'Prag', country: 'Çek Cumhuriyeti' },
  { code: 'SKG', city: 'Selanik', country: 'Yunanistan' },
  { code: 'SOF', city: 'Sofya', country: 'Bulgaristan' },
  { code: 'VIE', city: 'Viyana', country: 'Avusturya' },
  { code: 'WAW', city: 'Varşova', country: 'Polonya' },
  { code: 'ZRH', city: 'Zürih', country: 'İsviçre' },
  
  // Kuzey Amerika Şehirleri (Alfabetik)
  { code: 'ATL', city: 'Atlanta', country: 'ABD' },
  { code: 'DFW', city: 'Dallas-Fort Worth', country: 'ABD' },
  { code: 'JFK', city: 'New York-JFK', country: 'ABD' },
  { code: 'LAX', city: 'Los Angeles', country: 'ABD' },
  { code: 'MEX', city: 'Meksiko', country: 'Meksika' },
  { code: 'MIA', city: 'Miami', country: 'ABD' },
  { code: 'ORD', city: 'Chicago-O\'Hare', country: 'ABD' },
  { code: 'YUL', city: 'Montreal', country: 'Kanada' },
  { code: 'YYZ', city: 'Toronto', country: 'Kanada' },
  
  // Asya Şehirleri (Alfabetik)
  { code: 'AUH', city: 'Abu Dhabi', country: 'BAE' },
  { code: 'BKK', city: 'Bangkok', country: 'Tayland' },
  { code: 'BOM', city: 'Mumbai', country: 'Hindistan' },
  { code: 'CAI', city: 'Kahire', country: 'Mısır' },
  { code: 'DEL', city: 'Delhi', country: 'Hindistan' },
  { code: 'DOH', city: 'Doha', country: 'Katar' },
  { code: 'DXB', city: 'Dubai', country: 'BAE' },
  { code: 'HKG', city: 'Hong Kong', country: 'Çin' },
  { code: 'HND', city: 'Tokyo-Haneda', country: 'Japonya' },
  { code: 'ICN', city: 'Seul-Incheon', country: 'Güney Kore' },
  { code: 'JED', city: 'Cidde', country: 'Suudi Arabistan' },
  { code: 'JNB', city: 'Johannesburg', country: 'Güney Afrika' },
  { code: 'NBO', city: 'Nairobi', country: 'Kenya' },
  { code: 'NRT', city: 'Tokyo-Narita', country: 'Japonya' },
  { code: 'PEK', city: 'Pekin', country: 'Çin' },
  { code: 'PVG', city: 'Şangay-Pudong', country: 'Çin' },
  { code: 'RUH', city: 'Riyad', country: 'Suudi Arabistan' },
  { code: 'SIN', city: 'Singapur', country: 'Singapur' }
];

const AWBForm = () => {
  const { isOffline, addToOfflineQueue } = useOffline();
  
  const [formData, setFormData] = useState({
    awbNumber: '',
    origin: '',
    destination: '',
    weight: '',
    pieces: '',
    flightNumber: '',
    awbDate: '',
    flightDate: '',
    volume: '',
    dimensions: '',
    cargoType: '',
    consolidationType: '',
    specialHandling: '',
    shipperName: '',
    receiverName: '',
    shipperAddress: '',
    receiverAddress: '',
    carrierCompany: '',
    commodity: '',
    declaredValue: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const API_BASE_URL = window.location.hostname === '10.0.2.2' 
    ? 'http://10.0.2.2:3001' 
    : 'http://localhost:3001';

  // Basit form reset
  const resetForm = () => {
    setFormData({
      awbNumber: '',
      origin: '',
      destination: '',
      weight: '',
      pieces: '',
      flightNumber: '',
      awbDate: '',
      flightDate: '',
      volume: '',
      dimensions: '',
      cargoType: '',
      consolidationType: '',
      specialHandling: '',
      shipperName: '',
      receiverName: '',
      shipperAddress: '',
      receiverAddress: '',
      carrierCompany: '',
      commodity: '',
      declaredValue: ''
    });
    setErrors({});
    setMessage('');
    setMessageType('');
  };

  // Basit input değişim handler'ı
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Hata varsa temizle
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Basit form validasyonu
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.awbNumber) newErrors.awbNumber = 'AWB numarası zorunludur';
    else if (!/^\d{3}-\d{8}$/.test(formData.awbNumber)) newErrors.awbNumber = 'Geçersiz AWB formatı (3+8).';
    
    if (!formData.origin) newErrors.origin = 'IATA istasyon seçin.';
    if (!formData.destination) newErrors.destination = 'IATA istasyon seçin.';
    
    if (!formData.weight) newErrors.weight = 'Ağırlık zorunludur';
    else if (!/^\d+(\.\d{1,2})?$/.test(formData.weight)) newErrors.weight = 'En fazla 2 ondalık girilebilir.';
    
    if (!formData.pieces) newErrors.pieces = 'Parça sayısı zorunludur';
    else if (!/^\d+$/.test(formData.pieces) || parseInt(formData.pieces) <= 0) newErrors.pieces = 'Pozitif tam sayı giriniz';
    
    if (!formData.flightNumber) newErrors.flightNumber = 'Uçuş numarası zorunludur';
    else if (!/^[A-Z]{2}\d{4}$/.test(formData.flightNumber)) newErrors.flightNumber = 'Geçersiz format (AA9999)';
    
    if (!formData.awbDate) newErrors.awbDate = 'AWB tarihi zorunludur';
    if (!formData.flightDate) newErrors.flightDate = 'Uçuş tarihi zorunludur';
    else if (formData.awbDate && formData.flightDate && new Date(formData.flightDate) < new Date(formData.awbDate)) {
      newErrors.flightDate = 'Uçuş ≥ AWB tarihi olmalı';
    }
    
    if (!formData.cargoType) newErrors.cargoType = 'Kargo türü zorunludur';
    if (!formData.consolidationType) newErrors.consolidationType = 'Konsolidasyon türü zorunludur';
    
    // Konsolidasyon türü özel kuralları
    if (formData.consolidationType === 'Back-to-Back') {
      // B2B seçiliyken tam 1 HAWB zorunlu uyarısı
      // Bu kural ileride HAWB alanları eklendiğinde uygulanacak
      // Şimdilik sadece tür seçilmiş olması yeterli
    }
    
    if (formData.consolidationType === 'Consolidation' || formData.consolidationType === 'Co-Load') {
      // Consol/Co-Load'ta ≥1 HAWB zorunlu; toplamlar MAWB ile uyumlu
      // Bu kural ileride HAWB alanları eklendiğinde uygulanacak
      // Şimdilik sadece tür seçilmiş olması yeterli
    }
    
    if (formData.consolidationType === 'Direct') {
      // Direct seçiliyken HAWB alanları gizli/pasif olacak
      // Bu kural ileride HAWB alanları eklendiğinde uygulanacak
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Form submit başladı');
    console.log('Form data:', formData);
    
    if (!validateForm()) {
      console.log('Form validasyon hatası');
      setMessage('Lütfen zorunlu alanları doldurun');
      setMessageType('error');
      return;
    }
    
    console.log('Form validasyon başarılı, API çağrısı yapılıyor...');
    setLoading(true);
    setMessage('');

    // Offline modda kuyruğa ekle
    if (isOffline) {
      console.log('Offline mod - kuyruğa ekleniyor');
      const queueId = addToOfflineQueue('create_awb', formData);
      setMessage('Offline mod: AWB kuyruğa eklendi (ID: ' + queueId + ')');
      setMessageType('warning');
      setLoading(false);
      return;
    }

    try {
      console.log('API çağrısı yapılıyor:', `${API_BASE_URL}/api/awb`);
      const response = await axios.post(`${API_BASE_URL}/api/awb`, formData);
      
      console.log('API response:', response);
      
      if (response.status === 201) {
        setSuccessData(response.data);
        setShowSuccessModal(true);
        resetForm();
        setMessage('AWB başarıyla kaydedildi!');
        setMessageType('success');
      }
    } catch (error) {
      console.error('AWB kaydetme hatası:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        request: error.request
      });
      
      if (!navigator.onLine) {
        const queueId = addToOfflineQueue('create_awb', formData);
        setMessage('Bağlantı hatası: AWB offline kuyruğa eklendi (ID: ' + queueId + ')');
        setMessageType('warning');
      } else {
        setMessage('AWB kaydedilirken hata oluştu');
        setMessageType('error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="awb-page awb-form-container">
      <div className="form-container">
        {/* Professional Form Header */}
        <div className="form-header">
          <h1 className="form-title">
            AWB Yönetimi
          </h1>
          <p className="form-subtitle">AWB (Air Waybill) bilgilerini girerek kargo oluşturun</p>
          
          {/* Offline durum uyarısı */}
          {isOffline && (
            <div className="offline-warning">
              <span>Offline mod - Veriler cihazda saklanıyor</span>
              <span className="offline-note">İnternet bağlantısı geldiğinde otomatik senkronize edilecek</span>
            </div>
          )}
        </div>

      {/* Message Display */}
      {message && (
        <div className={`form-message ${messageType}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="dg-form" autoComplete="off">
        <div className="form-body">
                     {/* Uçuş & AWB Bilgileri - Professional Section */}
           <div className="form-section">
             <div className="section-header">
               <h2 className="section-title">UÇUŞ & AWB BİLGİLERİ</h2>
             </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="awbNumber" className="form-label">
                  AWB Numarası <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <input
                    type="text"
                    id="awbNumber"
                    name="awbNumber"
                    className={`form-input ${errors.awbNumber ? 'error' : ''}`}
                    value={formData.awbNumber}
                    onChange={handleInputChange}
                    maxLength="12"
                    autoComplete="off"
                  />
                </div>
                {errors.awbNumber && (
                  <div className="error-message">{errors.awbNumber}</div>
                )}
                <div className="form-helper-text">Format: 123-45678901 (3 haneli prefix + 8 haneli seri)</div>
              </div>

              <div className="form-group">
                <label htmlFor="origin" className="form-label">
                  Kalkış Yeri <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <select
                    id="origin"
                    name="origin"
                    className={`form-input ${errors.origin ? 'error' : ''}`}
                    value={formData.origin}
                    onChange={handleInputChange}
                    autoComplete="off"
                    size="1"
                    dir="ltr"
                    style={{
                      color: '#111827',
                      WebkitTextFillColor: '#111827',
                      opacity: 1,
                      filter: 'none',
                      textIndent: 0,
                      visibility: 'visible',
                      display: 'block',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      height: '42px',
                      lineHeight: '1.5',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="">Seçiniz</option>
                    {iataCodes.map(code => (
                      <option key={code.code} value={code.code}>
                        {code.code} - {code.city}, {code.country}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.origin && (
                  <div className="error-message">{errors.origin}</div>
                )}
                <div className="form-helper-text">Kalkış yeri seçin</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="destination" className="form-label">
                  Varış Yeri <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <select
                    id="destination"
                    name="destination"
                    className={`form-input ${errors.destination ? 'error' : ''}`}
                    value={formData.destination}
                    onChange={handleInputChange}
                    autoComplete="off"
                    size="1"
                    dir="ltr"
                    style={{
                      color: '#111827',
                      WebkitTextFillColor: '#111827',
                      opacity: 1,
                      filter: 'none',
                      textIndent: 0,
                      visibility: 'visible',
                      display: 'block',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      height: '42px',
                      lineHeight: '1.5',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="">Seçiniz</option>
                    {iataCodes.map(code => (
                      <option key={code.code} value={code.code}>
                        {code.code} - {code.city}, {code.country}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.destination && (
                  <div className="error-message">{errors.destination}</div>
                )}
                <div className="form-helper-text">Varış yeri seçin</div>
              </div>

              <div className="form-group">
                <label htmlFor="flightNumber" className="form-label">
                  Uçuş Numarası <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <input
                    type="text"
                    id="flightNumber"
                    name="flightNumber"
                    className={`form-input ${errors.flightNumber ? 'error' : ''}`}
                    value={formData.flightNumber}
                    onChange={handleInputChange}
                    maxLength="6"
                    autoComplete="off"
                  />
                </div>
                {errors.flightNumber && (
                  <div className="error-message">{errors.flightNumber}</div>
                )}
                <div className="form-helper-text">Format: TK1234 (2 harf + 4 rakam)</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="weight" className="form-label">
                  Ağırlık <span className="label-required">*</span>
                </label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    id="weight"
                    name="weight"
                    className={`form-input ${errors.weight ? 'error' : ''}`}
                    value={formData.weight}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max="999999.99"
                    autoComplete="off"
                  />
                  <span className="input-unit">kg</span>
                </div>
                {errors.weight && (
                  <div className="error-message">{errors.weight}</div>
                )}
                <div className="form-helper-text">Maksimum 2 ondalık</div>
              </div>

              <div className="form-group">
                <label htmlFor="pieces" className="form-label">
                  Parça Sayısı <span className="label-required">*</span>
                </label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    id="pieces"
                    name="pieces"
                    className={`form-input ${errors.pieces ? 'error' : ''}`}
                    value={formData.pieces}
                    onChange={handleInputChange}
                    min="1"
                    max="99999"
                    autoComplete="off"
                  />
                  <span className="input-unit">pcs</span>
                </div>
                {errors.pieces && (
                  <div className="error-message">{errors.pieces}</div>
                )}
                <div className="form-helper-text">Sadece tam sayı</div>
              </div>
            </div>
          </div>

          {/* Tarih Bilgileri - Professional Section */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">TARİH BİLGİLERİ</h2>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="awbDate" className="form-label">
                  AWB Tarihi <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <input
                    type="date"
                    id="awbDate"
                    name="awbDate"
                    className={`form-input date-picker ${errors.awbDate ? 'error' : ''}`}
                    value={formData.awbDate}
                    onChange={handleInputChange}
                    max={new Date().toISOString().split('T')[0]}
                    autoComplete="off"
                    data-testid="awb-date-input"
                  />
                </div>
                {errors.awbDate && (
                  <div className="error-message">{errors.awbDate}</div>
                )}
                <div className="form-helper-text">AWB belgesi oluşturulma tarihi</div>
              </div>

              <div className="form-group">
                <label htmlFor="flightDate" className="form-label">
                  Uçuş Tarihi <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <input
                    type="date"
                    id="flightDate"
                    name="flightDate"
                    className={`form-input date-picker ${errors.flightDate ? 'error' : ''}`}
                    value={formData.flightDate}
                    onChange={handleInputChange}
                    min={formData.awbDate || new Date().toISOString().split('T')[0]}
                    autoComplete="off"
                    data-testid="flight-date-input"
                  />
                </div>
                {errors.flightDate && (
                  <div className="error-message">{errors.flightDate}</div>
                )}
                <div className="form-helper-text">Kargo taşınacak uçuş tarihi</div>
              </div>
            </div>
          </div>

          {/* Kargo & Konsolidasyon Bilgileri - Professional Section */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">KARGO & KONSOLİDASYON BİLGİLERİ</h2>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cargoType" className="form-label">
                  Kargo Türü <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <select
                    id="cargoType"
                    name="cargoType"
                    className={`form-input ${errors.cargoType ? 'error' : ''}`}
                    value={formData.cargoType}
                    onChange={handleInputChange}
                    autoComplete="off"
                    size="1"
                    dir="ltr"
                    style={{
                      color: '#111827',
                      WebkitTextFillColor: '#111827',
                      opacity: 1,
                      filter: 'none',
                      textIndent: 0,
                      visibility: 'visible',
                      display: 'block',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      height: '42px',
                      lineHeight: '1.5',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="">Seçiniz</option>
                    <option value="General">Genel Kargo</option>
                    <option value="DG">Tehlikeli Madde (DG)</option>
                    <option value="Perishable">Bozulabilir Kargo</option>
                    <option value="Live Animals">Canlı Hayvan (AVI)</option>
                    <option value="Valuable">Değerli Kargo (VAL)</option>
                    <option value="Heavy">Ağır Kargo</option>
                    <option value="Oversized">Aşırı Boyutlu Kargo</option>
                  </select>
                </div>
                {errors.cargoType && (
                  <div className="error-message">{errors.cargoType}</div>
                )}
                <div className="form-helper-text">Örn: Genel, DG, Bozulabilir, Canlı Hayvan</div>
              </div>

              <div className="form-group">
                <label htmlFor="consolidationType" className="form-label">
                  Konsolidasyon Türü <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <select
                    id="consolidationType"
                    name="consolidationType"
                    className={`form-input ${errors.consolidationType ? 'error' : ''}`}
                    value={formData.consolidationType}
                    onChange={handleInputChange}
                    autoComplete="off"
                    size="1"
                    dir="ltr"
                    style={{
                      color: '#111827',
                      WebkitTextFillColor: '#111827',
                      opacity: 1,
                      filter: 'none',
                      textIndent: 0,
                      visibility: 'visible',
                      display: 'block',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      padding: '0.5rem 0.75rem',
                      height: '42px',
                      lineHeight: '1.5',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="" disabled>Seçiniz</option>
                    <option value="Direct">Direct (MAWB only)</option>
                    <option value="Back-to-Back">Back-to-Back (1 HAWB ↔ 1 MAWB)</option>
                    <option value="Consolidation">Consolidation (N HAWB → 1 MAWB)</option>
                    <option value="Co-Load">Co-Load</option>
                  </select>
                </div>
                {errors.consolidationType && (
                  <div className="error-message">{errors.consolidationType}</div>
                )}
                <div className="form-helper-text">MAWB/HAWB birleştirme: Direct, Back-to-Back, Consolidation, Co-Load.</div>
              </div>
            </div>
          </div>

          {/* Fiziksel Özellikler - Professional Section */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">FİZİKSEL ÖZELLİKLER</h2>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="volume" className="form-label">Hacim</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    id="volume"
                    name="volume"
                    className="form-input"
                    value={formData.volume}
                    onChange={handleInputChange}
                    step="0.001"
                    min="0"
                    autoComplete="off"
                  />
                  <span className="input-unit">m³</span>
                </div>
                <div className="form-helper-text">Opsiyonel - Kargo hacmi</div>
              </div>

              <div className="form-group">
                <label htmlFor="dimensions" className="form-label">Boyutlar</label>
                <div className="input-with-status">
                  <input
                    type="text"
                    id="dimensions"
                    name="dimensions"
                    className="form-input"
                    value={formData.dimensions}
                    onChange={handleInputChange}
                    autoComplete="off"
                  />
                </div>
                <div className="form-helper-text">Format: 100x50x50 (cm) - Opsiyonel</div>
              </div>
            </div>
          </div>

          {/* Özel İşlem Gereksinimleri - Professional Section */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">ÖZEL İŞLEM GEREKSİNİMLERİ</h2>
            </div>
            
            <div className="form-group full-width">
              <label htmlFor="specialHandling" className="form-label">Özel İşlem Gereksinimleri</label>
              <textarea
                id="specialHandling"
                name="specialHandling"
                className="form-textarea"
                value={formData.specialHandling}
                onChange={handleInputChange}
                rows="3"
                maxLength="1000"
                autoComplete="off"
              />
              <div className="form-helper-text">Opsiyonel - Özel kargo işlem gereksinimleri (max 1000 karakter)</div>
            </div>
          </div>

          {/* Gönderici & Alıcı Bilgileri - Professional Section */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">GÖNDERİCİ & ALICI BİLGİLERİ</h2>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="shipperName" className="form-label">Gönderici Adı</label>
                <div className="input-with-status">
                  <input
                    type="text"
                    id="shipperName"
                    name="shipperName"
                    className="form-input"
                    value={formData.shipperName}
                    onChange={handleInputChange}
                    autoComplete="off"
                  />
                </div>
                <div className="form-helper-text">Opsiyonel alan</div>
              </div>

              <div className="form-group">
                <label htmlFor="receiverName" className="form-label">Alıcı Adı</label>
                <div className="input-with-status">
                  <input
                    type="text"
                    id="receiverName"
                    name="receiverName"
                    className="form-input"
                    value={formData.receiverName}
                    onChange={handleInputChange}
                    autoComplete="off"
                  />
                </div>
                <div className="form-helper-text">Opsiyonel alan</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="shipperAddress" className="form-label">Gönderici Adresi</label>
                <textarea
                  id="shipperAddress"
                  name="shipperAddress"
                  className="form-textarea"
                  value={formData.shipperAddress}
                  onChange={handleInputChange}
                  rows="2"
                  autoComplete="off"
                />
                <div className="form-helper-text">Opsiyonel alan</div>
              </div>

              <div className="form-group">
                <label htmlFor="receiverAddress" className="form-label">Alıcı Adresi</label>
                <textarea
                  id="receiverAddress"
                  name="receiverAddress"
                  className="form-textarea"
                  value={formData.receiverAddress}
                  onChange={handleInputChange}
                  rows="2"
                  autoComplete="off"
                />
                <div className="form-helper-text">Opsiyonel alan</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="carrierCompany" className="form-label">Taşıyıcı Firma</label>
                <div className="input-with-status">
                  <input
                    type="text"
                    id="carrierCompany"
                    name="carrierCompany"
                    className="form-input"
                    value={formData.carrierCompany}
                    onChange={handleInputChange}
                    autoComplete="off"
                  />
                </div>
                <div className="form-helper-text">Opsiyonel alan</div>
              </div>

              <div className="form-group">
                <label htmlFor="commodity" className="form-label">Eşya Türü</label>
                <div className="input-with-status">
                  <input
                    type="text"
                    id="commodity"
                    name="commodity"
                    className="form-input"
                    value={formData.commodity}
                    onChange={handleInputChange}
                    autoComplete="off"
                  />
                </div>
                <div className="form-helper-text">Opsiyonel alan</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="declaredValue" className="form-label">Beyan Edilen Değer</label>
                <div className="input-with-unit">
                  <input
                    type="number"
                    id="declaredValue"
                    name="declaredValue"
                    className="form-input"
                    value={formData.declaredValue}
                    onChange={handleInputChange}
                    min="0"
                    autoComplete="off"
                  />
                  <span className="input-unit">USD</span>
                </div>
                <div className="form-helper-text">Opsiyonel - Kargo değeri</div>
              </div>
            </div>
          </div>



          {/* Form Actions - Professional Styling */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={loading}
            >
              Formu Temizle
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Kaydediliyor...' : 'AWB Kaydet'}
            </button>
          </div>
        </div>
      </form>

      {/* Success Modal */}
      {showSuccessModal && successData && (
        <div className="modal-overlay">
          <div className="success-modal">
            <h3>AWB Başarıyla Oluşturuldu!</h3>
            <div className="success-details">
              <p><strong>AWB No:</strong> {successData.awbNumber}</p>
              <p><strong>Kalkış:</strong> {formData.origin} → <strong>Varış:</strong> {formData.destination}</p>
              <p><strong>Uçuş:</strong> {formData.flightNumber} - {formData.flightDate}</p>
            </div>
            <div className="modal-actions">
              {formData.cargoType === 'DG' && (
                <button className="btn-dg">DG Formu Oluştur</button>
              )}
              <button className="btn-print">AWB Yazdır</button>
              <button 
                className="btn-new"
                onClick={() => setShowSuccessModal(false)}
              >
                Yeni AWB
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};

export default AWBForm;
