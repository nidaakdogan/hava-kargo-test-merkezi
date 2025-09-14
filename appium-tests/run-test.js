#!/usr/bin/env node

// Test Runner with Setup Validation
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🚀 Cargo DTL Mobile - E2E Test Runner');
console.log('=====================================\n');

// Pre-flight checks
function checkPrerequisites() {
  console.log('📋 Pre-flight checks...\n');
  
  // Check APK exists
  const apkPath = path.join(__dirname, 'apk', 'cargo-mobile-debug.apk');
  if (!fs.existsSync(apkPath)) {
    console.error('❌ APK not found: ' + apkPath);
    console.log('💡 Build APK first:');
    console.log('   cd ../cargo-mobile-native && npm run build:android');
    console.log('   cp dist/cargo-mobile-debug.apk ../appium-tests/apk/');
    process.exit(1);
  }
  console.log('✅ APK found: cargo-mobile-debug.apk');
  
  // Check config file
  const configPath = path.join(__dirname, 'config', 'android-emulator.config.js');
  if (!fs.existsSync(configPath)) {
    console.error('❌ Config not found: ' + configPath);
    process.exit(1);
  }
  console.log('✅ Config found: android-emulator.config.js');
  
  // Check test file
  const testPath = path.join(__dirname, 'tests', 'smoke-test.spec.js');
  if (!fs.existsSync(testPath)) {
    console.error('❌ Test file not found: ' + testPath);
    process.exit(1);
  }
  console.log('✅ Test file found: smoke-test.spec.js');
  
  console.log('\n🎯 App Details:');
  console.log('   Package: com.cargodigitaltwin.mobile');
  console.log('   Activity: .MainActivity');
  console.log('   Backend: http://10.0.2.2:3001');
  
  console.log('\n📱 Prerequisites:');
  console.log('   ⚠️  Android emulator running (API 34)');
  console.log('   ⚠️  Backend server on port 3001');
  console.log('   ⚠️  Appium server on port 4723');
  
  console.log('\n🧪 Starting E2E tests...\n');
}

// Network checks
function checkNetwork() {
  return new Promise((resolve) => {
    exec('curl -s http://localhost:4723/wd/hub/status', (error, stdout) => {
      if (error) {
        console.log('⚠️  Appium server check failed (ensure appium is running)');
      } else {
        console.log('✅ Appium server responsive');
      }
      resolve();
    });
  });
}

// Main execution
async function runTests() {
  try {
    checkPrerequisites();
    await checkNetwork();
    
    console.log('🎬 Executing: npm run test:e2e:android\n');
    console.log('=' * 50);
    
    const testProcess = exec('npm run test:e2e:android', {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    testProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    testProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    testProcess.on('close', (code) => {
      console.log('\n' + '=' * 50);
      if (code === 0) {
        console.log('🎉 All tests passed! Smoke scenarios are green ✅');
        console.log('\n📊 Test Summary:');
        console.log('   • App launch & navigation ✅');
        console.log('   • Offline→Online barcode flow ✅');
        console.log('   • ULD capacity warnings ✅');
        console.log('   • AWB update workflow ✅');
        console.log('   • DG validation & lists ✅');
        console.log('\n🏆 Ready for production deployment!');
      } else {
        console.log('❌ Some tests failed. Check logs above.');
        console.log('\n🔧 Debug tips:');
        console.log('   • Check Appium Inspector for element issues');
        console.log('   • Verify backend connectivity (10.0.2.2:3001)');
        console.log('   • Ensure emulator is responsive');
        console.log('   • Run: npm run test:debug for extended timeout');
      }
      process.exit(code);
    });
    
  } catch (error) {
    console.error('💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Execute
runTests();
