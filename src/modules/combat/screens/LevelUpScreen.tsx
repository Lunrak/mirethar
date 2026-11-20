import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { Hero } from '../../../core/types/combat';
import { attemptLevelUp, type XpBank } from '../../../core/rules/XpService';

type Props = {
  heroes: Hero[];
  bank: XpBank;
  onChange: (heroes: Hero[], bank: XpBank) => void;
  onClose: () => void;
  title?: string;
};

export function LevelUpScreen({
  heroes,
  bank,
  onChange,
  onClose,
  title = 'Party · Experiencia',
}: Props) {
  const [log, setLog] = useState<string[]>([]);

  const tryLevel = (heroId: string) => {
    const result = attemptLevelUp(bank, heroes, heroId);
    setLog((prev) => [result.message, ...prev].slice(0, 8));
    if (result.ok) onChange(result.heroes, result.bank);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
      </View>

      <View style={styles.bankBox}>
        <Text style={styles.bankLine}>
          XP disponibles: <Text style={styles.gold}>{bank.wholeXp}</Text>
        </Text>
        <Text style={styles.bankSub}>
          Minions: {bank.minionProgress.toFixed(1)} / 1.0 ({bank.minionEncounters}{' '}
          encuentros)
        </Text>
        {bank.lastLeveledHeroId ? (
          <Text style={styles.bankSub}>
            Último en subir:{' '}
            {heroes.find((h) => h.id === bank.lastLeveledHeroId)?.name ?? '—'} (no
            puede repetir seguido)
          </Text>
        ) : null}
        <Text style={styles.hint}>
          Gasta 1 XP: d6 &gt; nivel actual → sube; si no, se pierde el XP.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {heroes.map((h) => {
          const blocked =
            bank.wholeXp < 1 || bank.lastLeveledHeroId === h.id || h.isDead;
          return (
            <View key={h.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {h.name}{' '}
                  <Text style={styles.meta}>
                    · {h.class} · niv. {h.level}
                  </Text>
                </Text>
                <Text style={styles.meta}>
                  Life {h.life}/{h.maxLife}
                  {h.isDead ? ' · MUERTO' : h.isFallen ? ' · caído' : ''}
                </Text>
              </View>
              <Pressable
                disabled={blocked}
                onPress={() => tryLevel(h.id)}
                style={[styles.lvlBtn, blocked && styles.lvlBtnOff]}
              >
                <Text style={styles.lvlBtnText}>Subir nivel</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {log.length > 0 && (
        <View style={styles.logBox}>
          {log.map((line, i) => (
            <Text key={`${i}_${line.slice(0, 16)}`} style={styles.logLine}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a1a1e',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { color: '#f0d78c', fontSize: 22, fontWeight: '900' },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5a5650',
  },
  closeText: { color: '#e8e6e3', fontWeight: '700' },
  bankBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#241f14',
    borderWidth: 1,
    borderColor: '#c9a227',
    marginBottom: 12,
  },
  bankLine: { color: '#e8e6e3', fontSize: 16, fontWeight: '700' },
  gold: { color: '#f0d78c', fontSize: 20, fontWeight: '900' },
  bankSub: { color: '#9a9690', fontSize: 12, marginTop: 4 },
  hint: { color: '#b8b4ae', fontSize: 12, marginTop: 8 },
  list: { paddingBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#24242c',
    borderWidth: 1,
    borderColor: '#3a3a45',
    marginBottom: 8,
  },
  name: { color: '#e8e6e3', fontSize: 16, fontWeight: '800' },
  meta: { color: '#9a9690', fontSize: 12, fontWeight: '600' },
  lvlBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3a3420',
    borderWidth: 2,
    borderColor: '#c9a227',
  },
  lvlBtnOff: { opacity: 0.35 },
  lvlBtnText: { color: '#f0d78c', fontWeight: '800', fontSize: 12 },
  logBox: {
    borderTopWidth: 1,
    borderTopColor: '#2a2a32',
    paddingVertical: 8,
    maxHeight: 100,
  },
  logLine: { color: '#b8b4ae', fontSize: 12, marginBottom: 2 },
});
