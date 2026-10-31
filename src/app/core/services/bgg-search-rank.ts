import Fuse from 'fuse.js';
import type { BggSearchResult } from '../models/bgg-search-result.model';

const FUZZY_ONLY_TIER = 3;

// BGG's thing endpoint accepts at most 20 ids per request
export const POPULARITY_LOOKUP_SIZE = 20;

// Fuse scores run from 0 (perfect) to 1. Above this, a typo fallback match is only noise.
const TYPO_THRESHOLD = 0.3;
const LOOSE_THRESHOLD = 0.6;

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Fuse treats "Doomed" as almost perfect for "doom", so whole-word matches have to rank first. */
function matchTier(name: string, query: string): number {
  const normalized = normalize(name);
  if (normalized === query) return 0;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^${escaped}(?![\\p{L}\\p{N}])`, 'u').test(normalized)) return 1;
  if (new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(normalized)) return 2;
  return FUZZY_ONLY_TIER;
}

function rank(query: string, results: BggSearchResult[], threshold: number) {
  const normalizedQuery = normalize(query);
  const fuse = new Fuse(results, {
    keys: ['name'],
    includeScore: true,
    ignoreLocation: true,
    ignoreDiacritics: true,
    threshold,
  });

  return fuse
    .search(query)
    .map(({ item, score }) => ({
      item,
      score: score ?? 1,
      tier: matchTier(item.name, normalizedQuery),
    }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.score - b.score ||
        // Shorter names put base games ahead of "Name: Some Expansion"
        a.item.name.length - b.item.name.length ||
        (b.item.yearPublished ?? 0) - (a.item.yearPublished ?? 0),
    )
    .map(({ item }) => item);
}

/** Within the best matches, puts the games most people have rated first. */
export function sortByPopularity(
  query: string,
  results: BggSearchResult[],
  votes: Map<string, number>,
): BggSearchResult[] {
  const normalizedQuery = normalize(query);
  const top = results
    .slice(0, POPULARITY_LOOKUP_SIZE)
    .map((item) => ({ item, tier: matchTier(item.name, normalizedQuery) }))
    .sort(
      (a, b) =>
        a.tier - b.tier || (votes.get(b.item.bggId) ?? 0) - (votes.get(a.item.bggId) ?? 0),
    )
    .map(({ item }) => item);

  return [...top, ...results.slice(POPULARITY_LOOKUP_SIZE)];
}

/** Orders BGG's results by relevance. Nothing is dropped: BGG also matches alternate names. */
export function rankSearchResults(query: string, results: BggSearchResult[]): BggSearchResult[] {
  const ranked = rank(query, results, LOOSE_THRESHOLD);
  const rankedIds = new Set(ranked.map((result) => result.bggId));
  return [...ranked, ...results.filter((result) => !rankedIds.has(result.bggId))];
}

/** For results found through a shortened query, where most of them are unrelated to the typo. */
export function filterTypoMatches(query: string, results: BggSearchResult[]): BggSearchResult[] {
  return rank(query, results, TYPO_THRESHOLD);
}

/**
 * BGG only matches exact substrings, so "cataan" finds nothing. The start of the longest word
 * brings back candidates to match against, or null when the query is too short to shorten.
 */
export function typoFallbackQuery(query: string): string | null {
  const longestWord = query
    .trim()
    .split(/\s+/)
    .reduce((longest, word) => (word.length > longest.length ? word : longest), '');
  return longestWord.length > 3 ? longestWord.slice(0, 3) : null;
}
