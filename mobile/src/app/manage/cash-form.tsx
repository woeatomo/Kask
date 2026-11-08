import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { Button, Chips, Input, Muted, Screen, Segmented } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { isoDate, parseAmount, rupiah } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { CashTransaction, CashType } from '@/lib/types';

const CATEGORIES: Record<CashType, string[]> = {
  masuk: ['Donasi', 'Sewa fasilitas', 'Bantuan pemerintah', 'Saldo awal', 'Lainnya'],
  keluar: ['Kebersihan', 'Keamanan', 'Listrik & air', 'Perbaikan', 'Kegiatan', 'Sosial', 'ATK', 'Lainnya'],
};

export default function CashForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { communityId, rtUnits, canManageRt, scopeRtUnitId } = useCurrentCommunity();
  const [rtUnit, setRtUnit] = useState(scopeRtUnitId ?? '');
  const kasOptions = [
    ...(canManageRt(null) ? [{ value: '', label: 'Kas RW' }] : []),
    ...rtUnits.filter((r) => canManageRt(r.id)).map((r) => ({ value: r.id, label: `Kas RT ${r.rt_number}` })),
  ];
  const [type, setType] = useState<CashType>('keluar');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Lainnya');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(isoDate(new Date()));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from('cash_transactions').select('*').eq('id', id).single().then(({ data }) => {
      const t = data as CashTransaction | null;
      if (!t) return;
      setType(t.type);
      setAmount(String(Math.round(t.amount)));
      setCategory(t.category);
      setDescription(t.description ?? '');
      setDate(t.trx_date);
      setRtUnit(t.rt_unit_id ?? '');
    });
  }, [id]);

  async function save() {
    const amt = parseAmount(amount);
    if (amt <= 0) return Alert.alert('Nominal wajib diisi');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return Alert.alert('Format tanggal: YYYY-MM-DD');
    const row = {
      type,
      amount: amt,
      category: category.trim() || 'Lainnya',
      description: description.trim() || null,
      trx_date: date,
      rt_unit_id: rtUnit || null,
    };
    setSaving(true);
    const { error } = id
      ? await supabase.from('cash_transactions').update(row).eq('id', id)
      : await supabase.from('cash_transactions').insert({ ...row, community_id: communityId });
    setSaving(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    router.back();
  }

  function remove() {
    Alert.alert('Hapus transaksi?', undefined, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('cash_transactions').delete().eq('id', id!);
          if (error) return Alert.alert('Gagal', errorMessage(error));
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Segmented
        label="Jenis"
        value={type}
        onChange={(t) => {
          setType(t);
          setCategory('Lainnya');
        }}
        options={[
          { value: 'keluar', label: 'Pengeluaran' },
          { value: 'masuk', label: 'Pemasukan lain' },
        ]}
      />
      {rtUnits.length > 0 && (
        <>
          <Muted style={{ marginBottom: space.sm }}>Buku kas</Muted>
          <Chips value={rtUnit} onChange={setRtUnit} options={kasOptions} />
        </>
      )}
      <Input
        label="Nominal"
        value={amount}
        onChangeText={(t) => setAmount(t.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        hint={parseAmount(amount) ? rupiah(parseAmount(amount)) : undefined}
      />
      <Muted style={{ marginBottom: space.sm }}>Kategori</Muted>
      <Chips value={category} onChange={setCategory} options={CATEGORIES[type].map((c) => ({ value: c, label: c }))} />
      <Input label="Keterangan" value={description} onChangeText={setDescription} placeholder="mis. Beli lampu jalan 3 buah" />
      <Input label="Tanggal (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Button title="Simpan" onPress={save} loading={saving} />
      {id && <Button title="Hapus transaksi" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} />}
    </Screen>
  );
}
