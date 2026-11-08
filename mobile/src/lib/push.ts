import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const TOKEN_KEY = 'kask.pushToken';

// Tampilkan notifikasi juga saat aplikasi sedang dibuka
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface PushData {
  url?: string | null;
  community_id?: string | null;
  notification_id?: string | null;
}

/**
 * Minta izin notifikasi lalu daftarkan Expo push token ke Supabase.
 * Aman dipanggil berulang. Mengembalikan null jika tidak didukung / ditolak.
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Umum',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('EAS projectId belum diset (jalankan `npx eas-cli init`). Push dinonaktifkan.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) throw error;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    console.warn('Gagal mendaftarkan push token', e);
    return null;
  }
}

/** Hapus token perangkat ini sebelum logout agar tidak menerima notifikasi akun lama */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await supabase.from('push_tokens').delete().eq('token', token);
  await AsyncStorage.removeItem(TOKEN_KEY);
}
