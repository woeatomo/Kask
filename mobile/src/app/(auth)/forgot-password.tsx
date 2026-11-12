import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Muted, Title } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function ForgotPassword() {
  const [phoneText, setPhoneText] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const phone = normalizePhone(phoneText);
    if (!phone) return Alert.alert('Nomor tidak valid', 'Masukkan nomor WhatsApp yang terdaftar.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      // jangan buat akun baru dari halaman lupa password
      options: { shouldCreateUser: false, channel: 'whatsapp' },
    });
    setLoading(false);
    if (error) {
      const notFound = /signups not allowed|not found|user/i.test(error.message);
      return Alert.alert('Gagal', notFound ? 'Nomor ini belum terdaftar di Kask.' : errorMessage(error));
    }
    router.push({ pathname: '/verify-otp', params: { phone, mode: 'recovery' } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
        <Title>Lupa password</Title>
        <Muted style={{ marginBottom: space.lg }}>
          Masukkan nomor WhatsApp akun Anda. Kami akan mengirim kode untuk membuat password baru.
        </Muted>
        <Input
          label="Nomor WhatsApp"
          value={phoneText}
          onChangeText={setPhoneText}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="0812xxxxxxxx"
        />
        <Button title="Kirim kode WhatsApp" icon="logo-whatsapp" onPress={submit} loading={loading} />
        <Button title="Kembali" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
      </ScrollView>
    </SafeAreaView>
  );
}
