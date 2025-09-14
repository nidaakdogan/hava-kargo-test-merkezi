import { test, expect } from '@playwright/test'

test.describe('ULD Web Demo - Adım Sırası ve Toast Testleri', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/uld-form')
    await page.waitForLoadState('networkidle')
  })

  test('ULD Demo Adım Sırası - Tam Akış', async ({ page }) => {
    // Adım 1: Uçak Tipi seçimi (Opsiyonel)
    await page.selectOption('[data-testid="aircraft-select"]', 'B777')
    await page.waitForTimeout(100) // Dropdown menü kapanması için bekleme
    
    // Toast kontrolü
    await expect(page.locator('.toast.toast-success')).toBeVisible()
    await expect(page.locator('.toast.toast-success')).toContainText('Uçak Tipi seçildi: B777')
    
    // Adım 2: Havayolu seçimi (Opsiyonel)
    await page.selectOption('[data-testid="airline-select"]', 'TK')
    await page.waitForTimeout(100)
    
    // Toast kontrolü
    await expect(page.locator('.toast.toast-success')).toBeVisible()
    await expect(page.locator('.toast.toast-success')).toContainText('Havayolu seçildi: TK')
    
    // Adım 3: ULD Kodu girişi (Zorunlu)
    await page.fill('[data-testid="uld-code-input"]', 'AKE12345AB')
    await page.waitForTimeout(100)
    
    // Toast kontrolü
    await expect(page.locator('.toast.toast-success')).toBeVisible()
    await expect(page.locator('.toast.toast-success')).toContainText('ULD Kodu girildi: AKE12345AB')
    
    // Adım 4: ULD Tipi seçimi (Zorunlu)
    await page.selectOption('[data-testid="uld-type-select"]', 'AKE')
    await page.waitForTimeout(100)
    
    // Toast kontrolü
    await expect(page.locator('.toast.toast-success')).toBeVisible()
    await expect(page.locator('.toast.toast-success')).toContainText('ULD Tipi seçildi: AKE')
    
    // ULD tipi hazır sinyali kontrolü
    await expect(page.locator('[data-testid="uld-limits-ready"][data-ready="true"]')).toBeVisible()
    
    // Adım 5: Mevcut Ağırlık girişi (Zorunlu) - Limit aşımı senaryosu
    await page.fill('[data-testid="current-weight-input"]', '1600')
    await page.waitForTimeout(100)
    
    // Toast kontrolü - Uyarı
    await expect(page.locator('.toast.toast-warning')).toBeVisible()
    await expect(page.locator('.toast.toast-warning')).toContainText('Mevcut ağırlık girildi: 1600 kg – Limit aşıldı')
    
    // Limit aşımı uyarısı kontrolü
    await expect(page.locator('.current-weight-helper.error')).toContainText('❌ Limit aşıldı')
    
    // Adım 6: ULD Kaydet (Zorunlu)
    await page.click('[data-testid="submit-uld-form-button"]')
    
    // Toast kontrolü - Hata
    await expect(page.locator('.toast.toast-error')).toBeVisible()
    await expect(page.locator('.toast.toast-error')).toContainText('Kayıt başarısız – Kapasite aşıldı')
  })

  test('Adım Gating Sistemi - Sıralı Aktivasyon', async ({ page }) => {
    // İlk durumda sadece uçak tipi ve havayolu aktif olmalı
    await expect(page.locator('[data-testid="aircraft-select"]')).toBeEnabled()
    await expect(page.locator('[data-testid="airline-select"]')).toBeEnabled()
    await expect(page.locator('[data-testid="uld-code-input"]')).toBeEnabled()
    
    // ULD tipi ve mevcut ağırlık başlangıçta aktif olmamalı
    await expect(page.locator('[data-testid="uld-type-select"]')).toBeEnabled() // ULD kodu girilmeden önce aktif
    await expect(page.locator('[data-testid="current-weight-input"]')).toBeDisabled()
    
    // ULD kodu girildikten sonra ULD tipi aktif kalmalı
    await page.fill('[data-testid="uld-code-input"]', 'AKE12345AB')
    await expect(page.locator('[data-testid="uld-type-select"]')).toBeEnabled()
    await expect(page.locator('[data-testid="current-weight-input"]')).toBeDisabled()
    
    // ULD tipi seçildikten sonra mevcut ağırlık aktif olmalı
    await page.selectOption('[data-testid="uld-type-select"]', 'AKE')
    await page.waitForTimeout(100) // Hazır sinyali için bekleme
    await expect(page.locator('[data-testid="current-weight-input"]')).toBeEnabled()
  })

  test('Dropdown Seçimlerinin UI\'da Görünmesi', async ({ page }) => {
    // Uçak tipi seçimi
    await page.selectOption('[data-testid="aircraft-select"]', 'B777')
    await expect(page.locator('[data-testid="aircraft-select"]')).toHaveValue('B777')
    
    // Havayolu seçimi
    await page.selectOption('[data-testid="airline-select"]', 'TK')
    await expect(page.locator('[data-testid="airline-select"]')).toHaveValue('TK')
    
    // ULD tipi seçimi
    await page.selectOption('[data-testid="uld-type-select"]', 'AKE')
    await expect(page.locator('[data-testid="uld-type-select"]')).toHaveValue('AKE')
    
    // Seçilen değerlerin dropdown'larda görünür olduğunu kontrol et
    await expect(page.locator('[data-testid="aircraft-select"] option[value="B777"]')).toBeVisible()
    await expect(page.locator('[data-testid="airline-select"] option[value="TK"]')).toBeVisible()
    await expect(page.locator('[data-testid="uld-type-select"] option[value="AKE"]')).toBeVisible()
  })

  test('Toast Süresi ve Stack Davranışı', async ({ page }) => {
    // Hızlı ardışık işlemler
    await page.selectOption('[data-testid="aircraft-select"]', 'B777')
    await page.selectOption('[data-testid="airline-select"]', 'TK')
    await page.fill('[data-testid="uld-code-input"]', 'AKE12345AB')
    
    // Birden fazla toast'un görünür olduğunu kontrol et
    await expect(page.locator('.toast')).toHaveCount(3)
    
    // Toast'ların 3-4 saniye sonra kaybolduğunu kontrol et
    await page.waitForTimeout(4000)
    await expect(page.locator('.toast')).toHaveCount(0)
  })

  test('Zorunlu Alan Validasyonu', async ({ page }) => {
    // Boş form ile kaydet butonuna tıklama
    await expect(page.locator('[data-testid="submit-uld-form-button"]')).toBeDisabled()
    
    // ULD kodu olmadan
    await page.selectOption('[data-testid="uld-type-select"]', 'AKE')
    await expect(page.locator('[data-testid="submit-uld-form-button"]')).toBeDisabled()
    
    // ULD kodu ile ama ULD tipi olmadan
    await page.fill('[data-testid="uld-code-input"]', 'AKE12345AB')
    await page.selectOption('[data-testid="uld-type-select"]', '')
    await expect(page.locator('[data-testid="submit-uld-form-button"]')).toBeDisabled()
    
    // Tüm zorunlu alanlar dolu
    await page.selectOption('[data-testid="uld-type-select"]', 'AKE')
    await page.waitForTimeout(100)
    await page.fill('[data-testid="current-weight-input"]', '1000')
    await expect(page.locator('[data-testid="submit-uld-form-button"]')).toBeEnabled()
  })

  test('Demo Step Panel Güncellemeleri', async ({ page }) => {
    // Demo step panel'in görünür olduğunu kontrol et
    await expect(page.locator('.demo-step-panel')).toBeVisible()
    
    // Adımları sırayla gerçekleştir ve panel güncellemelerini kontrol et
    await page.selectOption('[data-testid="aircraft-select"]', 'B777')
    await page.waitForTimeout(100)
    
    // Panel'de adım görünür olmalı
    await expect(page.locator('.demo-step')).toContainText('Uçak Tipi seçildi')
    
    await page.selectOption('[data-testid="airline-select"]', 'TK')
    await page.waitForTimeout(100)
    
    await page.fill('[data-testid="uld-code-input"]', 'AKE12345AB')
    await page.waitForTimeout(100)
    
    await page.selectOption('[data-testid="uld-type-select"]', 'AKE')
    await page.waitForTimeout(100)
    
    await page.fill('[data-testid="current-weight-input"]', '1600')
    await page.waitForTimeout(100)
    
    // Son 5 adımın panel'de görünür olduğunu kontrol et
    await expect(page.locator('.demo-step')).toHaveCount(5)
  })
})
