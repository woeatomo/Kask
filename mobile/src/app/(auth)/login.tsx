import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, Muted, styles as ui } from '@/components/ui';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email || !password) return Alert.alert('Lengkapi email dan password');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Gagal masuk', errorMessage(error));
  }

  async function forgot() {
    if (!email) return Alert.alert('Isi email terlebih dahulu');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    Alert.alert(error ? 'Gagal' : 'Terkirim', error ? errorMessage(error) : 'Cek email untuk reset password.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
        <Text style={{ fontSize: 40, fontWeight: '800', color: colors.primary }}>Kask</Text>
        <Muted style={{ marginBottom: space.xl }}>Iuran, kas, dan berita warga RT / RW</Muted>
        <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        <Button title="Masuk" onPress={submit} loading={loading} />
        <Button title="Lupa password?" variant="ghost" onPress={forgot} style={{ marginTop: space.sm }} />
        <View style={[ui.row, { justifyContent: 'center', marginTop: space.lg }]}>
          <Muted>Belum punya akun? </Muted>
          <Link href="/register" style={{ color: colors.primary, fontWeight: '700' }}>
            Daftar
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
