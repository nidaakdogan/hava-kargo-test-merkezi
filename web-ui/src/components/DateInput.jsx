import React, { useState, useEffect } from 'react';
import { 
  formatDateDDMMYYYY, 
  formatDateForInput, 
  parseInputToDDMMYYYY,
  parseDDMMYYYYToInput,
  isValidDate 
} from '../utils/dateUtils';

const DateInput = ({ 
  value, 
  onChange, 
  className = '', 
  placeholder = 'GG/AA/YYYY',
  max,
  min,
  disabled = false,
  required = false,
  name,
  id,
  ...props 
}) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isValid, setIsValid] = useState(true);

  // Value değiştiğinde display value'yu güncelle
  useEffect(() => {
    if (value) {
      if (value.includes('/')) {
        // Zaten DD/MM/YYYY formatında
        setDisplayValue(value);
        setIsValid(isValidDate(parseDDMMYYYYToInput(value)));
      } else {
        // HTML input formatında (YYYY-MM-DD)
        setDisplayValue(formatDateDDMMYYYY(value));
        setIsValid(isValidDate(value));
      }
    } else {
      setDisplayValue('');
      setIsValid(true);
    }
  }, [value]);

  // Input değişikliği
  const handleChange = (e) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    
    // Sadece rakam ve / kabul et
    const cleaned = inputValue.replace(/[^0-9/]/g, '');
    
    // Maksimum 10 karakter (DD/MM/YYYY)
    if (cleaned.length <= 10) {
      setDisplayValue(cleaned);
      
      // Tam format kontrolü (DD/MM/YYYY)
      if (cleaned.length === 10 && cleaned.includes('/')) {
        const parts = cleaned.split('/');
        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
          const htmlDate = parseDDMMYYYYToInput(cleaned);
          const valid = isValidDate(htmlDate);
          setIsValid(valid);
          
          if (valid) {
            // HTML input formatına çevir ve parent'a gönder
            onChange({
              target: {
                name: name,
                value: htmlDate
              }
            });
          }
        }
      } else if (cleaned.length < 10) {
        // Henüz tam format değil, sadece display'i güncelle
        setIsValid(true);
      }
    }
  };

  // Focus'ta placeholder'ı temizle
  const handleFocus = (e) => {
    if (displayValue === placeholder) {
      setDisplayValue('');
    }
  };

  // Blur'da boşsa placeholder koy
  const handleBlur = (e) => {
    if (!displayValue) {
      setDisplayValue(placeholder);
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`${className} ${!isValid ? 'error' : ''}`}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      name={name}
      id={id}
      maxLength="10"
      {...props}
    />
  );
};

export default DateInput;
