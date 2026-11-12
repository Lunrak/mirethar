/**
 * Hoja de personaje – preparación de combate
 * Click en ranura → elegir variante permitida por clase (4AD)
 */

import React, { useMemo, useState } from 'react';
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
import {
	ITEMS,
	isTwoHanded,
	isTorch,
	hasFreeHand,
	type EquipmentSlot,
	type Item,
} from '../../../core/data/items';
import {
	optionsForSlot,
	applySlotChoice,
	type SlotOption,
} from '../../../core/data/equipmentOptions';
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
	shield: 'Escudo / mano izq.',
	mainHand: 'Mano dcha. (arma)',
	offHand: 'Mano izq.',
	misc: 'Misc',
	spellbook: 'Grimorio',
};

type Props = {
	hero: Hero;
	visible: boolean;
	onClose: () => void;
	onChange: (hero: Hero) => void;
	/** Party completa para avisos de antorcha de grupo */
	party?: Hero[];
};

function SlotChip({
	slot,
	item,
	locked,
	onPress,
}: {
	slot: EquipmentSlot;
	item?: Item;
	locked?: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			disabled={locked}
			style={[styles.slotChip, locked && styles.slotLocked]}
			accessibilityRole="button"
			accessibilityLabel={`${SLOT_LABEL[slot]}: ${item?.name ?? 'vacío'}`}
		>
			<Text style={styles.slotLabel}>{SLOT_LABEL[slot]}</Text>
			<Text
				style={styles.slotValue}
				numberOfLines={2}
			>
				{locked
					? 'Ocupada (2 manos)'
					: item
						? item.name
						: '— tocar para elegir —'}
			</Text>
			{item?.rules?.[0] ? (
				<Text
					style={styles.slotRule}
					numberOfLines={1}
				>
					{item.rules[0]}
				</Text>
			) : null}
		</Pressable>
	);
}

export function CharacterSheet({
	hero,
	visible,
	onClose,
	onChange,
	party,
}: Props) {
	const def = CLASSES[hero.class];
	const [pickerSlot, setPickerSlot] = useState<EquipmentSlot | null>(null);

	const twoHanded = isTwoHanded(hero.equipment.mainHand);
	const bow = !!hero.equipment.mainHand?.tags?.includes('bow');
	const offLocked = twoHanded || bow;
	const freeHand = hasFreeHand(hero.equipment);

	const partyHasTorch = useMemo(() => {
		const list = party ?? [hero];
		return list.some((h) => {
			const eq = h.id === hero.id ? hero.equipment : h.equipment;
			return (
				isTorch(eq.offHand) ||
				isTorch(eq.misc) ||
				isTorch(eq.mainHand) ||
				Object.values(eq).some((it) => isTorch(it))
			);
		});
	}, [party, hero]);

	const warnings = useMemo(() => {
		const w: string[] = [];
		if (hero.class === 'wizard' && !freeHand) {
			w.push(
				'Mago: necesita una mano libre para lanzar conjuros. Suelta el arma o la antorcha/escudo de la otra mano.',
			);
		}
		if (!partyHasTorch) {
			w.push(
				'Ningún héroe lleva antorcha: en zonas oscuras el grupo puede sufrir penalizadores (manual 4AD).',
			);
		}
		if (twoHanded) {
			w.push(
				'Arma a dos manos: no puedes equipar escudo ni antorcha en la mano izquierda.',
			);
		}
		if (bow) {
			w.push(
				'Arco: ocupa el uso de las manos; sin escudo ni antorcha en off-hand.',
			);
		}
		return w;
	}, [hero.class, freeHand, partyHasTorch, twoHanded, bow]);

	const pickerOptions: SlotOption[] = useMemo(() => {
		if (!pickerSlot) return [];
		return optionsForSlot(hero.class, pickerSlot, hero.equipment);
	}, [pickerSlot, hero.class, hero.equipment]);

	const choose = (opt: SlotOption) => {
		if (!pickerSlot) return;
		const equipment = applySlotChoice(hero.equipment, pickerSlot, opt.itemId);
		onChange({ ...hero, equipment });
		setPickerSlot(null);
	};

	const openOffHand = () => {
		// Unificamos shield/offHand en el picker de "mano izq"
		setPickerSlot(
			offLocked ? 'offHand' : hero.equipment.shield ? 'shield' : 'offHand',
		);
	};

	return (
		<Modal
			visible={visible}
			animationType="fade"
			transparent
		>
			<View style={styles.backdrop}>
				<View style={styles.sheet}>
					<View style={styles.sheetHeader}>
						<Text style={styles.sheetTitle}>Hoja · {CLASS_ES[hero.class]}</Text>
						<Pressable
							onPress={onClose}
							style={styles.closeBtn}
						>
							<Text style={styles.closeText}>Cerrar</Text>
						</Pressable>
					</View>

					<View style={styles.columns}>
						{/* IZQUIERDA – datos */}
						<ScrollView
							style={styles.colLeft}
							contentContainerStyle={styles.colPad}
						>
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
							{def.traits.map((tr) => (
								<Text
									key={tr}
									style={styles.trait}
								>
									• {tr}
								</Text>
							))}

							<Text style={[styles.blockTitle, { marginTop: 12 }]}>
								Reglas de equipo
							</Text>
							<Text style={styles.trait}>
								• Armadura permitida: {def.armorAllowed.join(', ')}
							</Text>
							<Text style={styles.trait}>
								• Armas permitidas: {def.weaponsAllowed.join(', ')}
							</Text>
							{(def.notes ?? []).map((n) => (
								<Text
									key={n}
									style={styles.trait}
								>
									• {n}
								</Text>
							))}

							{warnings.length > 0 && (
								<>
									<Text
										style={[
											styles.blockTitle,
											{ marginTop: 12, color: '#e8c547' },
										]}
									>
										Avisos
									</Text>
									{warnings.map((w) => (
										<Text
											key={w}
											style={styles.warn}
										>
											⚠ {w}
										</Text>
									))}
								</>
							)}
						</ScrollView>

						{/* CENTRO – ranuras clicables */}
						<View style={styles.colCenter}>
							<Text style={styles.blockTitle}>Equipo (toca una ranura)</Text>
							<View style={styles.paper}>
								<View style={styles.paperTop}>
									<SlotChip
										slot="armor"
										item={hero.equipment.armor}
										onPress={() => setPickerSlot('armor')}
									/>
									<SlotChip
										slot="spellbook"
										item={hero.equipment.spellbook}
										onPress={() => setPickerSlot('spellbook')}
									/>
								</View>
								<View style={styles.paperMid}>
									<SlotChip
										slot="mainHand"
										item={hero.equipment.mainHand}
										onPress={() => setPickerSlot('mainHand')}
									/>
									<View style={styles.portrait}>
										<Text style={styles.portraitIcon}>
											{CLASS_ICON[hero.class]}
										</Text>
										<HeroGearIcons hero={hero} />
										<Text
											style={styles.portraitName}
											numberOfLines={1}
										>
											{hero.name}
										</Text>
									</View>
									<SlotChip
										slot="offHand"
										item={hero.equipment.offHand ?? hero.equipment.shield}
										locked={offLocked}
										onPress={openOffHand}
									/>
								</View>
								<View style={styles.paperBot}>
									<SlotChip
										slot="misc"
										item={hero.equipment.misc}
										onPress={() => setPickerSlot('misc')}
									/>
								</View>
							</View>
						</View>

						{/* DERECHA – resumen del equipo actual */}
						<ScrollView
							style={styles.colRight}
							contentContainerStyle={styles.colPad}
						>
							<Text style={styles.blockTitle}>Resumen</Text>
							{(
								[
									['Armadura', hero.equipment.armor],
									['Arma', hero.equipment.mainHand],
									[
										'Mano izq.',
										hero.equipment.offHand ?? hero.equipment.shield,
									],
									['Grimorio', hero.equipment.spellbook],
									['Misc', hero.equipment.misc],
								] as [string, Item | undefined][]
							).map(([label, it]) => (
								<View
									key={label}
									style={styles.summaryRow}
								>
									<Text style={styles.summaryLabel}>{label}</Text>
									<Text style={styles.summaryValue}>{it?.name ?? '—'}</Text>
									{it?.rules?.map((r) => (
										<Text
											key={r}
											style={styles.summaryRule}
										>
											{r}
										</Text>
									))}
								</View>
							))}
							<Text style={[styles.muted, { marginTop: 10 }]}>
								Toca una ranura del centro para cambiar entre las variantes de
								tu clase.
							</Text>
						</ScrollView>
					</View>
				</View>

				{/* Picker de variantes */}
				<Modal
					visible={pickerSlot != null}
					transparent
					animationType="slide"
				>
					<View style={styles.pickerBackdrop}>
						<View style={styles.pickerSheet}>
							<Text style={styles.pickerTitle}>
								{pickerSlot ? SLOT_LABEL[pickerSlot] : ''}
							</Text>
							<Text style={styles.pickerSub}>
								Variantes permitidas para {CLASS_ES[hero.class]}
							</Text>
							<ScrollView style={{ maxHeight: 320 }}>
								{pickerOptions.map((opt) => {
									const selected =
										opt.itemId == null
											? pickerSlot === 'mainHand'
												? !hero.equipment.mainHand
												: pickerSlot === 'armor'
													? !hero.equipment.armor
													: pickerSlot === 'spellbook'
														? !hero.equipment.spellbook
														: pickerSlot === 'misc'
															? !hero.equipment.misc
															: !hero.equipment.shield &&
																!hero.equipment.offHand
											: hero.equipment.mainHand?.id === opt.itemId ||
												hero.equipment.armor?.id === opt.itemId ||
												hero.equipment.shield?.id === opt.itemId ||
												hero.equipment.offHand?.id === opt.itemId ||
												hero.equipment.misc?.id === opt.itemId ||
												hero.equipment.spellbook?.id === opt.itemId;
									return (
										<Pressable
											key={`${opt.itemId ?? 'empty'}_${opt.label}`}
											onPress={() => choose(opt)}
											style={[styles.optBtn, selected && styles.optBtnOn]}
										>
											<Text style={styles.optLabel}>{opt.label}</Text>
											{opt.hint ? (
												<Text style={styles.optHint}>{opt.hint}</Text>
											) : null}
											{opt.itemId && ITEMS[opt.itemId]?.rules ? (
												<Text style={styles.optHint}>
													{ITEMS[opt.itemId].rules!.join(' · ')}
												</Text>
											) : null}
										</Pressable>
									);
								})}
							</ScrollView>
							<Pressable
								onPress={() => setPickerSlot(null)}
								style={styles.pickerCancel}
							>
								<Text style={styles.pickerCancelText}>Cancelar</Text>
							</Pressable>
						</View>
					</View>
				</Modal>
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
		flex: 1.25,
		padding: 12,
		borderRightWidth: 1,
		borderRightColor: '#2a2a32',
	},
	colRight: { flex: 1 },
	colPad: { padding: 12, paddingBottom: 24 },
	blockTitle: {
		color: '#c9a227',
		fontSize: 13,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 1,
		marginBottom: 8,
	},
	statName: {
		color: '#f5f2ea',
		fontSize: 22,
		fontWeight: '800',
		marginBottom: 4,
	},
	statLine: { color: '#e8e6e3', fontSize: 15, marginBottom: 3, lineHeight: 21 },
	trait: { color: '#b8b4ae', fontSize: 13, lineHeight: 19, marginBottom: 4 },
	warn: { color: '#e8c547', fontSize: 13, lineHeight: 19, marginBottom: 6 },
	muted: { color: '#7a7670', fontSize: 12 },
	paper: { flex: 1, justifyContent: 'center', gap: 10 },
	paperTop: { flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
	paperMid: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 6,
	},
	paperBot: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
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
		minWidth: 96,
		maxWidth: 130,
		padding: 8,
		borderRadius: 8,
		backgroundColor: '#22222a',
		borderWidth: 1,
		borderColor: '#5dce7a',
		borderStyle: 'dashed',
	},
	slotLocked: {
		borderColor: '#5a5650',
		opacity: 0.7,
	},
	slotLabel: {
		color: '#7a7670',
		fontSize: 10,
		fontWeight: '700',
		textTransform: 'uppercase',
		marginBottom: 2,
	},
	slotValue: { color: '#e8e6e3', fontSize: 12, fontWeight: '600' },
	slotRule: { color: '#9a9690', fontSize: 10, marginTop: 2 },
	summaryRow: {
		marginBottom: 10,
		paddingBottom: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#2a2a32',
	},
	summaryLabel: { color: '#7a7670', fontSize: 11, fontWeight: '700' },
	summaryValue: { color: '#e8e6e3', fontSize: 14, fontWeight: '700' },
	summaryRule: { color: '#9a9690', fontSize: 11 },
	pickerBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.55)',
		justifyContent: 'flex-end',
	},
	pickerSheet: {
		backgroundColor: '#1a1a1e',
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		padding: 16,
		borderWidth: 1,
		borderColor: '#3a3a45',
	},
	pickerTitle: { color: '#f0d78c', fontSize: 18, fontWeight: '800' },
	pickerSub: { color: '#9a9690', fontSize: 13, marginBottom: 12 },
	optBtn: {
		padding: 12,
		marginBottom: 8,
		borderRadius: 10,
		backgroundColor: '#22222a',
		borderWidth: 2,
		borderColor: '#3a3a45',
	},
	optBtnOn: { borderColor: '#c9a227', backgroundColor: '#3a3420' },
	optLabel: { color: '#e8e6e3', fontSize: 15, fontWeight: '700' },
	optHint: { color: '#9a9690', fontSize: 12, marginTop: 3 },
	pickerCancel: {
		marginTop: 8,
		padding: 12,
		alignItems: 'center',
	},
	pickerCancelText: { color: '#9a9690', fontWeight: '700' },
});
