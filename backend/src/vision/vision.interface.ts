import type { Team } from '../team/team.types';

/**
 * The vision ("see the team") agent contract. Turns a game screenshot into a
 * structured team. Multiple implementations bind to the same VISION token and
 * are chosen by environment (see vision.module.ts): Gemini, or any
 * OpenAI-compatible API including local Ollama / LM Studio. Adding another
 * provider never touches the team controller.
 */

/** Injection token used to bind a VisionTeamExtractor implementation. */
export const VISION = 'VISION';

/** A screenshot to read: base64-encoded image bytes plus its MIME type. */
export interface VisionImage {
  /** Base64 image data, WITHOUT any `data:` URL prefix. */
  base64: string;
  /** e.g. "image/png" or "image/jpeg". */
  mimeType: string;
}

export interface VisionTeamExtractor {
  /** Reads a team-preview screenshot and returns the team it depicts. */
  extractTeam(image: VisionImage): Promise<Team>;
}
