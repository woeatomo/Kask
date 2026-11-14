import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform, TurboModuleRegistry, View } from 'react-native';
import { useCommunity } from '@/context/CommunityContext';
import { space } from '@/lib/theme';

type AdsModule = typeof import('react-native-google-mobile-ads');

/**
 * Modul iklan bersifat native: tidak ada di Expo Go, dan library-nya langsung
 * error saat di-import (TurboModuleRegistry.getEnforcing). try/catch saja tidak
 * cukup karena di mode development Metro melaporkan error import sebagai fatal.
 * Jadi kita cek dulu apakah native module-nya terdaftar sebelum require.
 */
const ADS_NATIVE_MODULE = 'RNGoogleMobileAdsModule';

let ads: AdsModule | null | undefined;
function loadAds(): AdsModule | null {
  if (ads !== undefined) return ads;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (ads = null);
  if (TurboModuleRegistry.get(ADS_NATIVE_MODULE) == null) return (ads = null);
  try {
    ads = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    ads = null;
  }
  return ads;
}

// Minta persetujuan (UMP/GDPR jika berlaku) lalu inisialisasi SDK, sekali saja
let ready: Promise<boolean> | null = null;
function initAds(m: AdsModule): Promise<boolean> {
  ready ??= (async () => {
    try {
      const consent = await m.AdsConsent.gatherConsent();
      if (!consent.canRequestAds) return false;
      await m.default().initialize();
      return true;
    } catch (e) {
      console.warn('Iklan tidak tersedia', e);
      return false;
    }
  })();
  return ready;
}

function unitId(m: AdsModule): string | null {
  if (__DEV__) return m.TestIds.BANNER;
  const id = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS : process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
  return id || null;
}

/** Banner iklan, hanya tampil untuk komunitas berpaket Gratis */
export function AdBanner() {
  const { isPremium } = useCommunity();
  const m = isPremium ? null : loadAds();
  const [canShow, setCanShow] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (m) initAds(m).then(setCanShow);
  }, [m]);

  if (!m || !canShow || failed) return null;
  const id = unitId(m);
  if (!id) return null;

  return (
    <View style={{ alignItems: 'center', marginVertical: space.md }}>
      <m.BannerAd
        unitId={id}
        size={m.BannerAdSize.BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}
