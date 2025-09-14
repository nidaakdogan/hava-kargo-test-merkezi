const fs = require('fs');
const path = require('path');

// Raporu oku
const report = JSON.parse(fs.readFileSync('unused-css-report.json', 'utf8'));
const unusedClasses = report.categories.mobile.concat(
  report.categories.form,
  report.categories.button,
  report.categories.status,
  report.categories.chart,
  report.categories.other
);

console.log(`Toplam ${unusedClasses.length} kullanılmayan sınıf temizlenecek...`);

// CSS dosyalarını temizle
const cssFiles = [
  'src/App.css',
  'src/components/AwbAcceptance.css',
  'src/components/BarcodeScanner.css',
  'src/components/DgControl.css',
  'src/components/MobileNavigation.css',
  'src/components/OfflineQueue.css',
  'src/components/UldLoading.css',
  'src/styles/forms.css'
];

let totalRemoved = 0;

cssFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalLength = content.length;
    
    // Her kullanılmayan sınıf için daha kapsamlı temizlik
    unusedClasses.forEach(className => {
      // Escape special characters
      const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // 1. Basit sınıf tanımı: .className { ... }
      const simpleClassRegex = new RegExp(`\\.${escapedClass}\\s*\\{[^}]*\\}`, 'g');
      content = content.replace(simpleClassRegex, '');
      
      // 2. Pseudo-class'larla: .className:hover { ... }
      const pseudoClassRegex = new RegExp(`\\.${escapedClass}(:[^\\s{]+)?\\s*\\{[^}]*\\}`, 'g');
      content = content.replace(pseudoClassRegex, '');
      
      // 3. Pseudo-element'lerle: .className::before { ... }
      const pseudoElementRegex = new RegExp(`\\.${escapedClass}(::[^\\s{]+)?\\s*\\{[^}]*\\}`, 'g');
      content = content.replace(pseudoElementRegex, '');
      
      // 4. Media query içinde: @media ... { .className { ... } }
      const mediaQueryRegex = new RegExp(`@media[^{]*\\{[^}]*\\.${escapedClass}[^}]*\\}`, 'gs');
      content = content.replace(mediaQueryRegex, '');
      
      // 5. Nested sınıflar: .parent .className { ... }
      const nestedRegex = new RegExp(`[^{]*\\.${escapedClass}\\s*\\{[^}]*\\}`, 'g');
      content = content.replace(nestedRegex, '');
      
      // 6. Sadece sınıf adı olan satırları temizle
      const lineRegex = new RegExp(`^\\s*\\.${escapedClass}\\s*\\{[^}]*\\}\\s*$`, 'gm');
      content = content.replace(lineRegex, '');
    });
    
    // Boş satırları temizle (3+ ardışık boş satır)
    content = content.replace(/\n\s*\n\s*\n\s*\n+/g, '\n\n');
    
    // Boş media query'leri temizle
    content = content.replace(/@media[^{]*\{\s*\}/g, '');
    
    // Boş CSS kurallarını temizle
    content = content.replace(/\{[^}]*\}/g, (match) => {
      const innerContent = match.replace(/[{}]/g, '').trim();
      return innerContent === '' ? '' : match;
    });
    
    // Dosyayı kaydet
    fs.writeFileSync(filePath, content);
    
    const removed = originalLength - content.length;
    totalRemoved += removed;
    
    if (removed > 0) {
      console.log(`${file}: ${removed} karakter temizlendi`);
    }
  }
});

console.log(`\nToplam ${totalRemoved} karakter temizlendi!`);
console.log(`${unusedClasses.length} kullanılmayan sınıf kaldırıldı.`);

// Temizlik raporu oluştur
const cleanupReport = {
  timestamp: new Date().toISOString(),
  totalUnusedClasses: unusedClasses.length,
  totalCharactersRemoved: totalRemoved,
  filesProcessed: cssFiles.length,
  removedClasses: unusedClasses
};

fs.writeFileSync('advanced-css-cleanup-report.json', JSON.stringify(cleanupReport, null, 2));
console.log('\nGelişmiş temizlik raporu advanced-css-cleanup-report.json dosyasına kaydedildi.');
