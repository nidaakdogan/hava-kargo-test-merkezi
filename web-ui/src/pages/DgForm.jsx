import React, { useState, useEffect } from 'react'
import axios from 'axios'
import '../styles/forms.css'

const DgForm = () => {
  const [formData, setFormData] = useState({
    // 1. Gönderi Bilgileri
    awbNumber: '',           // AWB Numarası (zorunlu)
    shipperName: '',         // Gönderen Adı/Ünvanı (zorunlu)
    shipperAddress: '',      // Gönderen Adresi (zorunlu)
    consigneeName: '',       // Alıcı Adı/Ünvanı (zorunlu)
    consigneeAddress: '',    // Alıcı Adresi (zorunlu)
    declarationDate: '',     // Beyan Tarihi (otomatik)
    declarationPlace: '',    // Beyan Yeri (otomatik)
    
    // 2. Tehlikeli Madde Tanımlama
    unNumber: '',            // UN Numarası (zorunlu)
    properShippingName: '',  // Tehlikeli Madde Adı (zorunlu)
    dgClass: '',             // DG Sınıfı (zorunlu)
    packingGroup: '',        // Paketleme Grubu (zorunlu)
    secondaryRisk: '',       // İkincil Risk (opsiyonel)
    
    // 3. Paketleme ve Miktar
    netQuantity: '',         // Net Miktar (zorunlu)
    grossWeight: '',         // Brüt Ağırlık (zorunlu)
    netWeight: '',           // Net Ağırlık (opsiyonel)
    packageCount: '',        // Paket Sayısı (zorunlu)
    packingType: '',         // Ambalaj Türü (zorunlu)
    packingInstructions: '', // Ambalaj Talimatları (opsiyonel)
    
    // 4. Taşıma ve Operasyon
    transportMethod: '',     // Taşıma Yöntemi (zorunlu)
    handlingInfo: '',        // Kargo Bildirimleri (opsiyonel)
    cargoAircraftOnly: false, // Sadece Kargo Uçağı (opsiyonel)
    
    // 5. Onay ve İmza
    preparerName: '',        // Hazırlayan Adı (zorunlu)
    preparerSignature: '',   // Hazırlayan İmzası (zorunlu)
    approverName: '',        // Onaylayan Adı (zorunlu)
    approvalDate: ''         // Onay Tarihi (otomatik)
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  const API_BASE_URL = window.location.hostname === '10.0.2.2' 
    ? 'http://10.0.2.2:3001' 
    : 'http://localhost:3001'

  // DG sınıfları - IATA DGR standartları
  const dgClasses = {
    '1': { value: '1', label: '1 – Patlayıcılar (Explosives)', description: 'Patlayıcı maddeler ve nesneler' },
    '2': { value: '2', label: '2 – Gazlar (Gases)', description: 'Yanıcı, yanıcı olmayan, zehirli gazlar' },
    '3': { value: '3', label: '3 – Yanıcı Sıvılar (Flammable Liquids)', description: 'Yanıcı sıvı maddeler' },
    '4.1': { value: '4.1', label: '4.1 – Yanıcı Katılar (Flammable Solids)', description: 'Yanıcı katı maddeler' },
    '4.2': { value: '4.2', label: '4.2 – Kendiliğinden Yanan (Spontaneously Combustible)', description: 'Kendiliğinden yanan maddeler' },
    '4.3': { value: '4.3', label: '4.3 – Su ile Temas Ettiğinde Tehlikeli (Dangerous When Wet)', description: 'Su ile reaksiyona giren maddeler' },
    '5.1': { value: '5.1', label: '5.1 – Oksitleyici (Oxidizers)', description: 'Oksitleyici maddeler' },
    '5.2': { value: '5.2', label: '5.2 – Organik Peroksitler (Organic Peroxides)', description: 'Organik peroksitler' },
    '6.1': { value: '6.1', label: '6.1 – Zehirli (Toxic)', description: 'Zehirli maddeler' },
    '6.2': { value: '6.2', label: '6.2 – Enfeksiyon Yapıcı (Infectious Substances)', description: 'Enfeksiyon yapıcı maddeler' },
    '7': { value: '7', label: '7 – Radyoaktif (Radioactive)', description: 'Radyoaktif maddeler' },
    '8': { value: '8', label: '8 – Aşındırıcı (Corrosives)', description: 'Aşındırıcı maddeler' },
    '9': { value: '9', label: '9 – Çeşitli Tehlikeli Maddeler ve Nesneler (Miscellaneous Dangerous Goods)', description: 'Diğer tehlikeli maddeler ve nesneler' }
  }

  // Paketleme grupları
  const packingGroups = {
    'I': { value: 'I', label: 'Grup I – Çok Tehlikeli', description: 'En yüksek risk seviyesi' },
    'II': { value: 'II', label: 'Grup II – Orta Tehlikeli', description: 'Orta risk seviyesi' },
    'III': { value: 'III', label: 'Grup III – Düşük Tehlikeli', description: 'Düşük risk seviyesi' }
  }

  // İkincil risk sınıfları
  const secondaryRisks = [
    { value: '', label: 'İkincil risk yok' },
    { value: '3', label: '3 – Yanıcı Sıvı (Flammable Liquid)' },
    { value: '4.1', label: '4.1 – Yanıcı Katı (Flammable Solid)' },
    { value: '4.2', label: '4.2 – Kendiliğinden Yanan (Spontaneously Combustible)' },
    { value: '4.3', label: '4.3 – Su ile Temas Ettiğinde Tehlikeli (Dangerous When Wet / Reacts with Water)' },
    { value: '5.1', label: '5.1 – Oksitleyici (Oxidizer)' },
    { value: '5.2', label: '5.2 – Organik Peroksit (Organic Peroxide)' },
    { value: '6.1', label: '6.1 – Zehirli (Toxic)' },
    { value: '8', label: '8 – Aşındırıcı (Corrosive)' }
  ]

  // Ambalaj türleri
  const packingTypes = [
    { value: 'box', label: 'Kutu' },
    { value: 'drum', label: 'Varil' },
    { value: 'jerrican', label: 'Jerrican' },
    { value: 'bag', label: 'Çanta/Torba' },
    { value: 'composite', label: 'Kompozit Ambalaj' },
    { value: 'pressure', label: 'Basınçlı Ambalaj' },
    { value: 'other', label: 'Diğer' }
  ]

  // Taşıma yöntemleri
  const transportMethods = [
    { value: 'air', label: 'Havayolu' },
    { value: 'road', label: 'Karayolu' },
    { value: 'sea', label: 'Denizyolu' },
    { value: 'rail', label: 'Demiryolu' }
  ]

  // Kargo bildirimleri
  const handlingInfoOptions = [
    { value: '', label: 'Özel bildirim yok' },
    { value: 'cargo_only', label: 'Sadece Kargo Uçağı' },
    { value: 'keep_cool', label: 'Serin Tutun' },
    { value: 'keep_dry', label: 'Kuru Tutun' },
    { value: 'fragile', label: 'Kırılgan' },
    { value: 'this_way_up', label: 'Bu Taraf Yukarı' },
    { value: 'do_not_stack', label: 'Üst Üste Koymayın' }
  ]

  // Basit input değişim handler'ı
  const handleInputChange = (e) => {
    const { name, value } = e.target
        setFormData(prev => ({
          ...prev,
      [name]: value
    }))
    
    // Hata varsa temizle
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
        }))
      }
    }
    
  // UN Numarası için özel input handler - Geliştirilmiş format
  const handleUNNumberChange = (e) => {
    let value = e.target.value.trim().toUpperCase()
    
    // Sadece rakam girilirse UN prefix ekle
    if (/^[0-9]+$/.test(value)) {
      value = 'UN' + value
    }
    
    // UN ile başlamıyorsa UN ekle
    if (!value.startsWith('UN')) {
      value = 'UN' + value.replace(/UN/g, '')
    }
    
    // Sadece UN ve rakamları kabul et, boşlukları kaldır
    value = value.replace(/[^UN0-9]/g, '')
    
    // Maksimum 6 karakter (UN + 4 rakam)
    if (value.length > 6) {
      value = value.substring(0, 6)
    }
    
    setFormData(prev => ({
      ...prev,
      unNumber: value
    }))
    
    // Hata varsa temizle
    if (errors.unNumber) {
      setErrors(prev => ({
        ...prev,
        unNumber: ''
      }))
    }
  }

  // IATA DGR standartlarına göre form validasyonu
  const validateForm = () => {
    const newErrors = {}
    
    // 1. Gönderi Bilgileri
    if (!formData.awbNumber) newErrors.awbNumber = 'AWB numarası zorunludur'
    if (!formData.shipperName) newErrors.shipperName = 'Gönderen adı zorunludur'
    if (!formData.shipperAddress) newErrors.shipperAddress = 'Gönderen adresi zorunludur'
    if (!formData.consigneeName) newErrors.consigneeName = 'Alıcı adı zorunludur'
    if (!formData.consigneeAddress) newErrors.consigneeAddress = 'Alıcı adresi zorunludur'
    
    // 2. Tehlikeli Madde Tanımlama
    if (!formData.unNumber) {
      newErrors.unNumber = 'UN numarası zorunludur'
    } else if (!/^UN[0-9]{4}$/.test(formData.unNumber)) {
      newErrors.unNumber = 'Geçersiz format. UN + 4 rakam olmalı (örn. UN1203).'
    }
    if (!formData.properShippingName) newErrors.properShippingName = 'Tehlikeli madde adı zorunludur'
    if (!formData.dgClass) newErrors.dgClass = 'DG sınıfı zorunludur'
    if (!formData.packingGroup) newErrors.packingGroup = 'Paketleme grubu zorunludur'
    
    // 3. Paketleme ve Miktar
    if (!formData.netQuantity) newErrors.netQuantity = 'Net miktar zorunludur'
    if (!formData.grossWeight) newErrors.grossWeight = 'Brüt ağırlık zorunludur'
    if (!formData.packageCount) newErrors.packageCount = 'Paket sayısı zorunludur'
    if (!formData.packingType) newErrors.packingType = 'Ambalaj türü zorunludur'
    
    // 4. Taşıma ve Operasyon
    if (!formData.transportMethod) newErrors.transportMethod = 'Taşıma yöntemi zorunludur'
    
    // 5. Onay ve İmza
    if (!formData.preparerName) newErrors.preparerName = 'Hazırlayan adı zorunludur'
    if (!formData.preparerSignature) newErrors.preparerSignature = 'Hazırlayan imzası zorunludur'
    if (!formData.approverName) newErrors.approverName = 'Onaylayan adı zorunludur'
    
    // Sayısal değer kontrolleri
    if (formData.grossWeight && parseFloat(formData.grossWeight) <= 0) {
      newErrors.grossWeight = 'Brüt ağırlık 0\'dan büyük olmalıdır'
    }
    if (formData.netWeight && parseFloat(formData.netWeight) <= 0) {
      newErrors.netWeight = 'Net ağırlık 0\'dan büyük olmalıdır'
    }
    if (formData.packageCount && parseInt(formData.packageCount) <= 0) {
      newErrors.packageCount = 'Paket sayısı 0\'dan büyük olmalıdır'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Form submit - IATA DGR standartlarına göre
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      setMessage('Lütfen zorunlu alanları doldurun')
      setMessageType('error')
      return
    }
    
    setLoading(true)
    setMessage('')
    
    try {
      // Otomatik tarih ve yer bilgilerini ekle
      const now = new Date()
      const updatedFormData = {
        ...formData,
        declarationDate: now.toISOString().split('T')[0],
        declarationPlace: 'İstanbul, Türkiye',
        approvalDate: now.toISOString().split('T')[0]
      }
      
      const response = await axios.post(`${API_BASE_URL}/api/dg`, updatedFormData)
      
      if (response.status === 201) {
        setMessage('DG formu başarıyla kaydedildi!')
        setMessageType('success')
        
        // Formu temizle - tüm yeni alanları dahil
        setFormData({
          // 1. Gönderi Bilgileri
          awbNumber: '',
          shipperName: '',
          shipperAddress: '',
          consigneeName: '',
          consigneeAddress: '',
          declarationDate: '',
          declarationPlace: '',
          
          // 2. Tehlikeli Madde Tanımlama
          unNumber: '',
          properShippingName: '',
          dgClass: '',
          packingGroup: '',
          secondaryRisk: '',
          
          // 3. Paketleme ve Miktar
          netQuantity: '',
          grossWeight: '',
          netWeight: '',
          packageCount: '',
          packingType: '',
          packingInstructions: '',
          
          // 4. Taşıma ve Operasyon
          transportMethod: '',
          handlingInfo: '',
          cargoAircraftOnly: false,
          
          // 5. Onay ve İmza
          preparerName: '',
          preparerSignature: '',
          approverName: '',
          approvalDate: ''
        })
        setErrors({})
      }
    } catch (error) {
      console.error('DG form kaydetme hatası:', error)
      setMessage('DG form kaydedilirken hata oluştu')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  // Toast mesajı göster
  const showToast = (message, type) => {
    setMessage(message)
    setMessageType(type)
    
    setTimeout(() => {
      setMessage('')
      setMessageType('')
    }, 3000)
  }

  // Alan durumunu al
  const getFieldStatus = (fieldName) => {
    if (errors[fieldName]) return 'error'
    if (formData[fieldName]) return 'success'
    return 'neutral'
  }

  return (
    <div className="awb-form-container">
      <div className="form-container">
        {/* Form Başlığı */}
        <div className="form-header">
          <h1 className="form-title" data-testid="dg-form-title">DG Formu – Tehlikeli Madde Beyanı (IATA DGR)</h1>
          <p className="form-subtitle">IATA Dangerous Goods Regulations standartlarına uygun tehlikeli madde beyanı</p>
        </div>
      
      {/* Toast Mesajı */}
      {message && (
        <div className={`form-message ${messageType}`} data-testid="dg-form-message">
          {message}
        </div>
      )}
      
      <div className="form-body">
             <form onSubmit={handleSubmit} className="dg-form" autoComplete="off">
          
          {/* GÖNDERİ BİLGİLERİ */}
        <div className="form-section">
          <div className="section-header">
              <h2 className="section-title">GÖNDERİ BİLGİLERİ</h2>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="awbNumber" className="form-label">
                  AWB Numarası <span className="label-required">*</span>
              </label>
                <input
                  type="text"
                  id="awbNumber"
                  name="awbNumber"
                  value={formData.awbNumber}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldStatus('awbNumber') === 'error' ? 'error' : ''}`}
                  data-testid="awb-number-input"
                  required
                  autoComplete="off"
                />
              {errors.awbNumber && (
                <div className="error-message">{errors.awbNumber}</div>
              )}
                <div className="form-helper-text">
                  AWB numarasını girin (örn. 123-45678901)
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="shipperName" className="form-label">
                  Gönderen Adı/Ünvanı <span className="label-required">*</span>
                </label>
                <input
                  type="text"
                  id="shipperName"
                  name="shipperName"
                  value={formData.shipperName}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldStatus('shipperName') === 'error' ? 'error' : ''}`}
                  data-testid="shipper-name-input"
                  required
                  autoComplete="off"
                />
                {errors.shipperName && (
                  <div className="error-message">{errors.shipperName}</div>
                )}
                <div className="form-helper-text">
                  Gönderen firma/kişi adı
                </div>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="consigneeName" className="form-label">
                  Alıcı Adı/Ünvanı <span className="label-required">*</span>
                </label>
                <input
                  type="text"
                  id="consigneeName"
                  name="consigneeName"
                  value={formData.consigneeName}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldStatus('consigneeName') === 'error' ? 'error' : ''}`}
                  data-testid="consignee-name-input"
                  required
                  autoComplete="off"
                />
                {errors.consigneeName && (
                  <div className="error-message">{errors.consigneeName}</div>
                )}
                <div className="form-helper-text">
                  Alıcı firma/kişi adı
                </div>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="shipperAddress" className="form-label">
                  Gönderen Adresi <span className="label-required">*</span>
                </label>
                <textarea
                  id="shipperAddress"
                  name="shipperAddress"
                  value={formData.shipperAddress}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldStatus('shipperAddress') === 'error' ? 'error' : ''}`}
                  data-testid="shipper-address-input"
                  required
                  rows="3"
                  autoComplete="off"
                />
                {errors.shipperAddress && (
                  <div className="error-message">{errors.shipperAddress}</div>
                )}
                <div className="form-helper-text">
                  Gönderenin tam adresi
                </div>
            </div>
            
              <div className="form-group">
                <label htmlFor="consigneeAddress" className="form-label">
                  Alıcı Adresi <span className="label-required">*</span>
                </label>
                <textarea
                  id="consigneeAddress"
                  name="consigneeAddress"
                  value={formData.consigneeAddress}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldStatus('consigneeAddress') === 'error' ? 'error' : ''}`}
                  data-testid="consignee-address-input"
                  required
                  rows="3"
                  autoComplete="off"
                />
                {errors.consigneeAddress && (
                  <div className="error-message">{errors.consigneeAddress}</div>
                )}
                <div className="form-helper-text">
                  Alıcının tam adresi
                </div>
              </div>
            </div>
          </div>
          
          {/* TEHLİKELİ MADDE TANIMLAMA */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">TEHLİKELİ MADDE TANIMLAMA</h2>
            </div>
            
            <div className="form-row">
            <div className="form-group">
              <label htmlFor="unNumber" className="form-label">
                                  UN Numarası <span className="label-required">*</span>
              </label>
                <input
                  type="text"
                  id="unNumber"
                  name="unNumber"
                  value={formData.unNumber}
                  onChange={handleUNNumberChange}
                  className={`form-input ${getFieldStatus('unNumber') === 'error' ? 'error' : ''}`}
                  data-testid="un-number-input"
                  required
                  autoComplete="off"
                  maxLength="6"
                  style={{
                    fontFamily: 'monospace',
                    letterSpacing: '1px'
                  }}
                />
              {errors.unNumber && (
                <div className="error-message">{errors.unNumber}</div>
              )}
              <div className="form-helper-text">
                UN ile başlayan 4 rakam (örn. UN1203)
              </div>
            </div>
              
              <div className="form-group">
                <label htmlFor="properShippingName" className="form-label">
                  Tehlikeli Madde Adı <span className="label-required">*</span>
                </label>
                <input
                  type="text"
                  id="properShippingName"
                  name="properShippingName"
                  value={formData.properShippingName}
                  onChange={handleInputChange}
                  className={`form-input ${getFieldStatus('properShippingName') === 'error' ? 'error' : ''}`}
                  data-testid="proper-shipping-name-input"
                  required
                  autoComplete="off"
                  list="dg-names-list"
                />
                <datalist id="dg-names-list">
                  <option value="Acetone" />
                  <option value="Benzene" />
                  <option value="Ethanol" />
                  <option value="Gasoline" />
                  <option value="Hydrogen peroxide" />
                  <option value="Lithium batteries" />
                  <option value="Matches" />
                  <option value="Paint" />
                  <option value="Perfume" />
                  <option value="Sulfuric acid" />
                </datalist>
                {errors.properShippingName && (
                  <div className="error-message">{errors.properShippingName}</div>
                )}
                <div className="form-helper-text">
                  IATA DGR'de belirtilen resmi ad
              </div>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dgClass" className="form-label">
                                  DG Sınıfı <span className="label-required">*</span>
              </label>
                                <div className="input-with-status">
                  <select
                    id="dgClass"
                    name="dgClass"
                    value={formData.dgClass}
                    onChange={handleInputChange}
                    className={`form-input ${getFieldStatus('dgClass') === 'error' ? 'error' : ''}`}
                    data-testid="dg-class-select"
                    required
                    autoComplete="off"
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
                    <option value="">DG sınıfı seçin</option>
                    <option value="1">1 – Patlayıcılar (Explosives)</option>
                    <option value="2">2 – Gazlar (Gases)</option>
                    <option value="3">3 – Yanıcı Sıvılar (Flammable Liquids)</option>
                    <option value="4.1">4.1 – Yanıcı Katılar (Flammable Solids)</option>
                    <option value="4.2">4.2 – Kendiliğinden Yanan (Spontaneously Combustible)</option>
                    <option value="4.3">4.3 – Su ile Temas Ettiğinde Tehlikeli (Dangerous When Wet)</option>
                    <option value="5.1">5.1 – Oksitleyici (Oxidizers)</option>
                    <option value="5.2">5.2 – Organik Peroksitler (Organic Peroxides)</option>
                    <option value="6.1">6.1 – Zehirli (Toxic)</option>
                    <option value="6.2">6.2 – Enfeksiyon Yapıcı (Infectious Substances)</option>
                    <option value="7">7 – Radyoaktif (Radioactive)</option>
                    <option value="8">8 – Aşındırıcı (Corrosives)</option>
                    <option value="9">9 – Çeşitli Tehlikeli Maddeler ve Nesneler (Miscellaneous Dangerous Goods)</option>
                  </select>
                </div>
              {errors.dgClass && (
                <div className="error-message">{errors.dgClass}</div>
              )}
                <div className="form-helper-text">
                  {formData.dgClass ? dgClasses[formData.dgClass]?.description : 'DG sınıfı seçildiğinde açıklama gösterilir'}
                </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="packingGroup" className="form-label">
                                  Paketleme Grubu <span className="label-required">*</span>
              </label>
                                <div className="input-with-status">
                  <select
                    id="packingGroup"
                    name="packingGroup"
                    value={formData.packingGroup}
                    onChange={handleInputChange}
                    className={`form-input ${getFieldStatus('packingGroup') === 'error' ? 'error' : ''}`}
                    data-testid="packing-group-select"
                    required
                    autoComplete="off"
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
                    <option value="">Paketleme grubu seçin</option>
                    {Object.values(packingGroups).map(group => (
                      <option key={group.value} value={group.value}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </div>
              {errors.packingGroup && (
                <div className="error-message">{errors.packingGroup}</div>
              )}
                <div className="form-helper-text">
                  {formData.packingGroup ? packingGroups[formData.packingGroup]?.description : 'Paketleme grubu seçildiğinde açıklama gösterilir'}
                </div>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
                <label htmlFor="secondaryRisk" className="form-label">
                  İkincil Risk
              </label>
              <div className="input-with-status">
                <select
                    id="secondaryRisk"
                    name="secondaryRisk"
                    value={formData.secondaryRisk}
                  onChange={handleInputChange}
                    className={`form-input ${getFieldStatus('secondaryRisk') === 'error' ? 'error' : ''}`}
                    data-testid="secondary-risk-select"
                  autoComplete="off"
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
                    {secondaryRisks.map(risk => (
                      <option key={risk.value} value={risk.value}>
                        {risk.label}
                    </option>
                  ))}
                </select>
              </div>
                <div className="form-helper-text" style={{ color: '#6b7280', fontSize: '13px' }}>
                  Varsa DG sınıfına uygun ikincil risk seçiniz
              </div>
            </div>
          </div>
        </div>
        
        {/* Form Butonları */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setFormData({
                  // 1. Gönderi Bilgileri
                  awbNumber: '',
                  shipperName: '',
                  shipperAddress: '',
                  consigneeName: '',
                  consigneeAddress: '',
                  declarationDate: '',
                  declarationPlace: '',
                  
                  // 2. Tehlikeli Madde Tanımlama
                  unNumber: '',
                  properShippingName: '',
                  dgClass: '',
                  packingGroup: '',
                  secondaryRisk: '',
                  
                  // 3. Paketleme ve Miktar
                  netQuantity: '',
                  grossWeight: '',
                  netWeight: '',
                  packageCount: '',
                  packingType: '',
                  packingInstructions: '',
                  
                  // 4. Taşıma ve Operasyon
                  transportMethod: '',
                  handlingInfo: '',
                  cargoAircraftOnly: false,
                  
                  // 5. Onay ve İmza
                  preparerName: '',
                  preparerSignature: '',
                  approverName: '',
                  approvalDate: ''
                })
                setErrors({})
              }}
              data-testid="clear-dg-form-button"
            >
              Formu Temizle
            </button>
            
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            data-testid="submit-dg-form-button"
          >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Kaydediliyor...
                </>
              ) : (
                'DG Kaydet'
              )}
          </button>
      </div>
    </form>
      </div>
  </div>
  </div>
  )
}

export default DgForm
