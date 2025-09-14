const { remote } = require('webdriverio');

describe('Air Cargo ULD Mobile Tests', () => {
  let browser;

  before(async () => {
    // Appium bağlantı konfigürasyonu
    browser = await remote({
      hostname: 'localhost',
      port: 4723,
      path: '/wd/hub',
      capabilities: {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': 'Android Emulator',
        'appium:platformVersion': '11.0',
        'appium:appPackage': 'com.android.chrome',
        'appium:appActivity': 'com.google.android.apps.chrome.Main',
        'appium:noReset': true
      }
    });
  });

  after(async () => {
    if (browser) {
      await browser.deleteSession();
    }
  });

  it('ULD sayfasına gidiliyor', async () => {
    // ULD navigation linkine tıkla
    const uldNav = await browser.$('[data-testid="nav-uld"]');
    await uldNav.click();
    
    // ULD form başlığının görünmesini bekle
    const uldTitle = await browser.$('[data-testid="uld-form-title"]');
    await uldTitle.waitForDisplayed({ timeout: 10000 });
    
    // Başlık metnini kontrol et
    const titleText = await uldTitle.getText();
    expect(titleText).to.include('ULD Kapasite Yönetimi');
  });

  it('ULD form alanları görünüyor', async () => {
    // Form alanlarının görünür olduğunu kontrol et
    const uldCodeInput = await browser.$('[data-testid="uld-input-code"]');
    const typeSelect = await browser.$('[data-testid="uld-input-type"]');
    const maxWeightInput = await browser.$('[data-testid="uld-input-max-weight"]');
    const currentWeightInput = await browser.$('[data-testid="uld-input-current-weight"]');
    const volumeInput = await browser.$('[data-testid="uld-input-volume"]');
    
    await expect(uldCodeInput).to.be.displayed;
    await expect(typeSelect).to.be.displayed;
    await expect(maxWeightInput).to.be.displayed;
    await expect(currentWeightInput).to.be.displayed;
    await expect(volumeInput).to.be.displayed;
  });

  it('ULD tipi seçildiğinde otomatik ağırlık ve hacim dolduruluyor', async () => {
    // AKE tipini seç
    const typeSelect = await browser.$('[data-testid="uld-input-type"]');
    await typeSelect.selectByVisibleText('AKE (LD3 Container)');
    
    await browser.pause(1000);
    
    // Maksimum ağırlık otomatik dolduruldu mu kontrol et
    const maxWeightInput = await browser.$('[data-testid="uld-input-max-weight"]');
    const maxWeight = await maxWeightInput.getValue();
    expect(maxWeight).to.equal('1588');
    
    // Hacim otomatik dolduruldu mu kontrol et
    const volumeInput = await browser.$('[data-testid="uld-input-volume"]');
    const volume = await volumeInput.getValue();
    expect(volume).to.equal('4.3');
  });

  it('Test verisi oluşturma butonu çalışıyor', async () => {
    // Test verisi oluştur butonuna tıkla
    const generateButton = await browser.$('[data-testid="uld-generate-test"]');
    await generateButton.click();
    
    // Form alanlarının doldurulduğunu kontrol et
    const uldCodeInput = await browser.$('[data-testid="uld-input-code"]');
    await browser.pause(1000);
    
    const uldCode = await uldCodeInput.getValue();
    expect(uldCode).to.match(/^[A-Z]{3}\d{5}[A-Z]{2}$/);
    
    // ULD tipi seçildi mi kontrol et
    const typeSelect = await browser.$('[data-testid="uld-input-type"]');
    const selectedType = await typeSelect.getValue();
    expect(selectedType).to.not.equal('');
  });

  it('ULD kapasite uyarısı gösteriliyor', async () => {
    // Mevcut ağırlığı maksimum ağırlıktan fazla yap
    const currentWeightInput = await browser.$('[data-testid="uld-input-current-weight"]');
    await currentWeightInput.setValue('1700');
    
    // Kapasite uyarısının görünmesini bekle
    const capacityWarning = await browser.$('[data-testid="uld-capacity-warning"]');
    await capacityWarning.waitForDisplayed({ timeout: 5000 });
    
    // Uyarı metnini kontrol et
    const warningText = await capacityWarning.getText();
    expect(warningText).to.include('kapasitesi aşıldı');
  });

  it('Kapasite otomatik hesaplanıyor', async () => {
    // Mevcut ağırlığı geçerli bir değere ayarla
    const currentWeightInput = await browser.$('[data-testid="uld-input-current-weight"]');
    await currentWeightInput.setValue('1200');
    
    await browser.pause(1000);
    
    // Kapasite alanının otomatik hesaplandığını kontrol et
    const capacityInput = await browser.$('[data-testid="uld-input-capacity"]');
    const capacity = await capacityInput.getValue();
    
    // Hesaplama: 1200 / 1588 * 100 = 75.6%
    expect(parseFloat(capacity)).to.be.closeTo(75.6, 0.1);
  });

  it('ULD formu başarıyla kaydediliyor', async () => {
    // Formu kaydet butonuna tıkla
    const saveButton = await browser.$('[data-testid="uld-save-button"]');
    await saveButton.click();
    
    // Başarı mesajının görünmesini bekle
    const message = await browser.$('[data-testid="uld-form-message"]');
    await message.waitForDisplayed({ timeout: 10000 });
    
    // Mesaj metnini kontrol et
    const messageText = await message.getText();
    expect(messageText).to.include('başarıyla kaydedildi');
  });

  it('Dashboard\'a geri dönüş yapılıyor', async () => {
    // Dashboard navigation linkine tıkla
    const dashboardNav = await browser.$('[data-testid="nav-dashboard"]');
    await dashboardNav.click();
    
    // Dashboard başlığının görünmesini bekle
    const dashboardTitle = await browser.$('[data-testid="dashboard-title"]');
    await dashboardTitle.waitForDisplayed({ timeout: 10000 });
    
    // Başlık metnini kontrol et
    const titleText = await dashboardTitle.getText();
    expect(titleText).to.include('Test Laboratuvarı Dashboard');
  });
});
