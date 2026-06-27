import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface TeamMember {
  species: string;
  item?: string;
  ability?: string;
  nature?: string;
  moves?: string[];
}

export interface Team {
  name?: string;
  members: TeamMember[];
}

@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly http = inject(HttpClient);
  private readonly base = 'http://localhost:3000';

  get(): Observable<Team> {
    return this.http.get<Team>(`${this.base}/team`);
  }

  /** Send multiple game screenshots (e.g. stats + moves) to be read into a team. */
  importScreenshots(images: string[], mimeType: string): Observable<Team> {
    return this.http.post<Team>(`${this.base}/team/import-screenshot`, {
      images,
      mimeType,
    });
  }
}
