
const path = require('path');

module.exports = {
  capabilities: [
    {
      platformName: 'Android',
      platformVersion: '15',
      deviceName: 'Android Emulator',
      automationName: 'UiAutomator2',
      app: path.resolve(__dirname, '../../apk/cargo-mobile-debug.apk'),
      appPackage: 'com.cargodigitaltwin.mobile.debug',
      appActivity: 'com.cargodigitaltwin.mobile.MainActivity',
      appWaitActivity: '*.MainActivity',
      newCommandTimeout: 60,
      noReset: false,
      fullReset: false,
      autoGrantPermissions: true,
      skipUnlock: true,
      skipDeviceInitialization: false,
      skipServerInstallation: false,
      chromedriverExecutable: '',
      chromedriverChromeMappingFile: '',
      chromedriverDisableBuildCheck: false,
      chromedriverUseSystemExecutable: false,
      chromedriverAutoDownload: true,
      chromeOptions: {
        args: [
          '--disable-web-security',
          '--allow-running-insecure-content'
        ]
      }
    }
  ],
  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost:4723',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['appium'],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};