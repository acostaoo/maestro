import type { QuestionIntent, Weather } from './nlu.interface';

export const NLU_PROMPT = `
You are a Pokémon VGC (doubles) expert. Parse the following user question into structured JSON for a damage calculator.
The user is asking if their Pokémon can survive/tank a specific move from an opponent.

Format:
{
  "intent": "survive-check",
  "defender": string | null,
  "attacker": string | null,
  "move": string | null,
  "attackerBoosts": { "atk"?: number, "spa"?: number, "def"?: number, "spd"?: number, "spe"?: number } | null,
  "defenderBoosts": { "atk"?: number, "spa"?: number, "def"?: number, "spd"?: number, "spe"?: number } | null,
  "weather": "Sun" | "Rain" | "Sand" | "Snow" | null
}

Rules:
1. Intent: Always use "survive-check" for questions about surviving, tanking, living, or taking a hit.
2. Defender: The Pokémon receiving the hit. This is the user's own Pokémon (e.g., "Goodra" in "can my goodra tank a move from archaludon").
3. Attacker: The opponent Pokémon performing the attack (e.g., "Archaludon" in "can my goodra tank a move from archaludon").
4. Pokémon Names: Use official English names. Append regional forms if mentioned (e.g., "Goodra-Hisui", "Ursaluna-Bloodmoon", "Ogerpon-Wellspring").
5. Moves: Use official English names (e.g., "Draco Meteor", "Close Combat").
6. Boosts: Map phrases like "intimidated" or "at -1" to the corresponding stat change (range -6 to 6).
7. Weather: Map weather conditions (e.g., "under rain" to "Rain", "in the sun" to "Sun"). If NO weather condition is mentioned in the question, weather MUST be null.
8. Return ONLY the JSON object.

Question:
`;

export const NLU_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { 
      type: 'STRING', 
      enum: ['survive-check', 'unknown'],
      description: 'The intent of the question. Always "survive-check" for survive/tank checks.'
    },
    defender: { 
      type: 'STRING',
      description: 'The defending Pokémon receiving the hit (e.g., "Goodra"). Set to null if not identified.'
    },
    attacker: { 
      type: 'STRING',
      description: 'The opponent Pokémon performing the attack (e.g., "Archaludon"). Set to null if not identified.'
    },
    move: { 
      type: 'STRING',
      description: 'The attack move being used (e.g., "Draco Meteor"). Set to null if not identified.'
    },
    attackerBoosts: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        atk: { type: 'INTEGER' },
        spa: { type: 'INTEGER' },
        def: { type: 'INTEGER' },
        spd: { type: 'INTEGER' },
        spe: { type: 'INTEGER' },
      },
      description: 'Stat stage boosts/drops on the attacking Pokémon (range -6 to 6).'
    },
    defenderBoosts: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        atk: { type: 'INTEGER' },
        spa: { type: 'INTEGER' },
        def: { type: 'INTEGER' },
        spd: { type: 'INTEGER' },
        spe: { type: 'INTEGER' },
      },
      description: 'Stat stage boosts/drops on the defending Pokémon (range -6 to 6).'
    },
    weather: { 
      type: 'STRING', 
      enum: ['Sun', 'Rain', 'Sand', 'Snow'], 
      nullable: true,
      description: 'Weather condition in play. MUST be null if no weather is explicitly mentioned.'
    },
  },
  required: ['intent'],
};
