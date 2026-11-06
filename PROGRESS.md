Mirethar – Progress Report

Última actualización: 2026-11-06 (Semana 3 – Día 22 Core Loop integrado)
Stack: React Native + Expo (TypeScript) – capa /src/core + UI combate

Semana 1 (Días 1–7) – Foundation

Módulo

Estado

Tablas vermin / minions / bosses

✅

items + classes + createDefaultParty

✅

DiceService (Explosive Six)

✅

EncounterGenerator

✅

CombatStateManager (reducer inmutable)

✅

41 tests base

✅

Semana 2 (Días 8–14) – Motor de reglas de combate

✅ Qué funciona

Módulo

Estado

Notas

CombatResolver / resolveAttack

✅

finalValue, defense=level, daño por exceso, critical

AttackModifiers

✅

clase, arma, undead, crushing, arrows, pasillo

DefenseCalculator

✅

armor/shield, rogue +L, surprise, natural 1/6

TurnManager

✅

turnos héroe + enemigo auto, victoria/derrota

AbilityResolver

✅

Healing clérigo, Fireball/Lightning/Sleep/Protect/Blessing/Escape

HeroStatus

✅

vivo / herido / caído / muerto + cargar cadáver

MoraleService

✅

> ½ minions/boss, never-test, level drop boss

ReactionService

✅

reacciones 1–6, flee/bribe helpers

TrollRegeneration

✅

d6 5–6, bloqueo hechizo/descuartizar

XpService

✅

1 tirada al derrotar boss (MVP)

Tests semana 2

Suite

Estado

CombatResolver + AttackDefenseRules

✅

TurnManager

✅

AbilityResolver (4 clases vs goblins)

✅

HeroStatus

✅

CombatRules4AD (46 tests exhaustivos)

✅

week2-e2e-boss (4 héroes vs Boss)

✅

Flujo E2E verificado

createDefaultParty()
→ boss (Orc Brute / Medusa / Chaos Lord)
→ createCombat
→ loop: heroTurn (attack) → enemyTurn (defense rolls)
→ boss life 0 → victory
→ finalizeCombatHeroes (caídos → muertos)
→ awardBossXp() + rollXpForHero()

Comprobado:

Victoria y derrota

Heridas acumuladas en boss hasta 0

Caídos al final del combate pasan a muertos

1 tirada de XP al matar boss

Log de combate coherente

⚠️ Qué falta (Semana 3+)

Combate / reglas

[ ] Integrar moral automáticamente en TurnManager tras bajas

[ ] Integrar reacciones al inicio del encuentro

[ ] Regeneración de trolls en el loop de turnos

[ ] Tabla completa de level-up / XP thresholds

[ ] Weird Monsters table

[ ] Treasure rolls

UI

[ ] Pantalla de combate landscape

[ ] Dado Central (estados visuales)

[ ] Conectar modules/combat al core

Meta

[ ] Cementerio / cargar cadáver en mazmorra

[ ] Pueblo (Taberna, Mercado, etc.)

Cómo ejecutar

# Toda la suite core

npx jest src/core --verbose

# Solo E2E boss (consola)

npx jest week2-e2e-boss --verbose

# Reglas 4AD exhaustivas

npx jest CombatRules4AD --verbose

Próximos pasos recomendados (Semana 3)

Vertical slice UI: Guerrero vs Goblins + Dado Central

Enganchar moral/reacciones/trolls al TurnManager

Treasure + XP level-up

Primer flujo de exploración de salas

Semana 2 cerrada: motor de reglas de combate usable sin UI.
