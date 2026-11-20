/**
 * Overlay al revelar zona (mismo lenguaje visual que el combate):
 * fondo oscuro + una sola palabra grande del contenido.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export type RevealFlash = {
  id: string;
  /** Una sola palabra / etiqueta corta */
  word: string;
  /** Subtítulo opcional (forma: pasillo, sala…) */
  subtitle?: string;
};

type Props = {
  flash: RevealFlash | null;
  onDone?: () => void;
};

export function DungeonRevealOverlay({ flash, onDone }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!flash) {
      opacity.setValue(0);
      scale.setValue(0.8);
      return;
    }
    opacity.setValue(0);
    scale.setValue(0.8);

    const anim = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 110,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(700),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    anim.start(({ finished }) => {
      if (finished) onDone?.();
    });
    return () => anim.stop();
  }, [flash?.id, flash, opacity, scale, onDone]);

  if (!flash) return null;

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[styles.backdrop, { opacity }]} />
      <Animated.View
        style={[styles.stage, { opacity, transform: [{ scale }] }]}
      >
        {flash.subtitle ? (
          <Text style={styles.sub}>{flash.subtitle.toUpperCase()}</Text>
        ) : null}
        <Text style={styles.word}>{flash.word.toUpperCase()}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4, 6, 10, 0.88)',
  },
  stage: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sub: {
    color: '#9a9690',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  word: {
    color: '#f2efe8',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
