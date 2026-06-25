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

LLM provider for the vision/NLU/NLG agents is **pluggable** — Gemini, OpenAI, or
a local model via Ollama / LM Studio (see *Running locally* below).

## Repository layout

| Folder      | Stack    | Description                     |
| ----------- | -------- | ------------------------------- |
| `backend/`  | NestJS   | API + orchestrator + agents     |
| `frontend/` | Angular  | Chat-style UI                   |

## Running locally

You need [Node.js](https://nodejs.org/) 18+. Open two terminals.

**1. Backend** (http://localhost:3000):

```powershell
cd backend
npm install
npm run start:dev
```

**2. Frontend** (http://localhost:4200):

```powershell
cd frontend
npm install
npm start
```

Open http://localhost:4200. The calculator, team import (paste) and Q&A all work
with **no API key**. Only the *screenshot → team* import needs a vision model
(see below) — without one it just returns a 503 and everything else keeps working.

### Vision providers (screenshot → team)

Pick whichever fits your machine. Copy the template, then edit `backend/.env`:

```powershell
cd backend
Copy-Item .env.example .env
```

| Provider | Cost | Needs | `backend/.env` |
| --- | --- | --- | --- |
| **Ollama** (local) | Free, offline | `ollama pull llava` | `VISION_PROVIDER=ollama`<br>`OPENAI_BASE_URL=http://localhost:11434/v1`<br>`OPENAI_VISION_MODEL=llava`<br>`OPENAI_API_KEY=ollama` |
| **Google Gemini** | Free tier | [API key](https://aistudio.google.com/apikey) | `VISION_PROVIDER=gemini`<br>`GEMINI_API_KEY=...` |
| **OpenAI** | Paid | [API key](https://platform.openai.com/api-keys) | `VISION_PROVIDER=openai`<br>`OPENAI_API_KEY=sk-...`<br>`OPENAI_VISION_MODEL=gpt-4o-mini` |
| **LM Studio / other** | Free, local | A loaded vision model | `VISION_PROVIDER=openai`<br>`OPENAI_BASE_URL=http://localhost:1234/v1`<br>`OPENAI_VISION_MODEL=<model>` |

Leave `VISION_PROVIDER` blank to auto-detect (uses the OpenAI-compatible client
if `OPENAI_BASE_URL`/`OPENAI_API_KEY` is set, otherwise Gemini). Restart the
backend after editing `.env`. See [backend/.env.example](backend/.env.example)
for the full annotated list.

## Status

Phase 0 — scaffolding. Bare NestJS + Angular hello-world. Agents and the
calc engine are added incrementally in following phases.
