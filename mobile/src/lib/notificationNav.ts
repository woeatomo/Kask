import { router, type Href } from 'expo-router';

interface CommunitySwitcher {
  current: { community_id: string } | null;
  memberships: { community_id: string; status: string }[];
  setCurrent: (communityId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/** Pindah ke komunitas notifikasi (jika perlu) lalu buka rutenya */
export async function openNotificationTarget(
  ctx: CommunitySwitcher,
  communityId: string | null,
  url: string | null,
) {
  if (communityId && ctx.current?.community_id !== communityId) {
    // mis. notifikasi "permintaan disetujui": keanggotaan baru belum ada di state
    if (!ctx.memberships.some((m) => m.community_id === communityId && m.status === 'active')) {
      await ctx.refresh();
    }
    await ctx.setCurrent(communityId);
  }
  if (url) {
    // beri waktu navigator (Stack.Protected) menyesuaikan komunitas aktif
    setTimeout(() => router.push(url as Href), 50);
  }
}
