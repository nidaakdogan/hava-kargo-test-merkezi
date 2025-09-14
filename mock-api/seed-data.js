// Test verilerini oluştur
const generateTestData = () => {
  // AWB test verileri (25 adet)
  const awbData = [
    {
      id: '1',
      awbNumber: '123-45678901',
      origin: 'IST',
      destination: 'FRA',
      weight: 150.5,
      pieces: 25,
      flight: 'TK1234',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      awbNumber: '123-45678902',
      origin: 'IST',
      destination: 'AMS',
      weight: 89.2,
      pieces: 12,
      flight: 'TK5678',
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      awbNumber: '123-45678903',
      origin: 'FRA',
      destination: 'IST',
      weight: 234.7,
      pieces: 38,
      flight: 'TK9012',
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      awbNumber: '123-45678904',
      origin: 'LHR',
      destination: 'IST',
      weight: 178.3,
      pieces: 22,
      flight: 'TK3456',
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      awbNumber: '123-45678905',
      origin: 'CDG',
      destination: 'FRA',
      weight: 95.8,
      pieces: 15,
      flight: 'TK7890',
      createdAt: new Date().toISOString()
    },
    {
      id: '6',
      awbNumber: '123-45678906',
      origin: 'IST',
      destination: 'LHR',
      weight: 267.4,
      pieces: 41,
      flight: 'TK1111',
      createdAt: new Date().toISOString()
    },
    {
      id: '7',
      awbNumber: '123-45678907',
      origin: 'AMS',
      destination: 'IST',
      weight: 143.2,
      pieces: 19,
      flight: 'TK2222',
      createdAt: new Date().toISOString()
    },
    {
      id: '8',
      awbNumber: '123-45678908',
      origin: 'FRA',
      destination: 'CDG',
      weight: 76.9,
      pieces: 8,
      flight: 'TK3333',
      createdAt: new Date().toISOString()
    },
    {
      id: '9',
      awbNumber: '123-45678909',
      origin: 'IST',
      destination: 'CDG',
      weight: 198.7,
      pieces: 31,
      flight: 'TK4444',
      createdAt: new Date().toISOString()
    },
    {
      id: '10',
      awbNumber: '123-45678910',
      origin: 'LHR',
      destination: 'AMS',
      weight: 112.5,
      pieces: 17,
      flight: 'TK5555',
      createdAt: new Date().toISOString()
    },
    {
      id: '11',
      awbNumber: '123-45678911',
      origin: 'CDG',
      destination: 'LHR',
      weight: 156.8,
      pieces: 24,
      flight: 'TK6666',
      createdAt: new Date().toISOString()
    },
    {
      id: '12',
      awbNumber: '123-45678912',
      origin: 'AMS',
      destination: 'FRA',
      weight: 89.1,
      pieces: 13,
      flight: 'TK7777',
      createdAt: new Date().toISOString()
    },
    {
      id: '13',
      awbNumber: '123-45678913',
      origin: 'FRA',
      destination: 'AMS',
      weight: 223.6,
      pieces: 35,
      flight: 'TK8888',
      createdAt: new Date().toISOString()
    },
    {
      id: '14',
      awbNumber: '123-45678914',
      origin: 'IST',
      destination: 'LHR',
      weight: 167.9,
      pieces: 26,
      flight: 'TK9999',
      createdAt: new Date().toISOString()
    },
    {
      id: '15',
      awbNumber: '123-45678915',
      origin: 'LHR',
      destination: 'CDG',
      weight: 134.2,
      pieces: 20,
      flight: 'TK0000',
      createdAt: new Date().toISOString()
    },
    {
      id: '16',
      awbNumber: '123-45678916',
      origin: 'CDG',
      destination: 'IST',
      weight: 189.5,
      pieces: 29,
      flight: 'TK1112',
      createdAt: new Date().toISOString()
    },
    {
      id: '17',
      awbNumber: '123-45678917',
      origin: 'AMS',
      destination: 'LHR',
      weight: 145.8,
      pieces: 21,
      flight: 'TK2223',
      createdAt: new Date().toISOString()
    },
    {
      id: '18',
      awbNumber: '123-45678918',
      origin: 'FRA',
      destination: 'IST',
      weight: 278.3,
      pieces: 42,
      flight: 'TK3334',
      createdAt: new Date().toISOString()
    },
    {
      id: '19',
      awbNumber: '123-45678919',
      origin: 'IST',
      destination: 'AMS',
      weight: 123.7,
      pieces: 18,
      flight: 'TK4445',
      createdAt: new Date().toISOString()
    },
    {
      id: '20',
      awbNumber: '123-45678920',
      origin: 'LHR',
      destination: 'FRA',
      weight: 201.4,
      pieces: 32,
      flight: 'TK5556',
      createdAt: new Date().toISOString()
    },
    {
      id: '21',
      awbNumber: '123-45678921',
      origin: 'CDG',
      destination: 'AMS',
      weight: 98.6,
      pieces: 14,
      flight: 'TK6667',
      createdAt: new Date().toISOString()
    },
    {
      id: '22',
      awbNumber: '123-45678922',
      origin: 'AMS',
      destination: 'CDG',
      weight: 176.9,
      pieces: 27,
      flight: 'TK7778',
      createdAt: new Date().toISOString()
    },
    {
      id: '23',
      awbNumber: '123-45678923',
      origin: 'FRA',
      destination: 'LHR',
      weight: 245.1,
      pieces: 37,
      flight: 'TK8889',
      createdAt: new Date().toISOString()
    },
    {
      id: '24',
      awbNumber: '123-45678924',
      origin: 'IST',
      destination: 'CDG',
      weight: 158.3,
      pieces: 23,
      flight: 'TK9990',
      createdAt: new Date().toISOString()
    },
    {
      id: '25',
      awbNumber: '123-45678925',
      origin: 'LHR',
      destination: 'IST',
      weight: 192.7,
      pieces: 30,
      flight: 'TK0001',
      createdAt: new Date().toISOString()
    }
  ];

  // ULD test verileri (8 adet, gerçek havacılık standartlarına göre)
  const uldData = [
    {
      id: '1',
      uldCode: 'AKE12345AB',
      type: 'AKE',
      maxWeight: 1588.0,
      currentWeight: 1200.5,
      volume: 4.3,
      capacity: 75.6,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      uldCode: 'DPE67890CD',
      type: 'DPE',
      maxWeight: 1588.0,
      currentWeight: 800.2,
      volume: 3.2,
      capacity: 50.4,
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      uldCode: 'AKH11111EF',
      type: 'AKH',
      maxWeight: 1588.0,
      currentWeight: 1700.0, // Kasıtlı hatalı: kapasite aşıldı
      volume: 4.5,
      capacity: 107.1,
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      uldCode: 'DPN22222GH',
      type: 'DPN',
      maxWeight: 1588.0,
      currentWeight: 1200.3,
      volume: 1.6,
      capacity: 75.6,
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      uldCode: 'PMC33333IJ',
      type: 'PMC',
      maxWeight: 6804.0,
      currentWeight: 4500.7,
      volume: null, // Paletlerde hacim hesaplanmaz
      capacity: 66.1,
      createdAt: new Date().toISOString()
    },
    {
      id: '6',
      uldCode: 'PAG44444KL',
      type: 'PAG',
      maxWeight: 4626.0,
      currentWeight: 3800.2,
      volume: null, // Paletlerde hacim hesaplanmaz
      capacity: 82.1,
      createdAt: new Date().toISOString()
    },
    {
      id: '7',
      uldCode: 'PLA55555MN',
      type: 'PLA',
      maxWeight: 11300.0,
      currentWeight: 9500.8,
      volume: null, // Paletlerde hacim hesaplanmaz
      capacity: 84.1,
      createdAt: new Date().toISOString()
    },
    {
      id: '8',
      uldCode: 'AKE66666OP',
      type: 'AKE',
      maxWeight: 1588.0,
      currentWeight: 1600.1, // Kasıtlı hatalı: kapasite aşıldı
      volume: 4.3,
      capacity: 100.8,
      createdAt: new Date().toISOString()
    }
  ];

  // DG test verileri (15 adet, bazıları kasıtlı hatalı)
  const dgData = [
    {
      id: '1',
      awbId: '1',
      unNumber: 'UN1203',
      class: '3',
      packingGroup: 'II',
      quantity: 50.0,
      description: 'Benzin',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      awbId: '2',
      unNumber: 'UN1830',
      class: '8',
      packingGroup: 'II',
      quantity: 25.0,
      description: 'Sülfürik asit',
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      awbId: '3',
      unNumber: 'UN2014',
      class: '2',
      packingGroup: 'I',
      quantity: 15.5,
      description: 'Hidrojen peroksit',
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      awbId: '4',
      unNumber: 'UN1823',
      class: '8',
      packingGroup: 'II',
      quantity: 30.0,
      description: 'Sodyum hidroksit',
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      awbId: '5',
      unNumber: 'UN1005',
      class: '2',
      packingGroup: 'I',
      quantity: 12.8,
      description: 'Amonyak',
      createdAt: new Date().toISOString()
    },
    {
      id: '6',
      awbId: '6',
      unNumber: 'INVALID-UN', // Kasıtlı hatalı: geçersiz UN formatı
      class: '5',
      packingGroup: 'III',
      quantity: 45.2,
      description: 'Nitrik asit',
      createdAt: new Date().toISOString()
    },
    {
      id: '7',
      awbId: '7',
      unNumber: 'UN2672',
      class: '6',
      packingGroup: 'II',
      quantity: 18.7,
      description: 'Sodyum siyanür',
      createdAt: new Date().toISOString()
    },
    {
      id: '8',
      awbId: '8',
      unNumber: 'UN1202',
      class: '3',
      packingGroup: 'II',
      quantity: 22.3,
      description: 'Dizel yakıt',
      createdAt: new Date().toISOString()
    },
    {
      id: '9',
      awbId: '9',
      unNumber: 'UN1831',
      class: '8',
      packingGroup: 'I', // Kasıtlı hatalı: yanlış packing group
      quantity: 35.8,
      description: 'Hidroklorik asit',
      createdAt: new Date().toISOString()
    },
    {
      id: '10',
      awbId: '10',
      unNumber: 'UN1993',
      class: '3',
      packingGroup: 'II',
      quantity: 28.9,
      description: 'Flammable liquid',
      createdAt: new Date().toISOString()
    },
    {
      id: '11',
      awbId: '11',
      unNumber: 'UN1170',
      class: '3',
      packingGroup: 'II',
      quantity: 40.1,
      description: 'Etanol',
      createdAt: new Date().toISOString()
    },
    {
      id: '12',
      awbId: '12',
      unNumber: 'UN2814',
      class: '6',
      packingGroup: 'II',
      quantity: 16.4,
      description: 'Toksik madde',
      createdAt: new Date().toISOString()
    },
    {
      id: '13',
      awbId: '13',
      unNumber: 'UN1350',
      class: '4',
      packingGroup: 'II',
      quantity: 33.7,
      description: 'Sülfür',
      createdAt: new Date().toISOString()
    },
    {
      id: '14',
      awbId: '14',
      unNumber: 'UN1230',
      class: '3',
      packingGroup: 'II',
      quantity: 19.6,
      description: 'Metanol',
      createdAt: new Date().toISOString()
    },
    {
      id: '15',
      awbId: '15',
      unNumber: 'UN2920',
      class: '8',
      packingGroup: 'II',
      quantity: 27.3,
      description: 'Korozif madde',
      createdAt: new Date().toISOString()
    }
  ];

  console.log('Test verileri oluşturuldu:');
  console.log(`- ${awbData.length} AWB kaydı`);
  console.log(`- ${uldData.length} ULD kaydı`);
  console.log(`- ${dgData.length} DG kaydı`);
  
  return { awbData, uldData, dgData };
};

// Eğer bu dosya doğrudan çalıştırılırsa
if (require.main === module) {
  generateTestData();
}

module.exports = { generateTestData };
