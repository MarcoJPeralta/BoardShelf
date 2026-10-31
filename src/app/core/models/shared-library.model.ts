import { Game } from './game.model';

/** The only game fields anyone with a share link can read. Personal notes stay private. */
export type SharedGame = Omit<Game, 'notes' | 'addedAt'>;

export interface SharedLibrary {
  displayName: string;
  games: SharedGame[];
}

/** Copies an allow-list of fields, so a field added to Game later is never shared by accident. */
export function toSharedGame(game: SharedGame): SharedGame {
  const shared: SharedGame = {
    id: game.id,
    name: game.name,
    imageUrl: game.imageUrl,
    yearPublished: game.yearPublished,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    minDurationMinutes: game.minDurationMinutes,
    maxDurationMinutes: game.maxDurationMinutes,
    avgDurationMinutes: game.avgDurationMinutes,
    categories: game.categories ?? [],
    mechanics: game.mechanics,
    mode: game.mode,
    averageWeight: game.averageWeight,
    complexity: game.complexity,
    bggId: game.bggId,
  };

  // Firestore rejects `undefined`
  return Object.fromEntries(
    Object.entries(shared).filter(([, value]) => value !== undefined),
  ) as unknown as SharedGame;
}
