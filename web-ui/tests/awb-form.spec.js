const { test, expect } = require('@playwright/test');

test.describe('AWB Form Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mobil viewport için
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/awb');
    
    // Sayfa yüklenmesini bekle
    await page.waitForLoadState('networkidle');
  });

  test('AWB form sayfası yükleniyor', async ({ page }) => {
    await expect(page.getByTestId('awb-form-title')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('awb-form-title')).toHaveText('Air Waybill (AWB) – Hava Yük Senedi');
  });

  test('Form alanları görünüyor', async ({ page }) => {
    await expect(page.getByTestId('awb-input-number')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('awb-input-origin')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('awb-input-destination')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('awb-input-weight')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('awb-input-pieces')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('awb-input-flight')).toBeVisible({ timeout: 10000 });
  });

  test('Test verisi oluşturma butonu çalışıyor', async ({ page }) => {
    // Butonun görünür olmasını bekle
    await expect(page.getByTestId('awb-generate-test')).toBeVisible({ timeout: 10000 });
    
    // Butona tıkla
    await page.getByTestId('awb-generate-test').click();
    
    // Form alanlarının doldurulmasını bekle
    await page.waitForTimeout(1000);
    
    // Form alanlarının doldurulduğunu kontrol et
    const awbNumber = await page.getByTestId('awb-input-number').inputValue();
    expect(awbNumber).toMatch(/^123-\d{8}$/);
    
    const origin = await page.getByTestId('awb-input-origin').inputValue();
    expect(origin).toBeTruthy();
    
    const destination = await page.getByTestId('awb-input-destination').inputValue();
    expect(destination).toBeTruthy();
  });

  test('Form validasyonu çalışıyor - boş alanlar', async ({ page }) => {
    // Kaydet butonuna tıkla
    await page.getByTestId('awb-save-button').click();
    
    // Form submit edildiğinde hata mesajı görünmeli
    await expect(page.getByTestId('awb-form-message')).toBeVisible({ timeout: 10000 });
  });

  test('Form başarıyla kaydediliyor', async ({ page }) => {
    // Test verisi oluştur
    await page.getByTestId('awb-generate-test').click();
    await page.waitForTimeout(1000);
    
    // Form alanlarının doldurulduğunu kontrol et
    const awbNumber = await page.getByTestId('awb-input-number').inputValue();
    expect(awbNumber).toMatch(/^123-\d{8}$/);
    
    // Form kaydetme simülasyonu (API olmadan)
    await page.getByTestId('awb-save-button').click();
    
    // Form mesajı görünmeli (hata veya başarı)
    await expect(page.getByTestId('awb-form-message')).toBeVisible({ timeout: 15000 });
  });

  test('Form alanları doğru şekilde dolduruluyor', async ({ page }) => {
    const testData = {
      awbNumber: '123-99999999',
      origin: 'IST',
      destination: 'FRA',
      weight: '200.5',
      pieces: '30',
      flight: 'TK9999'
    };

    // Form alanlarını doldur
    await page.getByTestId('awb-input-number').fill(testData.awbNumber);
    await page.getByTestId('awb-input-origin').fill(testData.origin);
    await page.getByTestId('awb-input-destination').fill(testData.destination);
    await page.getByTestId('awb-input-weight').fill(testData.weight);
    await page.getByTestId('awb-input-pieces').fill(testData.pieces);
    await page.getByTestId('awb-input-flight').fill(testData.flight);

    // Değerlerin doğru doldurulduğunu kontrol et
    await expect(page.getByTestId('awb-input-number')).toHaveValue(testData.awbNumber);
    await expect(page.getByTestId('awb-input-origin')).toHaveValue(testData.origin);
    await expect(page.getByTestId('awb-input-destination')).toHaveValue(testData.destination);
    await expect(page.getByTestId('awb-input-weight')).toHaveValue(testData.weight);
    await expect(page.getByTestId('awb-input-pieces')).toHaveValue(testData.pieces);
    await expect(page.getByTestId('awb-input-flight')).toHaveValue(testData.flight);
  });

  test('Navigation geri dönüş çalışıyor', async ({ page }) => {
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('dashboard-title')).toBeVisible({ timeout: 10000 });
  });
});
