const { remote } = require('webdriverio');

describe('Air Cargo DG Mobile Tests', () => {
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

  it('DG sayfasına gidiliyor', async () => {
    // DG navigation linkine tıkla
    const dgNav = await browser.$('[data-testid="nav-dg"]');
    await dgNav.click();
    
    // DG form başlığının görünmesini bekle
    const dgTitle = await browser.$('[data-testid="dg-form-title"]');
    await dgTitle.waitForDisplayed({ timeout: 10000 });
    
    // Başlık metnini kontrol et
    const titleText = await dgTitle.getText();
    expect(titleText).to.include('Tehlikeli Madde (DG) Formu');
  });

  it('DG form alanları görünüyor', async () => {
    // Form alanlarının görünür olduğunu kontrol et
    const awbSelect = await browser.$('[data-testid="dg-input-awb"]');
    const unNumberInput = await browser.$('[data-testid="dg-input-un-number"]');
    const classSelect = await browser.$('[data-testid="dg-input-class"]');
    const packingGroupSelect = await browser.$('[data-testid="dg-input-packing-group"]');
    const quantityInput = await browser.$('[data-testid="dg-input-quantity"]');
    const descriptionInput = await browser.$('[data-testid="dg-input-description"]');
    
    await expect(awbSelect).to.be.displayed;
    await expect(unNumberInput).to.be.displayed;
    await expect(classSelect).to.be.displayed;
    await expect(packingGroupSelect).to.be.displayed;
    await expect(quantityInput).to.be.displayed;
    await expect(descriptionInput).to.be.displayed;
  });

  it('Test verisi oluşturma butonu çalışıyor', async () => {
    // Test verisi oluştur butonuna tıkla
    const generateButton = await browser.$('[data-testid="dg-generate-test"]');
    await generateButton.click();
    
    // Form alanlarının doldurulduğunu kontrol et
    const unNumberInput = await browser.$('[data-testid="dg-input-un-number"]');
    await browser.pause(1000);
    
    const unNumber = await unNumberInput.getValue();
    expect(unNumber).to.match(/^UN\d{4}$/);
  });

  it('DG form validasyonu çalışıyor', async () => {
    // Geçersiz UN numarası gir
    const unNumberInput = await browser.$('[data-testid="dg-input-un-number"]');
    await unNumberInput.setValue('INVALID');
    
    // Formu kaydet butonuna tıkla
    const saveButton = await browser.$('[data-testid="dg-save-button"]');
    await saveButton.click();
    
    // Validation error mesajının görünmesini bekle
    const errorMessage = await browser.$('[data-testid="dg-error-un"]');
    await errorMessage.waitForDisplayed({ timeout: 5000 });
    
    // Hata mesajını kontrol et
    const errorText = await errorMessage.getText();
    expect(errorText).to.include('UN ile başlamalı');
  });

  it('DG formu başarıyla kaydediliyor', async () => {
    // Geçerli verilerle formu doldur
    const unNumberInput = await browser.$('[data-testid="dg-input-un-number"]');
    await unNumberInput.setValue('UN1203');
    
    const classSelect = await browser.$('[data-testid="dg-input-class"]');
    await classSelect.selectByVisibleText('Sınıf 3');
    
    const packingGroupSelect = await browser.$('[data-testid="dg-input-packing-group"]');
    await packingGroupSelect.selectByVisibleText('Grup II');
    
    const quantityInput = await browser.$('[data-testid="dg-input-quantity"]');
    await quantityInput.setValue('50.0');
    
    const descriptionInput = await browser.$('[data-testid="dg-input-description"]');
    await descriptionInput.setValue('Test DG');
    
    // Formu kaydet butonuna tıkla
    const saveButton = await browser.$('[data-testid="dg-save-button"]');
    await saveButton.click();
    
    // Başarı mesajının görünmesini bekle
    const message = await browser.$('[data-testid="dg-form-message"]');
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
