import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActionSheetProvider } from '@/components/ActionSheet';
import { PushHandler } from '@/components/PushHandler';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CommunityProvider, useCommunity } from '@/context/CommunityContext';
import { isConfigured } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export { ErrorBoundary } from 'expo-router';

function RootNavigator() {
  const { session, loading: authLoading, profile } = useAuth();
  const { current, loading: communityLoading } = useCommunity();

  if (authLoading || (session && communityLoading)) return <Loading />;

  const signedIn = !!session;
  const hasCommunity = signedIn && !!current;
  const isAdmin = !!profile?.is_super_admin;

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg },
        headerBackTitle: 'Kembali',
      }}
    >
      {/* index mengarahkan ke layar yang sesuai dengan status login */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      {/* bisa dibuka tanpa login (wajib untuk kebijakan toko aplikasi) */}
      <Stack.Screen name="faq" options={{ title: 'Bantuan & FAQ' }} />
      <Stack.Screen name="privacy" options={{ title: 'Kebijakan Privasi' }} />

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasCommunity}>
        <Stack.Screen name="onboarding" options={{ title: 'Selamat datang', headerBackVisible: false }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="create-community" options={{ title: 'Buat Komunitas' }} />
        <Stack.Screen name="join-community" options={{ title: 'Gabung Komunitas' }} />
        <Stack.Screen name="profile" options={{ title: 'Profil Saya' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifikasi' }} />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && isAdmin}>
        <Stack.Screen name="admin" options={{ title: 'Panel Admin' }} />
      </Stack.Protected>

      <Stack.Protected guard={hasCommunity}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="pay" options={{ title: 'Bayar Iuran', presentation: 'modal' }} />
        <Stack.Screen name="premium" options={{ title: 'Kask Premium' }} />
        <Stack.Screen name="news/[id]" options={{ title: 'Berita' }} />
        <Stack.Screen name="news/edit" options={{ title: 'Tulis Berita', presentation: 'modal' }} />
        <Stack.Screen name="manage/dues" options={{ title: 'Kelola Iuran' }} />
        <Stack.Screen name="manage/due-form" options={{ title: 'Iuran', presentation: 'modal' }} />
        <Stack.Screen name="manage/bills" options={{ title: 'Tagihan Warga' }} />
        <Stack.Screen name="manage/verify" options={{ title: 'Verifikasi Pembayaran' }} />
        <Stack.Screen name="manage/members" options={{ title: 'Anggota' }} />
        <Stack.Screen name="manage/community" options={{ title: 'Pengaturan Komunitas' }} />
        <Stack.Screen name="manage/cash-form" options={{ title: 'Transaksi Kas', presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

function MissingConfig() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Konfigurasi belum lengkap</Text>
      <Text style={{ color: colors.muted }}>
        Salin mobile/.env.example menjadi mobile/.env lalu isi EXPO_PUBLIC_SUPABASE_URL dan
        EXPO_PUBLIC_SUPABASE_ANON_KEY, kemudian jalankan ulang `npx expo start`.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isConfigured ? (
        <AuthProvider>
          <CommunityProvider>
            <ActionSheetProvider>
              <RootNavigator />
              <PushHandler />
            </ActionSheetProvider>
          </CommunityProvider>
        </AuthProvider>
      ) : (
        <MissingConfig />
      )}
    </SafeAreaProvider>
  );
}
