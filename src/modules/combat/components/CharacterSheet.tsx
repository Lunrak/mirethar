/**
 * Hoja de personaje – vista desde preparación de combate
 * Izquierda: datos 4AD (clase, life, rasgos, riqueza)
 * Centro: silueta + ranuras de equipo
 * Derecha: opciones de equipo inicial nivel 1
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
} from 'react-native';
import type { Hero } from '../../../core/types/combat';
import { CLASSES, type HeroClass } from '../../../core/data/classes';
import { ITEMS, type EquipmentSlot, type Item } from '../../../core/data/items';
import { HeroGearIcons } from './UnitVisuals';

const CLASS_ES: Record<HeroClass, string> = {
  warrior: 'Guerrero',
  rogue: 'Pícaro',
  cleric: 'Clérigo',
  wizard: 'Mago',
};

const CLASS_ICON: Record<HeroClass, string> = {
  warrior: '🪖',
  rogue: '🥷',
  cleric: '🙏',
  wizard: '🧙',
};

const SLOT_LABEL: Record<EquipmentSlot, string> = {
  armor: 'Armadura',
  shield: 'Escudo',
  mainHand: 'Mano dcha.',
  offHand: 'Mano izq.',
  misc: 'Misc',
  spellbook: 'Grimorio',
};

/** Ranuras visibles en el muñeco de papel */
const PAPER_SLOTS: EquipmentSlot[] = [
  'armor',
  'mainHand',
  'offHand',
  'shield',
  'spellbook',
  'misc',
];

/**
 * Opciones de carga inicial nivel 1 según 4AD (variantes del manual).
 * Cada opción es un set parcial de slots → items.
 */
export type LoadoutOption = {
  id: string;
  label: string;
  hint: string;
  /** Reemplaza estos slots; el resto del equipo de clase se mantiene si no se toca */
  apply: Partial<Record<EquipmentSlot, string | null>>;
};

export function startingLoadouts(heroClass: HeroClass): LoadoutOption[] {
  switch (heroClass) {
    case 'warrior':
      return [
        {
          id: 'w_shield',
          label: 'Arma + escudo',
          hint: 'Estándar: armadura ligera, escudo, arma de mano',
          apply: {
            armor: 'light_armor',
            shield: 'shield',
            mainHand: 'hand_weapon',
            offHand: null,
          },
        },
        {
          id: 'w_2h',
          label: 'Arma a dos manos',
          hint: 'Cambia escudo + arma de mano por arma a 2 manos',
          apply: {
            armor: 'light_armor',
            shield: null,
            mainHand: 'two_handed_weapon',
            offHand: null,
          },
        },
        {
          id: 'w_bow',
          label: 'Arco',
          hint: 'Cambia escudo + arma de mano por arco',
          apply: {
            armor: 'light_armor',
            shield: null,
            mainHand: 'bow',
            offHand: null,
          },
        },
        {
          id: 'w_heavy',
          label: 'Armadura pesada',
          hint: 'Misma carga con armadura pesada (permitida al guerrero)',
          apply: {
            armor: 'heavy_armor',
            shield: 'shield',
            mainHand: 'hand_weapon',
            offHand: null,
          },
        },
      ];
    case 'rogue':
      return [
        {
          id: 'r_std',
          label: 'Carga estándar',
          hint: 'Armadura ligera, arma ligera, ganzúas y cuerda',
          apply: {
            armor: 'light_armor',
            mainHand: 'light_hand_weapon',
            shield: null,
            misc: 'lockpicks',
          },
        },
        {
          id: 'r_sling',
          label: 'Honda',
          hint: 'Arma a distancia ligera (sling)',
          apply: {
            armor: 'light_armor',
            mainHand: 'sling',
            shield: null,
            misc: 'lockpicks',
          },
        },
      ];
    case 'cleric':
      return [
        {
          id: 'c_std',
          label: 'Arma + escudo',
          hint: 'Armadura ligera, escudo, arma de mano, símbolo sagrado',
          apply: {
            armor: 'light_armor',
            shield: 'shield',
            mainHand: 'hand_weapon',
            offHand: null,
            misc: 'holy_symbol',
          },
        },
        {
          id: 'c_crush',
          label: 'Arma contundente',
          hint: '+1 vs esqueletos / rats esqueléticos',
          apply: {
            armor: 'light_armor',
            shield: 'shield',
            mainHand: 'crushing_weapon',
            offHand: null,
            misc: 'holy_symbol',
          },
        },
        {
          id: 'c_2h',
          label: 'Arma a dos manos',
          hint: 'Cambia escudo + arma de mano por arma a 2 manos',
          apply: {
            armor: 'light_armor',
            shield: null,
            mainHand: 'two_handed_weapon',
            offHand: null,
            misc: 'holy_symbol',
          },
        },
      ];
    case 'wizard':
      return [
        {
          id: 'z_std',
          label: 'Arma ligera',
          hint: 'Sin armadura; arma ligera, grimorio, útiles de escritura',
          apply: {
            armor: null,
            shield: null,
            mainHand: 'light_hand_weapon',
            spellbook: 'spellbook',
            misc: 'writing_implements',
          },
        },
        {
          id: 'z_sling',
          label: 'Honda',
          hint: 'Arma a distancia permitida al mago',
          apply: {
            armor: null,
            shield: null,
            mainHand: 'sling',
            spellbook: 'spellbook',
            misc: 'writing_implements',
          },
        },
      ];
    default:
      return [];
  }
}

function applyLoadout(hero: Hero, option: LoadoutOption): Hero {
  const equipment = { ...hero.equipment };
  for (const [slot, itemId] of Object.entries(option.apply)) {
    const s = slot as EquipmentSlot;
    if (itemId == null) {
      delete equipment[s];
    } else {
      const item = ITEMS[itemId];
      if (item) equipment[s] = item;
    }
  }
  // Arma a 2 manos: no debe quedar escudo
  if (equipment.mainHand?.tags?.includes('two-handed')) {
    delete equipment.shield;
    delete equipment.offHand;
  }
  return { ...hero, equipment };
}

type Props = {
  hero: Hero;
  visible: boolean;
  onClose: () => void;
  onChange: (hero: Hero) => void;
};

function SlotChip({
  slot,
  item,
}: {
  slot: EquipmentSlot;
  item?: Item;
}) {
  return (
    <View style={styles.slotChip}>
      <Text style={styles.slotLabel}>{SLOT_LABEL[slot]}</Text>
      <Text style={styles.slotValue} numberOfLines={2}>
        {item ? item.name : '— vacío —'}
      </Text>
    </View>
  );
}

export function CharacterSheet({ hero, visible, onClose, onChange }: Props) {
  const def = CLASSES[hero.class];
  const loadouts = useMemo(() => startingLoadouts(hero.class), [hero.class]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              Hoja de personaje · {CLASS_ES[hero.class]}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Cerrar</Text>
            </Pressable>
          </View>

          <View style={styles.columns}>
            {/* IZQUIERDA – datos */}
            <ScrollView style={styles.colLeft} contentContainerStyle={styles.colPad}>
              <Text style={styles.blockTitle}>Datos</Text>
              <Text style={styles.statName}>{hero.name}</Text>
              <Text style={styles.statLine}>
                {CLASS_ES[hero.class]} · Nivel {hero.level}
              </Text>
              <Text style={styles.statLine}>
                Life {hero.life}/{hero.maxLife}{' '}
                <Text style={styles.muted}>({def.lifeFormula})</Text>
              </Text>
              {hero.healingUsesLeft != null && (
                <Text style={styles.statLine}>
                  Curaciones: {hero.healingUsesLeft}/3
                </Text>
              )}
              {hero.spells && hero.spells.length > 0 && (
                <Text style={styles.statLine}>
                  Hechizos: {hero.spells.join(', ')}
                </Text>
              )}

              <Text style={[styles.blockTitle, { marginTop: 12 }]}>Rasgos</Text>
              {def.traits.map((t) => (
                <Text key={t} style={styles.trait}>
                  • {t}
                </Text>
              ))}

              <Text style={[styles.blockTitle, { marginTop: 12 }]}>Notas</Text>
              {(def.notes ?? []).map((n) => (
                <Text key={n} style={styles.trait}>
                  • {n}
                </Text>
              ))}
              <Text style={styles.trait}>
                • Armadura: {def.armorAllowed.join(', ')}
              </Text>
              <Text style={styles.trait}>
                • Armas: {def.weaponsAllowed.join(', ')}
              </Text>
            </ScrollView>

            {/* CENTRO – silueta + ranuras */}
            <View style={styles.colCenter}>
              <Text style={styles.blockTitle}>Equipo</Text>
              <View style={styles.paper}>
                <View style={styles.paperTop}>
                  <SlotChip slot="armor" item={hero.equipment.armor} />
                  <SlotChip slot="spellbook" item={hero.equipment.spellbook} />
                </View>
                <View style={styles.paperMid}>
                  <SlotChip slot="mainHand" item={hero.equipment.mainHand} />
                  <View style={styles.portrait}>
                    <Text style={styles.portraitIcon}>{CLASS_ICON[hero.class]}</Text>
                    <HeroGearIcons hero={hero} />
                    <Text style={styles.portraitName} numberOfLines={1}>
                      {hero.name}
                    </Text>
                  </View>
                  <SlotChip
                    slot="offHand"
                    item={hero.equipment.offHand ?? hero.equipment.shield}
                  />
                </View>
                <View style={styles.paperBot}>
                  <SlotChip slot="shield" item={hero.equipment.shield} />
                  <SlotChip slot="misc" item={hero.equipment.misc} />
                </View>
              </View>
              <Text style={styles.mutedCenter}>
                Ranuras según tienda / botín del manual (MVP)
              </Text>
            </View>

            {/* DERECHA – variantes nivel 1 */}
            <ScrollView style={styles.colRight} contentContainerStyle={styles.colPad}>
              <Text style={styles.blockTitle}>Carga nivel 1</Text>
              <Text style={styles.muted}>
                Variantes del manual al crear el personaje
              </Text>
              {loadouts.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => onChange(applyLoadout(hero, opt))}
                  style={styles.loadoutBtn}
                >
                  <Text style={styles.loadoutLabel}>{opt.label}</Text>
                  <Text style={styles.loadoutHint}>{opt.hint}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    flex: 1,
    maxHeight: '94%',
    backgroundColor: '#1a1a1e',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#3a3a45',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#121216',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a32',
  },
  sheetTitle: { color: '#e8e6e3', fontSize: 18, fontWeight: '800' },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a35',
    borderWidth: 1,
    borderColor: '#3a3a45',
  },
  closeText: { color: '#e8e6e3', fontWeight: '700', fontSize: 14 },
  columns: { flex: 1, flexDirection: 'row' },
  colLeft: { flex: 1.1, borderRightWidth: 1, borderRightColor: '#2a2a32' },
  colCenter: {
    flex: 1.2,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#2a2a32',
  },
  colRight: { flex: 1.1 },
  colPad: { padding: 12, paddingBottom: 24 },
  blockTitle: {
    color: '#c9a227',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  statName: { color: '#f5f2ea', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  statLine: { color: '#e8e6e3', fontSize: 15, marginBottom: 3, lineHeight: 21 },
  trait: { color: '#b8b4ae', fontSize: 13, lineHeight: 19, marginBottom: 4 },
  muted: { color: '#7a7670', fontSize: 12 },
  mutedCenter: {
    color: '#7a7670',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  paper: {
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  paperTop: { flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  paperMid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  paperBot: { flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  portrait: {
    width: 120,
    minHeight: 140,
    borderRadius: 12,
    backgroundColor: '#22222a',
    borderWidth: 2,
    borderColor: '#c9a227',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 6,
  },
  portraitIcon: { fontSize: 48 },
  portraitName: {
    color: '#e8e6e3',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  slotChip: {
    flex: 1,
    minWidth: 88,
    maxWidth: 120,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#22222a',
    borderWidth: 1,
    borderColor: '#3a3a45',
    borderStyle: 'dashed',
  },
  slotLabel: {
    color: '#7a7670',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  slotValue: { color: '#e8e6e3', fontSize: 12, fontWeight: '600' },
  loadoutBtn: {
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: '#22222a',
    borderWidth: 2,
    borderColor: '#3a3a45',
  },
  loadoutLabel: { color: '#f0d78c', fontSize: 15, fontWeight: '700' },
  loadoutHint: { color: '#9a9690', fontSize: 12, marginTop: 4, lineHeight: 17 },
});
