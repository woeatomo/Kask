import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Button, Empty, Loading, Muted, Screen, styles as ui } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useCommunity } from '@/context/CommunityContext';
import { tanggal } from '@/lib/format';
import { openNotificationTarget } from '@/lib/notificationNav';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { AppNotification } from '@/lib/types';
import { must, useData } from '@/lib/useData';

function waktu(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${tanggal(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const community = useCommunity();
  const userId = session?.user.id;

  const load = useCallback(async () => {
    const res = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId!)
      .order('created_at', { ascending: false })
      .limit(100);
    return (must(res) ?? []) as AppNotification[];
  }, [userId]);

  const { data, setData, loading, refreshing, refresh } = useData<AppNotification[]>(load, []);
  const unread = data.filter((n) => !n.read_at).length;

  // Tandai semua sudah dibaca setelah layar dibuka (tampilan tetap menyorot yang baru)
  useEffect(() => {
    if (!loading && unread > 0 && userId) {
      supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null).then(() => {});
    }
  }, [loading, unread, userId]);

  async function clearAll() {
    await supabase.from('notifications').delete().eq('user_id', userId!);
    setData([]);
  }

  if (loading) return <Loading />;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {data.length === 0 ? (
        <Empty icon="notifications-off-outline" text="Belum ada notifikasi" />
      ) : (
        <>
          {data.map((n) => {
            const name = community.memberships.find((m) => m.community_id === n.community_id)?.communities.name;
            return (
              <Pressable
                key={n.id}
                onPress={() => openNotificationTarget(community, n.community_id, n.url)}
                style={({ pressed }) => [
                  ui.card,
                  { paddingVertical: space.md },
                  !n.read_at && { borderColor: colors.primary, backgroundColor: '#F0FDFA' },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View style={[ui.row, { gap: space.md, alignItems: 'flex-start' }]}>
                  <Ionicons name={n.read_at ? 'notifications-outline' : 'notifications'} size={20} color={colors.primary} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: n.read_at ? '500' : '700' }}>{n.title}</Body>
                    {n.body ? <Muted style={{ marginTop: 2 }}>{n.body}</Muted> : null}
                    <Muted style={{ marginTop: 4, fontSize: 11 }}>
                      {waktu(n.created_at)}
                      {name && community.memberships.length > 1 ? ` · ${name}` : ''}
                    </Muted>
                  </View>
                </View>
              </Pressable>
            );
          })}
          <Button title="Hapus semua notifikasi" variant="ghost" small onPress={clearAll} />
        </>
      )}
    </Screen>
  );
}
