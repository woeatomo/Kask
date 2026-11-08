import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Badge, Button, Card, Muted, Screen, SectionTitle, Title, Body } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCommunity } from '@/context/CommunityContext';
import { communityLabel } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import { useState } from 'react';

export default function Onboarding() {
  const { profile, signOut } = useAuth();
  const { memberships, refresh } = useCommunity();
  const [refreshing, setRefreshing] = useState(false);
  const pending = memberships.filter((m) => m.status === 'pending');
  const suspended = memberships.filter((m) => m.status === 'active' && !m.communities.is_active);

  async function onRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  async function cancel(id: string) {
    const { error } = await supabase.rpc('remove_member', { p_membership_id: id });
    if (error) return Alert.alert('Gagal', errorMessage(error));
    refresh();
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Title>Halo, {profile?.full_name || 'Warga'} 👋</Title>
      <Muted style={{ marginBottom: space.lg }}>
        Anda belum tergabung di komunitas RT / RW mana pun.
      </Muted>

      {pending.length > 0 && (
        <>
          <SectionTitle>Menunggu persetujuan</SectionTitle>
          {pending.map((m) => (
            <Card key={m.id}>
              <Body style={{ fontWeight: '700' }}>{m.communities.name}</Body>
              <Muted>{communityLabel(m.communities)}</Muted>
              <Badge text="Menunggu persetujuan pengurus" tone="warning" />
              <Button title="Batalkan" variant="ghost" small onPress={() => cancel(m.id)} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
            </Card>
          ))}
          <Muted style={{ marginBottom: space.md }}>Tarik layar ke bawah untuk memeriksa status.</Muted>
        </>
      )}

      {suspended.map((m) => (
        <Card key={m.id}>
          <Body style={{ fontWeight: '700' }}>{m.communities.name}</Body>
          <Badge text="Komunitas sedang dinonaktifkan admin" tone="danger" />
        </Card>
      ))}

      <Card>
        <Body style={{ fontWeight: '700' }}>Saya warga</Body>
        <Muted style={{ marginVertical: space.sm }}>
          Minta kode undangan ke pengurus RT/RW Anda, lalu bergabung.
        </Muted>
        <Button title="Gabung dengan kode" icon="enter-outline" onPress={() => router.push('/join-community')} />
      </Card>

      <Card>
        <Body style={{ fontWeight: '700' }}>Saya Ketua RT / RW</Body>
        <Muted style={{ marginVertical: space.sm }}>
          Buat komunitas baru. Anda otomatis menjadi ketua dan bisa mengangkat pengurus.
        </Muted>
        <Button title="Buat komunitas" variant="secondary" icon="add-circle-outline" onPress={() => router.push('/create-community')} />
      </Card>

      {profile?.is_super_admin && (
        <Button title="Panel Admin" icon="shield-checkmark-outline" variant="secondary" onPress={() => router.push('/admin')} style={{ marginBottom: space.md }} />
      )}
      <Button title="Bantuan & FAQ" variant="ghost" icon="help-circle-outline" onPress={() => router.push('/faq')} />
      <Button title="Keluar" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
