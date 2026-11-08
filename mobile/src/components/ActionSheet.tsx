import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/lib/theme';

export interface SheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface SheetConfig {
  title?: string;
  message?: string;
  options: SheetOption[];
}

const SheetContext = createContext<(c: SheetConfig) => void>(() => {});

/**
 * Pengganti Alert untuk pilihan lebih dari 3 tombol
 * (Alert di Android hanya mendukung maksimal 3 tombol).
 */
export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SheetConfig | null>(null);
  const insets = useSafeAreaInsets();
  const close = useCallback(() => setConfig(null), []);

  return (
    <SheetContext.Provider value={setConfig}>
      {children}
      <Modal visible={!!config} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={close} />
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            paddingBottom: insets.bottom + space.sm,
            maxHeight: '75%',
          }}
        >
          {(config?.title || config?.message) && (
            <View style={{ padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              {config?.title ? <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{config.title}</Text> : null}
              {config?.message ? <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{config.message}</Text> : null}
            </View>
          )}
          <ScrollView>
            {config?.options.map((o) => (
              <Pressable
                key={o.label}
                onPress={() => {
                  close();
                  setTimeout(o.onPress, 250);
                }}
                style={({ pressed }) => ({ padding: space.lg, backgroundColor: pressed ? colors.bg : undefined })}
              >
                <Text style={{ fontSize: 16, color: o.destructive ? colors.danger : colors.text }}>{o.label}</Text>
              </Pressable>
            ))}
            <Pressable onPress={close} style={{ padding: space.lg }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.muted }}>Batal</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </SheetContext.Provider>
  );
}

export function useActionSheet() {
  return useContext(SheetContext);
}
