# Test Setup Information - Quick Reference

## 📱 APK / Package / Activity Bilgileri

### App Package Details
```
Package Name: com.cargodigitaltwin.mobile
Main Activity: .MainActivity
APK Path: ./apk/cargo-mobile-debug.apk
```

### APK Build Location
```bash
# Built APK should be at:
../cargo-mobile-native/dist/cargo-mobile-debug.apk

# Copy to test directory:
cp ../cargo-mobile-native/dist/cargo-mobile-debug.apk ./apk/
```

## 🌐 Base URL Configuration

### Backend Addresses
```javascript
// config.js (App)
BACKEND_URL: 'http://10.0.2.2:3001'  // Android emulator → host localhost:3001

// android-emulator.config.js (Appium)
baseUrl: 'http://localhost'  // Appium server base
```

### Network Test
```bash
# Host machine backend check:
curl http://localhost:3001/api/health

# Emulator backend access (via ADB):
adb shell curl http://10.0.2.2:3001/api/health
```

## 🎯 Test Execution Checklist

### Prerequisites ✅
- [ ] Android Studio emulator running (API 34)
- [ ] APK built and copied to `./apk/cargo-mobile-debug.apk`
- [ ] Backend mock server running on port 3001
- [ ] Appium server running on port 4723

### Commands
```bash
# 1. Start mock backend
cd ../mock-api && npm start &

# 2. Start emulator
emulator -avd Pixel_7_Pro_API_34

# 3. Start Appium server  
appium server --port 4723

# 4. Run E2E tests
cd appium-tests
npm run test:e2e:android
```

## 🐛 Troubleshooting Quick Checks

### If APK install fails:
```bash
# Check APK exists
ls -la ./apk/cargo-mobile-debug.apk

# Manual install test
adb install ./apk/cargo-mobile-debug.apk
```

### If app doesn't start:
```bash
# Check package/activity
adb shell am start -n com.cargodigitaltwin.mobile/.MainActivity

# Check app logs
adb logcat | grep -i cargo
```

### If network fails:
```bash
# Check backend reachable from emulator
adb shell ping 10.0.2.2

# Check port 3001 listening
netstat -an | findstr :3001
```

### If Appium can't find elements:
```bash
# Use Appium Inspector
# Connect to: http://localhost:4723
# With capabilities from android-emulator.config.js
```

## 📊 Expected Test Results

### Smoke Test Scenarios (5 main groups):
1. **App Launch & Navigation** (3 tests)
2. **Barcode Complete Flow** (1 comprehensive test)  
3. **ULD Capacity & Readonly** (2 tests)
4. **AWB Mini Update** (1 test)
5. **DG Lists & Validation** (2 tests)

### Success Indicators:
- ✅ All tests pass (green)
- ✅ No app crashes
- ✅ Elements found by testID
- ✅ Toast messages appear
- ✅ State changes work

## 🔧 Debug Mode

```bash
# Extended timeout + verbose logging
npm run test:debug

# Manual test with Appium Inspector
# 1. Start Appium Desktop or Inspector
# 2. Connect with config capabilities
# 3. Inspect element hierarchy
```
