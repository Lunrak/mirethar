import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CombatFlow } from './src/modules/combat';
import { DungeonScreen } from './src/modules/dungeon';

type Mode = 'menu' | 'combat' | 'dungeon';

export default function App() {
  const [mode, setMode] = useState<Mode>('menu');

  if (mode === 'combat') {
    return (
      <View style={{ flex: 1 }}>
        <CombatFlow />
        <Pressable style={styles.fab} onPress={() => setMode('menu')}>
          <Text style={styles.fabText}>Menú</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === 'dungeon') {
    return <DungeonScreen onBack={() => setMode('menu')} />;
  }

  return (
    <View style={styles.menu}>
      <Text style={styles.title}>Mirethar</Text>
      <Text style={styles.sub}>MVP · 4AD</Text>
      <Pressable style={styles.btn} onPress={() => setMode('dungeon')}>
        <Text style={styles.btnText}>Explorar mazmorra</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={() => setMode('combat')}>
        <Text style={styles.btnText}>Combate (prueba)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    flex: 1,
    backgroundColor: '#1a1a1e',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { color: '#f0d78c', fontSize: 32, fontWeight: '900' },
  sub: { color: '#9a9690', marginBottom: 20 },
  btn: {
    minWidth: 240,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#3a3420',
    borderWidth: 2,
    borderColor: '#c9a227',
    alignItems: 'center',
  },
  btnText: { color: '#f0d78c', fontSize: 16, fontWeight: '800' },
  fab: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(42,42,53,0.8)',
  },
  fabText: { color: '#e8e6e3', fontWeight: '700', fontSize: 12 },
});
