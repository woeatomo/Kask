import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { Body, Button, Loading, Muted, Screen, Title, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { tanggal } from '@/lib/format';
import { signedUrl } from '@/lib/storage';
import { errorMessage, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { News } from '@/lib/types';
import { must, useData } from '@/lib/useData';

export default function NewsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isPengurus } = useCurrentCommunity();
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const n = must(
      await supabase.from('news').select('*, profiles:author_id(full_name)').eq('id', id).single(),
    ) as News;
    return { news: n, imageUrl: await signedUrl('news-images', n.image_path) };
  }, [id]);

  const { data, loading } = useData<{ news: News; imageUrl: string | null } | null>(load, null);
  if (loading || !data) return <Loading />;
  const n = data.news;

  function remove() {
    Alert.alert('Hapus berita?', n.title, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const { error } = await supabase.from('news').delete().eq('id', n.id);
          setDeleting(false);
          if (error) return Alert.alert('Gagal', errorMessage(error));
          if (n.image_path) await supabase.storage.from('news-images').remove([n.image_path]);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Berita' }} />
      <Title>{n.title}</Title>
      <Muted style={{ marginBottom: space.md }}>
        {tanggal(n.published_at)}
        {n.profiles?.full_name ? ` · ${n.profiles.full_name}` : ''}
      </Muted>
      {data.imageUrl && (
        <Image
          source={{ uri: data.imageUrl }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginBottom: space.md }}
          resizeMode="cover"
        />
      )}
      <Body style={{ lineHeight: 22 }}>{n.body}</Body>
      {isPengurus && (
        <View style={[ui.row, { gap: space.sm, marginTop: space.xl }]}>
          <Button title="Edit" icon="create-outline" variant="secondary" small onPress={() => router.push({ pathname: '/news/edit', params: { id: n.id } })} />
          <Button title="Hapus" icon="trash-outline" variant="danger" small loading={deleting} onPress={remove} />
        </View>
      )}
    </Screen>
  );
}
