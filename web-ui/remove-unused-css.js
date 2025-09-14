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
    
    // Her kullanılmayan sınıf için regex oluştur
    unusedClasses.forEach(className => {
      // Basit sınıf tanımı (sadece sınıf adı)
      const simpleClassRegex = new RegExp(`\\.${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}`, 'g');
      content = content.replace(simpleClassRegex, '');
      
      // Pseudo-class'larla birlikte olan sınıflar
      const pseudoClassRegex = new RegExp(`\\.${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(:[^\\s{]+)?\\s*\\{[^}]*\\}`, 'g');
      content = content.replace(pseudoClassRegex, '');
      
      // Media query içindeki sınıflar
      const mediaQueryRegex = new RegExp(`@media[^{]*\\{[^}]*\\.${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^}]*\\}`, 'gs');
      content = content.replace(mediaQueryRegex, '');
    });
    
    // Boş satırları temizle (3+ ardışık boş satır)
    content = content.replace(/\n\s*\n\s*\n\s*\n+/g, '\n\n');
    
    // Dosyayı kaydet
    fs.writeFileSync(filePath, content);
    
    const removed = originalLength - content.length;
    totalRemoved += removed;
    
    console.log(`${file}: ${removed} karakter temizlendi`);
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

fs.writeFileSync('css-cleanup-report.json', JSON.stringify(cleanupReport, null, 2));
console.log('\nTemizlik raporu css-cleanup-report.json dosyasına kaydedildi.');
