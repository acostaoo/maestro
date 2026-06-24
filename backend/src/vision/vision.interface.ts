import type { Team } from '../team/team.types';

/**
 * The vision ("see the team") agent contract. Turns a game screenshot into a
 * structured team. A Gemini-backed implementation ships now; a local-model
 * implementation (e.g. Ollama llava) can be bound to the same token without
 * touching the team controller.
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
