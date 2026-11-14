import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { communityLogoUrl } from '@/lib/storage';
import { colors } from '@/lib/theme';
import type { Community } from '@/lib/types';

/** Inisial cadangan bila komunitas belum punya logo, mis. "RW 05 Griya Asri" -> "GA" */
function initials(c: Pick<Community, 'name' | 'type' | 'rw_number' | 'rt_number'>): string {
  const words = c.name
    .replace(/\b(RT|RW)\b\.?\s*\d*/gi, ' ')
    .split(/[\s/]+/)
    .filter((w) => /[A-Za-z]/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return c.type === 'RW' ? 'RW' : 'RT';
}

export function CommunityAvatar({
  community,
  size = 32,
}: {
  community: Pick<Community, 'name' | 'type' | 'rw_number' | 'rt_number' | 'logo_path'>;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const url = communityLogoUrl(community.logo_path);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (url && !failed) {
    return (
      <Image
        source={{ uri: url }}
        onError={() => setFailed(true)}
        style={[round, { backgroundColor: colors.primarySoft }]}
        accessibilityLabel={`Logo ${community.name}`}
      />
    );
  }
  return (
    <View style={[round, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{initials(community)}</Text>
    </View>
  );
}

/** Judul header: logo + nama komunitas */
export function CommunityHeaderTitle({ community }: { community: Pick<Community, 'name' | 'type' | 'rw_number' | 'rt_number' | 'logo_path'> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 260 }}>
      <CommunityAvatar community={community} size={32} />
      <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '700', color: colors.text, flexShrink: 1 }}>
        {community.name}
      </Text>
    </View>
  );
}
