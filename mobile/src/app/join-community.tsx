import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Body, Button, Card, Chips, Input, Muted, Screen } from '@/components/ui';
import { useCommunity } from '@/context/CommunityContext';
import { communityLabel } from '@/lib/format';
import { errorMessage, supabase } from '@/lib/supabase';
import type { CommunityType } from '@/lib/types';
import { space } from '@/lib/theme';

interface Found {
  id: string;
  name: string;
  type: CommunityType;
  rw_number: string;
  rt_number: string | null;
  kelurahan: string | null;
  kota: string | null;
  rt_units: { id: string; rt_number: string; name: string | null }[];
}

export default function JoinCommunity() {
  const { refresh } = useCommunity();
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [rtUnit, setRtUnit] = useState<string>('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    const { data, error } = await supabase.rpc('find_community_by_code', { p_code: code });
    setLoading(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    if (!data) return Alert.alert('Tidak ditemukan', 'Kode undangan tidak valid.');
    setFound(data as Found);
  }

  async function join() {
    if (!found) return;
    if (found.type === 'RW' && found.rt_units.length > 0 && !rtUnit) {
      return Alert.alert('Pilih RT', 'Pilih RT tempat tinggal Anda.');
    }
    setLoading(true);
    const { error } = await supabase.rpc('join_community', {
      p_code: code,
      p_rt_unit_id: rtUnit || null,
      p_address: address.trim() || null,
    });
    setLoading(false);
    if (error) return Alert.alert('Gagal', errorMessage(error));
    await refresh();
    Alert.alert('Permintaan terkirim', 'Tunggu persetujuan pengurus.');
    router.back();
  }

  return (
    <Screen>
      <Input
        label="Kode undangan"
        value={code}
        onChangeText={(t) => {
          setCode(t.toUpperCase());
          setFound(null);
        }}
        autoCapitalize="characters"
        placeholder="ABC123"
        maxLength={6}
      />
      {!found && <Button title="Cari" onPress={search} loading={loading} disabled={code.length < 6} />}

      {found && (
        <>
          <Card>
            <Body style={{ fontWeight: '700' }}>{found.name}</Body>
            <Muted>
              {communityLabel(found)}
              {found.kelurahan ? ` · ${found.kelurahan}` : ''}
              {found.kota ? `, ${found.kota}` : ''}
            </Muted>
          </Card>
          {found.type === 'RW' && found.rt_units.length > 0 && (
            <>
              <Muted style={{ marginBottom: space.sm }}>RT Anda</Muted>
              <Chips
                value={rtUnit}
                onChange={setRtUnit}
                options={found.rt_units.map((r) => ({ value: r.id, label: `RT ${r.rt_number}` }))}
              />
            </>
          )}
          <Input label="Alamat / nomor rumah" value={address} onChangeText={setAddress} placeholder="Jl. Mawar No. 12" />
          <Button title="Ajukan bergabung" onPress={join} loading={loading} />
        </>
      )}
    </Screen>
  );
}
