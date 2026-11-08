import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type Bucket = 'payment-proofs' | 'news-images';

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
}

/** Pilih gambar dari galeri. Mengembalikan null jika dibatalkan. */
export async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Izin akses galeri ditolak');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    base64: true,
  });
  if (res.canceled || !res.assets[0]?.base64) return null;
  const a = res.assets[0];
  return { uri: a.uri, base64: a.base64!, mimeType: a.mimeType ?? 'image/jpeg' };
}

/** Upload gambar; folder harus diawali community_id (lihat kebijakan storage). */
export async function uploadImage(bucket: Bucket, folder: string, img: PickedImage): Promise<string> {
  const ext = img.mimeType.split('/')[1] ?? 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, decode(img.base64), { contentType: img.mimeType });
  if (error) throw error;
  return path;
}

export async function signedUrl(bucket: Bucket, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
