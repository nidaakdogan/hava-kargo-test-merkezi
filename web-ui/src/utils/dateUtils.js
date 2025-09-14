// Tarih utility fonksiyonları - Türkçe format desteği

// Türkçe ay isimleri
const turkishMonths = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Türkçe gün isimleri (kısa)
const turkishDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

// Tarihi gün ay yıl formatında döndür (DD/MM/YYYY)
export const formatDateDDMMYYYY = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

// Tarihi Türkçe formatında döndür (4 Eylül 2025)
export const formatDateTurkish = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const day = d.getDate();
  const month = turkishMonths[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
};

// Tarihi kısa Türkçe formatında döndür (4 Eyl 2025)
export const formatDateTurkishShort = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const day = d.getDate();
  const month = turkishMonths[d.getMonth()].substring(0, 3);
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
};

// HTML date input için format (YYYY-MM-DD)
export const formatDateForInput = (date) => {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toISOString().split('T')[0];
};

// Bugünün tarihini HTML input formatında döndür
export const getTodayForInput = () => {
  return new Date().toISOString().split('T')[0];
};

// DD/MM/YYYY formatındaki tarihi HTML input formatına çevir
export const parseDDMMYYYYToInput = (dateString) => {
  if (!dateString) return '';
  
  const parts = dateString.split('/');
  if (parts.length !== 3) return '';
  
  const day = parts[0];
  const month = parts[1];
  const year = parts[2];
  
  // YYYY-MM-DD formatına çevir
  return `${year}-${month}-${day}`;
};

// HTML input formatındaki tarihi DD/MM/YYYY formatına çevir
export const parseInputToDDMMYYYY = (inputDate) => {
  if (!inputDate) return '';
  
  const parts = inputDate.split('-');
  if (parts.length !== 3) return '';
  
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  
  return `${day}/${month}/${year}`;
};

// Tarih validasyonu
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  
  const d = new Date(dateString);
  return !isNaN(d.getTime());
};

// Tarih karşılaştırması
export const isDateAfter = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1 > d2;
};

// Tarih karşılaştırması (eşit veya sonra)
export const isDateAfterOrEqual = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1 >= d2;
};
