import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { Body, Button, Card, Empty, Muted, Screen, SectionTitle, styles as ui } from '@/components/ui';
import { FAQ, fillVars } from '@/content/legal';
import { SUPPORT_EMAIL, useLegalVars } from '@/lib/appInfo';
import { colors, radius, space } from '@/lib/theme';

export default function FaqScreen() {
  const vars = useLegalVars();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ.map((c) => ({
      title: c.title,
      items: c.items
        .map((i) => ({ q: fillVars(i.q, vars), a: fillVars(i.a, vars) }))
        .filter((i) => !q || i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)),
    })).filter((c) => c.items.length > 0);
  }, [query, vars]);

  return (
    <Screen>
      <View style={[ui.row, { backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md }]}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari pertanyaan..."
          placeholderTextColor={colors.muted}
          style={{ flex: 1, paddingVertical: 10, paddingHorizontal: space.sm, fontSize: 15, color: colors.text }}
        />
      </View>

      {categories.length === 0 && <Empty icon="help-circle-outline" text="Tidak ada pertanyaan yang cocok" />}

      {categories.map((c) => (
        <View key={c.title}>
          <SectionTitle>{c.title}</SectionTitle>
          <Card style={{ paddingVertical: space.xs }}>
            {c.items.map((item, idx) => {
              const key = c.title + item.q;
              const expanded = open === key || query.trim().length > 0;
              return (
                <View key={key} style={idx > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                  <Pressable
                    onPress={() => setOpen(open === key ? null : key)}
                    style={[ui.row, { paddingVertical: space.md, gap: space.sm }]}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{item.q}</Text>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                  </Pressable>
                  {expanded && <Body style={{ paddingBottom: space.md, lineHeight: 21, color: '#334155' }}>{item.a}</Body>}
                </View>
              );
            })}
          </Card>
        </View>
      ))}

      <Card style={{ marginTop: space.md }}>
        <Body style={{ fontWeight: '700' }}>Masih ada pertanyaan?</Body>
        <Muted style={{ marginVertical: space.sm }}>Hubungi kami di {SUPPORT_EMAIL}</Muted>
        <View style={[ui.row, { gap: space.sm, flexWrap: 'wrap' }]}>
          {SUPPORT_EMAIL.includes('@') && (
            <Button title="Kirim email" icon="mail-outline" small onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Pertanyaan%20Kasmee`)} />
          )}
          <Button title="Kebijakan Privasi" small variant="secondary" onPress={() => router.push('/privacy')} />
        </View>
      </Card>
    </Screen>
  );
}
