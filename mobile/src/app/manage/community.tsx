import { useState } from 'react';
import { Alert, View } from 'react-native';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { Body, Button, Card, Input, ListItem, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { pickImage, uploadImage } from '@/lib/storage';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { RtUnit } from '@/lib/types';

export default function CommunitySettings() {
  const { current, communityId, isKetua, isFullPengurus, refresh, rtUnits, reloadRtUnits } = useCurrentCommunity();
  const c = current.communities;
  const [name, setName] = useState(c.name);
  const [kelurahan, setKelurahan] = useState(c.kelurahan ?? '');
  const [kecamatan, setKecamatan] = useState(c.kecamatan ?? '');
  const [kota, setKota] = useState(c.kota ?? '');
  const [provinsi, setProvinsi] = useState(c.provinsi ?? '');
  const [address, setAddress] = useState(c.address ?? '');
  const [bankInfo, setBankInfo] = useState(c.bank_info ?? '');
  const [saving, setSaving] = useState(false);
  const [newRt, setNewRt] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  async function changeLogo() {
    try {
      const img = await pickImage({ square: true });
      if (!img) return;
      if (img.base64.length * 0.75 > 1024 * 1024) {
        return Alert.alert('Gambar terlalu besar', 'Ukuran logo maksimal 1 MB. Pilih gambar yang lebih kecil.');
      }
      setLogoBusy(true);
      const oldPath = c.logo_path;
      const path = await uploadImage('community-logos', communityId, img);
      const { error } = await supabase.from('communities').update({ logo_path: path }).eq('id', communityId);
      if (error) throw error;
      if (oldPath) await supabase.storage.from('community-logos').remove([oldPath]);
      await refresh();
    } catch (e) {
      Alert.alert('Gagal mengganti logo', errorMessage(e));
    } finally {
      setLogoBusy(false);
    }
  }

  function removeLogo() {
    if (!c.logo_path) return;
    Alert.alert('Hapus logo?', 'Header akan kembali menampilkan inisial komunitas.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setLogoBusy(true);
          const oldPath = c.logo_path!;
          const { error } = await supabase.from('communities').update({ logo_path: null }).eq('id', communityId);
          if (!error) await supabase.storage.from('community-logos').remove([oldPath]);
          setLogoBusy(false);
          if (error) return Alert.alert('Gagal', errorMessage(error));
          await refresh();
        },
      },
    ]);
  }

  const loadRt = reloadRtUnits;

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
    if (!isFullPengurus) return;
    Alert.alert(`Hapus RT ${r.rt_number}?`, 'Warga di RT ini tidak terhapus, hanya pengelompokannya. RT yang sudah punya transaksi kas tidak bisa dihapus.', [
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
      <Card style={{ alignItems: 'center' }}>
        <CommunityAvatar community={c} size={96} />
        <Body style={{ fontWeight: '700', marginTop: space.sm }}>Logo komunitas</Body>
        <Muted style={{ textAlign: 'center', marginTop: 2 }}>
          Tampil di header Beranda semua anggota. Gunakan gambar persegi, maks. 1 MB.
        </Muted>
        {isKetua && (
          <View style={[ui.row, { gap: space.sm, marginTop: space.md }]}>
            <Button
              title={c.logo_path ? 'Ganti logo' : 'Pilih logo'}
              icon="image-outline"
              small
              loading={logoBusy}
              onPress={changeLogo}
            />
            {c.logo_path ? <Button title="Hapus" small variant="ghost" disabled={logoBusy} onPress={removeLogo} /> : null}
          </View>
        )}
      </Card>
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
              <ListItem
                key={r.id}
                icon="home-outline"
                title={`RT ${r.rt_number}`}
                subtitle={r.name ?? undefined}
                onPress={isFullPengurus ? () => removeRt(r) : undefined}
                right={isFullPengurus ? <Muted>Hapus</Muted> : <View />}
              />
            ))}
          </Card>
          {isFullPengurus && (
            <View style={[ui.row, { gap: space.sm, alignItems: 'flex-start' }]}>
              <View style={{ flex: 1 }}>
                <Input label="Nomor RT baru" value={newRt} onChangeText={setNewRt} keyboardType="number-pad" placeholder="01" />
              </View>
              <Button title="Tambah" onPress={addRt} style={{ marginTop: 22 }} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
