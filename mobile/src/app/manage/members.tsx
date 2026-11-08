import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useActionSheet, type SheetOption } from '@/components/ActionSheet';
import { Badge, Body, Button, Card, Chips, Empty, ListItem, Loading, Muted, ProgressBar, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { useCommunity, useCurrentCommunity } from '@/context/CommunityContext';
import { ROLE_LABEL, tanggal } from '@/lib/format';
import type { CommunityUsage } from '@/lib/plan';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { MemberRole, MemberRow } from '@/lib/types';
import { must, useData } from '@/lib/useData';

const ROLE_ORDER: Record<MemberRole, number> = { ketua: 0, pengurus: 1, warga: 2 };

export default function Members() {
  const { communityId, current, isKetua, rtUnits, rtLabel, canManageRt, scopeRtUnitId } = useCurrentCommunity();
  const { refresh: refreshCommunity } = useCommunity();
  const [rtFilter, setRtFilter] = useState(scopeRtUnitId ?? '');
  const sheet = useActionSheet();

  const load = useCallback(async () => {
    const usageRes = await supabase.rpc('community_usage', { p_community_id: communityId });
    const m = await supabase
      .from('memberships')
      .select('*, profiles(full_name, phone), rt_units:rt_units!memberships_rt_unit_id_community_id_fkey(rt_number)')
      .eq('community_id', communityId)
      .in('status', ['active', 'pending']);
    const members = ((must(m) ?? []) as MemberRow[]).sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? ''),
    );
    return { members, usage: must(usageRes) as CommunityUsage };
  }, [communityId]);

  const { data, loading, refreshing, refresh, reload } = useData<{ members: MemberRow[]; usage: CommunityUsage } | null>(load, null);
  if (loading || !data) return <Loading />;

  const pending = data.members.filter((m) => m.status === 'pending');
  const active = data.members.filter((m) => m.status === 'active');
  const pengurus = active.filter((m) => m.role !== 'warga');
  const warga = active.filter((m) => m.role === 'warga' && (!rtFilter || m.rt_unit_id === rtFilter));

  async function rpc(fn: string, args: Record<string, unknown>) {
    const { error } = await supabase.rpc(fn, args);
    if (error) {
      if (error.hint === 'member_limit') {
        Alert.alert('Batas anggota tercapai', error.message, [
          { text: 'Nanti', style: 'cancel' },
          { text: 'Lihat Premium', onPress: () => router.push('/premium') },
        ]);
      } else {
        Alert.alert('Gagal', errorMessage(error));
      }
      return false;
    }
    reload();
    return true;
  }

  function setPengurus(m: MemberRow, position: string, scope: string | null) {
    rpc('set_member_role', { p_membership_id: m.id, p_role: 'pengurus', p_position: position, p_managed_rt_unit_id: scope });
  }

  /** Di komunitas RW: tentukan apakah wewenang pengurus ini seluruh RW atau satu RT */
  function chooseScope(m: MemberRow, position: string) {
    if (rtUnits.length === 0) return setPengurus(m, position, null);
    sheet({
      title: 'Batas wewenang',
      message: `${position}: berwenang atas warga mana?`,
      options: [
        { label: 'Seluruh RW (tanpa batas)', onPress: () => setPengurus(m, position, null) },
        ...rtUnits.map((r) => ({ label: `Hanya RT ${r.rt_number}`, onPress: () => setPengurus(m, position, r.id) })),
      ],
    });
  }

  function choosePosition(m: MemberRow) {
    const options: SheetOption[] = [
      ...rtUnits.map((r) => ({
        label: `Ketua RT ${r.rt_number}`,
        // ketua RT otomatis dibatasi ke RT-nya
        onPress: () => setPengurus(m, `Ketua RT ${r.rt_number}`, r.id),
      })),
      ...['Bendahara', 'Sekretaris', 'Pengurus'].map((p) => ({ label: p, onPress: () => chooseScope(m, p) })),
    ];
    sheet({ title: 'Pilih jabatan', message: m.profiles?.full_name ?? '', options });
  }

  function chooseRt(m: MemberRow) {
    sheet({
      title: 'Pindah RT',
      message: m.profiles?.full_name ?? '',
      options: rtUnits.map((r) => ({
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
    // memindahkan antar RT hanya oleh pengurus tingkat RW
    if (rtUnits.length > 0 && canManageRt(null)) buttons.push({ label: 'Pindah RT', onPress: () => chooseRt(m) });
    if (!isSelf && m.role !== 'ketua' && (isKetua || (m.role === 'warga' && canManageRt(m.rt_unit_id)))) {
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
      subtitle={[
        m.position,
        m.managed_rt_unit_id ? `wewenang ${rtLabel(m.managed_rt_unit_id)}` : null,
        m.rt_units ? `RT ${m.rt_units.rt_number}` : null,
        m.address,
      ]
        .filter(Boolean)
        .join(' · ')}
      right={m.role !== 'warga' ? <Badge text={ROLE_LABEL[m.role]} tone="info" /> : undefined}
      onPress={() => actions(m)}
    />
  );

  const { usage } = data;
  const full = usage.member_limit !== null && usage.active_members >= usage.member_limit;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {usage.member_limit !== null && (
        <Card style={full ? { borderColor: colors.warning, backgroundColor: colors.warningSoft } : undefined}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Body style={{ fontWeight: '700' }}>
              {usage.active_members} / {usage.member_limit} anggota aktif
            </Body>
            <Badge text="Paket Gratis" />
          </View>
          <ProgressBar value={usage.active_members / usage.member_limit} />
          {full ? (
            <Muted style={{ marginTop: space.sm, color: colors.warning }}>
              Batas tercapai. Warga baru belum bisa disetujui sampai komunitas beralih ke Premium.
            </Muted>
          ) : null}
          <Button
            title={full ? 'Upgrade ke Premium' : 'Anggota tanpa batas dengan Premium'}
            small
            variant={full ? 'primary' : 'ghost'}
            icon="star-outline"
            onPress={() => router.push('/premium')}
            style={{ alignSelf: 'flex-start', marginTop: space.sm }}
          />
        </Card>
      )}
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
      {rtUnits.length > 0 && (
        <Chips
          value={rtFilter}
          onChange={setRtFilter}
          options={[{ value: '', label: 'Semua RT' }, ...rtUnits.map((r) => ({ value: r.id, label: `RT ${r.rt_number}` }))]}
        />
      )}
      {warga.length === 0 ? (
        <Empty icon="people-outline" text="Belum ada warga. Bagikan kode undangan dari tab Akun." />
      ) : (
        <Card style={{ paddingVertical: space.xs }}>{warga.map(memberItem)}</Card>
      )}
      <Muted style={{ textAlign: 'center' }}>
        {isKetua ? 'Ketuk anggota untuk mengatur jabatan dan batas wewenang.' : 'Hanya ketua yang dapat mengatur jabatan pengurus.'}
        {scopeRtUnitId ? ` Wewenang Anda: ${rtLabel(scopeRtUnitId)}.` : ''}
      </Muted>
    </Screen>
  );
}
