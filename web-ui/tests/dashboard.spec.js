const { test, expect } = require('@playwright/test');

test.describe('Dashboard Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Dashboard yükleniyor ve başlık görünüyor', async ({ page }) => {
    await expect(page.getByTestId('dashboard-title')).toBeVisible();
    await expect(page.getByTestId('dashboard-title')).toHaveText('Test Laboratuvarı Dashboard');
  });

  test('İstatistik kartları görünüyor', async ({ page }) => {
    await expect(page.getByTestId('stat-total-tests')).toBeVisible();
    await expect(page.getByTestId('stat-passed-tests')).toBeVisible();
    await expect(page.getByTestId('stat-failed-tests')).toBeVisible();
    await expect(page.getByTestId('stat-success-rate')).toBeVisible();
  });

  test('Navigation menüsü çalışıyor', async ({ page }) => {
    await expect(page.getByTestId('nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-awb')).toBeVisible();
    await expect(page.getByTestId('nav-uld')).toBeVisible();
    await expect(page.getByTestId('nav-dg')).toBeVisible();
    await expect(page.getByTestId('nav-scan')).toBeVisible();
  });

  test('AWB sayfasına geçiş yapılıyor', async ({ page }) => {
    await page.getByTestId('nav-awb').click();
    await expect(page.getByTestId('awb-form-title')).toBeVisible();
    await expect(page.getByTestId('awb-form-title')).toHaveText('Air Waybill (AWB) – Hava Yük Senedi');
  });

  test('ULD sayfasına geçiş yapılıyor', async ({ page }) => {
    await page.getByTestId('nav-uld').click();
    await expect(page.getByTestId('uld-form-title')).toBeVisible();
    await expect(page.getByTestId('uld-form-title')).toHaveText('ULD Kapasite Yönetimi');
  });

  test('DG sayfasına geçiş yapılıyor', async ({ page }) => {
    await page.getByTestId('nav-dg').click();
    await expect(page.getByTestId('dg-form-title')).toBeVisible();
    await expect(page.getByTestId('dg-form-title')).toHaveText('Tehlikeli Madde (DG) Formu');
  });

  test('Barkod simülasyonu sayfasına geçiş yapılıyor', async ({ page }) => {
    await page.getByTestId('nav-scan').click();
    await expect(page.getByTestId('scan-simulator-title')).toBeVisible();
    await expect(page.getByTestId('scan-simulator-title')).toHaveText('Barkod Simülasyonu');
  });

  test('Dashboard\'a geri dönüş yapılıyor', async ({ page }) => {
    await page.getByTestId('nav-awb').click();
    await page.getByTestId('nav-dashboard').click();
    await expect(page.getByTestId('dashboard-title')).toBeVisible();
  });
});
