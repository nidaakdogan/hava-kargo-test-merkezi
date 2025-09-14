import React, { useState, useEffect } from 'react'
import { useOffline } from '../../contexts/OfflineContext'
import './MobileAwb.css'

const MobileAwb = () => {
  const { isOffline } = useOffline()
  const [formData, setFormData] = useState({
    awbNumber: '',
    origin: '',
    destination: '',
    weight: '',
    pieces: '',
    flightNumber: '',
    awbDate: '',
    flightDate: '',
    dimensions: '',
    cargoType: '',
    consolidationType: ''
  })
  const [errors, setErrors] = useState({})
  const [toast, setToast] = useState(null)
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [originSearch, setOriginSearch] = useState('')
  const [destinationSearch, setDestinationSearch] = useState('')
  const [showOriginDropdown, setShowOriginDropdown] = useState(false)
  const [showDestinationDropdown, setShowDestinationDropdown] = useState(false)

  // Bugünün tarihini varsayılan olarak ayarla
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    setFormData(prev => ({
      ...prev,
      awbDate: today
    }))
  }, [])

  // IATA Airport Codes - Web'deki ile aynı
  const iataCodes = [
    { code: 'IST', city: 'İstanbul', country: 'Türkiye' },
    { code: 'FRA', city: 'Frankfurt', country: 'Almanya' },
    { code: 'LHR', city: 'Londra', country: 'İngiltere' },
    { code: 'CDG', city: 'Paris', country: 'Fransa' },
    { code: 'AMS', city: 'Amsterdam', country: 'Hollanda' },
    { code: 'MAD', city: 'Madrid', country: 'İspanya' },
    { code: 'FCO', city: 'Roma', country: 'İtalya' },
    { code: 'ZUR', city: 'Zürih', country: 'İsviçre' },
    { code: 'VIE', city: 'Viyana', country: 'Avusturya' },
    { code: 'MUC', city: 'Münih', country: 'Almanya' },
    { code: 'DUS', city: 'Düsseldorf', country: 'Almanya' },
    { code: 'HAM', city: 'Hamburg', country: 'Almanya' },
    { code: 'BCN', city: 'Barselona', country: 'İspanya' },
    { code: 'MXP', city: 'Milano', country: 'İtalya' },
    { code: 'CPH', city: 'Kopenhag', country: 'Danimarka' },
    { code: 'ARN', city: 'Stockholm', country: 'İsveç' },
    { code: 'OSL', city: 'Oslo', country: 'Norveç' },
    { code: 'HEL', city: 'Helsinki', country: 'Finlandiya' },
    { code: 'WAW', city: 'Varşova', country: 'Polonya' },
    { code: 'PRG', city: 'Prag', country: 'Çek Cumhuriyeti' },
    { code: 'BUD', city: 'Budapeşte', country: 'Macaristan' },
    { code: 'ATH', city: 'Atina', country: 'Yunanistan' },
    { code: 'LIS', city: 'Lizbon', country: 'Portekiz' },
    { code: 'DUB', city: 'Dublin', country: 'İrlanda' },
    { code: 'BRU', city: 'Brüksel', country: 'Belçika' },
    { code: 'LUX', city: 'Lüksemburg', country: 'Lüksemburg' },
    { code: 'GVA', city: 'Cenevre', country: 'İsviçre' },
    { code: 'ZAG', city: 'Zagreb', country: 'Hırvatistan' },
    { code: 'BEG', city: 'Belgrad', country: 'Sırbistan' },
    { code: 'SOF', city: 'Sofya', country: 'Bulgaristan' },
    { code: 'BUH', city: 'Bükreş', country: 'Romanya' },
    { code: 'OTP', city: 'Bükreş', country: 'Romanya' },
    { code: 'SKG', city: 'Selanik', country: 'Yunanistan' },
    { code: 'HER', city: 'Kandiye', country: 'Yunanistan' },
    { code: 'RHO', city: 'Rodos', country: 'Yunanistan' },
    { code: 'CFU', city: 'Korfu', country: 'Yunanistan' },
    { code: 'ZTH', city: 'Zakintos', country: 'Yunanistan' },
    { code: 'KGS', city: 'Kos', country: 'Yunanistan' },
    { code: 'MYK', city: 'Mikonos', country: 'Yunanistan' },
    { code: 'JTR', city: 'Santorini', country: 'Yunanistan' },
    { code: 'JMK', city: 'Mikonos', country: 'Yunanistan' },
    { code: 'SMI', city: 'Samos', country: 'Yunanistan' },
    { code: 'LRS', city: 'Leros', country: 'Yunanistan' },
    { code: 'KSO', city: 'Kastellorizo', country: 'Yunanistan' },
    { code: 'AXD', city: 'Alexandroupolis', country: 'Yunanistan' },
    { code: 'KVA', city: 'Kavala', country: 'Yunanistan' },
    { code: 'KZI', city: 'Kozani', country: 'Yunanistan' },
    { code: 'KIT', city: 'Kithira', country: 'Yunanistan' },
    { code: 'KLX', city: 'Kalamata', country: 'Yunanistan' },
    { code: 'KZS', city: 'Kastellorizo', country: 'Yunanistan' },
    { code: 'KGS', city: 'Kos', country: 'Yunanistan' },
    { code: 'MJK', city: 'Mikonos', country: 'Yunanistan' },
    { code: 'JTR', city: 'Santorini', country: 'Yunanistan' },
    { code: 'JMK', city: 'Mikonos', country: 'Yunanistan' },
    { code: 'SMI', city: 'Samos', country: 'Yunanistan' },
    { code: 'LRS', city: 'Leros', country: 'Yunanistan' },
    { code: 'KSO', city: 'Kastellorizo', country: 'Yunanistan' },
    { code: 'AXD', city: 'Alexandroupolis', country: 'Yunanistan' },
    { code: 'KVA', city: 'Kavala', country: 'Yunanistan' },
    { code: 'KZI', city: 'Kozani', country: 'Yunanistan' },
    { code: 'KIT', city: 'Kithira', country: 'Yunanistan' },
    { code: 'KLX', city: 'Kalamata', country: 'Yunanistan' },
    { code: 'KZS', city: 'Kastellorizo', country: 'Yunanistan' }
  ]

  // Dropdown dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.mobile-dropdown-container')) {
        setShowOriginDropdown(false)
        setShowDestinationDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // AWB numarası maskesi - 3+8 format (999-99999999)
  const handleAwbNumberChange = (value) => {
    // Sadece rakam kabul et
    const cleaned = value.replace(/\D/g, '')
    
    // 3+8 formatına göre maskele
    if (cleaned.length <= 3) {
      setFormData(prev => ({ ...prev, awbNumber: cleaned }))
    } else if (cleaned.length <= 11) {
      const prefix = cleaned.substring(0, 3)
      const suffix = cleaned.substring(3, 11)
      setFormData(prev => ({ ...prev, awbNumber: `${prefix}-${suffix}` }))
    }
  }

  // Uçuş numarası maskesi - Web'deki ile aynı
  const handleFlightNumberChange = (value) => {
    // Sadece harf ve rakam kabul et
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    
    // AA9999 formatına göre maskele
    if (cleaned.length <= 2) {
      setFormData(prev => ({ ...prev, flightNumber: cleaned }))
    } else if (cleaned.length <= 6) {
      const letters = cleaned.substring(0, 2)
      const numbers = cleaned.substring(2, 6)
      setFormData(prev => ({ ...prev, flightNumber: letters + numbers }))
    }
  }

  // Ağırlık maskesi - Web'deki ile aynı
  const handleWeightChange = (value) => {
    // Sadece rakam, nokta ve virgül kabul et
    const cleaned = value.replace(/[^\d.,]/g, '')
    
    // Virgülü noktaya çevir
    const normalized = cleaned.replace(',', '.')
    
    // Maksimum 2 ondalık kontrolü
    const parts = normalized.split('.')
    if (parts.length === 1) {
      setFormData(prev => ({ ...prev, weight: normalized }))
    } else if (parts.length === 2 && parts[1].length <= 2) {
      setFormData(prev => ({ ...prev, weight: normalized }))
    }
  }

  // Parça sayısı maskesi - Web'deki ile aynı
  const handlePiecesChange = (value) => {
    // Sadece pozitif tam sayı kabul et
    const cleaned = value.replace(/[^\d]/g, '')
    setFormData(prev => ({ ...prev, pieces: cleaned }))
  }

  // Validasyon fonksiyonları - Web'deki ile aynı
  const validateAwbNumber = (awb) => {
    if (!awb) return false
    const regex = /^\d{3}-\d{8}$/
    return regex.test(awb.trim())
  }

  const validateFlightNumber = (flight) => {
    if (!flight) return false
    const regex = /^[A-Z]{2}\d{4}$/
    return regex.test(flight.trim())
  }

  const validateWeight = (weight) => {
    if (!weight) return false
    const num = parseFloat(weight)
    return !isNaN(num) && num > 0 && /^\d+(\.\d{1,2})?$/.test(weight)
  }

  const validatePieces = (pieces) => {
    if (!pieces) return false
    const num = parseInt(pieces)
    return !isNaN(num) && num >= 1 && Number.isInteger(parseFloat(pieces))
  }

  const validateDate = (date) => {
    if (!date) return false
    const dateObj = new Date(date)
    return dateObj instanceof Date && !isNaN(dateObj)
  }

  const validateForm = () => {
    const newErrors = {}
    
    // Zorunlu alanlar - Web'deki ile aynı
    if (!formData.awbNumber) {
      newErrors.awbNumber = 'AWB numarası zorunludur'
    } else if (!validateAwbNumber(formData.awbNumber)) {
      newErrors.awbNumber = 'Geçersiz AWB formatı (3+8).'
    }
    
    if (!formData.origin) {
      newErrors.origin = 'IATA istasyon seçin.'
    }
    
    if (!formData.destination) {
      newErrors.destination = 'IATA istasyon seçin.'
    }
    
    if (!formData.weight) {
      newErrors.weight = 'Ağırlık zorunludur'
    } else if (!validateWeight(formData.weight)) {
      newErrors.weight = 'En fazla 2 ondalık girilebilir.'
    }
    
    if (!formData.pieces) {
      newErrors.pieces = 'Parça sayısı zorunludur'
    } else if (!validatePieces(formData.pieces)) {
      newErrors.pieces = 'Pozitif tam sayı giriniz'
    }
    
    if (!formData.flightNumber) {
      newErrors.flightNumber = 'Uçuş numarası zorunludur'
    } else if (!validateFlightNumber(formData.flightNumber)) {
      newErrors.flightNumber = 'Geçersiz format (AA9999)'
    }
    
    if (!formData.awbDate) {
      newErrors.awbDate = 'AWB tarihi zorunludur'
    } else if (!validateDate(formData.awbDate)) {
      newErrors.awbDate = 'Geçersiz tarih formatı'
    }
    
    if (!formData.flightDate) {
      newErrors.flightDate = 'Uçuş tarihi zorunludur'
    } else if (!validateDate(formData.flightDate)) {
      newErrors.flightDate = 'Geçersiz tarih formatı'
    } else if (formData.awbDate && formData.flightDate) {
      const awbDate = new Date(formData.awbDate)
      const flightDate = new Date(formData.flightDate)
      if (flightDate < awbDate) {
        newErrors.flightDate = 'Uçuş ≥ AWB tarihi olmalı'
      }
    }
    
    // Kalkış = Varış kontrolü - Web'deki ile aynı
    if (formData.origin && formData.destination && formData.origin === formData.destination) {
      newErrors.destination = 'Kalkış ve varış yeri aynı olamaz'
    }
    
    // Zorunlu alanlar - Web'deki ile aynı
    if (!formData.cargoType) {
      newErrors.cargoType = 'Kargo türü zorunludur'
    }
    
    if (!formData.consolidationType) {
      newErrors.consolidationType = 'Konsolidasyon türü zorunludur'
    }
    
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
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  // IATA kod arama fonksiyonları - Web'deki ile aynı
  const filteredOriginCodes = iataCodes.filter(airport =>
    airport.code.toLowerCase().includes(originSearch.toLowerCase()) ||
    airport.city.toLowerCase().includes(originSearch.toLowerCase()) ||
    airport.country.toLowerCase().includes(originSearch.toLowerCase())
  )

  const filteredDestinationCodes = iataCodes.filter(airport =>
    airport.code.toLowerCase().includes(destinationSearch.toLowerCase()) ||
    airport.city.toLowerCase().includes(destinationSearch.toLowerCase()) ||
    airport.country.toLowerCase().includes(destinationSearch.toLowerCase())
  )

  const handleOriginSelect = (airport) => {
    setFormData(prev => ({ ...prev, origin: airport.code }))
    setOriginSearch(airport.code)
    setShowOriginDropdown(false)
  }

  const handleDestinationSelect = (airport) => {
    setFormData(prev => ({ ...prev, destination: airport.code }))
    setDestinationSearch(airport.code)
    setShowDestinationDropdown(false)
  }

  const getSelectedAirportDisplay = (code) => {
    if (!code) return 'Seçiniz'
    const airport = iataCodes.find(airport => airport.code === code)
    return airport ? `${airport.code} - ${airport.city}, ${airport.country}` : code
  }

  const handleSave = () => {
    if (!validateForm()) {
      return
    }

    showToast('success', 'İşlem başarılı')
  }

  const handleSaveAndNew = () => {
    if (!validateForm()) {
      return
    }

    showToast('success', 'İşlem başarılı')
    
    // Clear form
    setFormData({
      awbNumber: '',
      origin: '',
      destination: '',
      weight: '',
      pieces: '',
      flightNumber: '',
      dimensions: ''
    })
    setErrors({})
  }

  return (
    <div className="mobile-awb">
      <div className="mobile-container">
        {/* Header Card - Web ile aynı */}
        <div className="mobile-card mobile-header-card">
          <h2 className="mobile-card-title">AWB Yönetimi</h2>
          <p className="mobile-card-subtitle">AWB (Air Waybill) bilgilerini girerek kargo oluşturun</p>
        </div>

        {/* Form Card - ULD ile aynı düzen */}
        <div className="mobile-card">
          <form className="mobile-awb-form">
            {/* UÇUŞ & AWB BİLGİLERİ - ULD ile aynı düzen */}
            <div className="mobile-form-section">
              <h3 className="mobile-form-section-title">UÇUŞ & AWB BİLGİLERİ</h3>
              
              {/* AWB Numarası */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  AWB Numarası <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="awbNumber"
                  value={formData.awbNumber}
                  onChange={(e) => handleAwbNumberChange(e.target.value)}
                  className={`mobile-input ${errors.awbNumber ? 'error' : ''}`}
                  autoComplete="off"
                  maxLength="12"
                />
                {errors.awbNumber && (
                  <div className="mobile-form-error">{errors.awbNumber}</div>
                )}
                <div className="mobile-form-help">
                  Format: 123-45678901 (3 haneli prefix + 8 haneli seri)
                </div>
              </div>

              {/* Kalkış Yeri */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Kalkış Yeri <span className="required">*</span>
                </label>
                <div className="mobile-dropdown-container">
                  <input
                    type="text"
                    value={originSearch}
                    onChange={(e) => {
                      setOriginSearch(e.target.value)
                      setShowOriginDropdown(true)
                    }}
                    onFocus={() => setShowOriginDropdown(true)}
                    placeholder="Kalkış yeri seçin"
                    className={`mobile-input ${errors.origin ? 'error' : ''}`}
                    autoComplete="off"
                  />
                  {showOriginDropdown && (
                    <div className="mobile-dropdown-list">
                      {filteredOriginCodes.slice(0, 10).map((airport) => (
                        <div
                          key={airport.code}
                          className="mobile-dropdown-item"
                          onClick={() => handleOriginSelect(airport)}
                        >
                          <div className="mobile-dropdown-code">{airport.code}</div>
                          <div className="mobile-dropdown-details">
                            <div className="mobile-dropdown-city">{airport.city}</div>
                            <div className="mobile-dropdown-country">{airport.country}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {errors.origin && (
                  <div className="mobile-form-error">{errors.origin}</div>
                )}
                <div className="mobile-form-help">
                  Kalkış yeri seçin
                </div>

              {/* Varış Yeri */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Varış Yeri <span className="required">*</span>
                </label>
                <div className="mobile-dropdown-container">
                  <input
                    type="text"
                    value={destinationSearch}
                    onChange={(e) => {
                      setDestinationSearch(e.target.value)
                      setShowDestinationDropdown(true)
                    }}
                    onFocus={() => setShowDestinationDropdown(true)}
                    placeholder="Varış yeri seçin"
                    className={`mobile-input ${errors.destination ? 'error' : ''}`}
                    autoComplete="off"
                  />
                  {showDestinationDropdown && (
                    <div className="mobile-dropdown-list">
                      {filteredDestinationCodes.slice(0, 10).map((airport) => (
                        <div
                          key={airport.code}
                          className="mobile-dropdown-item"
                          onClick={() => handleDestinationSelect(airport)}
                        >
                          <div className="mobile-dropdown-code">{airport.code}</div>
                          <div className="mobile-dropdown-details">
                            <div className="mobile-dropdown-city">{airport.city}</div>
                            <div className="mobile-dropdown-country">{airport.country}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {errors.destination && (
                  <div className="mobile-form-error">{errors.destination}</div>
                )}
                <div className="mobile-form-help">
                  Varış yeri seçin
                </div>
              </div>
              
              {/* Uçuş Numarası */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Uçuş Numarası <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="flightNumber"
                  value={formData.flightNumber}
                  onChange={(e) => handleFlightNumberChange(e.target.value)}
                  placeholder="TK1234"
                  className={`mobile-input ${errors.flightNumber ? 'error' : ''}`}
                  autoComplete="off"
                  maxLength="6"
                />
                {errors.flightNumber && (
                  <div className="mobile-form-error">{errors.flightNumber}</div>
                )}
                <div className="mobile-form-help">
                  Format: TK1234 (2 harf + 4 rakam)
                </div>
              </div>

              {/* Ağırlık */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Ağırlık (kg) <span className="required">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="weight"
                  value={formData.weight}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  className={`mobile-input ${errors.weight ? 'error' : ''}`}
                  autoComplete="off"
                />
                {errors.weight && (
                  <div className="mobile-form-error">{errors.weight}</div>
                )}
                <div className="mobile-form-help">
                  Maksimum 2 ondalık
                </div>
              </div>
              
              {/* Parça Sayısı */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Parça Sayısı <span className="required">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="pieces"
                  value={formData.pieces}
                  onChange={(e) => handlePiecesChange(e.target.value)}
                  className={`mobile-input ${errors.pieces ? 'error' : ''}`}
                  autoComplete="off"
                />
                {errors.pieces && (
                  <div className="mobile-form-error">{errors.pieces}</div>
                )}
                <div className="mobile-form-help">
                  Sadece tam sayı
                </div>
              </div>

              {/* AWB Tarihi */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  AWB Tarihi <span className="required">*</span>
                </label>
                <input
                  type="date"
                  name="awbDate"
                  value={formData.awbDate}
                  onChange={(e) => handleInputChange('awbDate', e.target.value)}
                  className={`mobile-input ${errors.awbDate ? 'error' : ''}`}
                />
                {errors.awbDate && (
                  <div className="mobile-form-error">{errors.awbDate}</div>
                )}
                <div className="mobile-form-help">
                  AWB tarihini seçin
                </div>
              </div>

              {/* Uçuş Tarihi */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Uçuş Tarihi <span className="required">*</span>
                </label>
              <input
                  type="date"
                  name="flightDate"
                  value={formData.flightDate}
                  onChange={(e) => handleInputChange('flightDate', e.target.value)}
                  min={formData.awbDate || ''}
                  className={`mobile-input ${errors.flightDate ? 'error' : ''}`}
                />
                {errors.flightDate && (
                  <div className="mobile-form-error">{errors.flightDate}</div>
                )}
                <div className="mobile-form-help">
                  Uçuş tarihini seçin (AWB tarihinden sonra)
                </div>
              </div>

              {/* Kargo Türü */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Kargo Türü <span className="required">*</span>
                </label>
                <select
                  name="cargoType"
                  value={formData.cargoType}
                  onChange={(e) => handleInputChange('cargoType', e.target.value)}
                  className={`mobile-input ${errors.cargoType ? 'error' : ''}`}
                >
                  <option value="">Seçiniz</option>
                  <option value="Genel">Genel</option>
                  <option value="DG">DG (Tehlikeli Madde)</option>
                  <option value="Bozulabilir">Bozulabilir</option>
                  <option value="Canlı Hayvan">Canlı Hayvan</option>
                  <option value="Değerli">Değerli</option>
                  <option value="Hassas">Hassas</option>
                </select>
                {errors.cargoType && (
                  <div className="mobile-form-error">{errors.cargoType}</div>
                )}
                <div className="mobile-form-help">
                  Örn: Genel, DG, Bozulabilir, Canlı Hayvan
                </div>
              </div>

              {/* Konsolidasyon Türü */}
              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Konsolidasyon Türü <span className="required">*</span>
                </label>
                <select
                  name="consolidationType"
                  value={formData.consolidationType}
                  onChange={(e) => handleInputChange('consolidationType', e.target.value)}
                  className={`mobile-input ${errors.consolidationType ? 'error' : ''}`}
                >
                  <option value="" disabled>Seçiniz</option>
                  <option value="Direct">Direct (MAWB only)</option>
                  <option value="Back-to-Back">Back-to-Back (1 HAWB ↔ 1 MAWB)</option>
                  <option value="Consolidation">Consolidation (N HAWB → 1 MAWB)</option>
                  <option value="Co-Load">Co-Load</option>
                </select>
                {errors.consolidationType && (
                  <div className="mobile-form-error">{errors.consolidationType}</div>
                )}
                <div className="mobile-form-help">
                  MAWB/HAWB birleştirme: Direct, Back-to-Back, Consolidation, Co-Load.
                </div>
              </div>
            </div>

            {/* Opsiyonel Bilgiler */}
            <div className="mobile-form-section">
              <button
                type="button"
                className="mobile-form-toggle"
                onClick={() => setShowAdvancedFields(!showAdvancedFields)}
              >
                <span>OPSİYONEL BİLGİLER</span>
                <span className="mobile-form-toggle-icon">
                  {showAdvancedFields ? '▲' : '▼'}
                </span>
              </button>

              {showAdvancedFields && (
                <div className="mobile-advanced-fields">
                  {/* Boyutlar */}
                  <div className="mobile-form-group">
                    <label className="mobile-form-label">Boyutlar</label>
                    <input
                      type="text"
                      name="dimensions"
                      value={formData.dimensions}
                      onChange={(e) => handleInputChange('dimensions', e.target.value)}
                      placeholder="120x80x160 cm"
                      className="mobile-input"
                      autoComplete="off"
                    />
                    <div className="mobile-form-help">
                      Boyutları girin (örn: 120x80x160 cm)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          </form>

          {/* Action Buttons - ULD ile aynı düzen */}
          <div className="mobile-form-actions">
            <button 
              type="button"
              className="mobile-btn mobile-btn-primary mobile-btn-full"
              onClick={handleSave}
              data-testid="awb-save-button"
            >
              {isOffline ? 'AWB Kaydet (Offline)' : 'AWB Kaydet'}
            </button>

            <button 
              type="button"
              className="mobile-btn mobile-btn-secondary mobile-btn-full"
              onClick={handleSaveAndNew}
              data-testid="awb-save-new-button"
            >
              Formu Temizle
            </button>
          </div>
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

export default MobileAwb
