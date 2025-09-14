// Barcode Scenarios Service
export class BarcodeScenariosService {
  constructor() {
    this.scenarios = {
      valid: [
        { code: 'ULD-12345', type: 'ULD', description: 'Geçerli ULD kodu' },
        { code: 'AWB-67890', type: 'AWB', description: 'Geçerli AWB kodu' },
        { code: 'DG-UN1234', type: 'DG', description: 'Geçerli DG kodu' },
        { code: 'ULD-ABCDE', type: 'ULD', description: 'Geçerli ULD kodu (harf)' },
        { code: 'AWB-98765', type: 'AWB', description: 'Geçerli AWB kodu (sayı)' }
      ],
      invalid: [
        { code: 'INVALID-123', type: 'INVALID', description: 'Geçersiz format' },
        { code: '12345', type: 'INVALID', description: 'Eksik prefix' },
        { code: 'ULD-', type: 'INVALID', description: 'Eksik kod' },
        { code: '', type: 'INVALID', description: 'Boş kod' },
        { code: 'WRONG-FORMAT', type: 'INVALID', description: 'Yanlış format' }
      ],
      incomplete: [
        { code: 'ULD-12', type: 'INCOMPLETE', description: 'Eksik ULD kodu' },
        { code: 'AWB-67', type: 'INCOMPLETE', description: 'Eksik AWB kodu' },
        { code: 'DG-UN', type: 'INCOMPLETE', description: 'Eksik DG kodu' }
      ]
    };

    this.currentScenario = null;
    this.scenarioIndex = 0;
  }

  // Rastgele barkod senaryosu seç
  getRandomScenario() {
    const allScenarios = [
      ...this.scenarios.valid,
      ...this.scenarios.invalid,
      ...this.scenarios.incomplete
    ];

    const randomIndex = Math.floor(Math.random() * allScenarios.length);
    this.currentScenario = allScenarios[randomIndex];
    this.scenarioIndex = randomIndex;

    return this.currentScenario;
  }

  // Sıralı barkod senaryosu (test için)
  getSequentialScenario() {
    const allScenarios = [
      ...this.scenarios.valid,
      ...this.scenarios.invalid,
      ...this.scenarios.incomplete
    ];

    if (this.scenarioIndex >= allScenarios.length) {
      this.scenarioIndex = 0;
    }

    this.currentScenario = allScenarios[this.scenarioIndex];
    this.scenarioIndex++;

    return this.currentScenario;
  }

  // Barkod doğrulama
  validateBarcode(barcode) {
    if (!barcode || barcode.trim() === '') {
      return {
        valid: false,
        type: 'INVALID',
        message: 'Barkod boş olamaz',
        scenario: 'empty'
      };
    }

    // ULD format kontrolü: ULD-XXXXX
    if (/^ULD-[A-Z0-9]{5}$/.test(barcode)) {
      return {
        valid: true,
        type: 'ULD',
        message: 'Geçerli ULD kodu',
        scenario: 'valid'
      };
    }

    // AWB format kontrolü: AWB-XXXXX
    if (/^AWB-[A-Z0-9]{5}$/.test(barcode)) {
      return {
        valid: true,
        type: 'AWB',
        message: 'Geçerli AWB kodu',
        scenario: 'valid'
      };
    }

    // DG format kontrolü: DG-UNXXXX
    if (/^DG-UN[0-9]{4}$/.test(barcode)) {
      return {
        valid: true,
        type: 'DG',
        message: 'Geçerli DG kodu',
        scenario: 'valid'
      };
    }

    // Eksik format kontrolü
    if (/^ULD-[A-Z0-9]{1,4}$/.test(barcode) || 
        /^AWB-[A-Z0-9]{1,4}$/.test(barcode) || 
        /^DG-UN[0-9]{1,3}$/.test(barcode)) {
      return {
        valid: false,
        type: 'INCOMPLETE',
        message: 'Barkod eksik - tam format gerekli',
        scenario: 'incomplete'
      };
    }

    // Geçersiz format
    return {
      valid: false,
      type: 'INVALID',
      message: 'Geçersiz barkod formatı',
      scenario: 'invalid'
    };
  }

  // Test senaryosu oluştur
  generateTestScenario() {
    const scenario = this.getSequentialScenario();
    const validation = this.validateBarcode(scenario.code);

    return {
      ...scenario,
      validation,
      expectedResult: validation.valid ? 'success' : 'failure',
      timestamp: new Date().toISOString()
    };
  }

  // Mobil test için barkod senaryoları
  getMobileTestScenarios() {
    return [
      {
        step: 1,
        code: 'ULD-12345',
        type: 'ULD',
        expectedResult: 'success',
        description: 'Geçerli ULD kodu tarama',
        duration: 2000
      },
      {
        step: 2,
        code: 'INVALID-123',
        type: 'INVALID',
        expectedResult: 'failure',
        description: 'Geçersiz barkod tarama',
        duration: 1500
      },
      {
        step: 3,
        code: 'AWB-67890',
        type: 'AWB',
        expectedResult: 'success',
        description: 'Geçerli AWB kodu tarama',
        duration: 2000
      },
      {
        step: 4,
        code: 'ULD-12',
        type: 'INCOMPLETE',
        expectedResult: 'failure',
        description: 'Eksik ULD kodu tarama',
        duration: 1500
      },
      {
        step: 5,
        code: 'DG-UN1234',
        type: 'DG',
        expectedResult: 'success',
        description: 'Geçerli DG kodu tarama',
        duration: 2000
      }
    ];
  }

  // Barkod tarama simülasyonu
  async simulateBarcodeScan(barcode, deviceId = 'test-device') {
    const validation = this.validateBarcode(barcode);
    
    // Simülasyon gecikmesi
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const result = {
      id: Date.now(),
      barcode,
      deviceId,
      timestamp: new Date().toISOString(),
      validation,
      success: validation.valid,
      message: validation.message
    };

    return result;
  }

  // Test sonuçlarını analiz et
  analyzeTestResults(results) {
    const total = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    const byType = results.reduce((acc, result) => {
      const type = result.validation.type;
      if (!acc[type]) {
        acc[type] = { total: 0, successful: 0, failed: 0 };
      }
      acc[type].total++;
      if (result.success) {
        acc[type].successful++;
      } else {
        acc[type].failed++;
      }
      return acc;
    }, {});

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      byType,
      duration: results.length > 0 ? 
        new Date(results[results.length - 1].timestamp) - new Date(results[0].timestamp) : 0
    };
  }
}

export default BarcodeScenariosService;
