import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useActionSheet, type SheetOption } from '@/components/ActionSheet';
import { Badge, Body, Button, Card, Chips, Empty, ListItem, Loading, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { useCommunity, useCurrentCommunity } from '@/context/CommunityContext';
import { ROLE_LABEL, tanggal } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { MemberRole, MemberRow, RtUnit } from '@/lib/types';
import { must, useData } from '@/lib/useData';

const ROLE_ORDER: Record<MemberRole, number> = { ketua: 0, pengurus: 1, warga: 2 };

export default function Members() {
  const { communityId, current, isKetua } = useCurrentCommunity();
  const { refresh: refreshCommunity } = useCommunity();
  const [rtFilter, setRtFilter] = useState('');
  const sheet = useActionSheet();

  const load = useCallback(async () => {
    const [m, r] = await Promise.all([
      supabase
        .from('memberships')
        .select('*, profiles(full_name, phone), rt_units(rt_number)')
        .eq('community_id', communityId)
        .in('status', ['active', 'pending']),
      supabase.from('rt_units').select('*').eq('community_id', communityId).order('rt_number'),
    ]);
    const members = ((must(m) ?? []) as MemberRow[]).sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? ''),
    );
    return { members, rtUnits: (must(r) ?? []) as RtUnit[] };
  }, [communityId]);

  const { data, loading, refreshing, refresh, reload } = useData<{ members: MemberRow[]; rtUnits: RtUnit[] } | null>(load, null);
  if (loading || !data) return <Loading />;

  const pending = data.members.filter((m) => m.status === 'pending');
  const active = data.members.filter((m) => m.status === 'active');
  const pengurus = active.filter((m) => m.role !== 'warga');
  const warga = active.filter((m) => m.role === 'warga' && (!rtFilter || m.rt_unit_id === rtFilter));

  async function rpc(fn: string, args: Record<string, unknown>) {
    const { error } = await supabase.rpc(fn, args);
    if (error) {
      Alert.alert('Gagal', errorMessage(error));
      return false;
    }
    reload();
    return true;
  }

  function choosePosition(m: MemberRow) {
    const positions = ['Bendahara', 'Sekretaris', ...(current.communities.type === 'RW' ? data!.rtUnits.map((r) => `Ketua RT ${r.rt_number}`) : []), 'Pengurus'];
    sheet({
      title: 'Pilih jabatan',
      message: m.profiles?.full_name ?? '',
      options: positions.map((p) => ({
        label: p,
        onPress: () => rpc('set_member_role', { p_membership_id: m.id, p_role: 'pengurus', p_position: p }),
      })),
    });
  }

  function chooseRt(m: MemberRow) {
    sheet({
      title: 'Pindah RT',
      message: m.profiles?.full_name ?? '',
      options: data!.rtUnits.map((r) => ({
        label: `RT ${r.rt_number}`,
        onPress: () => rpc('update_member_info', { p_membership_id: m.id, p_rt_unit_id: r.id, p_address: m.address }),
      })),
    });
  }

  function actions(m: MemberRow) {
    const name = m.profiles?.full_name || 'Anggota';
    const isSelf = m.id === current.id;
    const buttons: SheetOption[] = [];
    if (isKetua && m.role !== 'ketua') {
      buttons.push({ label: m.role === 'pengurus' ? 'Ubah jabatan' : 'Jadikan pengurus', onPress: () => choosePosition(m) });
      if (m.role === 'pengurus') {
        buttons.push({ label: 'Jadikan warga biasa', onPress: () => rpc('set_member_role', { p_membership_id: m.id, p_role: 'warga' }) });
      }
      buttons.push({
        label: 'Serahkan jabatan ketua',
        onPress: () =>
          Alert.alert('Serah terima jabatan', `${name} akan menjadi ketua. Anda menjadi pengurus. Lanjutkan?`, [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Ya, serahkan',
              onPress: async () => {
                const pos = current.communities.type === 'RW' ? `Ketua RW ${current.communities.rw_number}` : `Ketua RT ${current.communities.rt_number}`;
                if (await rpc('set_member_role', { p_membership_id: m.id, p_role: 'ketua', p_position: pos })) refreshCommunity();
              },
            },
          ]),
      });
    }
    if (data!.rtUnits.length > 0) buttons.push({ label: 'Pindah RT', onPress: () => chooseRt(m) });
    if (!isSelf && m.role !== 'ketua' && (isKetua || m.role === 'warga')) {
      buttons.push({
        label: 'Keluarkan',
        destructive: true,
        onPress: () =>
          Alert.alert('Keluarkan anggota?', name, [
            { text: 'Batal', style: 'cancel' },
            { text: 'Keluarkan', style: 'destructive', onPress: () => rpc('remove_member', { p_membership_id: m.id }) },
          ]),
      });
    }
    if (buttons.length === 0) return;
    sheet({ title: name, message: [m.profiles?.phone, m.address].filter(Boolean).join(' · ') || undefined, options: buttons });
  }

  const memberItem = (m: MemberRow) => (
    <ListItem
      key={m.id}
      icon={m.role === 'ketua' ? 'star' : m.role === 'pengurus' ? 'ribbon-outline' : 'person-outline'}
      title={m.profiles?.full_name || 'Tanpa nama'}
      subtitle={[m.position, m.rt_units ? `RT ${m.rt_units.rt_number}` : null, m.address].filter(Boolean).join(' · ')}
      right={m.role !== 'warga' ? <Badge text={ROLE_LABEL[m.role]} tone="info" /> : undefined}
      onPress={() => actions(m)}
    />
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {pending.length > 0 && (
        <>
          <SectionTitle>Permintaan bergabung ({pending.length})</SectionTitle>
          {pending.map((m) => (
            <Card key={m.id}>
              <Body style={{ fontWeight: '700' }}>{m.profiles?.full_name || 'Tanpa nama'}</Body>
              <Muted>
                {[m.rt_units ? `RT ${m.rt_units.rt_number}` : null, m.address, m.profiles?.phone].filter(Boolean).join(' · ') || '-'}
              </Muted>
              <Muted>Mendaftar {tanggal(m.joined_at)}</Muted>
              <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
                <Button title="Setujui" small icon="checkmark" onPress={() => rpc('approve_member', { p_membership_id: m.id, p_approve: true })} />
                <Button title="Tolak" small variant="ghost" onPress={() => rpc('approve_member', { p_membership_id: m.id, p_approve: false })} />
              </View>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>Pengurus</SectionTitle>
      <Card style={{ paddingVertical: space.xs }}>{pengurus.map(memberItem)}</Card>

      <SectionTitle>Warga ({warga.length})</SectionTitle>
      {data.rtUnits.length > 0 && (
        <Chips
          value={rtFilter}
          onChange={setRtFilter}
          options={[{ value: '', label: 'Semua RT' }, ...data.rtUnits.map((r) => ({ value: r.id, label: `RT ${r.rt_number}` }))]}
        />
      )}
      {warga.length === 0 ? (
        <Empty icon="people-outline" text="Belum ada warga. Bagikan kode undangan dari tab Akun." />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>{warga.map(memberItem)}</Card>
      )}
      <Muted style={{ textAlign: 'center' }}>
        {isKetua ? 'Ketuk anggota untuk mengatur jabatan.' : 'Hanya ketua yang dapat mengatur jabatan pengurus.'}
      </Muted>
    </Screen>
  );
}
