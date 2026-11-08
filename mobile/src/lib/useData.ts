import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { errorMessage } from './supabase';

/**
 * Memuat data setiap kali layar mendapat fokus, plus pull-to-refresh.
 * `loader` sebaiknya dibungkus useCallback oleh pemanggil.
 */
export function useData<T>(loader: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    try {
      setData(await loaderRef.current());
    } catch (e) {
      Alert.alert('Gagal memuat', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run, loader]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  return { data, setData, loading, refreshing, refresh, reload: run };
}

/** Lempar error Supabase agar ditangkap oleh useData / try-catch */
export function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}
