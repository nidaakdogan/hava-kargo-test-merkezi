#!/usr/bin/env node

/**
 * PWA Test Script - Kabul Kriterleri Kontrolü
 * Usage: node test-pwa.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 PWA Kabul Kriterleri Kontrolü Başlatılıyor...\n');

const errors = [];
const warnings = [];
const success = [];

// Test helpers
function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, 'public', filePath);
  if (fs.existsSync(fullPath)) {
    success.push(`✅ ${description}: ${filePath}`);
    return true;
  } else {
    errors.push(`❌ ${description}: ${filePath} BULUNAMADI`);
    return false;
  }
}

function checkManifest() {
  console.log('📄 Manifest.json Kontrolü...');
  
  const manifestPath = path.join(__dirname, 'public', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push('❌ manifest.json dosyası bulunamadı');
    return;
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Required fields
    const requiredFields = [
      'name', 'short_name', 'start_url', 'display', 
      'theme_color', 'background_color', 'icons'
    ];
    
    requiredFields.forEach(field => {
      if (manifest[field]) {
        success.push(`✅ Manifest ${field}: "${manifest[field]}"`);
      } else {
        errors.push(`❌ Manifest ${field} eksik`);
      }
    });

    // Check scope
    if (manifest.scope) {
      success.push(`✅ Manifest scope: "${manifest.scope]}"`);
    } else {
      warnings.push(`⚠️ Manifest scope önerilir`);
    }

    // Check icons
    if (manifest.icons && manifest.icons.length > 0) {
      const required192 = manifest.icons.find(icon => icon.sizes.includes('192x192'));
      const required512 = manifest.icons.find(icon => icon.sizes.includes('512x512'));
      const maskable192 = manifest.icons.find(icon => 
        icon.sizes.includes('192x192') && icon.purpose === 'maskable'
      );
      const maskable512 = manifest.icons.find(icon => 
        icon.sizes.includes('512x512') && icon.purpose === 'maskable'
      );

      if (required192) success.push('✅ 192x192 ikon tanımlı');
      else errors.push('❌ 192x192 ikon eksik');

      if (required512) success.push('✅ 512x512 ikon tanımlı');
      else errors.push('❌ 512x512 ikon eksik');

      if (maskable192) success.push('✅ 192x192 maskable ikon tanımlı');
      else warnings.push('⚠️ 192x192 maskable ikon önerilir');

      if (maskable512) success.push('✅ 512x512 maskable ikon tanımlı');
      else warnings.push('⚠️ 512x512 maskable ikon önerilir');
    } else {
      errors.push('❌ Manifest icons array boş');
    }

  } catch (error) {
    errors.push(`❌ Manifest.json parse hatası: ${error.message}`);
  }
}

function checkServiceWorker() {
  console.log('\n⚙️ Service Worker Kontrolü...');
  
  checkFile('sw.js', 'Service Worker dosyası');
  
  const swPath = path.join(__dirname, 'public', 'sw.js');
  if (fs.existsSync(swPath)) {
    const swContent = fs.readFileSync(swPath, 'utf8');
    
    // Check required features
    if (swContent.includes('skipWaiting')) {
      success.push('✅ SW skipWaiting() var');
    } else {
      warnings.push('⚠️ SW skipWaiting() önerilir');
    }

    if (swContent.includes('clients.claim')) {
      success.push('✅ SW clients.claim() var');
    } else {
      warnings.push('⚠️ SW clients.claim() önerilir');
    }

    if (swContent.includes('caches.open')) {
      success.push('✅ SW cache API kullanıyor');
    } else {
      errors.push('❌ SW cache API eksik');
    }

    if (swContent.includes('fetch')) {
      success.push('✅ SW fetch event handler var');
    } else {
      errors.push('❌ SW fetch event handler eksik');
    }
  }
}

function checkHTMLMeta() {
  console.log('\n📱 HTML Meta Tags Kontrolü...');
  
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    errors.push('❌ index.html dosyası bulunamadı');
    return;
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Check PWA meta tags
  if (htmlContent.includes('manifest.json')) {
    success.push('✅ Manifest link tag var');
  } else {
    errors.push('❌ Manifest link tag eksik');
  }

  if (htmlContent.includes('theme-color')) {
    success.push('✅ Theme color meta tag var');
  } else {
    warnings.push('⚠️ Theme color meta tag önerilir');
  }

  // Check iOS meta tags
  if (htmlContent.includes('apple-mobile-web-app-capable')) {
    success.push('✅ iOS web app capable meta tag var');
  } else {
    warnings.push('⚠️ iOS web app capable meta tag önerilir');
  }

  if (htmlContent.includes('apple-touch-icon')) {
    success.push('✅ Apple touch icon var');
  } else {
    warnings.push('⚠️ Apple touch icon önerilir');
  }
}

function checkIcons() {
  console.log('\n🖼️ İkon Dosyaları Kontrolü...');
  
  // Critical icons
  const criticalIcons = [
    'icon-192x192.png',
    'icon-512x512.png'
  ];

  criticalIcons.forEach(icon => {
    checkFile(`icons/${icon}`, `Kritik ikon`);
  });

  // Recommended icons
  const recommendedIcons = [
    'maskable-icon-192x192.png',
    'maskable-icon-512x512.png',
    'apple-touch-icon-180x180.png',
    'favicon.ico'
  ];

  recommendedIcons.forEach(icon => {
    const exists = checkFile(`icons/${icon}`, `Önerilen ikon`);
    if (!exists) {
      warnings.push(`⚠️ ${icon} dosyası önerilir`);
    }
  });
}

function checkOffline() {
  console.log('\n📴 Offline Desteği Kontrolü...');
  
  checkFile('offline.html', 'Offline fallback sayfası');
}

function checkPackageJson() {
  console.log('\n📦 Package.json PWA Scripts Kontrolü...');
  
  const packagePath = path.join(__dirname, 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (packageJson.scripts && packageJson.scripts['build:pwa']) {
      success.push('✅ PWA build script var');
    } else {
      warnings.push('⚠️ PWA build script önerilir');
    }

    if (packageJson.scripts && packageJson.scripts['dev:https']) {
      success.push('✅ HTTPS dev script var');
    } else {
      warnings.push('⚠️ HTTPS dev script önerilir');
    }
  }
}

// Run all tests
function runTests() {
  checkManifest();
  checkServiceWorker();
  checkHTMLMeta();
  checkIcons();
  checkOffline();
  checkPackageJson();

  // Results
  console.log('\n' + '='.repeat(50));
  console.log('📊 PWA Test Sonuçları');
  console.log('='.repeat(50));

  if (success.length > 0) {
    console.log('\n✅ BAŞARILI KONTROLLER:');
    success.forEach(msg => console.log(`  ${msg}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️ UYARILAR:');
    warnings.forEach(msg => console.log(`  ${msg}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ HATALAR:');
    errors.forEach(msg => console.log(`  ${msg}`));
  }

  // Final score
  const totalChecks = success.length + warnings.length + errors.length;
  const score = Math.round((success.length / totalChecks) * 100);
  
  console.log('\n' + '='.repeat(50));
  console.log(`🏆 PWA SKORU: ${score}% (${success.length}/${totalChecks})`);
  
  if (score >= 90) {
    console.log('🎉 Tebrikler! PWA production\'a hazır!');
  } else if (score >= 70) {
    console.log('🔧 İyi durumdas. Birkaç iyileştirme yapın.');
  } else {
    console.log('🚨 Daha fazla çalışma gerekiyor.');
  }

  console.log('\n💡 Test tamamlandıktan sonra:');
  console.log('1. npm start -> HTTPS test için');
  console.log('2. Chrome DevTools -> Lighthouse -> PWA test');
  console.log('3. PWA-TEST-CHECKLIST.md -> Manuel test adımları');
  
  console.log('='.repeat(50));

  // Exit code for CI
  process.exit(errors.length > 0 ? 1 : 0);
}

// Run the tests
runTests();
