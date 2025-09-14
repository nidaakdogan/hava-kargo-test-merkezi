import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useNotification } from '../contexts/NotificationContext'
import { io } from 'socket.io-client'
import '../styles/forms.css'
// ToastContainer kaldırıldı - sadece Dashboard'da olmalı
import { eventBus } from '../services/ToastManager'

const UldForm = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    uldCode: '',
    uldType: '',
    maxWeight: '',
    tare: '',
    allowable: '',
    currentWeight: '',
    volume: '',
    capacityUsage: '',
    remainingWeight: ''
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  
  const { showSuccess, showError, showInfo, showWarning } = useNotification()
  const [isMobile, setIsMobile] = useState(false)
  const [capacityWarning, setCapacityWarning] = useState(null)
  const [isTareEditable, setIsTareEditable] = useState(false)
  const [selectedAircraft, setSelectedAircraft] = useState('')
  const [selectedAirline, setSelectedAirline] = useState('')
  
  


  const API_BASE_URL = 'http://localhost:3001'



  // Override kuralları - Uçak/airline özel kısıtlamaları
  const overrideRules = {
    aircraft: {
      'B767': {
        'AKH': { mgw: 1135, tare: 88 }, // AKH'yi 1.135 kg'a sabitleyen filo
        'DPE': { mgw: 1134, tare: 83 }  // DPE için özel limit
      },
      'B777': {
        'AKH': { mgw: 1588, tare: 88 }  // B777'de AKH AKE ile aynı limit
      }
    },
    airline: {
      'TK': {
        'AKH': { mgw: 1135, tare: 88 }, // Turkish Airlines özel kısıtlaması
        'PMC': { mgw: 6804, tare: 102 } // TK palet limiti
      },
      'LH': {
        'AKH': { mgw: 1588, tare: 88 }, // Lufthansa AKH'yi AKE ile eşit tutar
        'PMC': { mgw: 6800, tare: 102 }
      }
    }
  }

  // Override kurallarını uygulayan fonksiyon
  const getUldMetricsWithOverride = (uldType) => {
    const baseUld = uldTypes.find(uld => uld.value === uldType)
    if (!baseUld) return null

    let mgw = baseUld.mgw
    let tare = baseUld.tare

    // Uçak override'ı kontrol et
    if (selectedAircraft && overrideRules.aircraft[selectedAircraft]?.[uldType]) {
      const aircraftOverride = overrideRules.aircraft[selectedAircraft][uldType]
      mgw = aircraftOverride.mgw
      tare = aircraftOverride.tare
    }

    // Airline override'ı kontrol et (uçak override'ından sonra)
    if (selectedAirline && overrideRules.airline[selectedAirline]?.[uldType]) {
      const airlineOverride = overrideRules.airline[selectedAirline][uldType]
      mgw = airlineOverride.mgw
      tare = airlineOverride.tare
    }

    return {
      ...baseUld,
      mgw,
      tare,
      volume: baseUld.volume,
      type: baseUld.type
    }
  }

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ULD formu açıldığında toast göster
  useEffect(() => {
    // eventBus.emit('web:form-open'); // Toast kaldırıldı
  }, [])

  // Uçak veya airline değiştiğinde mevcut ULD tipi için override'ı yeniden uygula
  useEffect(() => {
    if (formData.uldType) {
      const selectedUld = getUldMetricsWithOverride(formData.uldType)
      if (selectedUld) {
        const mgw = selectedUld.mgw
        const tare = selectedUld.tare
        const volume = selectedUld.volume
        const isPallet = selectedUld.type === 'pallet'
        const allowable = Math.max(0, mgw - tare)
        
        setFormData(prev => ({
          ...prev,
          maxWeight: mgw.toString(),
          tare: tare.toString(),
          volume: isPallet ? '' : (volume ? volume.toString() : ''),
          allowable: allowable.toString(),
          capacityUsage: '',
          remainingWeight: ''
        }))
      }
    }
  }, [selectedAircraft, selectedAirline])

  // Uçak tipi seçimi - Adım 1
  const handleAircraftChange = (e) => {
    const value = e.target.value
    console.log('🛩️ [ULD Demo] Uçak tipi seçildi:', value)
    setSelectedAircraft(value)
    
    if (value) {
      // Adım doğrulama ve tamamlama
      setTimeout(() => {
      }, 100) // Dropdown menü kapanması için kısa bekleme
    }
  }

  // Havayolu seçimi - Adım 2
  const handleAirlineChange = (e) => {
    const value = e.target.value
    console.log('🏢 [ULD Demo] Havayolu seçildi:', value)
    setSelectedAirline(value)
    
    if (value) {
      // Adım doğrulama ve tamamlama
      setTimeout(() => {
      }, 100) // Dropdown menü kapanması için kısa bekleme
    }
  }

  // ULD tipleri - Sistemde sabit hesaplama kurallarına göre güncellendi
  const uldTypes = [
    { value: 'AKE', label: 'AKE - LD3 Container', name: 'LD3', mgw: 1588, tare: 82, volume: 4.4, type: 'container', description: 'Taban 156,2×153,4 cm, yükseklik ~162,5 cm' },
    { value: 'AKH', label: 'AKH - LD3 (alçak) Container', name: 'LD3', mgw: 1135, tare: 88, volume: 3.6, type: 'container', description: 'AKE ile aynı taban, yükseklik ~113 cm' },
    { value: 'DPE', label: 'DPE - LD2 Container', name: 'LD2', mgw: 1179, tare: 83, volume: 3.45, type: 'container', description: '767 ailesinde yaygın; AKE\'den daha dar' },
    { value: 'DPW', label: 'DPW - LD3 Container (varyant)', name: 'LD3', mgw: 1588, tare: 80, volume: 4.4, type: 'container', description: 'LD-3 ailesiyle aynı geometri' },
    { value: 'AMJ', label: 'AMJ - LD9 (10-ft) Container', name: 'LD9', mgw: 6804, tare: 340, volume: 9.5, type: 'container', description: 'Taban 125"×96" (317,5×243,8 cm), yükseklik 96"' },
    { value: 'AMA', label: 'AMA - LD9 / GM1 Container', name: 'LD9', mgw: 6804, tare: 410, volume: 9.5, type: 'container', description: 'AMJ ile aynı boyut sınıfı' },
    { value: 'AAF', label: 'AAF - LD26 Container', name: 'LD26', mgw: 5329, tare: 271, volume: 13.6, type: 'container', description: 'Taban 125"×88" (317,5×223,5 cm), yükseklik ~162,6 cm' },
    { value: 'AMF', label: 'AMF - LD11 Container', name: 'LD11', mgw: 3175, tare: 192, volume: 7.3, type: 'container', description: 'Taban 125"×88", yükseklik ~162,6 cm' },
    { value: 'PMC', label: 'PMC - 96×125 Palet (P6P)', name: 'LD7', mgw: 6800, tare: 102, volume: null, type: 'pallet', description: 'Ana güvertede MGW genelde 6.800 kg' },
    { value: 'PLA', label: 'PLA - 60,4×125 Palet', name: 'LD6', mgw: 3175, tare: 93, volume: null, type: 'pallet', description: 'Dar tabanlı palet' },
    { value: 'PAG', label: 'PAG - 88×125 Palet', name: '88x125', mgw: 5715, tare: 96, volume: null, type: 'pallet', description: 'Ana güvertede ~6.000-6.804 kg, alt güvertede ~4.626 kg' },
    { value: 'PAJ', label: 'PAJ - 96×125 Palet', name: '96x125', mgw: 6800, tare: 102, volume: null, type: 'pallet', description: 'PMC ile aynı sınıf' }
  ];

  // ULD tipi değiştiğinde otomatik hesaplama - Override sistemi ile - Adım 4
  const handleUldTypeChange = (e) => {
    const selectedType = e.target.value
    const selectedUld = getUldMetricsWithOverride(selectedType)
    
    if (selectedUld) {
      const mgw = selectedUld.mgw
      const tare = selectedUld.tare
      const volume = selectedUld.volume
      const isPallet = selectedUld.type === 'pallet'
      
      // HESAP KURALLARI (Override sistemi ile):
      // Yüklenebilir Ağırlık (kg) = MGW - Tare
      const allowable = Math.max(0, mgw - tare)
      
      setFormData(prev => ({
        ...prev,
        uldType: selectedType,
        maxWeight: mgw.toString(),
        tare: tare.toString(),
        volume: isPallet ? '' : (volume ? volume.toString() : ''),
        allowable: allowable.toString(),
        capacityUsage: '',
        remainingWeight: ''
      }))
       
       // Tare düzenleme modu sıfırlanır
       setIsTareEditable(false)
       
       // ULD seçildiğinde otomatik odak kaldırıldı - ekran fırlamasını önlemek için
      
      // Tare > MGW uyarısı
      if (tare > mgw) {
        setCapacityWarning({
          type: 'warning',
          message: 'Tare, MGW\'den büyük – Yüklenebilir ağırlık 0\'a düşürüldü.'
        })
      } else {
        setCapacityWarning(null)
      }

      // ULD tipi seçildi - adım tamamla
      setTimeout(() => {
      }, 100) // Dropdown menü kapanması için kısa bekleme
    } else {
      setFormData(prev => ({
        ...prev,
        uldType: selectedType,
        maxWeight: '',
        tare: '',
        volume: '',
        allowable: '',
        capacityUsage: '',
        remainingWeight: ''
      }))
      setCapacityWarning(null)
    }
  }

  // Input değişim handler'ı
  const handleInputChange = (e) => {
    const { name, value } = e.target
    
    if (name === 'currentWeight') {
      handleCurrentWeightChange(e)
    } else if (name === 'uldCode') {
      handleUldCodeChange(e)
    } else if (name === 'tare') {
      handleTareChange(e)
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
      
      if (errors[name]) {
        setErrors(prev => ({
          ...prev,
          [name]: ''
        }))
      }
    }
  }

  // ULD kodu validasyonu - Adım 3
  const handleUldCodeChange = (e) => {
    const { value } = e.target
    setFormData(prev => ({ ...prev, uldCode: value.toUpperCase() }))
    
    if (errors.uldCode) {
      setErrors(prev => ({
        ...prev,
        uldCode: ''
      }))
    }
    
    if (value && !/^[A-Z]{3}[0-9]{5}[A-Z]{2}$/.test(value.toUpperCase())) {
      setErrors(prev => ({
        ...prev,
        uldCode: 'ULD Kodu formatı hatalı. Örn: AKE12345AB'
      }))
    } else if (value && /^[A-Z]{3}[0-9]{5}[A-Z]{2}$/.test(value.toUpperCase())) {
      // Geçerli format - adım tamamla
      setTimeout(() => {
      }, 100)
    }
  }

  // Tare düzenleme modunu aç/kapat
  const toggleTareEdit = () => {
    setIsTareEditable(!isTareEditable)
    
    // Düzenleme modu kapatılırsa varsayılan değere geri dön
    if (isTareEditable) {
      const selectedUld = uldTypes.find(uld => uld.value === formData.uldType)
      if (selectedUld) {
        const defaultTare = selectedUld.tare
        setFormData(prev => ({ ...prev, tare: defaultTare.toString() }))
        
        // Yüklenebilir ağırlık yeniden hesaplanır
        const mgw = parseFloat(formData.maxWeight)
        const allowable = Math.max(0, mgw - defaultTare)
        setFormData(prev => ({
          ...prev,
          allowable: allowable.toString(),
          capacityUsage: '',
          remainingWeight: ''
        }))
        
        // Mevcut ağırlık varsa kapasite yeniden hesaplanır
        if (formData.currentWeight) {
          handleCurrentWeightChange({ target: { name: 'currentWeight', value: formData.currentWeight } })
        }
      }
    }
  }

  // Tare değişikliklerini kaydet
  const saveTareChanges = () => {
    setIsTareEditable(false)
    // Değişiklikler zaten formData'da, sadece modu kapat
  }

  // Tare değişikliklerini iptal et
  const cancelTareChanges = () => {
    const selectedUld = uldTypes.find(uld => uld.value === formData.uldType)
    if (selectedUld) {
      const defaultTare = selectedUld.tare
      setFormData(prev => ({ ...prev, tare: defaultTare.toString() }))
      
      // Yüklenebilir ağırlık yeniden hesaplanır
      const mgw = parseFloat(formData.maxWeight)
      const allowable = Math.max(0, mgw - defaultTare)
      setFormData(prev => ({
        ...prev,
        allowable: allowable.toString(),
        capacityUsage: '',
        remainingWeight: ''
      }))
      
      // Mevcut ağırlık varsa kapasite yeniden hesaplanır
      if (formData.currentWeight) {
        handleCurrentWeightChange({ target: { name: 'currentWeight', value: formData.currentWeight } })
      }
    }
    setIsTareEditable(false)
  }

  // Tare değiştiğinde otomatik hesaplama
  const handleTareChange = (e) => {
    const { value } = e.target
    setFormData(prev => ({ ...prev, tare: value }))
    
    if (errors.tare) {
      setErrors(prev => ({
        ...prev,
        tare: ''
      }))
    }
    
    // Tare değiştiğinde yüklenebilir ağırlık ve kapasite yeniden hesaplanır
    if (value && formData.maxWeight) {
      const tare = parseFloat(value)
      const mgw = parseFloat(formData.maxWeight)
      
      if (tare < 0) {
        setErrors(prev => ({
          ...prev,
          tare: 'Tare 0\'dan küçük olamaz'
        }))
        return
      }
      
      if (tare > mgw) {
        setErrors(prev => ({
          ...prev,
          tare: 'Tare, MGW\'den büyük olamaz'
        }))
        return
      }
      
      // HESAP KURALLARI (Sistemde sabit):
      // Yüklenebilir Ağırlık (kg) = MGW - Tare
      const allowable = Math.max(0, mgw - tare)
      
      setFormData(prev => ({
        ...prev,
        allowable: allowable.toString(),
        capacityUsage: '',
        remainingWeight: ''
      }))
      
      // Mevcut ağırlık varsa kapasite yeniden hesaplanır
      if (formData.currentWeight) {
        handleCurrentWeightChange({ target: { name: 'currentWeight', value: formData.currentWeight } })
      }
    }
  }

  // Mevcut ağırlık değiştiğinde hesaplama - Sistemde sabit kurallara göre - Adım 5
  const handleCurrentWeightChange = (e) => {
    const { value } = e.target
    setFormData(prev => ({ ...prev, currentWeight: value }))
    
    if (errors.currentWeight) {
      setErrors(prev => ({
        ...prev,
        currentWeight: ''
      }))
    }
    
    if (value && formData.allowable) {
      const current = parseFloat(value)
      const allowable = parseFloat(formData.allowable)
      
             if (current <= 0) {
         setErrors(prev => ({
           ...prev,
           currentWeight: 'Sıfırdan büyük bir değer giriniz'
         }))
         return
       }
      
      if (current > allowable) {
        setErrors(prev => ({
          ...prev,
          currentWeight: `Ağırlık kapasiteyi aşıyor. Lütfen ${allowable} kg ve altı girin.`
        }))
        
        // Overweight için error toast
        showError(`Kayıt başarısız: Mevcut ağırlık (${current} kg), kapasite (${allowable} kg) değerini aşıyor.`, 6000)
      }
      
      // HESAP KURALLARI (Sistemde sabit):
      // Kapasite % = MevcutAğırlık / YüklenebilirAğırlık × 100
      const usage = allowable > 0 ? ((current / allowable) * 100).toFixed(1) : '0.0'
      
      // Kalan Ağırlık (kg) = YüklenebilirAğırlık - MevcutAğırlık
      const remaining = Math.max(0, allowable - current).toFixed(1)
      
      setFormData(prev => ({
        ...prev,
        capacityUsage: usage,
        remainingWeight: remaining
      }))
      
      // Kapasite uyarıları
      updateCapacityWarning()

      // Mevcut ağırlık girildi - adım tamamla (demo için 1600 kg ile limit aşımı)
      if (value && !isNaN(current) && current > 0) {
        setTimeout(() => {
        }, 100)
      }
    } else {
      setFormData(prev => ({
        ...prev,
        capacityUsage: '',
        remainingWeight: ''
      }))
      setCapacityWarning(null)
    }
  }

  // Kapasite uyarısını güncelle - Yeni kurallara göre
  const updateCapacityWarning = () => {
    if (!formData.allowable || !formData.currentWeight) {
      setCapacityWarning(null);
      return;
    }

    const capacityPercent = parseFloat(formData.capacityUsage);
    
    if (capacityPercent > 100.0) {
      setCapacityWarning({ 
        type: 'danger', 
        message: `❌ ULD kapasitesi aşıldı! Yük kabul edilmez! (${capacityPercent.toFixed(1)}%)` 
      });
    } else if (capacityPercent === 100.0) {
      setCapacityWarning({ 
        type: 'critical', 
        message: '⚠ Kapasite %100 doldu! Yeni yük eklenirse aşım olur.' 
      });
    } else if (capacityPercent >= 90.0) {
      setCapacityWarning({ 
        type: 'warning', 
        message: `⚠ Kritik seviye! Kapasite %${capacityPercent.toFixed(1)} - Dikkat!` 
      });
    } else if (capacityPercent >= 70.0) {
      setCapacityWarning({ 
        type: 'caution', 
        message: `⚠ Dikkat seviyesi! Kapasite %${capacityPercent.toFixed(1)}` 
      });
    } else {
      setCapacityWarning(null); // %0-69 arası uyarı yok (yeşil)
    }
  };

  // Submit butonunun disabled durumu
  const isSubmitDisabled = () => {
    // Temel alan kontrolü
    if (!formData.uldCode || !formData.uldType || !formData.currentWeight) {
      return true;
    }

    // ULD tipi seçildikten sonra hazır sinyali kontrolü
    if (formData.uldType && !document.querySelector('[data-testid="uld-limits-ready"][data-ready="true"]')) {
      return true;
    }

    // Ağırlık validasyonu
    const currentWeight = parseFloat(formData.currentWeight);
    if (currentWeight < 0) {
      return true;
    }

    // Overweight durumunda Kaydet disabled
    const allowable = parseFloat(formData.allowable || 0);
    if (currentWeight > allowable && allowable > 0) {
      return true;
    }

    // Diğer validasyon hataları varsa devre dışı bırak
    if (errors.uldCode || errors.uldType || errors.currentWeight) {
      return true;
    }

    return false;
  };

;

  // Submit buton tooltip mesajı
  const getSubmitButtonTooltip = () => {
    if (!formData.uldCode) return 'Zorunlu alanları doldurun: ULD Kodu'
    if (!formData.uldType) return 'Zorunlu alanları doldurun: ULD Tipi'
    if (!formData.currentWeight) return 'Zorunlu alanları doldurun: Mevcut Ağırlık'
    
    // ULD tipi seçildikten sonra hazır sinyali kontrolü
    if (formData.uldType && !document.querySelector('[data-testid="uld-limits-ready"][data-ready="true"]')) {
      return 'ULD tipi seçildi - Limitler hesaplanıyor, lütfen bekleyin'
    }
    
    if (Object.keys(errors).length > 0) return 'Validasyon hatalarını düzeltin'
    if (parseFloat(formData.currentWeight) < 0) return 'Ağırlık negatif olamaz'
    
    if (parseFloat(formData.currentWeight) > parseFloat(formData.allowable || 0)) {
      return 'Kapasite aşıldı - Kayıt reddedilecek (Test senaryosu)'
    }
    
    return 'Formu kaydetmek için tıklayın'
  }

  // Form validasyonu
  const validateForm = () => {
    const newErrors = {}
    
    // ULD Kodu validasyonu
    if (!formData.uldCode) {
      newErrors.uldCode = 'ULD kodu zorunludur'
    } else if (!/^[A-Z]{3}[0-9]{5}[A-Z]{2}$/.test(formData.uldCode)) {
      newErrors.uldCode = 'ULD Kodu formatı hatalı. Örn: AKE12345AB'
    }
    
    // ULD Tipi validasyonu
    if (!formData.uldType) {
      newErrors.uldType = 'ULD Tipi seçilmelidir'
    }
    
    // Tare validasyonu
    if (formData.tare) {
      const tare = parseFloat(formData.tare)
      const mgw = parseFloat(formData.maxWeight)
      
      if (tare < 0) {
        newErrors.tare = 'Tare 0\'dan küçük olamaz'
      } else if (tare > mgw) {
        newErrors.tare = 'Tare, MGW\'den büyük olamaz'
      }
    }
    
     // Mevcut Ağırlık validasyonu - enabled ise zorunlu
     if (formData.uldType) { // ULD seçilmişse enabled
       if (formData.currentWeight) {
         if (parseFloat(formData.currentWeight) < 0) {
           newErrors.currentWeight = 'Sıfırdan büyük bir değer giriniz'
         } else if (formData.allowable && parseFloat(formData.currentWeight) > parseFloat(formData.allowable)) {
           newErrors.currentWeight = 'Ağırlık yüklenebilir limiti aşıyor'
         }
       } else {
         newErrors.currentWeight = 'Mevcut ağırlık zorunludur'
       }
     }
     // ULD seçilmemişse (disabled) hiç validasyon yapmaz
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Form submit - Adım 6
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    
    if (!validateForm()) {
      setMessage('Lütfen zorunlu alanları doldurun ve validasyon hatalarını düzeltin')
      setMessageType('error')
      return
    }

                   if (parseFloat(formData.currentWeight) > parseFloat(formData.allowable || 0)) {
        const currentWeight = parseFloat(formData.currentWeight);
        const allowable = parseFloat(formData.allowable || 0);
        const excess = currentWeight - allowable;
        
        setMessage(`❌ ULD Kaydı başarısız – Kapasite aşıldı! Mevcut ağırlık (${formatKg(currentWeight)} kg) yüklenebilir limiti (${formatKg(allowable)} kg) ${formatKg(excess)} kg aşıyor.`)
        setMessageType('error')
        showError('Kapasite aşıldı - Kayıt reddedildi')
        
        // Toast: Ağırlık aşımı
        eventBus.emit('web:overweight', { 
          currentWeight: formatKg(currentWeight), 
          capacity: formatKg(allowable) 
        });
        
        return
      }
    
    setLoading(true)
    setMessage('')

    try {
      const response = await axios.post(`${API_BASE_URL}/api/uld`, formData)
      
      if (response.status === 201) {
        showSuccess('ULD başarıyla kaydedildi!', 'Kayıt Başarılı')
        
        // Toast: Mobil onayı
        setTimeout(() => {
          eventBus.emit('web:ask-mobile');
        }, 1000);
        
        setFormData({
          uldCode: '',
          uldType: '',
          maxWeight: '',
          tare: '',
          allowable: '',
          currentWeight: '',
          volume: '',
          capacityUsage: '',
          remainingWeight: ''
        })
        setErrors({})
        setMessage('')
        setCapacityWarning(null)
      }
    } catch (error) {
      console.error('ULD form kaydetme hatası:', error)
      setMessage('ULD form kaydedilirken hata oluştu')
      setMessageType('error')
      showError('ULD kaydedilirken hata oluştu. Lütfen tekrar deneyin.', 'Kayıt Hatası')
    } finally {
      setLoading(false)
    }
  }

  // Form temizleme
  const handleClearForm = () => {
    setFormData({
      uldCode: '',
      uldType: '',
      maxWeight: '',
      tare: '',
      allowable: '',
      currentWeight: '',
      volume: '',
      capacityUsage: '',
      remainingWeight: ''
    })
    setErrors({})
    setMessage('')
    setMessageType('')
    setCapacityWarning(null)
    setIsTareEditable(false)
    showInfo('Form sıfırlandı.', 'İşlem Tamamlandı')
  }


  // Kapasite bar yüzdesini hesapla (bar asla 100%'ü geçmez)
  const getCapacityBarPercentage = () => {
    const usage = parseFloat(formData.capacityUsage) || 0;
    return Math.min(Math.max(0, usage), 100); // min(usage%, 100)
  };

  // getProgressWarningText fonksiyonu kaldırıldı - artık kullanılmıyor

  // Kapasite bar rengini belirle - İyileştirilmiş eşikler
  const getCapacityBarColor = () => {
    const usage = parseFloat(formData.capacityUsage) || 0;
    if (usage >= 100.0) {
      return '#DC2626'; // Kırmızı (≥100% - Limit aşımı, kabul edilmez)
    } else if (usage >= 95.0) {
      return '#EA580C'; // Turuncu (95-99.9% - Kritik seviye, dikkat)
    } else if (usage >= 70.0) {
      return '#F59E0B'; // Sarı (70-94.9% - Uyarı)
    } else {
      return '#16A34A'; // Yeşil (0-69.9% - Normal)
    }
  };

  // Helper text fonksiyonları
  const getUldCodeHelper = () => {
    if (!formData.uldCode) {
      return { text: 'ULD kodu giriniz (örn: AKE12345AB)', type: 'info' };
    }
    
    if (errors.uldCode) {
      return { text: errors.uldCode, type: 'error' };
    }
    
    return { text: 'Format: XXX99999XX (3 harf + 5 rakam + 2 harf)', type: 'info' };
  };

  const getUldTypeHelper = () => {
    if (!formData.uldType) {
      return { text: 'ULD tipi seçiniz', type: 'info' };
    }
    
    return { text: 'ULD tipi seçildi', type: 'success' };
  };

  const getMaxWeightHelper = () => {
    if (!formData.uldType) {
      return { text: 'ULD tipine göre otomatik hesaplanır', type: 'info' };
    }
    
    return { text: 'ULD tipine göre otomatik', type: 'info' };
  };

  const getTareHelper = () => {
    if (!formData.uldType) {
      return { text: 'ULD tipine göre otomatik hesaplanır', type: 'info' };
    }
    
    if (isTareEditable) {
      const selectedUld = uldTypes.find(uld => uld.value === formData.uldType);
      const defaultTare = selectedUld?.tare;
      return { text: `Varsayılan: ${defaultTare} kg • Manuel düzenleniyor`, type: 'info' };
    }
    
    if (formData.tare) {
      const selectedUld = uldTypes.find(uld => uld.value === formData.uldType);
      const defaultTare = selectedUld?.tare;
      const currentTare = parseFloat(formData.tare);
      
      if (defaultTare && Math.abs(currentTare - defaultTare) > 0.1) {
        return { text: `Manuel düzenlendi: ${formatKg(currentTare)} kg`, type: 'warning' };
      }
      return { text: 'ULD tipine göre otomatik', type: 'info' };
    }
    
    return { text: 'ULD tipine göre otomatik', type: 'info' };
  };

  const getAllowableHelper = () => {
    if (!formData.uldType) {
      return { text: 'ULD tipine göre otomatik hesaplanır', type: 'info' };
    }
    
    return { text: 'MGW − Tare', type: 'info' };
  };

  const getCurrentWeightHelper = () => {
    // ULD Tipi seçilmemişse - tek koşul
    if (!formData.uldType) {
      return {
        type: 'disabled',
        text: 'Önce ULD Tipi seçiniz'
      };
    }
    
    // MGW ve Tare sayısal + NaN guard
    const mgw = Number(formData.maxWeight) || 0;
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
        text: `Geçerli aralık: 0–${formatKg(usable)} kg`
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
        text: `⚠️ Kritik seviye! Kapasite %${usage.toFixed(0)} doldu`
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
      text: `Geçerli aralık: 0–${formatKg(usable)} kg • Kalan: ${formatKg(remaining)} kg`
    };
  };

  // getCapacityUsageHelper fonksiyonu kaldırıldı - artık kullanılmıyor

  const getRemainingWeightHelper = () => {
    // ULD Tipi seçilmemişse sadece bilgi metni
    if (!formData.uldType) {
      return { text: 'ULD tipi seçildikten sonra hesaplanır', type: 'info' };
    }
    
    // Mevcut ağırlık girilmemişse bilgi metni
    if (!formData.currentWeight) {
      return { text: 'Mevcut ağırlık girildikten sonra hesaplanır', type: 'info' };
    }
    
    const remaining = parseFloat(formData.remainingWeight) || 0;
    
    if (remaining < 0) {
      return { text: `❌ Kapasite ${formatKg(Math.abs(remaining))} kg aşıldı`, type: 'error' };
    }
    
    return { text: 'Kalan yüklenebilir ağırlık', type: 'info' };
  };

  const getVolumeHelper = () => {
    if (!formData.uldType) {
      return { text: 'ULD tipine göre otomatik hesaplanır', type: 'info' };
    }
    
    const selectedUld = uldTypes.find(uld => uld.value === formData.uldType);
    const isPallet = selectedUld?.type === 'pallet';
    
    if (isPallet) {
      if (formData.volume) {
        return { text: `Girilen hacim: ${parseFloat(formData.volume).toFixed(1)} m³ (yük konturüne göre)`, type: 'info' };
      }
      return { text: 'Opsiyonel: Yük konturüne/örtüsüne göre manuel girebilirsiniz. Dimensional Weight hesaplaması için cm ölçüleri kullanın.', type: 'info' };
    } else {
      if (formData.volume) {
        return { text: `Hacim: ${parseFloat(formData.volume).toFixed(1)} m³`, type: 'info' };
      }
      return { text: 'ULD tipine göre otomatik hesaplanır', type: 'info' };
    }
  };

  // getUsagePercentage fonksiyonu kaldırıldı - artık kullanılmıyor

  // Yeni sayı formatlaması - kg binlik ayraçlı, % 1 ondalık
  const formatNumber = (value, decimals = 1) => {
    if (!value || isNaN(value)) return '';
    const num = parseFloat(value);
    if (Number.isInteger(num)) {
      return num.toLocaleString('tr-TR'); // Binlik ayraç ile
    }
    return num.toFixed(decimals);
  };

  // kg değerleri için binlik ayraçlı formatla
  const formatKg = (value) => {
    if (!value || isNaN(value)) return '';
    const num = parseFloat(value);
    return num.toLocaleString('tr-TR'); // Binlik ayraç: 6.557
  };

  // Yüzde değerleri için 1 ondalık
  const formatPercent = (value) => {
    if (!value || isNaN(value)) return '';
    const num = parseFloat(value);
    return num.toFixed(1); // 1 ondalık: 43.6
  };

  // Aşım bilgilerini hesapla
  const getOverflowInfo = () => {
    const usage = parseFloat(formData.capacityUsage) || 0;
    const current = parseFloat(formData.currentWeight) || 0;
    const allowable = parseFloat(formData.allowable) || 0;
    
    if (usage <= 100 || allowable <= 0) return null;
    
    const overKg = current - allowable;
    const overPercent = usage - 100;
    
    return {
      kg: overKg,
      percent: overPercent
    };
  };

  const mobileClass = isMobile ? 'mobile' : ''

  return (
    <div className="uld-page awb-form-container">
      {/* Demo Step Panel - Sadece demo modunda görünür */}
      
      <div className="form-container">
        {/* Professional Form Header */}
        <div className="form-header">
          <h1 className="form-title" data-testid="uld-form-title">
            ULD Kapasite Yönetimi
          </h1>
          <p className="form-subtitle">ULD (Unit Load Device) kapasite ve hacim hesaplamaları</p>
          
          {/* Demo Modu Test Butonları */}
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
          </div>
        </div>
      
      {/* Form Mesajı */}
      {message && (
        <div className={`form-message ${messageType} ${mobileClass}`} data-testid="uld-form-message">
          {message}
        </div>
      )}
      
      <div className="form-body">
        <form onSubmit={handleSubmit} className="dg-form" autoComplete="off">
          {/* ULD Bilgileri */}
          <div className="form-section">
            <div className="section-header">
              <h2 className="section-title">
                ULD BİLGİLERİ
              </h2>
            </div>
            
            {/* Uçak ve Airline Seçimi */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="aircraft" className="form-label">
                  Uçak Tipi
                  <span className="label-optional"> (Opsiyonel)</span>
                </label>
                <select
                  id="aircraft"
                  name="aircraft"
                  value={selectedAircraft}
                  onChange={handleAircraftChange}
                  className="form-input"
                  data-testid="aircraft-select"
                  data-selected-value={selectedAircraft}
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
                  <option value="">Uçak tipi seçin</option>
                  <option value="B767">Boeing 767</option>
                  <option value="B777">Boeing 777</option>
                  <option value="B787">Boeing 787</option>
                  <option value="A330">Airbus A330</option>
                  <option value="A350">Airbus A350</option>
                </select>
                <div className="form-helper-text info">
                  Uçak tipine göre ULD limitleri otomatik ayarlanır
                  {selectedAircraft && (
                    <div style={{color: '#059669', fontWeight: 'bold', marginTop: '4px'}}>
                      ✓ Seçilen: {selectedAircraft}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="airline" className="form-label">
                  Havayolu
                  <span className="label-optional"> (Opsiyonel)</span>
                </label>
                <select
                  id="airline"
                  name="airline"
                  value={selectedAirline}
                  onChange={handleAirlineChange}
                  className="form-input"
                  data-testid="airline-select"
                  data-selected-value={selectedAirline}
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
                  <option value="">Havayolu seçin</option>
                  <option value="TK">Turkish Airlines</option>
                  <option value="LH">Lufthansa</option>
                  <option value="AF">Air France</option>
                  <option value="KL">KLM</option>
                  <option value="BA">British Airways</option>
                </select>
                <div className="form-helper-text info">
                  Havayolu özel kısıtlamaları uygulanır
                  {selectedAirline && (
                    <div style={{color: '#059669', fontWeight: 'bold', marginTop: '4px'}}>
                      ✓ Seçilen: {selectedAirline}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="uldCode" className="form-label">
                  ULD Kodu
                  <span className="label-required">*</span>
                </label>
                <input
                  type="text"
                  id="uldCode"
                  name="uldCode"
                  className={`form-input ${mobileClass} ${errors.uldCode ? 'error' : ''}`}
                  value={formData.uldCode}
                  onChange={handleInputChange}
                  data-testid="uld-code-input"
                  required
                  autoComplete="off"
                />
                {errors.uldCode && (
                  <div className="error-message">
                    {errors.uldCode}
                  </div>
                )}
                <div className={`form-helper-text ${getUldCodeHelper().type}`}>
                  {getUldCodeHelper().text}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="uldType" className="form-label">
                  ULD Tipi
                  <span className="label-required">*</span>
                </label>
                <div className="input-with-status">
                  <select
                    id="uldType"
                    name="uldType"
                    value={formData.uldType || ''}
                    onChange={handleUldTypeChange}
                    className={`form-input ${mobileClass} ${errors.uldType ? 'error' : ''}`}
                    data-testid="uld-type-select"
                    required
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
                    <option value="">ULD tipi seçin</option>
                    {uldTypes.map(uld => (
                      <option key={uld.value} value={uld.value}>
                        {uld.label}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.uldType && (
                  <div className="error-message">
                    {errors.uldType}
                  </div>
                )}
                <div className={`form-helper-text ${getUldTypeHelper().type}`} data-testid="uld-type-helper">
                  {getUldTypeHelper().text}
                  {formData.uldType && (
                    <div style={{color: '#059669', fontWeight: 'bold', marginTop: '4px'}}>
                      ✓ Seçilen: {formData.uldType}
                    </div>
                  )}
                </div>
                {/* ULD Tipi Hazır Sinyali */}
                {formData.uldType && (
                  <div className="uld-ready-signal" data-testid="uld-limits-ready" data-ready="true">
                    <span className="ready-icon">✅</span>
                    <span className="ready-text">ULD tipi seçildi - Limitler hazır</span>
                    <div className="ready-details">
                      MGW: {formatKg(formData.maxWeight)} kg | Tare: {formatKg(formData.tare)} kg | Yüklenebilir: {formatKg(formData.allowable)} kg
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ağırlık Bilgileri */}
          <div className={`form-section ${mobileClass}`}>
            <div className={`section-header ${mobileClass}`}>
              <h3 className={`section-title ${mobileClass}`}>
                AĞIRLIK BİLGİLERİ
              </h3>
            </div>
            
            <div className="form-row">
                             <div className="form-group">
                 <label htmlFor="maxWeight" className="form-label">
                   Maksimum Ağırlık (kg) = MGW
                 </label>
                   <div className="input-with-unit">
                     <input
                       type="number"
                       id="maxWeight"
                       name="maxWeight"
                       value={formData.maxWeight || ''}
                       className="form-input"
                       data-testid="max-weight-input"
                       readOnly
                       disabled
                       autoComplete="off"
                       min="0"
                       max="999999"
                       step="0.1"
                       title="ULD tipine göre otomatik doldurulur"
                     />
                     <span className="input-unit">kg</span>
                   </div>
                                   <div className={`current-weight-helper ${getMaxWeightHelper().type}`}>
                    <span className="helper-icon">ⓘ</span>
                    <span className="helper-text">{getMaxWeightHelper().text}</span>
                  </div>
               </div>
              
                                            <div className="form-group">
                 <label htmlFor="tare" className="form-label">
                   Tare (kg)
                 </label>
                 <div className="tare-edit-container">
                   <div className="input-with-unit">
                     <input
                       type="number"
                       id="tare"
                       name="tare"
                       value={formData.tare || ''}
                       className={`form-input ${mobileClass} ${errors.tare ? 'error' : ''} ${getTareHelper().type === 'warning' ? 'error' : ''}`}
                       data-testid="tare-input"
                       onChange={handleInputChange}
                       autoComplete="off"
                       min="0"
                       max="999999"
                       step="0.1"
                       title={isTareEditable 
                         ? "Manuel düzenleme modu aktif. Değişiklikleri kaydetmek için ✔ ikonuna tıklayın" 
                         : "ULD tipine göre otomatik. İhtiyaç olursa düzenleyin"}
                       readOnly={!isTareEditable}
                       disabled={!isTareEditable}
                     />
                     <span className="input-unit">kg</span>
                   </div>
                   
                   {/* Edit Mode Icons */}
                   {isTareEditable ? (
                     <div className="tare-edit-mode-icons">
                       <span 
                         className="tare-edit-mode-icon save"
                         onClick={saveTareChanges}
                         title="Değişiklikleri kaydet"
                         data-testid="tare-save-icon"
                       >
                         ✔
                       </span>
                       <span 
                         className="tare-edit-mode-icon cancel"
                         onClick={cancelTareChanges}
                         title="Değişiklikleri iptal et"
                         data-testid="tare-cancel-icon"
                       >
                         ↶
                       </span>
                     </div>
                   ) : (
                     <span 
                       className="tare-edit-icon"
                       onClick={toggleTareEdit}
                       title="ULD tipine göre otomatik. İhtiyaç olursa düzenleyin"
                       data-testid="tare-edit-icon"
                     >
                       ✎
                     </span>
                   )}
                 </div>
                 {errors.tare && (
                   <div className="error-message">
                     {errors.tare}
                   </div>
                 )}
                                   <div className={`current-weight-helper ${getTareHelper().type}`}>
                    <span className="helper-icon">ⓘ</span>
                    <span className="helper-text">{getTareHelper().text}</span>
                  </div>
               </div>
            </div>
            
            <div className="form-row">
                             <div className="form-group">
                 <label htmlFor="allowable" className="form-label">
                   Yüklenebilir Ağırlık (kg)
                 </label>
                   <div className="input-with-unit">
                     <input
                       type="number"
                       id="allowable"
                       name="allowable"
                       value={formData.allowable || ''}
                       className="form-input"
                       data-testid="allowable-input"
                       readOnly
                       disabled
                       autoComplete="off"
                       min="0"
                       max="999999"
                       step="0.1"
                       title="MGW - Tare formülü ile otomatik hesaplanır"
                     />
                     <span className="input-unit">kg</span>
                   </div>
                                                                      <div className={`current-weight-helper ${getAllowableHelper().type}`}>
                    <span className="helper-icon">ⓘ</span>
                    <span className="helper-text">{getAllowableHelper().text}</span>
                  </div>
               </div>
              
              <div className="form-group">
                 <label htmlFor="currentWeight" className="form-label">
                   Mevcut Ağırlık (kg)
                   <span className="label-required">*</span>
                 </label>
                 <input
                     type="number"
                     id="currentWeight"
                     name="currentWeight"
                     value={formData.currentWeight}
                     className={`form-input ${mobileClass} ${errors.currentWeight ? 'error' : ''} ${getCurrentWeightHelper().type === 'error' ? 'error' : ''}`}
                     onChange={handleInputChange}
                     data-testid="current-weight-input"
                     required
                     autoComplete="off"
                     placeholder="Ağırlık giriniz (kg)"
                     title="0 - Yüklenebilir Ağırlık aralığında olmalıdır"
                     disabled={!formData.uldType}
                     aria-disabled={!formData.uldType}
                     tabIndex={!formData.uldType ? -1 : 0}
                     min="0"
                     max="999999"
                     step="1"
                   />
                   {/* Error mesajı kaldırıldı - helper metni yeterli */}
                 
                   {/* Tek Satır Helper - Sabit Yükseklik */}
                   <div 
                     className={`current-weight-helper ${getCurrentWeightHelper().type}`} 
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
                </div>
            </div>
          </div>

          {/* Kapasite ve Hacim Bilgileri */}
          <div className={`form-section ${mobileClass}`}>
            <div className={`section-header ${mobileClass}`}>
              <h3 className={`section-title ${mobileClass}`}>
                KAPASİTE VE HACİM
              </h3>
            </div>
            
            <div className="form-row">
                             <div className="form-group">
                                   <label htmlFor="volume" className="form-label">
                    Hacim (m³)
                    {formData.uldType && uldTypes.find(uld => uld.value === formData.uldType)?.type === 'pallet' && (
                      <span className="label-optional"> (Opsiyonel)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    id="volume"
                    name="volume"
                    value={formData.volume}
                    className="form-input"
                    data-testid="volume-input"
                    readOnly={!formData.uldType || uldTypes.find(uld => uld.value === formData.uldType)?.type !== 'pallet'}
                    disabled={!formData.uldType || uldTypes.find(uld => uld.value === formData.uldType)?.type !== 'pallet'}
                    onChange={handleInputChange}
                    autoComplete="off"
                    step="0.1"
                    min="0"
                    max="999"
                    placeholder={formData.uldType && uldTypes.find(uld => uld.value === formData.uldType)?.type === 'pallet' ? "Yük konturüne göre" : ""}
                                         title={formData.uldType && uldTypes.find(uld => uld.value === formData.uldType)?.type === 'pallet' 
                       ? "Palet için opsiyonel - yük konturüne göre" 
                       : "ULD tipine göre otomatik"}
                  />
                 <div className={`form-helper-text ${getVolumeHelper().type}`}>
                   {getVolumeHelper().text}
                 </div>
               </div>
              
                                                           {/* Kapasite Kullanımı (%) Input - Kaldırıldı */}
            </div>

                         {/* Kapasite Bar */}
             {formData.capacityUsage && (
               <div className="capacity-bar-container" data-testid="capacity-bar-container">
                 <div className="capacity-bar">
                   <div 
                     className="capacity-bar-fill"
                     data-testid="capacity-bar-fill"
                     style={{ width: `${getCapacityBarPercentage()}%`, backgroundColor: getCapacityBarColor() }}
                   ></div>
                 </div>
                 <div className="capacity-bar-label" data-testid="capacity-bar-label">
                   Kapasite: {formatPercent(formData.capacityUsage)}%
                   {getOverflowInfo() && (
                     <span className="overflow-badge" data-testid="capacity-overflow-badge">
                       • Aşıldı: +{formatKg(getOverflowInfo().kg)} kg
                     </span>
                   )}
                 </div>
                 
                                   {/* Progress Bar Uyarı Metni - Kaldırıldı */}
               </div>
             )}

                         {/* Kapasite Uyarı Banner - Kaldırıldı */}

            <div className="form-row">
                             <div className="form-group">
                 <label htmlFor="remainingWeight" className="form-label">
                   Kalan Ağırlık (kg)
                 </label>
                 <input
                   type="text"
                   id="remainingWeight"
                   name="remainingWeight"
                   value={(() => {
                     const remaining = parseFloat(formData.remainingWeight) || 0;
                     if (remaining < 0) {
                       return `Kapasite ${formatKg(Math.abs(remaining))} kg aşıldı`;
                     }
                     return formData.remainingWeight ? `${formatKg(formData.remainingWeight)} kg` : '';
                   })()}
                   className={`form-input ${mobileClass} ${parseFloat(formData.remainingWeight) < 0 ? 'error' : ''}`}
                   data-testid="remaining-weight-input"
                   readOnly
                   disabled
                   autoComplete="off"
                   title="Yüklenebilir Ağırlık - Mevcut Ağırlık"
                 />
                 <div className={`form-helper-text ${getRemainingWeightHelper().type}`}>
                   {getRemainingWeightHelper().text}
                 </div>
               </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearForm}
              disabled={loading}
              data-testid="clear-uld-form-button"
            >
              Formu Temizle
            </button>
            
            <button
              type="submit"
              className={`btn ${isSubmitDisabled() ? 'btn-disabled' : 'btn-primary'}`}
              disabled={isSubmitDisabled()}
              data-testid="submit-uld-form-button"
              title={getSubmitButtonTooltip()}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Kaydediliyor...
                </>
              ) : (
                'ULD Kaydet'
              )}
            </button>

          </div>
        </form>
      </div>
    </div>

    
    {/* Toast Container kaldırıldı - sadece Dashboard'da olmalı */}
  </div>
  )
}

export default UldForm