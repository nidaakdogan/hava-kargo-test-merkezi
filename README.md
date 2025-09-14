# Hava Kargo Test Merkezi

Web & mobil test arayüzü + Appium destekli test otomasyonu ile geliştirilmiş hava kargo senaryoları.

## 🚀 Özellikler

- **Web UI**: React + Vite ile modern arayüz
- **Mobile App**: PWA destekli mobil uygulama
- **Test Otomasyonu**: Appium ile E2E testler
- **Mock API**: Test verileri için backend simülasyonu
- **Native Android**: Kotlin ile geliştirilmiş WebView uygulaması

## 📱 Teknolojiler

- **Frontend**: React, Vite, CSS3
- **Mobile**: PWA, React Native
- **Testing**: Appium, Playwright
- **Backend**: Node.js, Express
- **Android**: Kotlin, Gradle

## 🛠️ Kurulum

```bash
# Web UI
cd web-ui
npm install
npm run dev

# Mobile App
cd mobile-app
npm install
npm start

# Test Otomasyonu
cd appium-tests
npm install
npm run test:e2e:android
```

## 📋 Test Senaryoları

- AWB (Air Waybill) form testleri
- ULD (Unit Load Device) yükleme testleri
- DG (Dangerous Goods) kontrol testleri
- Barkod tarama testleri
- Offline kuyruk testleri

## 🔧 Gereksinimler

- Node.js 18+
- Android Studio
- JDK 17
- Appium Server

## 📄 Lisans

MIT License