import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { CombatFlow, CombatScreen } from './src/modules/combat';
import { DungeonScreen } from './src/modules/dungeon';
import type { DungeonMap } from './src/core/types/dungeon';
import type { EncounterResult } from './src/core/rules/EncounterGenerator';
import type { CombatSessionConfig } from './src/modules/combat/hooks/useCombatSession';
import type { CombatSession } from './src/modules/combat/hooks/useCombatSession';
import { createDefaultParty } from './src/core/data/classes';
import { noteEncounterCleared as noteClearedDungeon } from './src/core/rules/DungeonGenerator';
import { claimRoomAfterVictory as claimVictory } from './src/core/rules/BribeService';
import {
	markFinalBossDefeated,
	finalBossGoldReward,
	finalBossMagicItemCount,
	tryCompleteAdventure,
} from './src/core/rules/FinalBossService';
import {
	applyEncounterXp,
	emptyXpBank,
	type EncounterXpKind,
} from './src/core/rules/XpService';
import { LevelUpScreen } from './src/modules/combat';

type Mode = 'menu' | 'combat' | 'dungeon' | 'dungeonCombat' | 'levelUp';

type PendingDungeonCombat = {
	map: DungeonMap;
	encounter: EncounterResult;
	ambush?: boolean;
	/** Tras dialogar y reacción hostil: enemigos primero sin solo-frente */
	enemiesActFirst?: boolean;
	log: string[];
};

export default function App() {
	const [mode, setMode] = useState<Mode>('menu');
	const [dungeonMap, setDungeonMap] = useState<DungeonMap | null>(null);
	const [dungeonLog, setDungeonLog] = useState<string[]>([]);
	const [pending, setPending] = useState<PendingDungeonCombat | null>(null);
	const [combatKey, setCombatKey] = useState(0);

	const openDungeonCombat = useCallback(
		(payload: {
			map: DungeonMap;
			encounter: EncounterResult;
			ambush?: boolean;
			enemiesActFirst?: boolean;
			log?: string[];
		}) => {
			let mapForCombat = payload.map;
			if (!mapForCombat.partyHeroes || mapForCombat.partyHeroes.length === 0) {
				mapForCombat = {
					...mapForCombat,
					partyHeroes: createDefaultParty(),
					xpBank: mapForCombat.xpBank ?? emptyXpBank(),
				};
			}
			setDungeonMap(mapForCombat);
			if (payload.log) setDungeonLog(payload.log);
			setPending({
				map: mapForCombat,
				encounter: payload.encounter,
				ambush: payload.ambush,
				enemiesActFirst: payload.enemiesActFirst,
				log: payload.log ?? dungeonLog,
			});
			setCombatKey((k) => k + 1);
			setMode('dungeonCombat');
		},
		[dungeonLog],
	);

	const returnFromCombat = useCallback(
		(session: CombatSession) => {
			if (!pending) {
				setMode('dungeon');
				return;
			}
			let map = pending.map;
			const victory = session.state.result === 'victory';
			// Conservar héroes (caídos/muertos/carga de cuerpos) en el mapa
			map = { ...map, partyHeroes: session.state.heroes };

			if (victory) {
				map = noteClearedDungeon(map);
				const wasFinal =
					!!pending.encounter.isFinalBoss ||
					pending.encounter.enemies.some((e) => e.isFinalBoss);
				let normalGold = Math.floor(Math.random() * 6 + 1) * 5;
				normalGold = finalBossGoldReward(normalGold, wasFinal);
				const magicN = finalBossMagicItemCount(
					pending.encounter.template,
					wasFinal,
				);
				const items =
					magicN > 0
						? Array.from({ length: magicN }, (_, i) => `Objeto mágico ${i + 1}`)
						: [];
				if (wasFinal) {
					map = markFinalBossDefeated(map);
				}
				let kind: EncounterXpKind = 'minion';
				if (wasFinal) kind = 'final_boss';
				else if (pending.encounter.type === 'boss') kind = 'boss';
				else if (pending.encounter.type === 'weird') kind = 'weird';
				else if (pending.encounter.type === 'vermin') kind = 'vermin';
				else kind = 'minion';
				const xp = applyEncounterXp(map.xpBank ?? emptyXpBank(), kind);
				map = { ...map, xpBank: xp.bank };
				const claim = claimVictory(map, map.partyCellId, {
					gold: normalGold,
					items,
				});
				map = claim.map;
				setDungeonLog((prev) =>
					[
						...prev,
						wasFinal ? '¡Jefe final derrotado!' : 'Victoria en combate.',
						xp.message,
						claim.message,
						wasFinal
							? 'Volved a la entrada de la mazmorra para terminar la aventura.'
							: '',
					]
						.filter(Boolean)
						.slice(-12),
				);
			} else {
				map = { ...map, partyHeroes: session.state.heroes };
				setDungeonLog((prev) =>
					[...prev, 'Derrota o retirada — volvéis al mapa.'].slice(-12),
				);
			}
			setDungeonMap(map);
			setPending(null);
			setMode('dungeon');
		},
		[pending],
	);

	if (mode === 'dungeonCombat' && pending) {
		const heroes =
			dungeonMap?.partyHeroes && dungeonMap.partyHeroes.length > 0
				? dungeonMap.partyHeroes
				: createDefaultParty();
		const cellKind = pending.map.cells[pending.map.partyCellId]?.kind ?? 'room';
		const location: 'room' | 'corridor' =
			cellKind === 'corridor' ? 'corridor' : 'room';

		const config: CombatSessionConfig = {
			heroes,
			enemies: pending.encounter.enemies,
			encounter: pending.encounter,
			encounterType: pending.encounter.type,
			ambush: pending.ambush,
			enemiesActFirst: pending.enemiesActFirst,
			// Solo emboscada real limita objetivos al frente de marcha
			ambushFrontOnly: pending.ambush ? true : false,
			location,
			positions: {
				front: heroes.slice(0, 2).map((h) => h.id),
				rear: heroes.slice(2).map((h) => h.id),
			},
		};
		return (
			<View style={{ flex: 1 }}>
				<CombatScreen
					key={combatKey}
					config={config}
					onCombatEnd={returnFromCombat}
				/>
			</View>
		);
	}

	if (mode === 'combat') {
		return (
			<View style={{ flex: 1 }}>
				<CombatFlow />
				<Pressable
					style={styles.fab}
					onPress={() => setMode('menu')}
				>
					<Text style={styles.fabText}>Menú</Text>
				</Pressable>
			</View>
		);
	}

	if (mode === 'levelUp') {
		const fromMap = dungeonMap;
		if (!fromMap) {
			return null;
		}
		const party =
			fromMap.partyHeroes && fromMap.partyHeroes.length > 0
				? fromMap.partyHeroes
				: [];
		return (
			<LevelUpScreen
				heroes={party}
				bank={fromMap.xpBank ?? emptyXpBank()}
				onChange={(heroesNext, bankNext) => {
					setDungeonMap({
						...fromMap,
						partyHeroes: heroesNext,
						xpBank: bankNext,
					});
				}}
				onClose={() => setMode('dungeon')}
			/>
		);
	}

	if (mode === 'dungeon') {
		return (
			<DungeonScreen
				onBack={() => {
					setMode('menu');
					setDungeonMap(null);
				}}
				initialMap={dungeonMap}
				resumeLog={dungeonLog}
				onEncounter={openDungeonCombat}
				onOpenLevelUp={() => setMode('levelUp')}
			/>
		);
	}

	return (
		<View style={styles.menu}>
			<Text style={styles.title}>Mirethar</Text>
			<Text style={styles.sub}>MVP · 4AD</Text>
			<Pressable
				style={styles.btn}
				onPress={() => setMode('dungeon')}
			>
				<Text style={styles.btnText}>Explorar mazmorra</Text>
			</Pressable>
			<Pressable
				style={styles.btn}
				onPress={() => setMode('combat')}
			>
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
