import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Input, Screen } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { errorMessage, supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq('id', profile.id);
    setSaving(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    await refreshProfile();
    router.back();
  }

  return (
    <Screen>
      <Input label="Nama lengkap" value={fullName} onChangeText={setFullName} />
      <Input label="No. HP" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Button title="Simpan" onPress={save} loading={saving} />
    </Screen>
  );
}
