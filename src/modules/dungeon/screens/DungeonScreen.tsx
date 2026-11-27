/**
 * Exploración de mazmorra – elegir entrada 1–6 y abrir puertas
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import {
	createDungeon,
	openDoor,
	movePartyTo,
	ENTRANCES,
	doorsFromPartyCell,
	noteEncounterCleared,
	acceptPendingQuest,
	turnInQuestOnMap,
} from '../../../core/rules/DungeonGenerator';
import type { DungeonMap } from '../../../core/types/dungeon';
import type { EncounterResult } from '../../../core/rules/EncounterGenerator';
import type { ActiveQuest } from '../../../core/types/quest';
import {
	getQuests,
	questsReadyHere,
	questProgressLabel,
} from '../../../core/rules/QuestService';
import {
	payBribe,
	claimRoomAfterVictory,
	bribeDemandText,
	ensureMonsterDeal,
} from '../../../core/rules/BribeService';
import { tryCompleteAdventure } from '../../../core/rules/FinalBossService';
import {
	abandonBodyAtCell,
	recoverAbandonedBody,
	bodiesAtCell,
} from '../../../core/rules/BodyService';
import { dropBody } from '../../../core/rules/HeroStatus';
import {
	resolveReaction,
	reactionStartsCombat,
	reactionFlees,
	reactionAllowsBribe,
} from '../../../core/rules/ReactionService';

import { DungeonMapView } from '../components/DungeonMapView';
import {
	DungeonRevealOverlay,
	type RevealFlash,
} from '../components/DungeonRevealOverlay';

type Props = {
	onBack?: () => void;
	/** Mapa persistido al volver del combate */
	initialMap?: DungeonMap | null;
	/** Log al volver del combate */
	resumeLog?: string[];
	/** Ir a combate con el encuentro actual */
	onOpenLevelUp?: () => void;
	onEncounter?: (payload: {
		map: DungeonMap;
		encounter: EncounterResult;
		/** Emboscada real (revisitar): enemigos primero + solo frente */
		ambush?: boolean;
		/** Tras dialogar y pelear: enemigos primero, sin restricción de frente */
		enemiesActFirst?: boolean;
		log?: string[];
	}) => void;
};

export default function DungeonScreen({
	onBack,
	onEncounter,
	initialMap = null,
	resumeLog,
	onOpenLevelUp,
}: Props) {
	const [map, setMap] = useState<DungeonMap | null>(initialMap);
	const [log, setLog] = useState<string[]>(resumeLog ?? []);
	const [pendingEncounter, setPendingEncounter] =
		useState<EncounterResult | null>(null);
	const [pendingAmbush, setPendingAmbush] = useState(false);
	const [questOffer, setQuestOffer] = useState<ActiveQuest | null>(null);
	const [revealFlash, setRevealFlash] = useState<RevealFlash | null>(null);
	/** Tras revelar criaturas: esperar a que el overlay termine antes de mostrar opciones */
	const [revealDone, setRevealDone] = useState(true);
	/** Última reacción de diálogo (mensaje en panel) */
	const [lastReactionMsg, setLastReactionMsg] = useState<string | null>(null);
	/** Si dialogaron y salió soborno, destacar opción de sobornar */
	const [bribeFromReaction, setBribeFromReaction] = useState(false);

	const start = (entranceId: number) => {
		const m = createDungeon(entranceId);
		setMap(m);
		setPendingEncounter(null);
		setPendingAmbush(false);
		setQuestOffer(null);
		setRevealDone(true);
		setLastReactionMsg(null);
		setBribeFromReaction(false);
		setLog([
			`Entrada ${entranceId}: ${ENTRANCES.find((e) => e.id === entranceId)?.name}`,
			'Tocad una puerta roja para explorar más allá.',
		]);
	};

	const handleOpenDoor = (doorId: string) => {
		if (!map) return;
		const result = openDoor(map, doorId);
		setMap(result.map);
		setLastReactionMsg(null);
		setBribeFromReaction(false);
		if (result.pendingEncounter) {
			const label = `${result.pendingEncounter.template.name} ×${result.pendingEncounter.quantity}`;
			const withDeal = ensureMonsterDeal(
				result.map,
				result.map.partyCellId,
				label,
			);
			setMap(withDeal);
			setPendingEncounter(result.pendingEncounter);
			setPendingAmbush(!!result.ambushEncounter);
		}
		if (result.pendingQuestOffer) {
			setQuestOffer(result.pendingQuestOffer);
		}
		setLog((prev) => [...prev, result.message].slice(-12));
		if (result.revealWord) {
			setRevealDone(false);
			setRevealFlash({
				id: `rev_${Date.now().toString(36)}`,
				word: result.revealWord,
				subtitle: result.revealSubtitle ?? undefined,
			});
		} else {
			setRevealDone(true);
		}
	};

	const handleSelectCell = (cellId: string) => {
		if (!map) return;
		const result = movePartyTo(map, cellId);
		let nextMap = result.map;
		const fin = tryCompleteAdventure(nextMap);
		nextMap = fin.map;
		setMap(nextMap);
		if (fin.completed) {
			setLog((prev) => [...prev, fin.message].slice(-12));
		} else if (fin.message && nextMap.finalBossDefeated) {
			setLog((prev) => [...prev, fin.message].slice(-12));
		}
		if (result.ambush) {
			const label = `${result.ambush.template.name} ×${result.ambush.quantity}`;
			const withDeal = ensureMonsterDeal(
				result.map,
				result.map.partyCellId,
				label,
			);
			setMap(withDeal);
			setPendingEncounter(result.ambush);
			setPendingAmbush(true);
			setLastReactionMsg(null);
			setBribeFromReaction(false);
			setRevealDone(true);
		} else {
			// Al entrar en casilla sobornada sin emboscada: actualizar demanda
			const deal = result.map.cells[result.map.partyCellId]?.monsterDeal;
			if (deal?.bribed) {
				const withDeal = ensureMonsterDeal(
					result.map,
					result.map.partyCellId,
					deal.label,
				);
				setMap(withDeal);
				setLog((prev) =>
					[
						...prev,
						bribeDemandText(
							withDeal.cells[result.map.partyCellId]!.monsterDeal!,
						),
					].slice(-12),
				);
			}
		}
		if (result.message) {
			setLog((prev) => [...prev, result.message].slice(-12));
		}
	};

	if (!map) {
		return (
			<View style={styles.root}>
				<View style={styles.header}>
					<Text style={styles.title}>Mazmorra</Text>
					<Text style={styles.sub}>Elige una de las 6 entradas</Text>
					{onBack && (
						<Pressable
							onPress={onBack}
							style={styles.backBtn}
						>
							<Text style={styles.backText}>Volver</Text>
						</Pressable>
					)}
				</View>
				<ScrollView contentContainerStyle={styles.entranceList}>
					{ENTRANCES.map((e) => (
						<Pressable
							key={e.id}
							onPress={() => start(e.id)}
							style={styles.entranceCard}
						>
							<Text style={styles.entranceId}>#{e.id}</Text>
							<View style={{ flex: 1 }}>
								<Text style={styles.entranceName}>{e.name}</Text>
								<Text style={styles.entranceBlurb}>{e.blurb}</Text>
							</View>
						</Pressable>
					))}
					<Pressable
						onPress={() => start(Math.floor(Math.random() * 6) + 1)}
						style={[styles.entranceCard, styles.randomCard]}
					>
						<Text style={styles.entranceName}>Al azar (d6)</Text>
						<Text style={styles.entranceBlurb}>
							Tira entrada como en la hoja de mapas
						</Text>
					</Pressable>
				</ScrollView>
			</View>
		);
	}

	const partyDoors = doorsFromPartyCell(map);
	const closed = partyDoors.filter(
		(d) => d.state === 'closed' && !d.leadsToCellId,
	);

	return (
		<View style={styles.root}>
			<View style={styles.header}>
				<View>
					<Text style={styles.title}>Mazmorra · Entrada {map.entranceId}</Text>
					<Text style={styles.sub}>
						Sala actual: {map.cells[map.partyCellId]?.label ?? map.partyCellId}
					</Text>
				</View>
				<View style={{ flexDirection: 'row', gap: 8 }}>
					{onOpenLevelUp && (
						<Pressable
							onPress={onOpenLevelUp}
							style={styles.backBtn}
						>
							<Text style={styles.backText}>XP {map.xpBank?.wholeXp ?? 0}</Text>
						</Pressable>
					)}
					<Pressable
						onPress={() => {
							setMap(null);
							setLog([]);
						}}
						style={styles.backBtn}
					>
						<Text style={styles.backText}>Nueva</Text>
					</Pressable>
				</View>
			</View>

			<DungeonRevealOverlay
				flash={revealFlash}
				onDone={() => {
					setRevealFlash(null);
					setRevealDone(true);
				}}
			/>
			{map.adventureComplete && (
				<View style={styles.completeBanner}>
					<Text style={styles.completeText}>Aventura completada</Text>
					<Text style={styles.muted}>
						Jefe final derrotado · Habéis salido por la entrada
					</Text>
				</View>
			)}

			{/* Mapa a pantalla completa (fondo + niebla); UI encima */}
			<View style={styles.mapBackdrop}>
				<DungeonMapView
					map={map}
					onSelectCell={handleSelectCell}
					onOpenDoor={handleOpenDoor}
				/>
			</View>

			<View
				style={styles.body}
				pointerEvents="box-none"
			>
				<View
					style={styles.mapSpacer}
					pointerEvents="none"
				/>

				<View style={styles.side}>
					<Text style={styles.sideTitle}>Puertas aquí</Text>
					{partyDoors.length === 0 && (
						<Text style={styles.muted}>Sin puertas en esta celda.</Text>
					)}
					{partyDoors.map((d) => {
						const canOpen = d.state === 'closed' && !d.leadsToCellId;
						return (
							<Pressable
								key={d.id}
								disabled={!canOpen}
								onPress={() => handleOpenDoor(d.id)}
								style={[styles.doorBtn, !canOpen && styles.doorBtnOff]}
							>
								<Text style={styles.doorBtnText}>
									{d.dir} · {canOpen ? 'Cerrada — abrir' : 'Abierta'}
								</Text>
							</Pressable>
						);
					})}
					{closed.length === 0 && (
						<Text style={styles.muted}>
							No quedan puertas sin explorar en esta casilla. Mové el grupo a
							otra (tocá una casilla).
						</Text>
					)}

					{questOffer && (
						<View style={styles.questBox}>
							<Text style={styles.sideTitle}>Misión</Text>
							<Text style={styles.questGiver}>
								{questOffer.giverName} · {questOffer.giverRole}
							</Text>
							<Text style={styles.questTitle}>{questOffer.title}</Text>
							<Text style={styles.questDialogue}>«{questOffer.dialogue}»</Text>
							<Text style={styles.muted}>{questOffer.goalText}</Text>
							<Pressable
								style={styles.encBtn}
								onPress={() => {
									setMap(acceptPendingQuest(map, questOffer));
									setLog((prev) =>
										[
											...prev,
											`Aceptáis «${questOffer.title}» de ${questOffer.giverName}.`,
										].slice(-12),
									);
									setQuestOffer(null);
								}}
							>
								<Text style={styles.encBtnText}>Aceptar misión</Text>
							</Pressable>
							<Pressable
								onPress={() => setQuestOffer(null)}
								style={{ marginTop: 6 }}
							>
								<Text style={styles.muted}>Rechazar</Text>
							</Pressable>
						</View>
					)}

					{map.cells[map.partyCellId]?.isEntrance && (
						<View style={styles.questTrack}>
							<Text style={styles.sideTitle}>Entrada</Text>
							<Text style={styles.muted}>
								Aquí podéis dejar cuerpos caídos y seguir, o terminar la
								aventura.
							</Text>
							{(map.partyHeroes ?? [])
								.filter((h) => h.isFallen || h.isDead || h.life <= 0)
								.map((h) => (
									<Pressable
										key={`drop_${h.id}`}
										style={styles.encBtn}
										onPress={() => {
											setMap(abandonBodyAtCell(map, h, map.partyCellId));
											setLog((prev) =>
												[
													...prev,
													`Dejáis el cuerpo de ${h.name} en la entrada.`,
												].slice(-12),
											);
										}}
									>
										<Text style={styles.encBtnText}>
											Dejar cuerpo: {h.name}
										</Text>
									</Pressable>
								))}
							{bodiesAtCell(map, map.partyCellId).map((b) => (
								<Pressable
									key={`rec_${b.heroId}`}
									style={[styles.encBtn, { borderColor: '#6ea8fe' }]}
									onPress={() => {
										const r = recoverAbandonedBody(map, b.heroId);
										setMap(r.map);
										setLog((prev) => [...prev, r.message].slice(-12));
									}}
								>
									<Text style={styles.encBtnText}>
										Revisar cuerpo: {b.heroName}
									</Text>
								</Pressable>
							))}
							<Pressable
								style={[
									styles.encBtn,
									{ borderColor: '#c9a227', marginTop: 6 },
								]}
								onPress={() => {
									setMap({ ...map, adventureComplete: true });
									setLog((prev) =>
										[...prev, 'Termináis la aventura en la entrada.'].slice(
											-12,
										),
									);
								}}
							>
								<Text style={styles.encBtnText}>Terminar aventura aquí</Text>
							</Pressable>
						</View>
					)}

					{getQuests(map).filter((q) => q.status !== 'completed').length >
						0 && (
						<View style={styles.questTrack}>
							<Text style={styles.sideTitle}>
								Misiones (
								{getQuests(map).filter((q) => q.status !== 'completed').length})
							</Text>
							{getQuests(map)
								.filter((q) => q.status !== 'completed')
								.map((q) => (
									<View
										key={q.instanceId}
										style={styles.questItem}
									>
										<Text style={styles.questTitle}>{q.title}</Text>
										<Text style={styles.questGiver}>
											{q.giverName} · {questProgressLabel(q)} · sala{' '}
											{q.giverCellId}
										</Text>
										<Text style={styles.muted}>{q.goalText}</Text>
										{q.status === 'ready_to_turn_in' &&
											map.partyCellId !== q.giverCellId && (
												<Text style={styles.readyText}>
													Listo — volved a {q.giverCellId} ({q.giverName})
												</Text>
											)}
										{q.status === 'ready_to_turn_in' &&
											map.partyCellId === q.giverCellId && (
												<Pressable
													style={styles.encBtn}
													onPress={() => {
														const { map: next, message } = turnInQuestOnMap(
															map,
															q.instanceId,
														);
														setMap(next);
														setLog((prev) => [...prev, message].slice(-12));
													}}
												>
													<Text style={styles.encBtnText}>
														Entregar · +{q.reward.gold} gp
													</Text>
												</Pressable>
											)}
									</View>
								))}
						</View>
					)}

					{map.goldFound || map.lootItems?.length ? (
						<View style={styles.lootBox}>
							<Text style={styles.sideTitle}>Botín de misiones</Text>
							<Text style={styles.encText}>{map.goldFound ?? 0} gp</Text>
							{(map.lootItems ?? []).map((it) => (
								<Text
									key={it}
									style={styles.muted}
								>
									· {it}
								</Text>
							))}
							{(map.xpMarks ?? []).map((xp) => (
								<Text
									key={xp}
									style={styles.muted}
								>
									· {xp}
								</Text>
							))}
						</View>
					) : null}

					{pendingEncounter && revealDone && (
						<View style={styles.encBox}>
							<Text style={styles.sideTitle}>¡Encuentro!</Text>
							<Text style={styles.encText}>
								{pendingEncounter.template.name} ×{pendingEncounter.quantity}
							</Text>
							<Text style={styles.muted}>
								Tipo: {pendingEncounter.type} (tabla #
								{pendingEncounter.tableRoll})
							</Text>
							{pendingAmbush && (
								<Text style={styles.readyText}>
									Emboscada: enemigos primero · solo 2 primeros del orden de
									marcha
								</Text>
							)}
							{lastReactionMsg ? (
								<Text style={styles.readyText}>{lastReactionMsg}</Text>
							) : null}
							{map.cells[map.partyCellId]?.monsterDeal && (
								<Text style={styles.muted}>
									{bribeDemandText(map.cells[map.partyCellId]!.monsterDeal!)}
								</Text>
							)}

							{/* Emboscada real: solo combatir (sin diálogo) */}
							{pendingAmbush ? (
								<Pressable
									style={styles.encBtn}
									onPress={() => {
										if (!pendingEncounter) return;
										onEncounter?.({
											map,
											encounter: pendingEncounter,
											ambush: true,
											log,
										});
										setPendingEncounter(null);
										setPendingAmbush(false);
										setLastReactionMsg(null);
										setBribeFromReaction(false);
									}}
								>
									<Text style={styles.encBtnText}>¡Emboscada! Combatir</Text>
								</Pressable>
							) : (
								<>
									{/* 4AD: atacar de inmediato → héroes primero */}
									<Pressable
										style={styles.encBtn}
										onPress={() => {
											if (!pendingEncounter) return;
											onEncounter?.({
												map,
												encounter: pendingEncounter,
												ambush: false,
												enemiesActFirst: false,
												log: [
													...log,
													'Atacáis de inmediato: vuestra party actúa primero.',
												],
											});
											setPendingEncounter(null);
											setLastReactionMsg(null);
											setBribeFromReaction(false);
										}}
									>
										<Text style={styles.encBtnText}>Combatir</Text>
									</Pressable>

									{/* 4AD: esperar / dialogar → tirada de reacción */}
									<Pressable
										style={[
											styles.encBtn,
											{ marginTop: 6, borderColor: '#c9a227' },
										]}
										onPress={() => {
											if (!pendingEncounter || !map) return;
											const partySize =
												map.partyHeroes?.filter(
													(h) => !h.isDead && !h.isFallen && h.life > 0,
												).length ?? 4;
											const enemyCount = pendingEncounter.quantity;
											const rr = resolveReaction(pendingEncounter.template);
											setLastReactionMsg(rr.message);
											setLog((prev) => [...prev, rr.message].slice(-12));

											if (reactionFlees(rr.reaction, partySize, enemyCount)) {
												setPendingEncounter(null);
												setBribeFromReaction(false);
												setLog((prev) =>
													[...prev, 'Las criaturas huyen. Sin combate.'].slice(
														-12,
													),
												);
												return;
											}

											if (reactionStartsCombat(rr.reaction)) {
												// No atacasteis de inmediato → enemigos primero
												onEncounter?.({
													map,
													encounter: pendingEncounter,
													ambush: false,
													enemiesActFirst: true,
													log: [
														...log,
														rr.message,
														'Hostiles: los enemigos atacan primero.',
													],
												});
												setPendingEncounter(null);
												setBribeFromReaction(false);
												setLastReactionMsg(null);
												return;
											}

											if (reactionAllowsBribe(rr.reaction)) {
												setBribeFromReaction(true);
												setLog((prev) =>
													[
														...prev,
														'Podéis intentar sobornarles o combatir de todos modos.',
													].slice(-12),
												);
												return;
											}

											if (rr.reaction === 'quest') {
												setLog((prev) =>
													[
														...prev,
														'Proponen una tarea (revisad ofertas de quest si aparecen).',
													].slice(-12),
												);
												return;
											}

											if (rr.reaction === 'sleeping') {
												// Dormidos: héroes pueden atacar primero
												onEncounter?.({
													map,
													encounter: pendingEncounter,
													ambush: false,
													enemiesActFirst: false,
													log: [
														...log,
														rr.message,
														'Están dormidos: atacáis primero.',
													],
												});
												setPendingEncounter(null);
												setBribeFromReaction(false);
												setLastReactionMsg(null);
												return;
											}

											// Reacciones no cubiertas: ofrecer combatir
											setLog((prev) =>
												[...prev, 'Podéis combatir o intentar sobornar.'].slice(
													-12,
												),
											);
										}}
									>
										<Text style={styles.encBtnText}>Dialogar</Text>
									</Pressable>
								</>
							)}

							{(map.cells[map.partyCellId]?.monsterDeal ||
								bribeFromReaction) && (
								<Pressable
									style={[
										styles.encBtn,
										{
											marginTop: 6,
											borderColor: bribeFromReaction ? '#f0d78c' : '#6ea8fe',
										},
									]}
									onPress={() => {
										const r = payBribe(map, map.partyCellId);
										setMap(r.map);
										setLog((prev) => [...prev, r.message].slice(-12));
										if (r.ok) {
											setPendingEncounter(null);
											setPendingAmbush(false);
											setBribeFromReaction(false);
											setLastReactionMsg(null);
										}
									}}
								>
									<Text style={styles.encBtnText}>
										Sobornar (
										{map.cells[map.partyCellId]?.monsterDeal?.nextBribeGold ??
											'?'}{' '}
										gp)
									</Text>
								</Pressable>
							)}

							{/* Atajo de prueba / debug */}
							<Pressable
								style={[
									styles.encBtn,
									{ marginTop: 6, borderColor: '#5dce7a' },
								]}
								onPress={() => {
									const normalGold = Math.floor(Math.random() * 6 + 1) * 5;
									let next = noteEncounterCleared(map);
									const claim = claimRoomAfterVictory(next, next.partyCellId, {
										gold: normalGold,
									});
									setMap(claim.map);
									setPendingEncounter(null);
									setPendingAmbush(false);
									setBribeFromReaction(false);
									setLastReactionMsg(null);
									setLog((prev) =>
										[
											...prev,
											'Encuentro resuelto (victoria).',
											claim.message,
										].slice(-12),
									);
								}}
							>
								<Text style={styles.encBtnText}>Marcar victoria</Text>
							</Pressable>
						</View>
					)}

					<Text style={[styles.sideTitle, { marginTop: 12 }]}>Log</Text>
					<ScrollView style={styles.log}>
						{log.map((line, i) => (
							<Text
								key={`${i}_${line}`}
								style={styles.logLine}
							>
								{line}
							</Text>
						))}
					</ScrollView>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#000000' },
	mapBackdrop: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		zIndex: 0,
	},
	mapSpacer: { flex: 1 },
	header: {
		height: 52,
		paddingHorizontal: 16,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(42,42,50,0.85)',
		backgroundColor: 'rgba(10,10,14,0.72)',
		zIndex: 2,
	},
	title: { color: '#e8e6e3', fontSize: 18, fontWeight: '800' },
	sub: { color: '#9a9690', fontSize: 12, marginTop: 2 },
	backBtn: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 8,
		backgroundColor: '#2a2a35',
	},
	backText: { color: '#e8e6e3', fontWeight: '700' },
	entranceList: { padding: 16, gap: 10 },
	entranceCard: {
		flexDirection: 'row',
		gap: 12,
		padding: 14,
		borderRadius: 12,
		backgroundColor: '#22222a',
		borderWidth: 2,
		borderColor: '#3a3a45',
		marginBottom: 10,
		alignItems: 'center',
	},
	randomCard: { borderColor: '#c9a227' },
	entranceId: {
		color: '#c9a227',
		fontSize: 22,
		fontWeight: '900',
		width: 36,
	},
	entranceName: { color: '#e8e6e3', fontSize: 16, fontWeight: '700' },
	entranceBlurb: { color: '#9a9690', fontSize: 13, marginTop: 2 },
	body: {
		flex: 1,
		flexDirection: 'row',
		zIndex: 1,
	},
	side: {
		width: 200,
		borderLeftWidth: 1,
		borderLeftColor: 'rgba(42,42,50,0.9)',
		padding: 10,
		backgroundColor: 'rgba(12,12,16,0.82)',
	},
	sideTitle: {
		color: '#c9a227',
		fontSize: 12,
		fontWeight: '800',
		textTransform: 'uppercase',
		marginBottom: 8,
	},
	doorBtn: {
		padding: 10,
		borderRadius: 8,
		backgroundColor: '#3a2020',
		borderWidth: 1,
		borderColor: '#e55',
		marginBottom: 6,
	},
	doorBtnOff: {
		backgroundColor: '#1e2a22',
		borderColor: '#3d8b5f',
		opacity: 0.85,
	},
	doorBtnText: { color: '#e8e6e3', fontWeight: '700', fontSize: 13 },
	muted: { color: '#7a7670', fontSize: 12, marginBottom: 8 },
	log: { flex: 1 },
	logLine: { color: '#b8b4ae', fontSize: 12, marginBottom: 4 },
	encBox: {
		padding: 10,
		borderRadius: 10,
		backgroundColor: '#3a2020',
		borderWidth: 1,
		borderColor: '#e55',
		marginBottom: 8,
	},
	encText: { color: '#e8e6e3', fontWeight: '800', fontSize: 14 },
	encBtn: {
		marginTop: 8,
		padding: 10,
		borderRadius: 8,
		backgroundColor: '#3a3420',
		borderWidth: 1,
		borderColor: '#c9a227',
		alignItems: 'center',
	},
	encBtnText: { color: '#f0d78c', fontWeight: '800' },
	questBox: {
		padding: 10,
		borderRadius: 10,
		backgroundColor: '#2a2830',
		borderWidth: 1,
		borderColor: '#c9a227',
		marginBottom: 8,
	},
	questTrack: {
		padding: 10,
		borderRadius: 10,
		backgroundColor: '#22222a',
		borderWidth: 1,
		borderColor: '#3a3a45',
		marginBottom: 8,
	},
	questGiver: { color: '#9a9690', fontSize: 12, marginBottom: 4 },
	questTitle: { color: '#f0d78c', fontSize: 14, fontWeight: '800' },
	questDialogue: {
		color: '#e8e6e3',
		fontSize: 12,
		lineHeight: 17,
		marginVertical: 6,
		fontStyle: 'italic',
	},
	readyText: {
		color: '#5dce7a',
		fontSize: 12,
		fontWeight: '700',
		marginTop: 4,
	},
	questItem: {
		marginBottom: 10,
		paddingBottom: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: '#3a3a45',
	},
	completeBanner: {
		position: 'absolute',
		top: 56,
		left: 16,
		right: 16,
		zIndex: 40,
		padding: 12,
		borderRadius: 10,
		backgroundColor: 'rgba(40, 34, 14, 0.92)',
		borderWidth: 2,
		borderColor: '#c9a227',
		alignItems: 'center',
	},
	completeText: {
		color: '#f0d78c',
		fontSize: 18,
		fontWeight: '900',
	},
	lootBox: {
		padding: 10,
		borderRadius: 10,
		backgroundColor: '#1e2a22',
		borderWidth: 1,
		borderColor: '#3d8b5f',
		marginBottom: 8,
	},
});
