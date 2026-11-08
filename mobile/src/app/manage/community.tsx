import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { Body, Button, Card, Input, ListItem, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { RtUnit } from '@/lib/types';

export default function CommunitySettings() {
  const { current, communityId, isKetua, refresh } = useCurrentCommunity();
  const c = current.communities;
  const [name, setName] = useState(c.name);
  const [kelurahan, setKelurahan] = useState(c.kelurahan ?? '');
  const [kecamatan, setKecamatan] = useState(c.kecamatan ?? '');
  const [kota, setKota] = useState(c.kota ?? '');
  const [provinsi, setProvinsi] = useState(c.provinsi ?? '');
  const [address, setAddress] = useState(c.address ?? '');
  const [bankInfo, setBankInfo] = useState(c.bank_info ?? '');
  const [saving, setSaving] = useState(false);
  const [rtUnits, setRtUnits] = useState<RtUnit[]>([]);
  const [newRt, setNewRt] = useState('');

  const loadRt = useCallback(async () => {
    const { data } = await supabase.from('rt_units').select('*').eq('community_id', communityId).order('rt_number');
    setRtUnits((data ?? []) as RtUnit[]);
  }, [communityId]);

  useEffect(() => {
    if (c.type === 'RW') loadRt();
  }, [c.type, loadRt]);

  async function save() {
    if (!name.trim()) return Alert.alert('Nama wajib diisi');
    setSaving(true);
    const { error } = await supabase
      .from('communities')
      .update({
        name: name.trim(),
        kelurahan: kelurahan.trim() || null,
        kecamatan: kecamatan.trim() || null,
        kota: kota.trim() || null,
        provinsi: provinsi.trim() || null,
        address: address.trim() || null,
        bank_info: bankInfo.trim() || null,
      })
      .eq('id', communityId);
    setSaving(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    await refresh();
    Alert.alert('Tersimpan');
  }

  async function addRt() {
    const n = newRt.trim();
    if (!n) return;
    const { error } = await supabase.from('rt_units').insert({ community_id: communityId, rt_number: n.padStart(2, '0') });
    if (error) return Alert.alert('Gagal', errorMessage(error));
    setNewRt('');
    loadRt();
  }

  function removeRt(r: RtUnit) {
    Alert.alert(`Hapus RT ${r.rt_number}?`, 'Warga di RT ini tidak terhapus, hanya pengelompokannya.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('rt_units').delete().eq('id', r.id);
          if (error) return Alert.alert('Gagal', errorMessage(error));
          loadRt();
        },
      },
    ]);
  }

  function regenerate() {
    Alert.alert('Ganti kode undangan?', 'Kode lama tidak bisa dipakai lagi.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ganti',
        onPress: async () => {
          const { error } = await supabase.rpc('regenerate_invite_code', { p_community_id: communityId });
          if (error) return Alert.alert('Gagal', errorMessage(error));
          await refresh();
        },
      },
    ]);
  }

  return (
    <Screen>
      {!isKetua && <Muted style={{ marginBottom: space.md }}>Hanya ketua yang dapat mengubah data komunitas.</Muted>}
      <Input label="Nama komunitas" value={name} onChangeText={setName} editable={isKetua} />
      <Input label="Kelurahan / Desa" value={kelurahan} onChangeText={setKelurahan} editable={isKetua} />
      <Input label="Kecamatan" value={kecamatan} onChangeText={setKecamatan} editable={isKetua} />
      <Input label="Kota / Kabupaten" value={kota} onChangeText={setKota} editable={isKetua} />
      <Input label="Provinsi" value={provinsi} onChangeText={setProvinsi} editable={isKetua} />
      <Input label="Alamat sekretariat" value={address} onChangeText={setAddress} editable={isKetua} />
      <Input
        label="Info rekening / QRIS untuk iuran"
        value={bankInfo}
        onChangeText={setBankInfo}
        editable={isKetua}
        multiline
        placeholder={'BCA 1234567890 a.n. Kas RW 05\nDANA 0812xxxx'}
      />
      {isKetua && <Button title="Simpan" onPress={save} loading={saving} />}

      {isKetua && (
        <>
          <SectionTitle>Kode undangan</SectionTitle>
          <Card>
            <Body style={{ fontSize: 22, fontWeight: '800', letterSpacing: 4, color: colors.primaryDark }}>{c.invite_code}</Body>
            <Button title="Ganti kode" small variant="secondary" onPress={regenerate} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
          </Card>
        </>
      )}

      {c.type === 'RW' && (
        <>
          <SectionTitle>Daftar RT</SectionTitle>
          <Card style={{ paddingVertical: space.xs }}>
            {rtUnits.length === 0 && <Muted style={{ paddingVertical: space.md }}>Belum ada RT. Tambahkan agar warga bisa memilih RT saat bergabung.</Muted>}
            {rtUnits.map((r) => (
              <ListItem key={r.id} icon="home-outline" title={`RT ${r.rt_number}`} subtitle={r.name ?? undefined} onPress={() => removeRt(r)} right={<Muted>Hapus</Muted>} />
            ))}
          </Card>
          <View style={[ui.row, { gap: space.sm, alignItems: 'flex-start' }]}>
            <View style={{ flex: 1 }}>
              <Input label="Nomor RT baru" value={newRt} onChangeText={setNewRt} keyboardType="number-pad" placeholder="01" />
            </View>
            <Button title="Tambah" onPress={addRt} style={{ marginTop: 22 }} />
          </View>
        </>
      )}
    </Screen>
  );
}
