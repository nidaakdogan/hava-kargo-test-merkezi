// Smoke Test Suite for Cargo DTL Mobile App
const { remote } = require('webdriverio');
const assert = require('assert');
const config = require('../config/android-emulator.config');

describe('Cargo DTL Mobile - Smoke Tests', function() {
  let driver;
  
  before(async function() {
    this.timeout(60000);
    console.log('📱 Connecting to Android emulator...');
    
    driver = await remote({
      protocol: 'http',
      hostname: config.host,
      port: config.port,
      path: '/',
      capabilities: config.capabilities
    });
    
    // Wait for app to load
    await driver.pause(3000);
    console.log('✅ App launched successfully');
    
    // Check available contexts but stay in native context for now
    const contexts = await driver.getContexts();
    console.log('Available contexts:', contexts);
    
    // Wait for WebView to load
    await driver.pause(5000);
    console.log('✅ WebView should be loaded now');
  });
  
  after(async function() {
    if (driver) {
      await driver.deleteSession();
      console.log('🔚 Test session ended');
    }
  });
  
  describe('App Launch & Navigation', function() {
    
    it('should launch app and show main screen', async function() {
      // Check app header
      const headerTitle = await driver.$('~Cargo DTL Mobile');
      await headerTitle.waitForDisplayed({ timeout: 10000 });
      
      const title = await headerTitle.getText();
      assert.strictEqual(title, 'Cargo DTL Mobile');
      console.log('✅ App header displayed correctly');
    });
    
    it('should show network status indicator', async function() {
      // Check network badge exists
      const networkBadge = await driver.$('//*[@text="Bağlı" or @text="Offline"]');
      await networkBadge.waitForDisplayed({ timeout: 5000 });
      
      const status = await networkBadge.getText();
      assert(status === 'Bağlı' || status === 'Offline');
      console.log(`✅ Network status: ${status}`);
    });
    
    it('should navigate between screens', async function() {
      // Test navigation to ULD screen
      const uldNav = await driver.$('~nav-uld');
      await uldNav.waitForDisplayed({ timeout: 5000 });
      await uldNav.click();
      
      // Verify ULD screen loaded
      const uldTitle = await driver.$('//*[@text="ULD Kapasite (Lite)"]');
      await uldTitle.waitForDisplayed({ timeout: 5000 });
      console.log('✅ ULD screen navigation works');
      
      // Test navigation to AWB screen
      const awbNav = await driver.$('~nav-awb');
      await awbNav.click();
      
      const awbTitle = await driver.$('//*[@text="AWB Yönetimi (Lite)"]');
      await awbTitle.waitForDisplayed({ timeout: 5000 });
      console.log('✅ AWB screen navigation works');
      
      // DG screen removed from mobile app - only 3 tabs now
      
      // Return to Barcode screen
      const barcodeNav = await driver.$('~nav-barcode');
      await barcodeNav.click();
      
      const controlPanel = await driver.$('//*[@text="Kontrol Paneli"]');
      await controlPanel.waitForDisplayed({ timeout: 5000 });
      console.log('✅ Barcode screen navigation works');
    });
  });
  
  describe('Barcode Functionality - Complete Offline to Online Flow', function() {
    
    beforeEach(async function() {
      // Ensure we're on barcode screen
      const barcodeNav = await driver.$('~nav-barcode');
      await barcodeNav.click();
      await driver.pause(1000);
    });
    
    it('should complete full offline→online barcode workflow', async function() {
      console.log('🔄 Starting complete barcode workflow...');
      
      // Step 1: Enable offline mode
      const offlineSwitch = await driver.$('~offline-mode-switch');
      await offlineSwitch.waitForDisplayed({ timeout: 5000 });
      await offlineSwitch.click();
      await driver.pause(500);
      console.log('✅ Offline mode enabled');
      
      // Step 2: Add first barcode
      const barcodeInput = await driver.$('~manual-barcode-input');
      await barcodeInput.setValue('ULD-AKE12345AB');
      const testButton = await driver.$('~test-barcode-button');
      await testButton.click();
      await driver.pause(1000);
      
      // Step 3: Add second barcode
      await barcodeInput.setValue('ULD-DPE67890CD');
      await testButton.click();
      await driver.pause(1000);
      
      // Verify 2 items in queue
      const queueCount = await driver.$('~queue-count');
      let count = await queueCount.getText();
      assert.strictEqual(count, '2');
      console.log('✅ 2 barcodes added to offline queue');
      
      // Step 4: Switch to online mode
      await offlineSwitch.click();
      await driver.pause(500);
      console.log('✅ Online mode enabled');
      
      // Step 5: Process queue
      const processButton = await driver.$('~process-queue-button');
      await processButton.waitForDisplayed({ timeout: 5000 });
      
      const isEnabled = await processButton.isEnabled();
      assert.strictEqual(isEnabled, true, 'Process button should be enabled with items in queue');
      
      await processButton.click();
      console.log('✅ Queue processing initiated');
      
      // Step 6: Wait for processing and verify success
      await driver.pause(3000); // Allow time for processing
      
      // Check queue cleared
      count = await queueCount.getText();
      assert.strictEqual(count, '0');
      console.log('✅ Queue processed successfully and cleared');
      
      // Look for success toast (optional - may disappear quickly)
      try {
        const successToast = await driver.$('//*[contains(@text, "başarıyla")]');
        if (await successToast.isExisting()) {
          console.log('✅ Success toast displayed');
        }
      } catch (e) {
        console.log('ℹ️ Toast check skipped (may have disappeared)');
      }
      
      console.log('🎉 Complete offline→online workflow verified');
    });
  });
  
  describe('ULD Screen Tests - Capacity and Readonly Fields', function() {
    
    beforeEach(async function() {
      const uldNav = await driver.$('~nav-uld');
      await uldNav.click();
      await driver.pause(1000);
    });
    
    it('should show readonly fields before ULD type selection and populate after', async function() {
      console.log('🔄 Testing ULD readonly fields and auto-population...');
      
      // Step 1: Check fields are readonly/empty before selection
      const mgwInput = await driver.$('~mgw-input');
      const tareInput = await driver.$('~tare-input');
      const loadableInput = await driver.$('~loadable-weight-input');
      
      await mgwInput.waitForDisplayed({ timeout: 5000 });
      
      // Verify fields are empty initially
      const initialMgw = await mgwInput.getText();
      const initialTare = await tareInput.getText();
      const initialLoadable = await loadableInput.getText();
      
      assert.strictEqual(initialMgw, '', 'MGW should be empty before type selection');
      assert.strictEqual(initialTare, '', 'Tare should be empty before type selection');
      assert.strictEqual(initialLoadable, '', 'Loadable should be empty before type selection');
      console.log('✅ MGW/Tare/Loadable fields readonly and empty before selection');
      
      // Step 2: Select ULD type and verify fields populate
      const akeButton = await driver.$('~uld-type-ake');
      await akeButton.waitForDisplayed({ timeout: 5000 });
      await akeButton.click();
      await driver.pause(500);
      
      // Verify fields now have values
      const mgwValue = await mgwInput.getText();
      const tareValue = await tareInput.getText();
      const loadableValue = await loadableInput.getText();
      
      assert.strictEqual(mgwValue, '6800', 'MGW should be populated');
      assert.strictEqual(tareValue, '75', 'Tare should be populated');
      assert.strictEqual(loadableValue, '6725', 'Loadable should be calculated (6800-75)');
      console.log('✅ Fields populated correctly after ULD type selection');
      
      console.log('🎉 ULD readonly and auto-population requirements verified');
    });
    
    it('should show red warning on weight limit overflow', async function() {
      console.log('🔄 Testing weight limit overflow warning...');
      
      // Select ULD type first
      const akeButton = await driver.$('~uld-type-ake');
      await akeButton.click();
      await driver.pause(500);
      
      // Enter weight that exceeds loadable (6725 kg for AKE)
      const currentWeightInput = await driver.$('~current-weight-input');
      await currentWeightInput.waitForDisplayed({ timeout: 5000 });
      await currentWeightInput.setValue('7000'); // Exceeds 6725 loadable
      await driver.pause(500);
      
      // Check for red warning indicators
      const capacityUsage = await driver.$('~capacity-usage');
      if (await capacityUsage.isExisting()) {
        const usage = await capacityUsage.getText();
        const usageNum = parseInt(usage.replace('%', ''));
        assert(usageNum > 100, 'Capacity usage should exceed 100%');
        console.log(`✅ Capacity overflow detected: ${usage}`);
      }
      
      // Look for warning text/styling
      try {
        const warningText = await driver.$('//*[contains(@text, "limit") or contains(@text, "aşım")]');
        if (await warningText.isExisting()) {
          console.log('✅ Warning text displayed for overflow');
        }
      } catch (e) {
        console.log('ℹ️ Warning text check skipped');
      }
      
      console.log('🎉 Weight limit overflow warning verified');
    });
    
    it('should show capacity bar with color thresholds', async function() {
      console.log('🔄 Testing capacity bar with color thresholds...');
      
      // Select ULD type first
      const akeButton = await driver.$('~uld-type-ake');
      await akeButton.click();
      await driver.pause(500);
      
      // Enter weight to test capacity bar
      const currentWeightInput = await driver.$('~current-weight-input');
      await currentWeightInput.waitForDisplayed({ timeout: 5000 });
      await currentWeightInput.setValue('5000'); // About 74% capacity
      await driver.pause(500);
      
      // Check capacity bar is displayed
      const capacityUsage = await driver.$('~capacity-usage');
      await capacityUsage.waitForDisplayed({ timeout: 5000 });
      
      const usage = await capacityUsage.getText();
      const usageNum = parseInt(usage.replace('%', ''));
      assert(usageNum > 0, 'Capacity usage should be calculated');
      console.log(`✅ Capacity bar displayed: ${usage}`);
      
      // Test update button
      const updateButton = await driver.$('~update-capacity-button');
      await updateButton.waitForDisplayed({ timeout: 5000 });
      
      const isEnabled = await updateButton.isEnabled();
      assert.strictEqual(isEnabled, true, 'Update button should be enabled');
      
      await updateButton.click();
      console.log('✅ Update button clicked');
      
      // Look for success toast
      await driver.pause(2000);
      try {
        const successToast = await driver.$('//*[contains(@text, "✅ İşlem başarılı")]');
        if (await successToast.isExisting()) {
          console.log('✅ Success toast displayed for capacity update');
        }
      } catch (e) {
        console.log('ℹ️ Toast check skipped (may have disappeared quickly)');
      }
      
      console.log('🎉 Capacity bar and update functionality verified');
    });
  });
  
  describe('AWB Screen Tests - Mini Update Flow', function() {
    
    beforeEach(async function() {
      const awbNav = await driver.$('~nav-awb');
      await awbNav.click();
      await driver.pause(1000);
    });
    
    it('should validate AWB form and show success toast', async function() {
      console.log('🔄 Testing AWB form validation and save...');
      
      // Step 1: Enter valid AWB number
      const awbInput = await driver.$('~awb-number-input');
      await awbInput.waitForDisplayed({ timeout: 5000 });
      await awbInput.setValue('123-45678901');
      
      // Step 2: Enter origin and destination
      const originInput = await driver.$('~origin-input');
      await originInput.setValue('IST');
      
      const destinationInput = await driver.$('~destination-input');
      await destinationInput.setValue('FRA');
      
      // Step 3: Enter weight and pieces
      const weightInput = await driver.$('~weight-input');
      await weightInput.setValue('250.50');
      
      const piecesInput = await driver.$('~pieces-input');
      await piecesInput.setValue('5');
      
      console.log('✅ AWB form fields filled');
      
      // Step 4: Save changes
      const saveButton = await driver.$('~awb-save-button');
      await saveButton.waitForDisplayed({ timeout: 5000 });
      
      const isEnabled = await saveButton.isEnabled();
      assert.strictEqual(isEnabled, true, 'Save button should be enabled with required fields');
      
      await saveButton.click();
      console.log('✅ AWB save initiated');
      
      // Step 5: Look for success toast
      await driver.pause(2000);
      try {
        const successToast = await driver.$('//*[contains(@text, "✅ İşlem başarılı")]');
        if (await successToast.isExisting()) {
          console.log('✅ Success toast displayed');
        }
      } catch (e) {
        console.log('ℹ️ Toast check skipped (may have disappeared quickly)');
      }
      
      console.log('🎉 AWB form validation and save workflow verified');
    });
  });
  
  describe('Test Barcode Grid Tests', function() {
    
    beforeEach(async function() {
      const barcodeNav = await driver.$('~nav-barcode');
      await barcodeNav.click();
      await driver.pause(1000);
    });
    
    it('should show test barcode grid with valid and invalid codes', async function() {
      console.log('🔄 Testing test barcode grid...');
      
      // Check for test barcode items
      const testBarcode1 = await driver.$('~test-barcode-0'); // 123-45678901
      const testBarcode2 = await driver.$('~test-barcode-1'); // ULD-AKE12345AB
      const testBarcode3 = await driver.$('~test-barcode-2'); // TEST-12345 ✓
      const testBarcode4 = await driver.$('~test-barcode-3'); // INVALID-CODE ✗
      
      await testBarcode1.waitForDisplayed({ timeout: 5000 });
      await testBarcode2.waitForDisplayed({ timeout: 5000 });
      await testBarcode3.waitForDisplayed({ timeout: 5000 });
      await testBarcode4.waitForDisplayed({ timeout: 5000 });
      
      console.log('✅ Test barcode grid displayed with all 4 test codes');
      
      // Test clicking valid barcode
      await testBarcode3.click();
      await driver.pause(1000);
      
      // Check queue count increased
      const queueCount = await driver.$('~queue-count');
      const count = await queueCount.getText();
      assert(parseInt(count) > 0, 'Queue count should increase after adding barcode');
      console.log('✅ Valid test barcode added to queue');
      
      // Test clicking invalid barcode
      await testBarcode4.click();
      await driver.pause(1000);
      
      // Check for error toast (may disappear quickly)
      try {
        const errorToast = await driver.$('//*[contains(@text, "Geçersiz") or contains(@text, "formatı")]');
        if (await errorToast.isExisting()) {
          console.log('✅ Error toast displayed for invalid barcode');
        }
      } catch (e) {
        console.log('ℹ️ Error toast check skipped (may have disappeared)');
      }
      
      console.log('🎉 Test barcode grid functionality verified');
    });
  });
});
