/**
 * Botones de acción estilo captura: columna derecha
 * ATTACK (rojo), hechizos (ámbar), DEFEND/otros (verde)
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Action, Hero } from '../../../core/types/combat';

type Props = {
  actions: Action[];
  selected: Action | null;
  disabled?: boolean;
  currentHero?: Hero | null;
  targetAutoSelected?: boolean;
  onSelect: (action: Action) => void;
  layout?: 'rail' | 'bar' | 'stack';
};

function colorsFor(action: Action): { border: string; bg: string; text: string } {
  const n = action.name.toLowerCase();
  if (action.type === 'attack' || n === 'attack') {
    return { border: '#c43c3c', bg: 'rgba(40, 16, 16, 0.88)', text: '#f0c0c0' };
  }
  if (action.type === 'heal' || n.includes('heal') || n.includes('defend') || n.includes('protect')) {
    return { border: '#3d8b5f', bg: 'rgba(14, 32, 22, 0.88)', text: '#b8e0c8' };
  }
  if (action.type === 'scavenge' || action.type === 'pickup_body') {
    return { border: '#7a8aaa', bg: 'rgba(20, 24, 36, 0.88)', text: '#c8d0e0' };
  }
  // spells / focus-like
  return { border: '#c9a227', bg: 'rgba(40, 34, 14, 0.88)', text: '#f0d78c' };
}

export function ActionPanel({
  actions,
  selected,
  disabled,
  currentHero,
  targetAutoSelected = false,
  onSelect,
  layout = 'stack',
}: Props) {
  return (
    <View style={layout === 'bar' ? styles.barWrap : styles.stackWrap}>
      {currentHero && (
        <Text style={styles.actorLabel} numberOfLines={1}>
          {currentHero.name}
        </Text>
      )}
      <View style={layout === 'bar' ? styles.barRow : styles.stackCol}>
        {actions.map((action) => {
          const isSelected =
            selected?.name === action.name && selected?.type === action.type;
          const c = colorsFor(action);
          const showHint =
            action.requiresTarget &&
            !(
              isSelected &&
              targetAutoSelected &&
              (action.type === 'attack' || action.type === 'spell')
            );

          return (
            <Pressable
              key={`${action.type}-${action.name}`}
              disabled={disabled}
              onPress={() => onSelect(action)}
              style={({ pressed }) => [
                styles.btn,
                {
                  borderColor: c.border,
                  backgroundColor: c.bg,
                },
                isSelected && styles.btnSelected,
                disabled && styles.btnDisabled,
                pressed && !disabled && styles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={action.name}
            >
              <Text style={[styles.btnText, { color: c.text }]}>
                {action.name.toUpperCase()}
              </Text>
              {showHint && <Text style={styles.hint}>objetivo</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stackWrap: {
    alignItems: 'stretch',
    gap: 6,
    minWidth: 110,
  },
  barWrap: {
    alignItems: 'center',
    gap: 6,
  },
  actorLabel: {
    color: '#c9a227',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  stackCol: {
    gap: 8,
  },
  barRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  btn: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    // sombra tipo placa
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  btnSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.04 }],
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  hint: {
    color: '#9a9690',
    fontSize: 9,
    marginTop: 1,
  },
});
