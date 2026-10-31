// src/app/core/services/share.service.ts
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase.config';
import { Game } from '../models/game.model';
import { SharedLibrary, toSharedGame } from '../models/shared-library.model';
import { AuthService } from './auth.service';
import { GameService } from './game.service';

// Firestore documents are capped at 1 MiB
const MAX_SHELF_BYTES = 900_000;
const SHELF_TOO_LARGE = 'Your library is too large to share.';

@Injectable({ providedIn: 'root' })
export class ShareService {
  private authService = inject(AuthService);
  private gameService = inject(GameService);
  private sharedLibraries = collection(db, 'sharedLibraries');

  private _shareId = signal<string | null>(null);
  readonly shareId = this._shareId.asReadonly();
  private _displayName = signal('');
  readonly displayName = this._displayName.asReadonly();
  private _loaded = signal(false);
  readonly loaded = this._loaded.asReadonly();
  private _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  readonly shareUrl = computed(() => {
    const id = this._shareId();
    return id ? `${window.location.origin}/shared/${id}` : null;
  });

  // What the public copy holds, so it's only written when a shared field really changed
  private syncedGames = '';

  constructor() {
    effect(() => {
      const uid = this.authService.currentUser()?.uid;
      untracked(() => {
        this.reset();
        if (uid) void this.loadShare(uid);
      });
    });

    // Every add, edit and delete passes through the games signal
    effect(() => {
      const shareId = this._shareId();
      const games = this.gameService.games();
      // A failed read must never be mistaken for an empty library and wipe the public copy
      if (!shareId || !this.gameService.gamesLoaded() || this.gameService.gamesError()) return;
      untracked(() => this.syncGames(shareId, games));
    });
  }

  /** Public read used by the guest page. Resolves to null when the link doesn't exist. */
  async getSharedLibrary(shareId: string): Promise<SharedLibrary | null> {
    const snapshot = await getDoc(doc(this.sharedLibraries, shareId));
    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return { displayName: data['displayName'] ?? '', games: data['games'] ?? [] };
  }

  /** Creates the link, or replaces the current one so the old URL stops working. */
  async createLink(displayName: string): Promise<void> {
    const uid = this.authService.currentUser()?.uid;
    if (!uid) return;

    const games = this.gameService.games().map(toSharedGame);
    const serialized = JSON.stringify(games);
    if (this.isTooLarge(serialized)) {
      this._error.set(SHELF_TOO_LARGE);
      return;
    }

    const name = displayName.trim();
    const newShelf = doc(this.sharedLibraries);
    const batch = writeBatch(db);
    const previousId = this._shareId();
    if (previousId) batch.delete(doc(this.sharedLibraries, previousId));
    batch.set(newShelf, { ownerUid: uid, displayName: name, games });
    await this.reportingErrors(() => batch.commit());

    if (!this._error()) {
      this.syncedGames = serialized;
      this._displayName.set(name);
      this._shareId.set(newShelf.id);
    }
  }

  async updateDisplayName(displayName: string): Promise<void> {
    const shareId = this._shareId();
    if (!shareId) return;

    const name = displayName.trim();
    await this.reportingErrors(() =>
      updateDoc(doc(this.sharedLibraries, shareId), { displayName: name }),
    );
    if (!this._error()) this._displayName.set(name);
  }

  async turnOff(): Promise<void> {
    const shareId = this._shareId();
    if (!shareId) return;

    await this.reportingErrors(() => deleteDoc(doc(this.sharedLibraries, shareId)));
    if (!this._error()) this.clearShare();
  }

  /** Asks Firestore rather than local state, so an account can't leave a public shelf behind. */
  async deleteAllShares(): Promise<void> {
    const uid = this.authService.currentUser()?.uid;
    if (!uid) return;

    const snapshot = await getDocs(query(this.sharedLibraries, where('ownerUid', '==', uid)));
    const batch = writeBatch(db);
    snapshot.docs.forEach((shelf) => batch.delete(shelf.ref));
    await batch.commit();
    this.clearShare();
  }

  private async loadShare(uid: string): Promise<void> {
    try {
      const snapshot = await getDocs(
        query(this.sharedLibraries, where('ownerUid', '==', uid), limit(1)),
      );
      if (this.authService.currentUser()?.uid !== uid) return;

      const shelf = snapshot.docs[0];
      if (shelf) {
        const games: Game[] = shelf.data()['games'] ?? [];
        this.syncedGames = JSON.stringify(games.map(toSharedGame));
        this._displayName.set(shelf.data()['displayName'] ?? '');
        this._shareId.set(shelf.id);
      }
    } catch (error) {
      console.error('Failed to load share link:', error);
      this._error.set('Could not load your share link. Please try again.');
    }
    this._loaded.set(true);
  }

  private syncGames(shareId: string, games: Game[]): void {
    const shared = games.map(toSharedGame);
    const serialized = JSON.stringify(shared);
    if (serialized === this.syncedGames) return;

    if (this.isTooLarge(serialized)) {
      this._error.set(SHELF_TOO_LARGE);
      return;
    }

    this.syncedGames = serialized;
    updateDoc(doc(this.sharedLibraries, shareId), { games: shared })
      .then(() => this._error.set(null))
      .catch((error) => {
        console.error('Failed to update shared library:', error);
        this.syncedGames = '';
        this._error.set('Could not update your shared library.');
      });
  }

  private async reportingErrors(write: () => Promise<void>): Promise<void> {
    this._error.set(null);
    try {
      await write();
    } catch (error) {
      console.error('Failed to update share link:', error);
      this._error.set('Could not update your share link. Please try again.');
    }
  }

  private isTooLarge(serialized: string): boolean {
    return new Blob([serialized]).size > MAX_SHELF_BYTES;
  }

  private clearShare(): void {
    this.syncedGames = '';
    this._displayName.set('');
    this._shareId.set(null);
  }

  private reset(): void {
    this.clearShare();
    this._loaded.set(false);
    this._error.set(null);
  }
}
