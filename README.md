# Mirethar

Juego digital basado en **Four Against Darkness** (reglas revisadas del manual básico).  
Stack: **React Native + Expo (TypeScript)** — núcleo de reglas en `src/core`, UI en `src/modules`.

Este README resume el alcance del **manual básico 4AD** como lista de puntos a implementar, separada en **cumplidos** y **faltantes**, y cómo clonar y probar el proyecto.

---

## Cumplidos (implementado)

### Personajes y equipo

- [x] Cuatro clases básicas: Guerrero, Pícaro, Clérigo, Mago (`classes.ts`, `createDefaultParty`)
- [x] Equipo inicial y slots de equipo (`items.ts`, `equipmentOptions.ts`)
- [x] Estados de héroe: vivo / herido / caído / muerto; cargar cadáver (`HeroStatus`, `BodyService`)
- [x] Orden de marcha (frente / retaguardia) en combate

### Dados y combate core

- [x] Tirada d6 con **Explosive Six** (`DiceService`)
- [x] Ataque: valor final vs level del monstruo; 1 siempre falla; daño por exceso en minions/vermin y heridas en bosses (`CombatResolver`)
- [x] Defensa: armor/shield, modificadores de clase, natural 1/6 (`DefenseCalculator`)
- [x] Modificadores 4AD: clase, arma a dos manos / ligera, undead, crushing vs skeletons, arrows, pasillo (`AttackModifiers`)
- [x] Turnos: héroes en orden de marcha → turno enemigo automático → nueva ronda (`TurnManager`)
- [x] Victoria / derrota por life 0; finalización de caídos al cerrar combate
- [x] Distribución de ataques enemigos según número de monstruos vs héroes; bosses/weird a objetivo aleatorio (`assignEnemyAttackTargets`)

### Tablas de encuentros (manual básico)

- [x] Vermin (d6) — `vermin.ts`
- [x] Minions (d6) — `minions.ts`
- [x] Bosses (d6) — `bosses.ts`
- [x] Weird monsters (d6) — `weird.ts`
- [x] Generación de encuentro por tipo y aleatoria (`EncounterGenerator`)
- [x] Cantidades según fórmulas del manual

### Reacciones, moral y reglas especiales

- [x] Tabla de reacciones por monstruo (`ReactionService`)
- [x] Moral de minions (>½ bajas) y bosses (>½ life); monstruos que nunca tiran moral (`MoraleService`)
- [x] Moral enganchada al aplicar daño en combate (`TurnManager` / `applyHeroAttack`)
- [x] Bajada de level del boss al quedar por debajo de la mitad de life
- [x] Regeneración de trolls (d6 5–6; bloqueo por hechizo / descuartizar)
- [x] Reglas especiales parciales: aliento, Iron Eater, momia, veneno, cargo de minotauro, etc. (`SpecialRulesService`)

### Habilidades y magia

- [x] Curación del clérigo (usos limitados)
- [x] Hechizos MVP: Fireball, Lightning Bolt, Sleep, Protect, Blessing, Escape (`AbilityResolver`, `spells.ts`)

### Botín, XP y jefe final

- [x] Botín simplificado por `treasureModifier` (`TreasureService`)
- [x] XP: vermin 0, minion fracciones, boss/weird 1, jefe final 2 (`XpService`)
- [x] Subida de nivel por gasto de XP (d6 > nivel; no el mismo héroe dos veces seguidas)
- [x] Detección / combate de jefe final de mazmorra (`FinalBossService`)
- [x] Soborno / claim de sala tras victoria (`BribeService`)

### Mazmorra procedural

- [x] Entradas 1–6 y materialización en mapa (`entrances.ts`, `entranceRooms.ts`)
- [x] Generación por etapas al abrir puertas (`DungeonGenerator`)
- [x] Pack de salas d66 **11–66** con rejillas, puertas y rotación (`dungeonRooms.ts` + PNG)
- [x] Contenidos de sala (tabla básica) (`roomContents.ts`, `RoomContentsService`)
- [x] Tabla de quests (`questTable.ts`, `QuestService`)
- [x] Vista de mapa local 7×9 con tiles floor/wall/puerta (`DungeonMapView`)
- [x] Flujo App: menú → mazmorra ↔ combate de encuentro (`App.tsx`)

### UI de combate

- [x] Pantalla landscape con dado central, feedback y log
- [x] Sprites de héroes y monstruos (idle / impacto / caído)
- [x] Disposición tipo referencia: enemigos arriba, héroes abajo, **acciones como iconos** en franja central, **dado en esquina inferior**
- [x] Setup de encuentro, resultados, level-up

### Calidad

- [x] Arquitectura modular `core` (reglas) vs `modules` (UI)
- [x] Suites de test de reglas 4AD, turnos, habilidades, e2e boss, generador de mazmorra
- [x] Criterios de aceptación GDD §10 documentados (`docs/ACCEPTANCE_DAY24.md`)

---

## Faltantes (pendiente respecto al manual básico 4AD)

### Combate y flujo de encuentro

- [x] Forzar **reacción** al inicio de cada encuentro en el flow UI (servicio listo; no siempre se aplica antes del combate)
- [x] Combate en **pasillo** completo: solo posiciones 1–2 atacan cuerpo a cuerpo; 3–4 con a distancia / hechizos según manual
- [x] Armas a distancia: uso restringido al primer asalto / skirmish según reglas de sala vs pasillo
- [x] Excepción **HATE** (ataques extra siempre a la clase odiada) en la distribución de objetivos
- [ ] Elección manual del jugador de quién se salva / recibe ataques extra (ahora heurística tank/front)

### Tablas y botín

- [ ] Tabla de tesoro **completa** del manual (objetos mágicos, oro detallado, excepciones por monstruo)
- [ ] Persistencia real de inventario de party entre combates y salas (botín aún simplificado)
- [ ] Todas las reglas especiales de cada entrada de tabla (texto del manual → lógica 100 % automatizada)

### Mazmorra y exploración

- [ ] Usar el pack **d66 11–66** al generar cada sala nueva (datos listos; acoplar a `DungeonGenerator` al abrir puerta)
- [ ] Trampas, enigmas y features especiales con resolución interactiva completa
- [ ] Mapa completo exportable / guardado de partida (save/load)
- [ ] Clases y suplementos **fuera del manual básico** (Abyss, Netherworld, Twisted Minions, etc.) — fuera de alcance MVP

### UI / producto

- [ ] Iconos PNG de habilidades (ahora glifos Unicode)
- [ ] Bloqueo de orientación landscape en la app host
- [ ] Tutorial in-game de reglas 4AD
- [ ] Audio / música
- [ ] Multidioma (UI en español; textos de tablas aún mezclan EN del manual)

---

## Guía: descargar y probar el proyecto

### Requisitos

- Node.js 20+ (recomendado LTS)
- npm o yarn
- Expo CLI (`npx expo` basta)
- Emulador Android/iOS **o** dispositivo con app **Expo Go**
- Git

### 1. Obtener el código

Si trabajas desde el repositorio local del proyecto (carpeta de trabajo sincronizada):

```bash
cd /ruta/a/mirethar   # carpeta del proyecto (artifacts / repo)
```

Si clonas desde remoto (ajusta la URL cuando exista):

```bash
git clone <URL_DEL_REPO> mirethar
cd mirethar
```

### 2. Instalar dependencias

En la raíz del proyecto debe haber un `package.json` de Expo/React Native. Si aún no está en el árbol versionado, créalo con un template Expo y copia `src/`, `App.tsx` y `assets` dentro:

```bash
npx create-expo-app@latest . --template blank-typescript
# luego asegura que App.tsx y src/ sean los de Mirethar
npm install
```

Con el `package.json` ya presente:

```bash
npm install
```

### 3. Arrancar

```bash
npx expo start
```

- Pulsa `a` (Android), `i` (iOS) o escanea el QR con **Expo Go**.
- Preferible **tablet o emulador en landscape**.

### 4. Qué probar en el menú

| Entrada      | Qué verifica                                                                      |
| ------------ | --------------------------------------------------------------------------------- |
| **Combate**  | Setup vermin/minion/boss/weird → turnos, dado, iconos de acción, victoria/derrota |
| **Mazmorra** | Entrada, mapa, abrir puertas, encuentros, vuelta al mapa tras combate             |
| **Level-up** | Tras acumular XP de bosses/minions, gastar XP en un héroe                         |

Flujo mínimo sugerido:

1. Mazmorra → explorar 2–3 salas.
2. Resolver un combate de minions y uno de boss.
3. Comprobar log, life, moral (huida posible) y XP.
4. Volver al mapa y abrir otra puerta.

### 5. Tests de reglas (sin UI)

Desde la raíz, con el runner que uses en el repo (Jest / vitest según `package.json`):

```bash
npm test
# o, si apuntas solo a core:
npx jest src/core
```

Suites relevantes: `CombatRules4AD`, `TurnManager`, `AbilityResolver`, `DungeonGenerator`, `week2-e2e-boss`.

### 6. Estructura útil

```
App.tsx                 # menú, mazmorra ↔ combate
src/core/data/          # tablas 4AD, clases, items, salas
src/core/rules/         # motor de reglas
src/core/types/         # tipos combate / mazmorra
src/modules/combat/     # UI combate
src/modules/dungeon/    # UI mazmorra
src/assets/             # sprites, dados, tiles de mapa
docs/                   # GDD, PDFs del manual, aceptación
```

### 7. Notas

- El núcleo de reglas es jugable y testeable **sin** depender de la UI.
- Los PDF del manual en `docs/` son referencia de diseño; la implementación es una adaptación fiel al **manual básico**, no un suplemento completo.
- PROGRESS.md histórico puede estar desfasado respecto a este README; **esta lista prevalece**.

---

## Referencias

- _Four Against Darkness_ – Revised rules (manual básico)
- `docs/Mirethar_GDD_MVP.pdf` – diseño del MVP
- `docs/ACCEPTANCE_DAY24.md` – criterios GDD §10

---

_Última actualización de este README: 2026-11-26_
