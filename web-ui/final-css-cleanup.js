const fs = require('fs');
const path = require('path');

// CSS dosyalarını oku ve sınıfları çıkar
function extractClassesFromCSS(cssContent) {
  const classRegex = /\.([a-zA-Z0-9_-]+)(?:\s*[,\s]|$)/g;
  const classes = [];
  let match;
  
  while ((match = classRegex.exec(cssContent)) !== null) {
    const className = match[1];
    if (!className.includes(':') && !className.includes('::')) {
      classes.push(className);
    }
  }
  
  return classes;
}

// JSX/JS dosyalarından kullanılan sınıfları çıkar
function extractUsedClassesFromJS(content) {
  const classRegex = /className\s*=\s*["'`]([^"'`]+)["'`]/g;
  const classes = [];
  let match;
  
  while ((match = classRegex.exec(content)) !== null) {
    const classString = match[1];
    const classNames = classString.split(/\s+/).filter(cls => cls.trim());
    classes.push(...classNames);
  }
  
  return classes;
}

// Tüm CSS sınıflarını topla
const allCssClasses = new Set();
const usedClasses = new Set();

// CSS dosyalarını tara
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

cssFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const classes = extractClassesFromCSS(content);
    classes.forEach(cls => allCssClasses.add(cls));
  }
});

// JSX/JS dosyalarını tara
function scanDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.includes('node_modules')) {
      scanDirectory(fullPath);
    } else if (item.endsWith('.jsx') || item.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const classes = extractUsedClassesFromJS(content);
      classes.forEach(cls => usedClasses.add(cls));
    }
  });
}

scanDirectory(path.join(__dirname, 'src'));

// Kullanılmayan sınıfları bul
const unusedClasses = Array.from(allCssClasses).filter(cls => !usedClasses.has(cls));

console.log('=== Final CSS Sınıf Analizi ===');
console.log(`Toplam CSS sınıfı: ${allCssClasses.size}`);
console.log(`Kullanılan sınıf: ${usedClasses.size}`);
console.log(`Kullanılmayan sınıf: ${unusedClasses.length}`);

if (unusedClasses.length > 0) {
  console.log('\n=== Gerçekten Kullanılmayan Sınıflar ===');
  unusedClasses.forEach(cls => console.log(`  - ${cls}`));
  
  // Bu sınıfları CSS'den temizle
  console.log('\n=== Temizlik Başlıyor ===');
  let totalRemoved = 0;
  
  cssFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let originalLength = content.length;
      
      unusedClasses.forEach(className => {
        const escapedClass = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Basit sınıf tanımı
        const simpleClassRegex = new RegExp(`\\.${escapedClass}\\s*\\{[^}]*\\}`, 'g');
        content = content.replace(simpleClassRegex, '');
        
        // Pseudo-class'larla
        const pseudoClassRegex = new RegExp(`\\.${escapedClass}(:[^\\s{]+)?\\s*\\{[^}]*\\}`, 'g');
        content = content.replace(pseudoClassRegex, '');
        
        // Pseudo-element'lerle
        const pseudoElementRegex = new RegExp(`\\.${escapedClass}(::[^\\s{]+)?\\s*\\{[^}]*\\}`, 'g');
        content = content.replace(pseudoElementRegex, '');
      });
      
      // Boş satırları temizle
      content = content.replace(/\n\s*\n\s*\n\s*\n+/g, '\n\n');
      
      fs.writeFileSync(filePath, content);
      
      const removed = originalLength - content.length;
      totalRemoved += removed;
      
      if (removed > 0) {
        console.log(`${file}: ${removed} karakter temizlendi`);
      }
    }
  });
  
  console.log(`\nToplam ${totalRemoved} karakter temizlendi!`);
} else {
  console.log('\n🎉 Tüm CSS sınıfları kullanılıyor! Temizlik gerekmiyor.');
}
