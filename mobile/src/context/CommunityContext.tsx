import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import type { MembershipWithCommunity } from '@/lib/types';
import { useAuth } from './AuthContext';

const ACTIVE_KEY = 'kask.activeCommunityId';

interface CommunityState {
  /** Semua keanggotaan user (aktif & pending) */
  memberships: MembershipWithCommunity[];
  /** Keanggotaan aktif yang sedang dipilih */
  current: MembershipWithCommunity | null;
  loading: boolean;
  isPengurus: boolean;
  isKetua: boolean;
  setCurrent: (communityId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const CommunityContext = createContext<CommunityState | null>(null);

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const [memberships, setMemberships] = useState<MembershipWithCommunity[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = session?.user.id;

  const refresh = useCallback(async () => {
    if (!userId) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('memberships')
      .select('*, communities(*)')
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .order('joined_at');
    const rows = (data ?? []) as MembershipWithCommunity[];
    setMemberships(rows);

    const stored = await AsyncStorage.getItem(ACTIVE_KEY);
    const active = rows.filter((m) => m.status === 'active' && m.communities.is_active);
    const pick = active.find((m) => m.community_id === stored) ?? active[0];
    setCurrentId(pick?.community_id ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const current = useMemo(
    () =>
      memberships.find(
        (m) => m.community_id === currentId && m.status === 'active' && m.communities.is_active,
      ) ?? null,
    [memberships, currentId],
  );

  const isSuper = profile?.is_super_admin ?? false;
  const value: CommunityState = {
    memberships,
    current,
    loading,
    isPengurus: isSuper || current?.role === 'ketua' || current?.role === 'pengurus',
    isKetua: isSuper || current?.role === 'ketua',
    setCurrent: async (communityId) => {
      await AsyncStorage.setItem(ACTIVE_KEY, communityId);
      setCurrentId(communityId);
    },
    refresh,
  };

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error('useCommunity harus di dalam CommunityProvider');
  return ctx;
}

/** Untuk layar yang hanya tampil jika sudah memilih komunitas */
export function useCurrentCommunity() {
  const ctx = useCommunity();
  if (!ctx.current) throw new Error('Belum ada komunitas aktif');
  return { ...ctx, current: ctx.current, communityId: ctx.current.community_id };
}
