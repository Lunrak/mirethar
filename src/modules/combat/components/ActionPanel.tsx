/**
 * Zona izquierda – selección de acción (GDD §5.1)
 * Botones táctiles 48–56 dp, pensados para pulgar izquierdo.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { Action } from '../../../core/types/combat';
import type { Hero } from '../../../core/types/combat';

type Props = {
  actions: Action[];
  selected: Action | null;
  disabled?: boolean;
  currentHero?: Hero | null;
  /** Si el objetivo enemigo ya se auto-eligió (grupo homogéneo) */
  targetAutoSelected?: boolean;
  onSelect: (action: Action) => void;
};

const CLASS_ICON: Record<NonNullable<Hero['class']>, string> = {
  warrior: '⚔️',
  rogue: '🗡️',
  cleric: '✝️',
  wizard: '🔮',
};

export function ActionPanel({
  actions,
  selected,
  disabled,
  currentHero,
  targetAutoSelected = false,
  onSelect,
}: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Acciones</Text>
      {currentHero && (
        <Text style={styles.heroHint} numberOfLines={1}>
          {CLASS_ICON[currentHero.class] ?? ''} {currentHero.name}
        </Text>
      )}
      {actions.map((action) => {
        const isSelected = selected?.name === action.name && selected?.type === action.type;
        // No pedir "elige objetivo" si ya se auto-seleccionó (ataque a grupo idéntico)
        const showTargetHint =
          action.requiresTarget &&
          !(isSelected && targetAutoSelected && (action.type === 'attack' || action.type === 'spell'));
        return (
          <Pressable
            key={`${action.type}-${action.name}`}
            disabled={disabled}
            onPress={() => onSelect(action)}
            hitSlop={4}
            style={({ pressed }) => [
              styles.btn,
              isSelected && styles.btnSelected,
              disabled && styles.btnDisabled,
              pressed && !disabled && styles.btnPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: !!disabled }}
            accessibilityLabel={action.name}
          >
            <Text style={[styles.btnText, isSelected && styles.btnTextSelected]}>
              {action.name}
            </Text>
            {showTargetHint && (
              <Text style={styles.btnHint}>elige objetivo</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: '28%',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#16161a',
    borderRightWidth: 1,
    borderRightColor: '#2a2a32',
  },
  label: {
    color: '#6b6760',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroHint: {
    color: '#c9a227',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  btn: {
    minHeight: 52, // 48–56 dp
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    backgroundColor: '#2a2a35',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3d3d4a',
  },
  btnSelected: {
    borderColor: '#c9a227',
    backgroundColor: '#3a3420',
  },
  btnPressed: {
    backgroundColor: '#353545',
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    color: '#e8e6e3',
    fontSize: 16,
    fontWeight: '700',
  },
  btnTextSelected: {
    color: '#f0d78c',
  },
  btnHint: {
    color: '#6b6760',
    fontSize: 11,
    marginTop: 2,
  },
});
