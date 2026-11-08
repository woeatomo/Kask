import { Linking, Text, View } from 'react-native';
import { Body, Muted, Screen, Title } from '@/components/ui';
import { LEGAL_UPDATED, PRIVACY_POLICY, fillVars } from '@/content/legal';
import { useLegalVars } from '@/lib/appInfo';
import { colors, space } from '@/lib/theme';

/** Teks dengan URL yang bisa diketuk */
function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <Body style={{ lineHeight: 21, color: '#334155' }}>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <Text key={i} style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(p.replace(/[.,]$/, ''))}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Body>
  );
}

export default function PrivacyScreen() {
  const vars = useLegalVars();
  return (
    <Screen>
      <Title>Kebijakan Privasi</Title>
      <Muted style={{ marginBottom: space.lg }}>Terakhir diperbarui: {LEGAL_UPDATED}</Muted>
      {PRIVACY_POLICY.map((s) => (
        <View key={s.title} style={{ marginBottom: space.lg }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: space.sm }}>{s.title}</Text>
          {s.intro ? (
            <View style={{ marginBottom: space.sm }}>
              <Linked text={fillVars(s.intro, vars)} />
            </View>
          ) : null}
          {s.bullets?.map((b) => (
            <View key={b} style={{ flexDirection: 'row', marginBottom: 6, paddingRight: space.sm }}>
              <Text style={{ color: colors.primary, marginRight: space.sm, lineHeight: 21 }}>•</Text>
              <View style={{ flex: 1 }}>
                <Linked text={fillVars(b, vars)} />
              </View>
            </View>
          ))}
          {s.paragraphs?.map((p) => (
            <View key={p} style={{ marginTop: s.bullets ? space.sm : 0, marginBottom: s.bullets ? 0 : space.sm }}>
              <Linked text={fillVars(p, vars)} />
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}
