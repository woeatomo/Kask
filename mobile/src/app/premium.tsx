import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { Badge, Body, Button, Card, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { communityLabel, tanggal } from '@/lib/format';
import { PREMIUM_BENEFITS, PREMIUM_PRICE_LABEL, UPGRADE_WHATSAPP, type CommunityUsage } from '@/lib/plan';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

export default function Premium() {
  const { current, communityId, isPremium, isKetua, refresh } = useCurrentCommunity();
  const c = current.communities;
  const [usage, setUsage] = useState<CommunityUsage | null>(null);

  // Status paket bisa berubah dari panel admin; muat ulang setiap layar dibuka
  useFocusEffect(
    useCallback(() => {
      refresh();
      supabase.rpc('community_usage', { p_community_id: communityId }).then(({ data }) => {
        if (data) setUsage(data as CommunityUsage);
      });
    }, [refresh, communityId]),
  );

  // App Store melarang tautan ke pembayaran di luar aplikasi untuk fitur digital,
  // jadi di iOS hanya ditampilkan informasi (tanpa tombol kontak/harga).
  const canShowContact = Platform.OS !== 'ios' && !!UPGRADE_WHATSAPP;

  function contact() {
    const msg = `Halo, saya ingin berlangganan Kask Premium untuk komunitas "${c.name}" (${communityLabel(c)}). ID: ${c.id}`;
    Linking.openURL(`https://wa.me/${UPGRADE_WHATSAPP}?text=${encodeURIComponent(msg)}`);
  }

  return (
    <Screen>
      <Card style={{ backgroundColor: isPremium ? colors.primary : colors.card, borderColor: colors.primary }}>
        <View style={[ui.row, { gap: space.md }]}>
          <Ionicons name="star" size={32} color={isPremium ? '#FDE68A' : colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: isPremium ? '#fff' : colors.text }}>
              {isPremium ? 'Premium aktif' : 'Paket Gratis'}
            </Text>
            <Text style={{ color: isPremium ? '#CCFBF1' : colors.muted }}>
              {c.name}
              {isPremium ? (c.plan_expires_at ? ` · berlaku s.d. ${tanggal(c.plan_expires_at)}` : ' · tanpa batas waktu') : ''}
            </Text>
          </View>
        </View>
      </Card>

      {usage && (
        <Muted style={{ marginBottom: space.sm }}>
          Anggota aktif: {usage.active_members}
          {usage.member_limit !== null ? ` dari batas ${usage.member_limit} (paket Gratis)` : ' (tanpa batas)'}
        </Muted>
      )}

      <SectionTitle>Keuntungan Premium</SectionTitle>
      <Card style={{ paddingVertical: space.sm }}>
        {PREMIUM_BENEFITS.map((b) => (
          <View key={b.title} style={[ui.row, { gap: space.md, paddingVertical: space.sm }]}>
            <Ionicons name={b.icon} size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: '600' }}>{b.title}</Body>
              <Muted>{b.desc}</Muted>
            </View>
            {isPremium && <Ionicons name="checkmark-circle" size={20} color={colors.success} />}
          </View>
        ))}
      </Card>
      <Muted style={{ marginBottom: space.lg }}>
        Langganan berlaku untuk satu komunitas ({communityLabel(c)}), sehingga semua anggotanya ikut menikmati.
        Fitur inti (iuran, verifikasi, laporan kas di aplikasi, berita, notifikasi) tetap gratis.
      </Muted>

      {!isPremium && (
        <>
          {PREMIUM_PRICE_LABEL && Platform.OS !== 'ios' ? <Badge text={PREMIUM_PRICE_LABEL} tone="info" /> : null}
          {isKetua ? (
            canShowContact ? (
              <Button title="Hubungi kami untuk berlangganan" icon="logo-whatsapp" onPress={contact} style={{ marginTop: space.md }} />
            ) : (
              <Muted style={{ marginTop: space.md }}>
                Untuk berlangganan, hubungi pengelola aplikasi Kask dengan menyebutkan ID komunitas: {c.id}
              </Muted>
            )
          ) : (
            <Muted style={{ marginTop: space.md }}>Minta ketua komunitas Anda untuk mengaktifkan Premium.</Muted>
          )}
        </>
      )}
    </Screen>
  );
}
