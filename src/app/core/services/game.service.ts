// src/app/core/services/game.service.ts
import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { Game } from '../models/game.model';
import { db } from '../firebase.config';
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private authService = inject(AuthService);
  private _games = signal<Game[]>([]);
  readonly games = this._games.asReadonly();
  readonly totalGames = computed(() => this._games().length);

  // False until the first snapshot arrives, so pages can tell "loading" from "no games"
  private _gamesLoaded = signal(false);
  readonly gamesLoaded = this._gamesLoaded.asReadonly();

  // Set when the listener fails, so a failed read is never mistaken for an empty library
  private _gamesError = signal<string | null>(null);
  readonly gamesError = this._gamesError.asReadonly();

  readonly availableCategories = computed(() => {
    const all = this._games().flatMap((g) => g.categories);
    return [...new Set(all)].sort();
  });

  players = signal<number | null>(null);
  mode = signal<'pvp' | 'coop' | 'both' | null>(null);
  maxDuration = signal<number | null>(null);
  complexity = signal<'1' | '2' | '3' | '4' | '5' | null>(null);
  categories = signal<string[]>([]);

  readonly hasActiveFilters = computed(
    () =>
      this.players() !== null ||
      this.mode() !== null ||
      this.maxDuration() !== null ||
      this.complexity() !== null ||
      this.categories().length > 0,
  );

  readonly filteredGames = computed(() => {
    let games = this._games();

    const players = this.players();
    const mode = this.mode();
    const maxDuration = this.maxDuration();
    const complexity = this.complexity();
    const categories = this.categories();

    if (players) {
      games = games.filter((game) => game.minPlayers <= players && game.maxPlayers >= players);
    }

    if (mode) {
      games = games.filter((game) => game.mode === mode);
    }

    if (maxDuration) {
      games = games.filter((game) => game.avgDurationMinutes <= maxDuration);
    }

    if (complexity) {
      games = games.filter((game) => game.complexity === parseInt(complexity));
    }

    if (categories.length > 0) {
      games = games.filter((game) =>
        game.categories.some((category) => categories.includes(category)),
      );
    }

    return games;
  });

  readonly hasFilteredGames = computed(() => this.filteredGames().length > 0);

  private unsubscribe?: () => void; // Para desligar o rádio quando o user sai
  private retryTimer?: ReturnType<typeof setTimeout>;
  private gamesCollection = collection(db, 'games');

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.startListening(user.uid);
      } else {
        this.stopListening?.();
      }
    });
  }

  private startListening(uid: string) {
    // Sub-collection path: users -> user ID -> games
    const gamesRef = collection(db, 'users', uid, 'games');
    // Order by addedAt
    const q = query(gamesRef, orderBy('addedAt', 'desc'));

    // onSnapshot creates a real-time "tunnel"
    clearTimeout(this.retryTimer);
    this.unsubscribe?.();
    this.unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const updatedGames = snapshot.docs.map(
          (doc) =>
            ({
              ...doc.data(),
              id: doc.id, // The ID now comes from Firestore
              addedAt: doc.data()['addedAt']?.toDate(), // Convert Timestamp from Firebase to Date JS
            }) as Game,
        );

        this._games.set(updatedGames);
        this._gamesError.set(null);
        this._gamesLoaded.set(true);
      },
      (error) => {
        console.error('Failed to load games:', error);
        this._gamesError.set(
          error.code === 'permission-denied'
            ? 'Firestore denied access to your games. Check your database security rules.'
            : 'Could not load your games. Please try again.',
        );
        this._gamesLoaded.set(true);
        // Firestore ends a listener after an error, so it needs a new one to recover
        this.retryTimer = setTimeout(() => this.startListening(uid), 10000);
      },
    );
  }

  private stopListening() {
    clearTimeout(this.retryTimer);
    if (this.unsubscribe) this.unsubscribe();
    this._games.set([]);
    this._gamesLoaded.set(false);
    this._gamesError.set(null);
  }

  /** Firestore rejects `undefined`; drop those keys before writes. */
  private stripUndefined(data: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  }

  // ── CRUD operations ─────────────────────────────────────────────────────

  async addGame(game: Omit<Game, 'id' | 'addedAt'>): Promise<void> {
    const uid = this.authService.currentUser()?.uid;
    if (!uid) return;
    const gamesRef = collection(db, 'users', uid, 'games');
    await addDoc(gamesRef, this.stripUndefined({ ...game, addedAt: new Date() }));
  }

  getAllGames(): Game[] {
    return this._games();
  }

  getGameById(id: string): Game | undefined {
    return this._games().find((game) => game.id === id);
  }

  async updateGame(id: string, changes: Partial<Game>): Promise<void> {
    const uid = this.authService.currentUser()?.uid;
    if (!uid) return;
    const gamesRef = collection(db, 'users', uid, 'games');
    const gameDoc = doc(gamesRef, id);
    await updateDoc(gameDoc, this.stripUndefined(changes as Record<string, unknown>));
  }

  async deleteGame(id: string): Promise<void> {
    const uid = this.authService.currentUser()?.uid;
    if (!uid) return;
    const gamesRef = collection(db, 'users', uid, 'games');
    const gameDoc = doc(gamesRef, id);
    await deleteDoc(gameDoc);
  }

  async deleteAllGames(): Promise<void> {
    const uid = this.authService.currentUser()?.uid;
    if (!uid) return;
    const snapshot = await getDocs(collection(db, 'users', uid, 'games'));

    // Firestore allows at most 500 writes per batch
    for (let i = 0; i < snapshot.docs.length; i += 500) {
      const batch = writeBatch(db);
      snapshot.docs.slice(i, i + 500).forEach((game) => batch.delete(game.ref));
      await batch.commit();
    }
  }
}
