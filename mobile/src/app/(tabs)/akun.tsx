import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Share, Text, View } from 'react-native';
import { Badge, Body, Button, Card, ListItem, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { ROLE_LABEL, communityLabel } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function Akun() {
  const { profile, session, signOut } = useAuth();
  const { current, memberships, isPengurus, setCurrent, refresh } = useCurrentCommunity();
  const others = memberships.filter((m) => m.community_id !== current.community_id);
  const c = current.communities;

  function shareCode() {
    Share.share({
      message: `Gabung ke ${c.name} (${communityLabel(c)}) di aplikasi Kask dengan kode undangan: ${c.invite_code}`,
    });
  }

  function leave() {
    Alert.alert('Keluar dari komunitas?', `Anda akan keluar dari ${c.name}.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('remove_member', { p_membership_id: current.id });
          if (error) return Alert.alert('Gagal', errorMessage(error));
          await refresh();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Card>
        <View style={[ui.row, { gap: space.md }]}>
          <Ionicons name="person-circle" size={52} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '700', fontSize: 17 }}>{profile?.full_name || '-'}</Body>
            <Muted>{session?.user.email}</Muted>
            {profile?.phone ? <Muted>{profile.phone}</Muted> : null}
          </View>
        </View>
        <Button title="Ubah profil" small variant="secondary" onPress={() => router.push('/profile')} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
      </Card>

      <SectionTitle>Komunitas aktif</SectionTitle>
      <Card>
        <Body style={{ fontWeight: '700' }}>{c.name}</Body>
        <Muted>
          {communityLabel(c)}
          {c.kelurahan ? ` · ${c.kelurahan}` : ''}
        </Muted>
        <View style={[ui.row, { gap: space.sm, marginTop: space.sm }]}>
          <Badge text={ROLE_LABEL[current.role]} tone={current.role === 'warga' ? 'neutral' : 'info'} />
          {current.position ? <Badge text={current.position} tone="neutral" /> : null}
        </View>
        {c.bank_info ? (
          <>
            <Muted style={{ marginTop: space.md }}>Rekening iuran</Muted>
            <Body>{c.bank_info}</Body>
          </>
        ) : null}
        {isPengurus && (
          <View style={{ marginTop: space.md, padding: space.md, backgroundColor: colors.primarySoft, borderRadius: 10 }}>
            <Muted>Kode undangan warga</Muted>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 4, color: colors.primaryDark }}>{c.invite_code}</Text>
              <Button title="Bagikan" icon="share-social-outline" small onPress={shareCode} />
            </View>
          </View>
        )}
      </Card>

      {isPengurus && (
        <Card style={{ paddingVertical: space.xs }}>
          <ListItem icon="people-outline" title="Anggota & pengurus" onPress={() => router.push('/manage/members')} />
          <ListItem icon="receipt-outline" title="Kelola iuran & tagihan" onPress={() => router.push('/manage/dues')} />
          <ListItem icon="checkmark-done-outline" title="Verifikasi pembayaran" onPress={() => router.push('/manage/verify')} />
          <ListItem icon="settings-outline" title="Pengaturan komunitas" onPress={() => router.push('/manage/community')} />
        </Card>
      )}

      {others.length > 0 && (
        <>
          <SectionTitle>Komunitas lain</SectionTitle>
          <Card style={{ paddingVertical: space.xs }}>
            {others.map((m) => (
              <ListItem
                key={m.id}
                icon="swap-horizontal-outline"
                title={m.communities.name}
                subtitle={m.status === 'pending' ? 'Menunggu persetujuan' : !m.communities.is_active ? 'Dinonaktifkan' : communityLabel(m.communities)}
                onPress={m.status === 'active' && m.communities.is_active ? () => setCurrent(m.community_id) : undefined}
              />
            ))}
          </Card>
        </>
      )}

      <Card style={{ paddingVertical: space.xs }}>
        <ListItem icon="enter-outline" title="Gabung komunitas lain" onPress={() => router.push('/join-community')} />
        <ListItem icon="add-circle-outline" title="Buat komunitas baru" onPress={() => router.push('/create-community')} />
        {profile?.is_super_admin && (
          <ListItem icon="shield-checkmark-outline" title="Panel admin (developer)" onPress={() => router.push('/admin')} />
        )}
        {current.role !== 'ketua' && (
          <ListItem icon="exit-outline" iconColor={colors.danger} title="Keluar dari komunitas ini" onPress={leave} />
        )}
      </Card>

      <Button title="Keluar akun" variant="ghost" icon="log-out-outline" onPress={signOut} />
    </Screen>
  );
}
