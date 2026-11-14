import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, Input, Muted, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { formatPhone } from '@/lib/phone';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile) return;
    if (!fullName.trim()) return Alert.alert('Nama wajib diisi');
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', profile.id);
    setSaving(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    await refreshProfile();
    router.back();
  }

  return (
    <Screen>
      <Input label="Nama lengkap" value={fullName} onChangeText={setFullName} />
      <Card>
        <Muted>Nomor WhatsApp (untuk masuk)</Muted>
        <Body style={{ fontWeight: '700', marginTop: 2 }}>{formatPhone(profile?.phone)}</Body>
        <Muted style={{ marginTop: space.sm }}>
          Nomor login tidak bisa diubah dari aplikasi. Jika ganti nomor, hubungi pengelola Kasmee.
        </Muted>
      </Card>
      <Button title="Simpan" onPress={save} loading={saving} />
      <Button title="Ganti password" variant="ghost" icon="key-outline" onPress={() => router.push('/set-password')} style={{ marginTop: space.sm }} />
    </Screen>
  );
}
