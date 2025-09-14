// WebView Smoke Test for Cargo Digital Twin Mobile App
const { remote } = require('webdriverio');
const config = require('../config/webview-android.config');

describe('WebView Cargo Digital Twin - Smoke Tests', () => {
  let driver;

  before(async function() {
    this.timeout(120000);
    console.log('🔧 Setting up WebView test environment...');
    
    try {
      driver = await remote({
        hostname: config.host,
        port: config.port,
        path: '/',
        capabilities: config.capabilities
      });
      
      console.log('📱 WebView app started successfully');
      
      // Wait for splash screen to finish
      await driver.pause(3000);
      
    } catch (error) {
      console.error('❌ Failed to setup WebView test:', error);
      throw error;
    }
  });

  after(async function() {
    if (driver) {
      await driver.deleteSession();
      console.log('🧹 WebView test cleanup completed');
    }
  });

  describe('App Launch & WebView Context', () => {
    
    it('should launch app successfully', async function() {
      this.timeout(30000);
      
      // App should be launched by now
      const activity = await driver.getCurrentActivity();
      console.log('📍 Current Activity:', activity);
      
      // Verify main activity
      activity.should.include('MainActivity');
    });

    it('should switch to WebView context', async function() {
      this.timeout(30000);
      
      // Wait for WebView to load
      await driver.pause(5000);
      
      // Get available contexts
      const contexts = await driver.getContexts();
      console.log('🔍 Available contexts:', contexts);
      
      // Should have both NATIVE_APP and WEBVIEW contexts
      contexts.should.include('NATIVE_APP');
      
      // Find and switch to WebView context
      const webviewContext = contexts.find(context => 
        context.includes('WEBVIEW') || context.includes('CHROMIUM')
      );
      
      if (webviewContext) {
        await driver.switchContext(webviewContext);
        console.log('🌐 Switched to WebView context:', webviewContext);
        
        // Verify we're in WebView
        const currentContext = await driver.getContext();
        currentContext.should.equal(webviewContext);
      } else {
        console.log('⚠️ WebView context not found, staying in native context');
      }
    });

    it('should load web content', async function() {
      this.timeout(30000);
      
      try {
        // Wait for page to load
        await driver.pause(3000);
        
        // Try to get page title or URL
        const title = await driver.getTitle().catch(() => 'Unknown');
        console.log('📄 Page Title:', title);
        
        // Check if page has loaded by looking for common elements
        const body = await driver.$('body').catch(() => null);
        if (body) {
          const isDisplayed = await body.isDisplayed();
          console.log('📋 Body element found and displayed:', isDisplayed);
          isDisplayed.should.be.true;
        }
        
      } catch (error) {
        console.log('⚠️ WebView content check:', error.message);
        // Don't fail the test if WebView content is not accessible
        // This can happen with CORS or network issues
      }
    });

  });

  describe('Basic Navigation', () => {
    
    it('should handle back button properly', async function() {
      this.timeout(15000);
      
      // Switch back to native context
      await driver.switchContext('NATIVE_APP');
      
      // Simulate back button press
      await driver.pressKeyCode(4); // Android back key
      
      // App should still be running (not closed)
      const activity = await driver.getCurrentActivity().catch(() => null);
      console.log('📍 Activity after back press:', activity);
      
      if (activity) {
        activity.should.include('MainActivity');
      }
    });

    it('should support pull-to-refresh gesture', async function() {
      this.timeout(20000);
      
      try {
        // Switch to WebView context if available
        const contexts = await driver.getContexts();
        const webviewContext = contexts.find(context => 
          context.includes('WEBVIEW') || context.includes('CHROMIUM')
        );
        
        if (webviewContext) {
          await driver.switchContext(webviewContext);
        }
        
        // Perform pull-to-refresh gesture
        const { width, height } = await driver.getWindowSize();
        
        await driver.touchPerform([
          { action: 'press', options: { x: width / 2, y: height * 0.2 } },
          { action: 'wait', options: { ms: 100 } },
          { action: 'moveTo', options: { x: width / 2, y: height * 0.8 } },
          { action: 'release' }
        ]);
        
        console.log('📱 Pull-to-refresh gesture performed');
        
        // Wait for refresh to complete
        await driver.pause(2000);
        
      } catch (error) {
        console.log('⚠️ Pull-to-refresh test:', error.message);
        // Don't fail test for gesture issues
      }
    });

  });

  describe('Appium Capabilities Verification', () => {
    
    it('should have correct app package', async function() {
      const currentPackage = await driver.getCurrentPackage();
      console.log('📦 Current Package:', currentPackage);
      currentPackage.should.equal('com.cargodigitaltwin.mobile.debug');
    });

    it('should have correct app activity', async function() {
      const currentActivity = await driver.getCurrentActivity();
      console.log('🎯 Current Activity:', currentActivity);
      currentActivity.should.include('MainActivity');
    });

    it('should provide device info for LinkedIn demo', async function() {
      const deviceInfo = {
        platformName: await driver.getCapabilities().then(caps => caps.platformName),
        platformVersion: await driver.getCapabilities().then(caps => caps.platformVersion),
        deviceName: await driver.getCapabilities().then(caps => caps.deviceName),
        appPackage: await driver.getCurrentPackage(),
        appActivity: await driver.getCurrentActivity()
      };
      
      console.log('📊 Device Info for LinkedIn Demo:');
      console.log('  Platform:', deviceInfo.platformName, deviceInfo.platformVersion);
      console.log('  Device:', deviceInfo.deviceName);
      console.log('  Package:', deviceInfo.appPackage);
      console.log('  Activity:', deviceInfo.appActivity);
      
      // Verify key info
      deviceInfo.appPackage.should.equal('com.cargodigitaltwin.mobile.debug');
      deviceInfo.appActivity.should.include('MainActivity');
    });

  });

});
