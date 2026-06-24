import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';

interface PokeApiSprites {
  front_default: string | null;
  other?: {
    'official-artwork'?: { front_default: string | null };
  };
}

interface PokeApiPokemon {
  id: number;
  sprites: PokeApiSprites;
}

/**
 * Resolves a species name to a sprite URL via PokeAPI (CORS-enabled), then
 * rewrites the raw.githubusercontent URL onto the jsDelivr CDN, which loads
 * reliably cross-origin. Results are cached per species.
 */
@Injectable({ providedIn: 'root' })
export class SpriteService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<string | null>>();

  get(name: string): Observable<string | null> {
    const id = name
      .toLowerCase()
      .replace(/[.']/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    let cached = this.cache.get(id);
    if (!cached) {
      cached = this.http
        .get<PokeApiPokemon>(`https://pokeapi.co/api/v2/pokemon/${id}`)
        .pipe(
          map((p) => this.pickSprite(p)),
          catchError(() => of(null)),
          shareReplay(1),
        );
      this.cache.set(id, cached);
    }
    return cached;
  }

  private pickSprite(p: PokeApiPokemon): string | null {
    const url =
      p.sprites?.front_default ??
      p.sprites?.other?.['official-artwork']?.front_default ??
      null;
    if (!url) {
      return null;
    }
    return url.replace(
      'https://raw.githubusercontent.com/PokeAPI/sprites/master/',
      'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/',
    );
  }
}
