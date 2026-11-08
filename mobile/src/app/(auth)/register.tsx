import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Muted, Title } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!fullName.trim() || !email || password.length < 6) {
      return Alert.alert('Lengkapi data', 'Nama dan email wajib diisi, password minimal 6 karakter.');
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), phone: phone.trim() || null } },
    });
    setLoading(false);
    if (error) return Alert.alert('Gagal daftar', errorMessage(error));
    if (!data.session) {
      Alert.alert('Cek email Anda', 'Klik link konfirmasi di email, lalu masuk.');
      router.back();
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
        <Title>Daftar Akun</Title>
        <Muted style={{ marginBottom: space.lg }}>
          Setelah daftar, Anda bisa membuat komunitas (untuk ketua RT/RW) atau bergabung dengan kode undangan.
        </Muted>
        <Input label="Nama lengkap" value={fullName} onChangeText={setFullName} />
        <Input label="No. HP (opsional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry hint="Minimal 6 karakter" />
        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: space.md, lineHeight: 18 }}>
          Dengan mendaftar, Anda menyetujui pemrosesan data sesuai{' '}
          <Link href="/privacy" style={{ color: colors.primary, fontWeight: '600' }}>
            Kebijakan Privasi
          </Link>{' '}
          Kask.
        </Text>
        <Button title="Daftar" onPress={submit} loading={loading} />
        <Button title="Sudah punya akun? Masuk" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
      </ScrollView>
    </SafeAreaView>
  );
}
