import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Body, Button, Chips, Input, Muted, Screen, Segmented, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { parseAmount, rupiah } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Due, DueFrequency, DueKind, RtUnit } from '@/lib/types';

export default function DueForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { communityId, current } = useCurrentCommunity();
  const [kind, setKind] = useState<DueKind>('wajib');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<DueFrequency>('bulanan');
  const [amount, setAmount] = useState('');
  const [target, setTarget] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [rtUnit, setRtUnit] = useState('');
  const [active, setActive] = useState(true);
  const [rtUnits, setRtUnits] = useState<RtUnit[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (current.communities.type === 'RW') {
      supabase.from('rt_units').select('*').eq('community_id', communityId).order('rt_number')
        .then(({ data }) => setRtUnits((data ?? []) as RtUnit[]));
    }
    if (!id) return;
    supabase.from('dues').select('*').eq('id', id).single().then(({ data }) => {
      const d = data as Due | null;
      if (!d) return;
      setKind(d.kind);
      setName(d.name);
      setDescription(d.description ?? '');
      setFrequency(d.frequency);
      setAmount(d.amount ? String(Math.round(d.amount)) : '');
      setTarget(d.target_amount ? String(Math.round(d.target_amount)) : '');
      setDueDay(String(d.due_day));
      setRtUnit(d.rt_unit_id ?? '');
      setActive(d.is_active);
    });
  }, [id, communityId, current.communities.type]);

  async function save() {
    const amt = parseAmount(amount);
    const day = Number(dueDay);
    if (!name.trim()) return Alert.alert('Nama iuran wajib diisi');
    if (kind === 'wajib' && amt <= 0) return Alert.alert('Nominal iuran wajib diisi');
    if (kind === 'wajib' && frequency === 'bulanan' && !(day >= 1 && day <= 28)) {
      return Alert.alert('Tanggal jatuh tempo harus 1–28');
    }
    const row = {
      name: name.trim(),
      description: description.trim() || null,
      kind,
      frequency: kind === 'wajib' ? frequency : 'sekali',
      amount: kind === 'wajib' ? amt : null,
      target_amount: kind === 'sukarela' ? parseAmount(target) || null : null,
      due_day: kind === 'wajib' && frequency === 'bulanan' ? day : 10,
      rt_unit_id: rtUnit || null,
      is_active: active,
    };
    setSaving(true);
    const { error } = id
      ? await supabase.from('dues').update(row).eq('id', id)
      : await supabase.from('dues').insert({ ...row, community_id: communityId });
    setSaving(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    router.back();
  }

  function remove() {
    Alert.alert('Hapus iuran?', 'Semua tagihan dan riwayat pembayaran iuran ini ikut terhapus, termasuk pemasukan kasnya. Sebaiknya nonaktifkan saja.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('dues').delete().eq('id', id!);
          if (error) return Alert.alert('Gagal', errorMessage(error));
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      {!id && (
        <Segmented
          label="Jenis"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'wajib', label: 'Wajib (tagihan)' },
            { value: 'sukarela', label: 'Sukarela (donasi)' },
          ]}
        />
      )}
      <Input label="Nama iuran" value={name} onChangeText={setName} placeholder={kind === 'wajib' ? 'Iuran Kebersihan & Keamanan' : 'Donasi Renovasi Pos Ronda'} />
      <Input label="Keterangan" value={description} onChangeText={setDescription} multiline />

      {kind === 'wajib' ? (
        <>
          <Segmented
            label="Frekuensi"
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: 'bulanan', label: 'Bulanan' },
              { value: 'sekali', label: 'Sekali' },
            ]}
          />
          <Input
            label="Nominal per warga"
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            hint={parseAmount(amount) ? rupiah(parseAmount(amount)) : undefined}
          />
          {frequency === 'bulanan' && (
            <Input label="Tanggal jatuh tempo (1–28)" value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" />
          )}
        </>
      ) : (
        <Input
          label="Target dana (opsional)"
          value={target}
          onChangeText={(t) => setTarget(t.replace(/[^\d]/g, ''))}
          keyboardType="number-pad"
          hint={parseAmount(target) ? rupiah(parseAmount(target)) : undefined}
        />
      )}

      {rtUnits.length > 0 && (
        <>
          <Muted style={{ marginBottom: space.sm }}>Berlaku untuk</Muted>
          <Chips
            value={rtUnit}
            onChange={setRtUnit}
            options={[{ value: '', label: 'Semua RT' }, ...rtUnits.map((r) => ({ value: r.id, label: `RT ${r.rt_number}` }))]}
          />
        </>
      )}

      <View style={[ui.row, { justifyContent: 'space-between', marginBottom: space.lg }]}>
        <Body>{kind === 'wajib' ? 'Aktif' : 'Masih menerima sumbangan'}</Body>
        <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary }} />
      </View>
      <Button title="Simpan" onPress={save} loading={saving} />
      {id && <Button title="Hapus iuran" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} />}
    </Screen>
  );
}
