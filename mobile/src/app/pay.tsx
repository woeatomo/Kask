import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image } from 'react-native';
import { Body, Button, Card, Input, Loading, Muted, Screen, Segmented } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { billPeriodLabel, parseAmount, rupiah } from '@/lib/format';
import { pickImage, uploadImage, type PickedImage } from '@/lib/storage';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Bill, Due, PaymentMethod } from '@/lib/types';
import { must, useData } from '@/lib/useData';

type BillRow = Bill & { dues: Due };

export default function Pay() {
  const { billId, dueId } = useLocalSearchParams<{ billId?: string; dueId?: string }>();
  const { current, communityId } = useCurrentCommunity();
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('transfer');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (billId) {
      const bill = must(await supabase.from('bills').select('*, dues(*)').eq('id', billId).single()) as BillRow;
      return { due: bill.dues, bill };
    }
    const due = must(await supabase.from('dues').select('*').eq('id', dueId!).single()) as Due;
    return { due, bill: null as BillRow | null };
  }, [billId, dueId]);

  const { data, loading } = useData<{ due: Due; bill: BillRow | null } | null>(load, null);
  if (loading || !data) return <Loading />;
  const { due, bill } = data;
  const amount = bill ? Number(bill.amount) : parseAmount(amountText);

  async function choose() {
    try {
      const img = await pickImage();
      if (img) setProof(img);
    } catch (e) {
      Alert.alert('Gagal', errorMessage(e));
    }
  }

  async function submit() {
    if (amount <= 0) return Alert.alert('Nominal tidak valid');
    if (method !== 'tunai' && !proof) {
      return Alert.alert('Bukti pembayaran', 'Unggah foto / screenshot bukti transfer.');
    }
    setSaving(true);
    try {
      const proofPath = proof ? await uploadImage('payment-proofs', `${communityId}/${current.user_id}`, proof) : null;
      const { error } = await supabase.from('payments').insert({
        community_id: communityId,
        due_id: due.id,
        membership_id: current.id,
        bill_id: bill?.id ?? null,
        amount,
        method,
        note: note.trim() || null,
        proof_path: proofPath,
      });
      if (error) throw error;
      Alert.alert('Terkirim', 'Pembayaran menunggu verifikasi pengurus.');
      router.back();
    } catch (e) {
      Alert.alert('Gagal', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Muted>{due.kind === 'wajib' ? 'Iuran wajib' : 'Iuran sukarela'}</Muted>
        <Body style={{ fontWeight: '700', fontSize: 17 }}>{due.name}</Body>
        {bill && <Muted>Periode {billPeriodLabel(bill)}</Muted>}
        {bill && <Body style={{ fontSize: 24, fontWeight: '800', marginTop: space.sm }}>{rupiah(bill.amount)}</Body>}
      </Card>

      {!bill && (
        <Input
          label="Nominal sumbangan"
          value={amountText}
          onChangeText={(t) => setAmountText(t.replace(/[^\d]/g, ''))}
          keyboardType="number-pad"
          placeholder="50000"
          hint={amount > 0 ? rupiah(amount) : undefined}
        />
      )}

      <Segmented
        label="Metode"
        value={method}
        onChange={setMethod}
        options={[
          { value: 'transfer', label: 'Transfer' },
          { value: 'qris', label: 'QRIS' },
          { value: 'tunai', label: 'Tunai' },
        ]}
      />

      {method !== 'tunai' && current.communities.bank_info ? (
        <Card>
          <Muted>Transfer ke</Muted>
          <Body style={{ fontWeight: '700' }}>{current.communities.bank_info}</Body>
        </Card>
      ) : null}
      {method === 'tunai' && (
        <Muted style={{ marginBottom: space.md }}>
          Serahkan uang tunai ke bendahara/pengurus. Pengurus akan memverifikasi setelah menerima.
        </Muted>
      )}

      {proof && <Image source={{ uri: proof.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, marginBottom: space.sm }} resizeMode="contain" />}
      <Button
        title={proof ? 'Ganti bukti' : 'Unggah bukti pembayaran'}
        icon="camera-outline"
        variant="secondary"
        onPress={choose}
        style={{ marginBottom: space.md }}
      />
      <Input label="Catatan (opsional)" value={note} onChangeText={setNote} />
      <Button title="Kirim pembayaran" onPress={submit} loading={saving} />
    </Screen>
  );
}

