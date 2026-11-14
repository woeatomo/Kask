import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Muted, styles as ui } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function Login() {
  const [phoneText, setPhoneText] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const phone = normalizePhone(phoneText);
    if (!phone) return Alert.alert('Nomor tidak valid', 'Masukkan nomor WhatsApp, mis. 0812xxxxxxxx.');
    if (!password) return Alert.alert('Isi password');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ phone, password });
    setLoading(false);
    if (!error) return;
    if (/not confirmed/i.test(error.message)) {
      // daftar tapi belum memasukkan kode OTP: kirim ulang lalu verifikasi
      await supabase.auth.resend({ type: 'sms', phone });
      Alert.alert('Nomor belum diverifikasi', 'Kode verifikasi baru dikirim ke WhatsApp Anda.');
      router.push({ pathname: '/verify-otp', params: { phone, mode: 'signup' } });
      return;
    }
    Alert.alert('Gagal masuk', errorMessage(error));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
        <View style={[ui.row, { gap: space.md, marginBottom: space.xl }]}>
          <Image source={require('../../../assets/logo-kasmee.png')} style={{ width: 64, height: 64 }} accessibilityLabel="Logo Kasmee" />
          <View>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.primary }}>Kasmee</Text>
            <Muted>Iuran, kas & kabar warga RT/RW</Muted>
          </View>
        </View>
        <Input
          label="Nomor WhatsApp"
          value={phoneText}
          onChangeText={setPhoneText}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="0812xxxxxxxx"
        />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        <Button title="Masuk" onPress={submit} loading={loading} />
        <Button title="Lupa password?" variant="ghost" onPress={() => router.push('/forgot-password')} style={{ marginTop: space.sm }} />
        <View style={[ui.row, { justifyContent: 'center', marginTop: space.lg }]}>
          <Muted>Belum punya akun? </Muted>
          <Link href="/register" style={{ color: colors.primary, fontWeight: '700' }}>
            Daftar
          </Link>
        </View>
        <View style={[ui.row, { justifyContent: 'center', marginTop: space.xl, gap: space.lg }]}>
          <Link href="/faq" style={{ color: colors.muted, fontSize: 13 }}>
            Bantuan & FAQ
          </Link>
          <Link href="/privacy" style={{ color: colors.muted, fontSize: 13 }}>
            Kebijakan Privasi
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
