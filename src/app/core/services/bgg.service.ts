import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { BggSearchResult } from '../models/bgg-search-result.model';
import { BggThingDetails } from '../models/bgg-thing-details.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class BggService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  /** Same-origin proxy that adds the BGG token: `worker/index.ts`, or `proxy.conf.mjs` in dev. */
  private readonly apiBaseUrl = '/api/bgg';

  search(query: string, page = 1): Observable<BggSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return of([]);

    const params = new HttpParams().set('query', trimmed).set('page', page);

    return this.getXml('search', params).pipe(
      map((body) => this.parseSearchXml(body)),
      catchError((err: unknown) => throwError(() => new Error(this.describeHttpError(err)))),
    );
  }

  /** Full game metadata for one BGG id (`/xmlapi2/thing?id=…&stats=1`). */
  getThing(bggId: string): Observable<BggThingDetails> {
    const id = bggId.trim();
    if (!id) {
      return throwError(() => new Error('Missing BoardGameGeek id.'));
    }

    const params = new HttpParams().set('id', id);

    return this.getXml('thing', params).pipe(
      map((body) => this.parseThingXml(body)),
      catchError((err: unknown) => throwError(() => new Error(this.describeHttpError(err)))),
    );
  }

  private getXml(endpoint: 'search' | 'thing', params: HttpParams): Observable<string> {
    const user = this.authService.currentUser();
    if (!user) {
      return throwError(() => new Error('Please sign in to search BoardGameGeek.'));
    }

    return from(user.getIdToken()).pipe(
      switchMap((idToken) =>
        this.http.get(`${this.apiBaseUrl}/${endpoint}`, {
          params,
          headers: { Authorization: `Bearer ${idToken}` },
          responseType: 'text',
        }),
      ),
    );
  }

  private parseSearchXml(xml: string): BggSearchResult[] {
    const body = xml.trim();
    if (!body.startsWith('<')) {
      throw new Error(body.slice(0, 200) || 'BoardGameGeek returned a non-XML response.');
    }

    const doc = new DOMParser().parseFromString(body, 'text/xml');
    if (doc.querySelector('parsererror')) {
      throw new Error('Could not parse BoardGameGeek search response.');
    }

    const results: BggSearchResult[] = [];
    doc.querySelectorAll('items > item').forEach((item) => {
      const id = item.getAttribute('id');
      if (!id) return;

      const name =
        item.querySelector('name[type="primary"]')?.getAttribute('value') ??
        item.querySelector('name')?.getAttribute('value');
      if (!name) return;

      const yearRaw = item.querySelector('yearpublished')?.getAttribute('value');
      const yearParsed = yearRaw ? Number.parseInt(yearRaw, 10) : Number.NaN;

      results.push({
        bggId: id,
        name,
        yearPublished: Number.isFinite(yearParsed) ? yearParsed : null,
        rank: null,
      });
    });

    return results;
  }

  private parseThingXml(xml: string): BggThingDetails {
    const body = xml.trim();
    if (!body.startsWith('<')) {
      throw new Error(body.slice(0, 200) || 'BoardGameGeek returned a non-XML response.');
    }

    const doc = new DOMParser().parseFromString(body, 'text/xml');
    if (doc.querySelector('parsererror')) {
      throw new Error('Could not parse BoardGameGeek thing response.');
    }

    const item = doc.querySelector('items > item');
    if (!item) {
      throw new Error('No <item> in BoardGameGeek thing response.');
    }

    const bggId = item.getAttribute('id');
    if (!bggId) {
      throw new Error('Thing response missing id attribute.');
    }

    const name =
      item.querySelector('name[type="primary"]')?.getAttribute('value') ??
      item.querySelector('name')?.getAttribute('value') ??
      'Unknown title';

    const yearRaw = item.querySelector('yearpublished')?.getAttribute('value');
    const yearNum = yearRaw ? Number.parseInt(yearRaw, 10) : Number.NaN;

    const imageUrl =
      item.querySelector('image')?.textContent?.trim() ||
      item.querySelector('thumbnail')?.textContent?.trim() ||
      '';

    const minPlayers = this.intAttr(item, 'minplayers', 1) ?? 1;
    const maxPlayersRaw = this.intAttr(item, 'maxplayers', minPlayers);
    const maxPlayers = Math.max(minPlayers, maxPlayersRaw ?? minPlayers);

    const minDurationMinutes = this.intAttr(item, 'minplaytime', null);
    const maxDurationMinutes = this.intAttr(item, 'maxplaytime', null);
    const playingTimeMinutes = this.intAttr(item, 'playingtime', null);
    const avgDurationMinutes = this.resolvePlayMinutes(
      playingTimeMinutes,
      minDurationMinutes,
      maxDurationMinutes,
    );

    const categories = this.linkValues(item, 'boardgamecategory');
    const mechanics = this.linkValues(item, 'boardgamemechanic');

    const weightRaw = item.querySelector('statistics ratings averageweight')?.getAttribute('value');
    const averageWeight = weightRaw != null && weightRaw !== '' ? Number.parseFloat(weightRaw) : null;
    const complexity = this.complexityFromWeight(
      averageWeight != null && Number.isFinite(averageWeight) ? averageWeight : null,
    );

    const mode = this.inferMode(categories, mechanics);

    return {
      bggId,
      name,
      yearPublished: Number.isFinite(yearNum) ? yearNum : null,
      imageUrl,
      minPlayers,
      maxPlayers,
      minDurationMinutes,
      maxDurationMinutes,
      avgDurationMinutes,
      categories,
      mechanics,
      averageWeight: averageWeight != null && Number.isFinite(averageWeight) ? averageWeight : null,
      complexity,
      mode,
    };
  }

  private intAttr(parent: Element, tag: string, fallback: number | null): number | null {
    const raw = parent.querySelector(tag)?.getAttribute('value');
    if (raw == null || raw === '') return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  private resolvePlayMinutes(
    playingTimeMinutes: number | null,
    minDurationMinutes: number | null,
    maxDurationMinutes: number | null,
  ): number {
    if (playingTimeMinutes != null && playingTimeMinutes > 0) return playingTimeMinutes;
    if (minDurationMinutes != null && maxDurationMinutes != null && maxDurationMinutes > 0) {
      return Math.max(1, Math.round((minDurationMinutes + maxDurationMinutes) / 2));
    }
    if (maxDurationMinutes != null && maxDurationMinutes > 0) return maxDurationMinutes;
    if (minDurationMinutes != null && minDurationMinutes > 0) return minDurationMinutes;

    return 60;
  }

  private linkValues(item: Element, linkType: string): string[] {
    const names: string[] = [];
    item.querySelectorAll(`link[type="${linkType}"]`).forEach((el) => {
      const v = el.getAttribute('value')?.trim();
      if (v) names.push(v);
    });
    return names;
  }

  private complexityFromWeight(weight: number | null): 1 | 2 | 3 | 4 | 5 {
    if (weight == null || !Number.isFinite(weight)) return 3;
    const rounded = Math.round(weight);
    const clamped = Math.min(5, Math.max(1, rounded));
    return clamped as 1 | 2 | 3 | 4 | 5;
  }

  private inferMode(categories: string[], mechanics: string[]): 'pvp' | 'coop' | 'both' {
    const blob = [...categories, ...mechanics].join(' | ').toLowerCase();
    if (blob.includes('semi-cooper') || blob.includes('semi cooper')) return 'both';
    if (blob.includes('co-operative') || blob.includes('cooperative')) return 'coop';
    return 'pvp';
  }

  private describeHttpError(err: unknown): string {
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        return 'Your session has expired. Please sign in again.';
      }
      if (status === 429) {
        return 'BoardGameGeek rate limit reached. Wait a few seconds and try again.';
      }
      if (status === 503 || status === 500) {
        return 'BoardGameGeek is busy (throttled). Wait a few seconds and try again.';
      }
    }
    if (err instanceof Error) return err.message;
    return 'BoardGameGeek request failed.';
  }
}
