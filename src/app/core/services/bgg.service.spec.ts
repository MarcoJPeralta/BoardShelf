import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { BggService } from './bgg.service';
import { AuthService } from './auth.service';
import { rankSearchResults, typoFallbackQuery } from './bgg-search-rank';
import { BggSearchResult } from '../models/bgg-search-result.model';

const result = (name: string, yearPublished: number | null = 2020): BggSearchResult => ({
  bggId: name,
  name,
  yearPublished,
  rank: null,
});

const xml = (names: string[]) =>
  `<items>${names
    .map((name) => `<item id="${name}"><name type="primary" value="${name}"/></item>`)
    .join('')}</items>`;

describe('rankSearchResults', () => {
  const names = (results: BggSearchResult[]) => results.map((r) => r.name);

  it('should put exact and whole-word matches ahead of partial ones', () => {
    const ranked = rankSearchResults('doom', [
      result('1490 Doom'),
      result('Doomed'),
      result('Doom: The Boardgame'),
      result('Doom'),
    ]);

    expect(names(ranked)).toEqual(['Doom', 'Doom: The Boardgame', '1490 Doom', 'Doomed']);
  });

  it('should ignore case and accents', () => {
    const ranked = rankSearchResults('pokemon', [result('Great Pokémon Game'), result('POKÉMON')]);

    expect(names(ranked)[0]).toBe('POKÉMON');
  });

  it('should list a base game before its expansions', () => {
    const ranked = rankSearchResults('gloomhaven', [
      result('Gloomhaven: Forgotten Circles'),
      result('Gloomhaven'),
    ]);

    expect(names(ranked)).toEqual(['Gloomhaven', 'Gloomhaven: Forgotten Circles']);
  });

  it('should keep results BGG matched through an alternate name', () => {
    const ranked = rankSearchResults('catan', [result('Die Siedler'), result('Catan')]);

    expect(names(ranked)).toEqual(['Catan', 'Die Siedler']);
  });

  it('should treat regular expression characters in a query as plain text', () => {
    expect(() => rankSearchResults('c++ (game', [result('Other')])).not.toThrow();
  });
});

describe('typoFallbackQuery', () => {
  it('should use the start of the longest word', () => {
    expect(typoFallbackQuery('cataan')).toBe('cat');
    expect(typoFallbackQuery('to ride tiket')).toBe('tik');
  });

  it('should not shorten a query that is already short', () => {
    expect(typoFallbackQuery('uno')).toBeNull();
  });
});

describe('BggService search', () => {
  let service: BggService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { currentUser: signal({ getIdToken: async () => 'id-token' }) },
        },
      ],
    });
    service = TestBed.inject(BggService);
    http = TestBed.inject(HttpTestingController);
  });

  const answer = async (query: string, names: string[]) => {
    const request = await vi.waitFor(() => {
      const [match] = http.match((r) => r.params.get('query') === query);
      if (!match) throw new Error(`No request for ${query}`);
      return match;
    });
    request.flush(xml(names));
  };

  const answerVotes = async (votes: Record<string, number>) => {
    const request = await vi.waitFor(() => {
      const [match] = http.match((r) => r.url.endsWith('/thing'));
      if (!match) throw new Error('No popularity request');
      return match;
    });
    request.flush(
      `<items>${Object.entries(votes)
        .map(([id, count]) => `<item id="${id}"><usersrated value="${count}"/></item>`)
        .join('')}</items>`,
    );
  };

  it('should rank word matches by popularity when BGG finds results', async () => {
    const search = firstValueFrom(service.search('doom'));
    await answer('doom', ['Doomed', 'Doom Cat', 'Doom: The Boardgame']);
    await answerVotes({ Doomed: 9000, 'Doom Cat': 10, 'Doom: The Boardgame': 5000 });

    expect((await search).map((r) => r.name)).toEqual(['Doom: The Boardgame', 'Doom Cat', 'Doomed']);
    http.verify();
  });

  it('should keep the relevance order when the popularity lookup fails', async () => {
    const search = firstValueFrom(service.search('doom'));
    await answer('doom', ['Doomed', 'Doom']);
    const request = await vi.waitFor(() => {
      const [match] = http.match((r) => r.url.endsWith('/thing'));
      if (!match) throw new Error('No popularity request');
      return match;
    });
    request.flush('', { status: 503, statusText: 'Busy' });

    expect((await search).map((r) => r.name)).toEqual(['Doom', 'Doomed']);
  });

  it('should retry a misspelled query and keep only close matches', async () => {
    const search = firstValueFrom(service.search('cataan'));
    await answer('cataan', []);
    await answer('cat', ['Catan', 'Bobcat Rally Zone']);

    expect((await search).map((r) => r.name)).toEqual(['Catan']);
    http.verify();
  });

  it('should report a failed request as an error', async () => {
    const search = firstValueFrom(service.search('doom'));
    const request = await vi.waitFor(() => {
      const [match] = http.match((r) => r.params.get('query') === 'doom');
      if (!match) throw new Error('No request');
      return match;
    });
    request.flush('', { status: 429, statusText: 'Too Many Requests' });

    await expect(search).rejects.toThrow('rate limit');
  });
});
