import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Muted, Title } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { formatPhone } from '@/lib/phone';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

const RESEND_SECONDS = 60;

export default function VerifyOtp() {
  const { phone, mode } = useLocalSearchParams<{ phone: string; mode: 'signup' | 'recovery' }>();
  const { setRecovering } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const submitted = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(token: string) {
    if (submitted.current) return;
    submitted.current = true;
    setLoading(true);
    // tandai dulu agar navigator langsung mengarah ke "buat password baru" begitu sesi aktif
    if (mode === 'recovery') setRecovering(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    setLoading(false);
    submitted.current = false;
    if (error) {
      if (mode === 'recovery') setRecovering(false);
      setCode('');
      const expired = /expired|invalid/i.test(error.message);
      Alert.alert('Kode salah', expired ? 'Kode salah atau sudah kedaluwarsa. Minta kode baru.' : errorMessage(error));
    }
    // sukses: sesi aktif, navigator otomatis pindah (beranda / buat password baru)
  }

  async function resend() {
    const { error } =
      mode === 'recovery'
        ? await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false, channel: 'whatsapp' } })
        : await supabase.auth.resend({ type: 'sms', phone });
    if (error) return Alert.alert('Gagal mengirim ulang', errorMessage(error));
    setWait(RESEND_SECONDS);
    Alert.alert('Terkirim', 'Kode baru sudah dikirim ke WhatsApp Anda.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
        <Title>Masukkan kode</Title>
        <Muted style={{ marginBottom: space.xl }}>
          Kode 6 digit telah dikirim lewat WhatsApp ke{' '}
          <Text style={{ fontWeight: '700', color: colors.text }}>{formatPhone(phone).replace(/-/g, '\u2011')}</Text>.
        </Muted>
        <TextInput
          value={code}
          onChangeText={(t) => {
            const v = t.replace(/\D/g, '').slice(0, 6);
            setCode(v);
            if (v.length === 6) verify(v);
          }}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={6}
          autoFocus
          placeholder="••••••"
          placeholderTextColor={colors.muted}
          style={{
            fontSize: 32,
            letterSpacing: 12,
            textAlign: 'center',
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: space.md,
            marginBottom: space.lg,
            color: colors.text,
          }}
        />
        <Button title="Verifikasi" onPress={() => verify(code)} loading={loading} disabled={code.length !== 6} />
        <Button
          title={wait > 0 ? `Kirim ulang kode (${wait} dtk)` : 'Kirim ulang kode'}
          variant="ghost"
          disabled={wait > 0}
          onPress={resend}
          style={{ marginTop: space.sm }}
        />
        <Button title="Ganti nomor" variant="ghost" onPress={() => router.back()} />
        <Muted style={{ textAlign: 'center', marginTop: space.lg }}>
          Tidak menerima kode? Pastikan nomor aktif di WhatsApp dan tidak memblokir pesan dari nomor tidak dikenal.
        </Muted>
      </ScrollView>
    </SafeAreaView>
  );
}
