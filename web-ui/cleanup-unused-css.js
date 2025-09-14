const fs = require('fs');
const path = require('path');

// CSS dosyalarını oku
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

// Tüm CSS sınıflarını topla
const allCssClasses = new Set();
const usedClasses = new Set();

// CSS dosyalarından sınıfları çıkar
function extractClassesFromCSS(cssContent) {
  const classRegex = /\.([a-zA-Z0-9_-]+)(?:\s*[,\s]|$)/g;
  const classes = [];
  let match;
  
  while ((match = classRegex.exec(cssContent)) !== null) {
    const className = match[1];
    // Pseudo-classes ve pseudo-elements'i filtrele
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
    // Birden fazla sınıf varsa ayır
    const classNames = classString.split(/\s+/).filter(cls => cls.trim());
    classes.push(...classNames);
  }
  
  return classes;
}

// Tüm dosyaları tara
function scanFiles() {
  // CSS dosyalarını tara
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
}

// Ana işlem
scanFiles();

// Kullanılmayan sınıfları bul
const unusedClasses = Array.from(allCssClasses).filter(cls => !usedClasses.has(cls));

console.log('=== CSS Sınıf Analizi ===');
console.log(`Toplam CSS sınıfı: ${allCssClasses.size}`);
console.log(`Kullanılan sınıf: ${usedClasses.size}`);
console.log(`Kullanılmayan sınıf: ${unusedClasses.length}`);
console.log('\n=== Kullanılmayan Sınıflar ===');

// Kullanılmayan sınıfları kategorilere ayır
const mobileClasses = unusedClasses.filter(cls => cls.startsWith('mobile-'));
const formClasses = unusedClasses.filter(cls => cls.includes('form-') || cls.includes('input-') || cls.includes('label-'));
const buttonClasses = unusedClasses.filter(cls => cls.includes('btn-') || cls.includes('button-'));
const statusClasses = unusedClasses.filter(cls => cls.includes('status-') || cls.includes('badge-'));
const chartClasses = unusedClasses.filter(cls => cls.includes('chart-') || cls.includes('trend-'));
const otherClasses = unusedClasses.filter(cls => 
  !cls.startsWith('mobile-') && 
  !cls.includes('form-') && 
  !cls.includes('input-') && 
  !cls.includes('label-') && 
  !cls.includes('btn-') && 
  !cls.includes('button-') && 
  !cls.includes('status-') && 
  !cls.includes('badge-') && 
  !cls.includes('chart-') && 
  !cls.includes('trend-')
);

console.log(`\nMobile sınıfları (${mobileClasses.length}):`);
mobileClasses.slice(0, 20).forEach(cls => console.log(`  - ${cls}`));
if (mobileClasses.length > 20) console.log(`  ... ve ${mobileClasses.length - 20} tane daha`);

console.log(`\nForm sınıfları (${formClasses.length}):`);
formClasses.slice(0, 20).forEach(cls => console.log(`  - ${cls}`));
if (formClasses.length > 20) console.log(`  ... ve ${formClasses.length - 20} tane daha`);

console.log(`\nButton sınıfları (${buttonClasses.length}):`);
buttonClasses.slice(0, 20).forEach(cls => console.log(`  - ${cls}`));
if (buttonClasses.length > 20) console.log(`  ... ve ${buttonClasses.length - 20} tane daha`);

console.log(`\nStatus sınıfları (${statusClasses.length}):`);
statusClasses.slice(0, 20).forEach(cls => console.log(`  - ${cls}`));
if (statusClasses.length > 20) console.log(`  ... ve ${statusClasses.length - 20} tane daha`);

console.log(`\nChart sınıfları (${chartClasses.length}):`);
chartClasses.slice(0, 20).forEach(cls => console.log(`  - ${cls}`));
if (chartClasses.length > 20) console.log(`  ... ve ${chartClasses.length - 20} tane daha`);

console.log(`\nDiğer sınıflar (${otherClasses.length}):`);
otherClasses.slice(0, 20).forEach(cls => console.log(`  - ${cls}`));
if (otherClasses.length > 20) console.log(`  ... ve ${otherClasses.length - 20} tane daha`);

// Sonuçları dosyaya yaz
const report = {
  totalCssClasses: allCssClasses.size,
  usedClasses: usedClasses.size,
  unusedClasses: unusedClasses.length,
  categories: {
    mobile: mobileClasses,
    form: formClasses,
    button: buttonClasses,
    status: statusClasses,
    chart: chartClasses,
    other: otherClasses
  }
};

fs.writeFileSync('unused-css-report.json', JSON.stringify(report, null, 2));
console.log('\n=== Rapor ===');
console.log('Detaylı rapor unused-css-report.json dosyasına kaydedildi.');
