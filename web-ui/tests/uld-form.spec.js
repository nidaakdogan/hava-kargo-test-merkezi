const { test, expect } = require('@playwright/test');

test.describe('ULD Web Test Akışı', () => {
  test.beforeEach(async ({ page }) => {
    // Desktop viewport için
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/uld');
    
    // Sayfa yüklenmesini bekle
    await page.waitForLoadState('networkidle');
  });

  test('ULD Web Test Akışı - Kapasite Aşımı Senaryosu', async ({ page }) => {
    console.log('🚀 ULD Web Testi başladı');
    
    // Yardımcı fonksiyon: Adım kapısı kontrolü
    const waitForStepGate = async (selector, timeout = 5000, stepName = '') => {
      try {
        await expect(page.getByTestId(selector)).toBeVisible({ timeout });
        await expect(page.getByTestId(selector)).toBeEnabled({ timeout });
        return true;
      } catch (error) {
        console.log(`❌ Adım kapısı başarısız: ${stepName} - ${selector} hazır değil`);
        throw new Error(`Adım tamamlanamadı: ${stepName} - ${selector} ${timeout}ms içinde hazır olmadı`);
      }
    };

    // Yardımcı fonksiyon: Değer kontrolü
    const waitForValue = async (selector, expectedValue, timeout = 3000) => {
      try {
        await expect(page.getByTestId(selector)).toHaveValue(expectedValue, { timeout });
        return true;
      } catch (error) {
        console.log(`❌ Değer kontrolü başarısız: ${selector} = ${expectedValue}`);
        throw new Error(`Değer kontrolü başarısız: ${selector} beklenen değeri almadı`);
      }
    };

    // 1. ULD Kapasite sayfası açılır
    await expect(page.getByTestId('uld-form-title')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('uld-form-title')).toHaveText('ULD Kapasite Yönetimi');
    console.log('✅ ULD sayfası açıldı');

    // 2. ULD Tipi seçilir (AKE - LD3) - KRİTİK ADIM
    await waitForStepGate('uld-type-select', 5000, 'ULD Tipi seçimi');
    await page.getByTestId('uld-type-select').selectOption('AKE');
    
    // HAZIR SİNYALİ KONTROL ET - Bu olmadan devam etme!
    await expect(page.getByTestId('uld-limits-ready')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('uld-limits-ready')).toHaveAttribute('data-ready', 'true');
    
    // Limitlerin doldurulduğunu kontrol et
    await waitForValue('max-weight-input', '1588', 3000);
    await waitForValue('tare-input', '82', 3000);
    await waitForValue('allowable-input', '1506', 3000);
    console.log('✅ ULD tipi seçildi ve hazır sinyali alındı - limitler hazır');

    // 3. ULD Kodu girilir
    await waitForStepGate('uld-code-input', 3000, 'ULD Kodu girişi');
    await page.getByTestId('uld-code-input').fill('AKE12345AB');
    await waitForValue('uld-code-input', 'AKE12345AB', 2000);
    console.log('✅ ULD kodu girildi');

    // 4. (Opsiyonel) Uçak Tipi seçilir
    await waitForStepGate('aircraft-select', 3000, 'Uçak Tipi seçimi');
    await page.getByTestId('aircraft-select').selectOption('B777');
    await page.waitForTimeout(500); // Dropdown kapanması için kısa bekleme
    console.log('✅ Uçak tipi seçildi');

    // 5. (Opsiyonel) Havayolu seçilir
    await waitForStepGate('airline-select', 3000, 'Havayolu seçimi');
    await page.getByTestId('airline-select').selectOption('TK');
    await page.waitForTimeout(500); // Dropdown kapanması için kısa bekleme
    console.log('✅ Havayolu seçildi');

    // 6. Mevcut Ağırlık girilir (limit üstü değer - 1600 kg)
    await waitForStepGate('current-weight-input', 3000, 'Mevcut Ağırlık girişi');
    await page.getByTestId('current-weight-input').fill('1600');
    await waitForValue('current-weight-input', '1600', 2000);
    
    // Kapasite aşımı uyarısı kontrol et - KRİTİK!
    await expect(page.getByTestId('capacity-bar-container')).toBeVisible({ timeout: 3000 });
    await expect(page.getByTestId('capacity-overflow-badge')).toBeVisible({ timeout: 3000 });
    
    // Kalan ağırlık negatif olmalı (aşım)
    const remainingWeight = page.getByTestId('remaining-weight-input');
    await expect(remainingWeight).toContainText('Kapasite', { timeout: 3000 });
    console.log('✅ Mevcut ağırlık girildi - kapasite aşımı tespit edildi');

    // 7. Kaydet butonunun aktif olduğunu kontrol et - KORUYUCU KİLİT
    const saveButton = page.getByTestId('submit-uld-form-button');
    await expect(saveButton).toBeEnabled({ timeout: 5000 });
    
    // Zorunlu alanların dolu olduğunu doğrula
    await waitForValue('uld-type-select', 'AKE', 1000);
    await waitForValue('uld-code-input', 'AKE12345AB', 1000);
    await waitForValue('current-weight-input', '1600', 1000);
    
    await saveButton.click();
    await page.waitForTimeout(2000); // API yanıtı için bekle
    
    // 8. Hata mesajı kontrol et - Kayıt reddedilmeli
    const formMessage = page.getByTestId('uld-form-message');
    await expect(formMessage).toBeVisible({ timeout: 10000 });
    
    // Hata mesajı içeriğini kontrol et
    const messageText = await formMessage.textContent();
    expect(messageText).toMatch(/kapasite|aşıldı|başarısız/i);
    console.log('✅ Kayıt reddedildi - kapasite aşımı mesajı görüntülendi');

    // 9. Toast mesajları kontrol et
    const toast = page.locator('.toast');
    if (await toast.isVisible()) {
      const toastText = await toast.textContent();
      console.log('📱 Toast mesajı:', toastText);
    }

    console.log('🎉 ULD Web Testi tamamlandı - Kapasite aşımı senaryosu başarılı');
  });

  test('ULD form alanları doğru sırayla dolduruluyor', async ({ page }) => {
    // ULD tipi seçilmeden önce ağırlık alanı disabled olmalı
    const currentWeightInput = page.getByTestId('current-weight-input');
    await expect(currentWeightInput).toBeDisabled();
    
    // ULD tipi seç
    await page.getByTestId('uld-type-select').selectOption('AKE');
    await page.waitForTimeout(1000);
    
    // Artık ağırlık alanı aktif olmalı
    await expect(currentWeightInput).toBeEnabled();
    
    // Form alanlarının doldurulduğunu kontrol et
    await expect(page.getByTestId('max-weight-input')).toHaveValue('1588');
    await expect(page.getByTestId('tare-input')).toHaveValue('82');
    await expect(page.getByTestId('allowable-input')).toHaveValue('1506');
  });

  test('ULD form validasyonu çalışıyor', async ({ page }) => {
    // Boş form ile kaydet
    await page.getByTestId('submit-uld-form-button').click();
    
    // Hata mesajı görünmeli
    await expect(page.locator('.form-message')).toBeVisible({ timeout: 10000 });
  });

  test('ULD form temizleme çalışıyor', async ({ page }) => {
    // Form doldur
    await page.getByTestId('uld-type-select').selectOption('AKE');
    await page.getByTestId('uld-code-input').fill('TEST123');
    await page.getByTestId('current-weight-input').fill('1000');
    
    // Formu temizle
    await page.getByTestId('clear-uld-form-button').click();
    
    // Alanların temizlendiğini kontrol et
    await expect(page.getByTestId('uld-code-input')).toHaveValue('');
    await expect(page.getByTestId('current-weight-input')).toHaveValue('');
  });

  test('ULD kapasite hesaplamaları doğru çalışıyor', async ({ page }) => {
    // AKE tipini seç
    await page.getByTestId('uld-type-select').selectOption('AKE');
    await page.waitForTimeout(1000);
    
    // MGW = 1588, Tare = 82, Allowable = 1506
    await expect(page.getByTestId('max-weight-input')).toHaveValue('1588');
    await expect(page.getByTestId('tare-input')).toHaveValue('82');
    await expect(page.getByTestId('allowable-input')).toHaveValue('1506');
    
    // Mevcut ağırlık gir (1500 kg - %99.6)
    await page.getByTestId('current-weight-input').fill('1500');
    await page.waitForTimeout(1000);
    
    // Kapasite kullanımı kontrol et
    const capacityBar = page.locator('.capacity-bar-label');
    await expect(capacityBar).toContainText('99.6%');
    
    // Kalan ağırlık kontrol et
    const remainingWeight = page.getByTestId('remaining-weight-input');
    await expect(remainingWeight).toContainText('6 kg');
  });

  test('ULD form responsive tasarım', async ({ page }) => {
    // Mobil viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    
    // Form alanları görünür olmalı
    await expect(page.getByTestId('uld-form-title')).toBeVisible();
    await expect(page.getByTestId('uld-type-select')).toBeVisible();
    await expect(page.getByTestId('uld-code-input')).toBeVisible();
  });
});
