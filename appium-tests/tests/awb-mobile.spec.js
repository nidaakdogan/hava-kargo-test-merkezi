const { remote } = require('webdriverio');

describe('Air Cargo AWB Mobile Tests', () => {
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

      it('Chrome\'da Air Cargo uygulaması açılıyor', async () => {
    // Chrome'u aç
    await browser.activateApp('com.android.chrome');
    
    // Adres çubuğuna git
    const addressBar = await browser.$('//android.widget.EditText[@resource-id="com.android.chrome:id/url_bar"]');
    await addressBar.click();
    
    // Web UI adresini gir (emülatör-localhost köprüsü)
    await addressBar.setValue('http://10.0.2.2:5173');
    
    // Enter tuşuna bas
    await browser.pressKeyCode(66); // Enter key code
    
    // Sayfa yüklenene kadar bekle
    await browser.pause(3000);
  });

  it('AWB sayfasına gidiliyor', async () => {
    // AWB navigation linkine tıkla
    const awbNav = await browser.$('[data-testid="nav-awb"]');
    await awbNav.click();
    
    // AWB form başlığının görünmesini bekle
    const awbTitle = await browser.$('[data-testid="awb-form-title"]');
    await awbTitle.waitForDisplayed({ timeout: 10000 });
    
    // Başlık metnini kontrol et
    const titleText = await awbTitle.getText();
    expect(titleText).to.include('AWB Yönetimi');
  });

  it('AWB form alanları görünüyor', async () => {
    // Form alanlarının görünür olduğunu kontrol et
    const awbNumberInput = await browser.$('[data-testid="awb-input-number"]');
    const originInput = await browser.$('[data-testid="awb-input-origin"]');
    const destinationInput = await browser.$('[data-testid="awb-input-destination"]');
    const weightInput = await browser.$('[data-testid="awb-input-weight"]');
    const piecesInput = await browser.$('[data-testid="awb-input-pieces"]');
    const flightInput = await browser.$('[data-testid="awb-input-flight"]');
    
    await expect(awbNumberInput).to.be.displayed;
    await expect(originInput).to.be.displayed;
    await expect(destinationInput).to.be.displayed;
    await expect(weightInput).to.be.displayed;
    await expect(piecesInput).to.be.displayed;
    await expect(flightInput).to.be.displayed;
  });

  it('Test verisi oluşturma butonu çalışıyor', async () => {
    // Test verisi oluştur butonuna tıkla
    const generateButton = await browser.$('[data-testid="awb-generate-test"]');
    await generateButton.click();
    
    // Form alanlarının doldurulduğunu kontrol et
    const awbNumberInput = await browser.$('[data-testid="awb-input-number"]');
    await browser.pause(1000);
    
    const awbNumber = await awbNumberInput.getValue();
    expect(awbNumber).to.match(/^123-\d{8}$/);
  });

  it('AWB formu başarıyla kaydediliyor', async () => {
    // Formu kaydet butonuna tıkla
    const saveButton = await browser.$('[data-testid="awb-save-button"]');
    await saveButton.click();
    
    // Başarı mesajının görünmesini bekle
    const message = await browser.$('[data-testid="awb-form-message"]');
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
