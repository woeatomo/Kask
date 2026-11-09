// Melengkapi app.json dengan nilai dari environment variable saat build.
//
// ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID: App ID dari AdMob (format ca-app-pub-xxx~yyy).
// Jika kosong, dipakai App ID tes resmi Google (iklan tes, tidak menghasilkan uang).
const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';

// File Firebase untuk push notification Android (FCM).
// Di EAS: simpan sebagai environment variable bertipe *file* bernama GOOGLE_SERVICES_JSON.
// Lokal: letakkan di mobile/google-services.json (sudah di-.gitignore).
const fs = require('fs');
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.ADMOB_ANDROID_APP_ID || TEST_ANDROID_APP_ID,
        iosAppId: process.env.ADMOB_IOS_APP_ID || TEST_IOS_APP_ID,
      },
    ],
  ],
});
