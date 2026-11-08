import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Switch, View } from 'react-native';
import { Body, Button, Input, Screen, styles as ui } from '@/components/ui';
import { useCurrentCommunity } from '@/context/CommunityContext';
import { pickImage, signedUrl, uploadImage, type PickedImage } from '@/lib/storage';
import { errorMessage, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { News } from '@/lib/types';

export default function NewsEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { communityId } = useCurrentCommunity();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data }) => {
        const n = data as News | null;
        if (!n) return;
        setTitle(n.title);
        setBody(n.body);
        setPinned(n.is_pinned);
        setImagePath(n.image_path);
        setPreview(await signedUrl('news-images', n.image_path));
      });
  }, [id]);

  async function choose() {
    try {
      const img = await pickImage();
      if (img) {
        setPicked(img);
        setPreview(img.uri);
      }
    } catch (e) {
      Alert.alert('Gagal', errorMessage(e));
    }
  }

  async function save() {
    if (!title.trim()) return Alert.alert('Judul wajib diisi');
    setSaving(true);
    try {
      let path = imagePath;
      if (picked) path = await uploadImage('news-images', communityId, picked);
      const row = { title: title.trim(), body: body.trim(), is_pinned: pinned, image_path: path };
      const { error } = id
        ? await supabase.from('news').update(row).eq('id', id)
        : await supabase.from('news').insert({ ...row, community_id: communityId });
      if (error) throw error;
      if (picked && imagePath && imagePath !== path) {
        await supabase.storage.from('news-images').remove([imagePath]);
      }
      router.back();
    } catch (e) {
      Alert.alert('Gagal menyimpan', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Input label="Judul" value={title} onChangeText={setTitle} placeholder="mis. Kerja bakti Minggu ini" />
      <Input label="Isi" value={body} onChangeText={setBody} multiline placeholder="Tulis pengumuman..." />
      {preview && (
        <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginBottom: space.sm }} />
      )}
      <Button
        title={preview ? 'Ganti gambar' : 'Tambah gambar'}
        icon="image-outline"
        variant="secondary"
        small
        onPress={choose}
        style={{ alignSelf: 'flex-start', marginBottom: space.md }}
      />
      <View style={[ui.row, { justifyContent: 'space-between', marginBottom: space.lg }]}>
        <Body>Sematkan di atas</Body>
        <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: colors.primary }} />
      </View>
      <Button title={id ? 'Simpan perubahan' : 'Terbitkan'} onPress={save} loading={saving} />
    </Screen>
  );
}
