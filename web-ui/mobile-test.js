const wdio = require('webdriverio');

// Appium 2.0 Capabilities - Vendor Prefix ile
const caps = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': 'emulator-5554',
  'appium:appPackage': 'com.android.chrome',
  'appium:appActivity': 'com.google.android.apps.chrome.Main',
  'appium:noReset': true,
  'appium:newCommandTimeout': 3600,
  'appium:autoGrantPermissions': true
};

// Test Function
async function runMobileTest() {
  console.log('🚀 Mobil test başlıyor...');
  
  try {
    // Appium session başlat
    const driver = await wdio.remote({
      port: 4723,
      capabilities: caps
    });

    console.log('✅ Appium session başlatıldı');

    // Direkt bizim sayfayı aç
    console.log('🌐 Sayfa açılıyor...');
    await driver.url('http://192.168.1.101:5173/control-panel');
    console.log('✅ URL açıldı');
    
    // Çok uzun bekle
    console.log('⏳ Sayfa yüklenmesi bekleniyor (30 saniye)...');
    await driver.pause(30000);

    // Sayfa kaynak kodunu kontrol et
    console.log('📄 Sayfa kaynak kodu alınıyor...');
    const pageSource = await driver.getPageSource();
    console.log('📄 Sayfa kaynak kodu uzunluğu:', pageSource.length);
    
    if (pageSource.includes('Kontrol Paneli')) {
      console.log('✅ Sayfa içeriği yüklendi!');
    } else {
      console.log('❌ Sayfa içeriği yüklenmedi');
      console.log('📄 Sayfa içeriği:', pageSource.substring(0, 1000));
    }

    // Screenshot al
    await driver.saveScreenshot('./mobile-test-screenshot.png');
    console.log('📸 Screenshot alındı');

    // Session'ı kapat
    await driver.deleteSession();
    console.log('✅ Test tamamlandı');

  } catch (error) {
    console.error('❌ Test hatası:', error);
  }
}

// Test'i çalıştır
runMobileTest();
