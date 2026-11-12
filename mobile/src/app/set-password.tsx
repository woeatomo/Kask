import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Input, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

/** Buat password baru: wajib setelah "Lupa password", atau dari menu Profil */
export default function SetPassword() {
  const { recovering, setRecovering, signOut } = useAuth();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (p1.length < 6) return Alert.alert('Password minimal 6 karakter');
    if (p1 !== p2) return Alert.alert('Kedua password tidak sama');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setSaving(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    Alert.alert('Berhasil', 'Password baru sudah disimpan.');
    if (recovering) {
      setRecovering(false);
      router.replace('/');
    } else {
      router.back();
    }
  }

  return (
    <Screen>
      <Muted style={{ marginBottom: space.lg }}>
        {recovering
          ? 'Nomor WhatsApp Anda sudah terverifikasi. Buat password baru untuk masuk ke Kask.'
          : 'Masukkan password baru untuk akun Anda.'}
      </Muted>
      <Input label="Password baru" value={p1} onChangeText={setP1} secureTextEntry autoComplete="new-password" />
      <Input label="Ulangi password baru" value={p2} onChangeText={setP2} secureTextEntry autoComplete="new-password" />
      <Button title="Simpan password" onPress={save} loading={saving} />
      {recovering && <Button title="Batal & keluar" variant="ghost" onPress={signOut} style={{ marginTop: space.sm }} />}
    </Screen>
  );
}
