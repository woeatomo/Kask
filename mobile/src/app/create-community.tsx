import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Input, Muted, Screen, Segmented } from '@/components/ui';
import { useCommunity } from '@/context/CommunityContext';
import { errorMessage, supabase } from '@/lib/supabase';
import type { CommunityType } from '@/lib/types';
import { space } from '@/lib/theme';

export default function CreateCommunity() {
  const { refresh, setCurrent } = useCommunity();
  const [type, setType] = useState<CommunityType>('RT');
  const [name, setName] = useState('');
  const [rw, setRw] = useState('');
  const [rt, setRt] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kota, setKota] = useState('');
  const [myAddress, setMyAddress] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!rw.trim() || (type === 'RT' && !rt.trim())) {
      return Alert.alert('Lengkapi data', 'Nomor RW' + (type === 'RT' ? ' dan RT' : '') + ' wajib diisi.');
    }
    const finalName = name.trim() || (type === 'RT' ? `RT ${rt} / RW ${rw}` : `RW ${rw}`);
    setLoading(true);
    const { data, error } = await supabase.rpc('create_community', {
      p_name: finalName,
      p_type: type,
      p_rw_number: rw.trim(),
      p_rt_number: type === 'RT' ? rt.trim() : null,
      p_kelurahan: kelurahan.trim() || null,
      p_kecamatan: kecamatan.trim() || null,
      p_kota: kota.trim() || null,
      p_my_address: myAddress.trim() || null,
    });
    setLoading(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    await setCurrent(data as string);
    await refresh();
    router.replace('/home');
  }

  return (
    <Screen>
      <Segmented
        label="Jenis komunitas"
        value={type}
        onChange={setType}
        options={[
          { value: 'RT', label: 'Satu RT' },
          { value: 'RW', label: 'Satu RW (beberapa RT)' },
        ]}
      />
      <Muted style={{ marginBottom: space.md }}>
        {type === 'RT'
          ? 'Ketua RT menjadi pengurus tertinggi.'
          : 'Ketua RW menjadi pengurus tertinggi. Ketua-ketua RT bisa diangkat sebagai pengurus, dan warga dikelompokkan per RT.'}
      </Muted>
      <Input label="Nomor RW" value={rw} onChangeText={setRw} keyboardType="number-pad" placeholder="05" />
      {type === 'RT' && <Input label="Nomor RT" value={rt} onChangeText={setRt} keyboardType="number-pad" placeholder="03" />}
      <Input label="Nama komunitas (opsional)" value={name} onChangeText={setName} placeholder="mis. Perumahan Griya Asri" />
      <Input label="Kelurahan / Desa" value={kelurahan} onChangeText={setKelurahan} />
      <Input label="Kecamatan" value={kecamatan} onChangeText={setKecamatan} />
      <Input label="Kota / Kabupaten" value={kota} onChangeText={setKota} />
      <Input label="Alamat rumah Anda" value={myAddress} onChangeText={setMyAddress} placeholder="Jl. Mawar No. 1" />
      <Button title="Buat komunitas" onPress={submit} loading={loading} />
    </Screen>
  );
}
