Mirethar – Progress Report (Semana 1)

Fecha: 2026-11-03
Alcance: Días 1–7 (core data-driven + estado de combate)
Stack: React Native + Expo (TypeScript) – solo capa /src/core

✅ Qué funciona

Datos (data-driven)

Archivo

Estado

Notas

src/core/data/vermin.ts

✅

6 entradas exactas 4AD (Rats → Skeletal Rats)

src/core/data/minions.ts

✅

6 entradas exactas 4AD (Skeletons/Zombies → Fungi Folk)

src/core/data/bosses.ts

✅

6 bosses del manual básico (Mummy → Small Dragon)

src/core/data/items.ts

✅

Equipo inicial de las 4 clases + slots

src/core/data/classes.ts

✅

Life, traits y equipo inicial exactos del GDD §3.2

Reglas / lógica

Módulo

Estado

Notas

DiceService

✅

rollD6, rollWithExplosiveSix, rollDice (inyectable RNG)

EncounterGenerator

✅

Genera Vermin / Minion / Boss con cantidades 4AD

CombatStateManager

✅

Estado inmutable + reducer. Fases: heroTurn → resolution → next / enemyTurn / ended

createDefaultParty()

✅

Guerrero (7), Pícaro (4), Clérigo (5), Mago (3) con equipo 4AD

Tipos

Tipo

Estado

EnemyTemplate / EnemyInstance

✅

Hero / Action / CombatState

✅ (incluye heroTurnOrder, heroTurnIndex)

ReactionType

✅ (union tipada)

Item / EquipmentSlot

✅ (fuente de verdad en items.ts)

Tests

Suite

Estado

EncounterGenerator.test.ts

✅ Generación + rangos de cantidad/nivel

CombatStateManager.test.ts

✅ Crear, seleccionar, resolver, avanzar turno, inmutabilidad

week1-review.test.ts

✅ 5 combates de prueba + sistemas base

classes.test.ts

⚠️ Crear si aún no existe en el repo local

⚠️ Qué falta / limitaciones actuales

Combate (reglas)

[ ] Resolución real de ataque/defensa (dados + modificadores de clase/equipo)

[ ] Aplicar daño a EnemyInstance.currentLife / Hero.life

[ ] Caídos / muertos (isFallen → isDead)

[ ] Moral, reacciones de monstruos, huida, soborno

[ ] Turno de enemigos (AI mínima)

[ ] Posicionamiento (frente / retaguardia) con efecto en reglas

[ ] Hechizos del Mago y Healing del Clérigo

Contenido

[ ] Tabla Weird Monsters

[ ] Tablas de tesoro / XP

[ ] Expansiones (Abyss, Netherworld, Twisted Minions, Fiendish Foes)

UI / App

[ ] Pantalla de combate (layout landscape)

[ ] Dado Central (estados visuales)

[ ] Integración con React state / reducer en la UI

Arquitectura

[ ] Módulo modules/combat conectado al core

[ ] Persistencia de héroes / cementerio (post-MVP)

Flujo verificado (Semana 1)

createDefaultParty()
↓
generateEncounter('vermin' | 'minion' | 'boss')
↓
createCombat(heroes, enemies)
↓
selectAction → selectTarget → startResolution → finishResolution
↓
(siguiente héroe | enemyTurn | ended)

Estado siempre inmutable. Cada acción del reducer devuelve un nuevo objeto.

Cómo ejecutar la revisión

# Todos los tests de core

npx jest src/core --verbose

# Solo revisión semana 1

npx jest week1-review --verbose

# Solo combate

npx jest CombatStateManager --verbose

Próximos pasos recomendados (Semana 2)

Día 8–9: CombatResolver – resolver ataque/defensa con Explosive Six + mods de clase.

Día 10: Aplicar daño, caídos y victoria/derrota automática.

Día 11–12: Turno enemigo simple + reacciones básicas.

Día 13: Vertical slice UI (Guerrero vs Goblins + Dado Central).

Documento generado en la revisión del Día 7 (Semana 1).
