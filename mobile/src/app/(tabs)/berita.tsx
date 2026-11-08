import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { AdBanner } from '@/components/AdBanner';
import { Badge, Body, Card, Empty, Fab, Loading, Muted, Screen, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { tanggal } from '@/lib/format';
import { space } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import type { News } from '@/lib/types';
import { must, useData } from '@/lib/useData';

export default function Berita() {
  const { communityId, isPengurus, rtLabel } = useCurrentCommunity();

  const load = useCallback(async () => {
    const res = await supabase
      .from('news')
      .select('*, profiles:author_id(full_name)')
      .eq('community_id', communityId)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(100);
    return (must(res) ?? []) as News[];
  }, [communityId]);

  const { data, loading, refreshing, refresh } = useData<News[]>(load, []);
  if (loading) return <Loading />;

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={refresh}
      footer={isPengurus ? <Fab icon="create-outline" onPress={() => router.push('/news/edit')} /> : undefined}
    >
      {data.length === 0 ? (
        <Empty icon="newspaper-outline" text="Belum ada berita atau pengumuman" />
      ) : (
        data.map((n, i) => (
          <View key={n.id}>
          {i === 3 && <AdBanner />}
          <Card onPress={() => router.push({ pathname: '/news/[id]', params: { id: n.id } })}>
            <View style={[ui.row, { gap: space.xs }]}>
              {n.is_pinned && <Badge text="📌 Disematkan" tone="info" />}
              {n.rt_unit_id && <Badge text={`Khusus ${rtLabel(n.rt_unit_id) ?? 'RT'}`} tone="warning" />}
            </View>
            <Body style={{ fontWeight: '700', fontSize: 16, marginTop: n.is_pinned || n.rt_unit_id ? 6 : 0 }}>{n.title}</Body>
            <Muted>
              {tanggal(n.published_at)}
              {n.profiles?.full_name ? ` · ${n.profiles.full_name}` : ''}
            </Muted>
            <Body style={{ marginTop: 6 }} numberOfLines={3}>
              {n.body}
            </Body>
          </Card>
          </View>
        ))
      )}
      {data.length > 0 && data.length <= 3 && <AdBanner />}
    </Screen>
  );
}
