# Maestro — Pokémon Damage Calc Orchestrator

Natural-language Pokémon damage calculator orchestrator built on
[`@smogon/damage-calc`](https://github.com/smogon/damage-calc).

Ask questions like:

> "can my goodra tank a draco meteor from archaludon?"

…and get a spoken-language answer with the useful numbers behind it:

> "Yes — but it's an OHKO if they run max SpA + Timid."

**Target format:** Gen 9 VGC (doubles).

## Planned architecture

```
Angular chat UI
   │  question text
   ▼
NestJS Orchestrator
   ├─ NLU agent        parse question → calc intent
   ├─ Set/Spread agent expand mons → common competitive sets/spreads
   ├─ Calc engine      wrapper around @smogon/damage-calc
   ├─ NLG agent        results → spoken answer
   └─ Team designer    screenshot (Pokémon Champions) → team (later phase)
```

LLM provider for the NLU/NLG agents: **Gemini** (added in a later phase).

## Repository layout

| Folder      | Stack    | Description                     |
| ----------- | -------- | ------------------------------- |
| `backend/`  | NestJS   | API + orchestrator + agents     |
| `frontend/` | Angular  | Chat-style UI                   |

## Running locally

Backend (http://localhost:3000):

```powershell
cd backend
npm run start:dev
```

Frontend (http://localhost:4200):

```powershell
cd frontend
npm start
```

## Status

Phase 0 — scaffolding. Bare NestJS + Angular hello-world. Agents and the
calc engine are added incrementally in following phases.
