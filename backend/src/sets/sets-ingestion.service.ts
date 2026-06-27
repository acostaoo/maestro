import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Generations, toID } from '@smogon/calc';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SetsRepository } from './sets.repository';
import type { SpeciesSets, StatSpread, TailorMadeData, TailorMadeSpread, UsageStat } from './sets.types';

const BASE_URL = 'https://www.pikalytics.com/pokedex';
/** How many top-ranked species to ingest in the daily cron. */
const TOP_DAILY = 20;
/** Polite delay between sequential requests during the daily batch (ms). */
const FETCH_DELAY_MS = 1500;

const GEN = Generations.get(9);

interface ScrapedEntry {
  name: string;
  pct: number;
}

interface ScrapedSpread {
  evs: Record<string, number>;
  pct: number;
}

interface ScrapedData {
  moves: ScrapedEntry[];
  items: ScrapedEntry[];
  abilities: ScrapedEntry[];
  natures: ScrapedEntry[];
  spreads: ScrapedSpread[];
}

/**
 * Ingests competitive set data from Pikalytics for the current regulation.
 *
 * Configuration (via .env):
 *   PIKALYTICS_FORMAT — format slug (default: battledataregmbs3)
 *
 * Daily cron (03:00): fetches the top 20 ranked species.
 * On-demand: `ingestOne(species)` — called by the orchestrator when a species
 * is requested but has no cached sets yet.
 * Manual trigger: POST /sets/ingest (top 20) or POST /sets/ingest/:name (one).
 */
@Injectable()
export class SetsIngestionService {
  private readonly logger = new Logger(SetsIngestionService.name);
  private readonly dataDir =
    process.env.SETS_DATA_DIR ?? join(process.cwd(), 'src', 'sets', 'data');
  private readonly format =
    process.env.PIKALYTICS_FORMAT ?? 'battledataregmbs3';

  constructor(private readonly repo: SetsRepository) {}

  // ---------------------------------------------------------------------------
  // Scheduled & manual triggers
  // ---------------------------------------------------------------------------

  /** Daily at 03:00 — ingests the top 20 species from the current ranking. */
  @Cron('0 3 * * *')
  async scheduledIngest(): Promise<void> {
    try {
      const ranking = await this.fetchRanking();
      const top = ranking.slice(0, TOP_DAILY);
      this.logger.log(`Daily ingest starting: ${top.join(', ')}`);
      let n = 0;
      for (const species of top) {
        try {
          await this.ingestOne(species);
          n++;
        } catch (err) {
          this.logger.warn(`Skipping ${species}: ${(err as Error).message}`);
        }
        if (n < top.length) await this.sleep(FETCH_DELAY_MS);
      }
      this.logger.log(`Daily ingest complete (${n}/${top.length} species).`);
    } catch (err) {
      this.logger.error(`Daily ingest failed: ${(err as Error).message}`);
    }
  }

  /** Manual trigger: ingests the top 20 species. Returns a summary. */
  async ingest(): Promise<{ ingested: number; top: string[] }> {
    const ranking = await this.fetchRanking();
    const top = ranking.slice(0, TOP_DAILY);
    let ingested = 0;
    for (const species of top) {
      try {
        await this.ingestOne(species);
        ingested++;
      } catch (err) {
        this.logger.warn(`Skipping ${species}: ${(err as Error).message}`);
      }
      if (ingested < top.length) await this.sleep(FETCH_DELAY_MS);
    }
    return { ingested, top };
  }

  /**
   * Fetches and persists sets for a single species from Pikalytics.
   * Reloads the repository cache on success.
   * Throws on HTTP or parse errors so callers can handle them.
   */
  async ingestOne(species: string): Promise<SpeciesSets> {
    const html = await this.fetchPage(species);
    const data = this.scrape(html);
    const tailorMade = this.buildTailorMade(species, data);

    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true });
    writeFileSync(
      join(this.dataDir, `${toID(species)}.json`),
      JSON.stringify(tailorMade, null, 2),
      'utf-8',
    );
    this.repo.load();
    this.logger.log(`Ingested sets for ${species}.`);
    const sets = this.repo.findBySpecies(species);
    if (!sets) throw new Error(`Failed to reload sets for ${species} after ingestion`);
    return sets;
  }

  // ---------------------------------------------------------------------------
  // HTML scraping
  // ---------------------------------------------------------------------------

  private async fetchPage(species: string): Promise<string> {
    const url = `${BASE_URL}/${this.format}/${encodeURIComponent(species)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'maestro-vgc-assistant/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.text();
  }

  private async fetchRanking(): Promise<string[]> {
    const url = `${BASE_URL}/${this.format}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'maestro-vgc-assistant/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ranking`);
    const html = await res.text();

    // Links in the Top 20 section: /pokedex/battledataregmbs3/Garchomp
    const re = new RegExp(`/pokedex/${this.format}/([\\w-]+)`, 'g');
    const seen = new Set<string>();
    const ranking: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (!seen.has(m[1])) {
        seen.add(m[1]);
        ranking.push(m[1]);
      }
    }
    return ranking;
  }

  /**
   * Parses a Pikalytics Pokemon page into move/item/ability/nature/EV data.
   * Targets the specific section wrapper ids present in the server-rendered
   * HTML so that raw fetch() captures them reliably.
   */
  private scrape(html: string): ScrapedData {
    const movesHtml = this.extractSectionHtml(html, 'moves_wrapper');
    const itemsHtml = this.extractSectionHtml(html, 'items_wrapper');
    const abilitiesHtml = this.extractSectionHtml(html, 'abilities_wrapper');
    const naturesHtml = this.extractSectionHtml(html, 'dex_natures_wrapper');
    const spreadsHtml = this.extractSectionHtml(html, 'dex_spreads_wrapper');

    return {
      moves: this.parseEntriesFromHtml(movesHtml, 'pokedex-inline-text-offset')
      .filter((e) => e.pct > 0),
      items: this.parseEntriesFromHtml(itemsHtml, 'pokedex-inline-text')
            .filter((e) => e.pct >= 1),
      abilities: this.parseEntriesFromHtml(abilitiesHtml, 'pokedex-inline-text-offset')
        .filter((e) => e.pct >= 1),
      natures: this.parseEntriesFromHtml(naturesHtml, 'pokedex-inline-text-offset')
        .filter((e) => e.pct >= 1),
      spreads: this.parseSpreadsFromHtml(spreadsHtml)
        .filter((s) => s.pct >= 1),
    };
  }

  /**
   * Extracts the raw HTML of the first <div> with the given id, including its
   * opening and closing tags. Handles arbitrary nesting by counting div depth.
   */
  private extractSectionHtml(html: string, id: string): string {
    const idIdx = html.indexOf(`id="${id}"`);
    if (idIdx === -1) return '';
    const divOpen = html.lastIndexOf('<div', idIdx);
    if (divOpen === -1) return '';

    let depth = 0;
    const re = /<\/?div[\s>]/gi;
    re.lastIndex = divOpen;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (m[0][1] === '/') {
        if (--depth === 0) return html.slice(divOpen, m.index + m[0].length);
      } else {
        depth++;
      }
    }
    return html.slice(divOpen);
  }

  /**
   * Parses name+usage pairs from a section's raw HTML. Each entry must have
   * an element with the given CSS class (the name) followed by a
   * pokedex-inline-right element (the percentage) within the same entry div.
   */
  private parseEntriesFromHtml(sectionHtml: string, nameClass: string): ScrapedEntry[] {
    const re = new RegExp(
      `class="${nameClass}"[^>]*>([^<]+)<[\\s\\S]*?class="pokedex-inline-right"[^>]*>([\\d.]+)%<`,
      'g',
    );
    const hits: ScrapedEntry[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(sectionHtml)) !== null) {
      const name = m[1].trim();
      if (name) hits.push({ name, pct: parseFloat(m[2]) });
    }
    return hits.sort((a, b) => b.pct - a.pct);
  }

  /**
   * Parses EL spreads from the dex_spreads_wrapper section HTML.
   * Each entry has six pokedex-inline-text divs in HP/Atk/Def/SpA/SpD/Spe
   * order (Champions format, values 0–32) followed by a pokedex-inline-right
   * percentage. Entries with fewer than 6 stat values are skipped.
   */
  private parseSpreadsFromHtml(sectionHtml: string): ScrapedSpread[] {
    if (!sectionHtml) return [];
    const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
    const numRe = /class="pokedex-inline-text"[^>]*>(\d+)\/?<\/div>/gi;
    const pctRe = /class="pokedex-inline-right"[^>]*>([\d.]+)%/g;

    const allNums: number[] = [];
    const allPcts: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = numRe.exec(sectionHtml)) !== null) allNums.push(parseInt(m[1], 10));
    while ((m = pctRe.exec(sectionHtml)) !== null) allPcts.push(parseFloat(m[1]));

    const results: ScrapedSpread[] = [];
    for (let i = 0; i < allPcts.length; i++) {
      const nums = allNums.slice(i * 6, i * 6 + 6);
      if (nums.length < 6) break;
      const evs: Record<string, number> = {};
      STATS.forEach((stat, j) => { evs[stat] = nums[j]; });
      results.push({ evs, pct: allPcts[i] });
    }
    return results.sort((a, b) => b.pct - a.pct);
  }

  // ---------------------------------------------------------------------------
  // Set building
  // ---------------------------------------------------------------------------

  /** Assembles a TailorMadeData object from raw scraped entries + base stats from calc data. */
  private buildTailorMade(species: string, data: ScrapedData): TailorMadeData {
    const base_stats = GEN.species.get(toID(species))?.baseStats as StatSpread | undefined;
    const toUsage = (e: ScrapedEntry): UsageStat => ({ name: e.name, usage: e.pct });
    const spreads: TailorMadeSpread[] = data.spreads.map((s) => ({
      ...s.evs,
      usage: s.pct,
    }));
    return {
      species,
      ...(base_stats && { base_stats }),
      moves: data.moves.map(toUsage),
      items: data.items.map(toUsage),
      abilities: data.abilities.map(toUsage),
      natures: data.natures.map(toUsage),
      spreads,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
