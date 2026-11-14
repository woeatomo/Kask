import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Muted, Title } from '@/components/ui';
import { normalizePhone } from '@/lib/phone';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [phoneText, setPhoneText] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const phone = normalizePhone(phoneText);
    if (!fullName.trim()) return Alert.alert('Isi nama lengkap');
    if (!phone) return Alert.alert('Nomor tidak valid', 'Masukkan nomor WhatsApp aktif, mis. 0812xxxxxxxx.');
    if (password.length < 6) return Alert.alert('Password minimal 6 karakter');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      phone,
      password,
      options: { data: { full_name: fullName.trim() }, channel: 'whatsapp' },
    });
    setLoading(false);
    if (error) return Alert.alert('Gagal daftar', errorMessage(error));
    // tanpa sesi = perlu verifikasi OTP (jika verifikasi nomor dimatikan, langsung masuk)
    if (!data.session) router.push({ pathname: '/verify-otp', params: { phone, mode: 'signup' } });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
        <Image source={require('../../../assets/logo-kasmee.png')} style={{ width: 56, height: 56, marginBottom: space.md }} accessibilityLabel="Logo Kasmee" />
        <Title>Daftar Akun Kasmee</Title>
        <Muted style={{ marginBottom: space.lg }}>
          Kode verifikasi akan dikirim ke WhatsApp Anda. Setelah itu Anda bisa membuat komunitas (ketua RT/RW) atau bergabung
          dengan kode undangan.
        </Muted>
        <Input label="Nama lengkap" value={fullName} onChangeText={setFullName} autoComplete="name" />
        <Input
          label="Nomor WhatsApp"
          value={phoneText}
          onChangeText={setPhoneText}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="0812xxxxxxxx"
          hint="Dipakai untuk masuk dan menerima kode verifikasi"
        />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="Minimal 6 karakter" />
        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: space.md, lineHeight: 18 }}>
          Dengan mendaftar, Anda menyetujui pemrosesan data sesuai{' '}
          <Link href="/privacy" style={{ color: colors.primary, fontWeight: '600' }}>
            Kebijakan Privasi
          </Link>{' '}
          Kasmee.
        </Text>
        <Button title="Daftar & kirim kode WhatsApp" icon="logo-whatsapp" onPress={submit} loading={loading} />
        <Button title="Sudah punya akun? Masuk" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
      </ScrollView>
    </SafeAreaView>
  );
}
