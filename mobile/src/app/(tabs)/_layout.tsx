import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useCommunity } from '@/context/CommunityContext';
import { colors } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />
  );
}

export default function TabsLayout() {
  const { current } = useCommunity();
  if (!current) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Beranda', headerTitle: current.communities.name, tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="iuran" options={{ title: 'Iuran', tabBarIcon: icon('wallet-outline') }} />
      <Tabs.Screen name="kas" options={{ title: 'Kas', headerTitle: 'Laporan Kas', tabBarIcon: icon('stats-chart-outline') }} />
      <Tabs.Screen name="berita" options={{ title: 'Berita', tabBarIcon: icon('newspaper-outline') }} />
      <Tabs.Screen name="akun" options={{ title: 'Akun', tabBarIcon: icon('person-circle-outline') }} />
    </Tabs>
  );
}
