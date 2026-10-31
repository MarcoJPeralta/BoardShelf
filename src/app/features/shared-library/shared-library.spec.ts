import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { SharedLibrary } from './shared-library';
import { Game } from '../../core/models/game.model';
import { SharedGame, toSharedGame } from '../../core/models/shared-library.model';
import { ShareService } from '../../core/services/share.service';

const scythe: SharedGame = {
  id: 'scythe',
  name: 'Scythe',
  minPlayers: 1,
  maxPlayers: 5,
  avgDurationMinutes: 115,
  categories: ['Strategy'],
  mode: 'pvp',
  complexity: 3,
};
const azul: SharedGame = {
  ...scythe,
  id: 'azul',
  name: 'Azul',
  maxPlayers: 4,
  avgDurationMinutes: 45,
};

describe('SharedLibrary', () => {
  let component: SharedLibrary;
  let fixture: ComponentFixture<SharedLibrary>;
  const getSharedLibrary = vi.fn();

  const open = async () => {
    fixture = TestBed.createComponent(SharedLibrary);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('shareId', 'abc');
    await fixture.whenStable();
  };

  beforeEach(async () => {
    getSharedLibrary.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [SharedLibrary],
      providers: [provideRouter([]), { provide: ShareService, useValue: { getSharedLibrary } }],
    }).compileComponents();
  });

  it('should show the games without edit or delete controls', async () => {
    getSharedLibrary.mockResolvedValue({ displayName: "Sam's shelf", games: [scythe, azul] });
    await open();

    const element = fixture.nativeElement as HTMLElement;
    expect(getSharedLibrary).toHaveBeenCalledWith('abc');
    expect(element.querySelector('h1')?.textContent).toContain("Sam's shelf");
    expect(element.querySelectorAll('app-game-card').length).toBe(2);
    expect(element.querySelector('.game-card__delete')).toBeNull();
    expect(element.querySelector('.game-card__link')).toBeNull();
  });

  it('should filter by name, players and duration', async () => {
    getSharedLibrary.mockResolvedValue({ displayName: '', games: [scythe, azul] });
    await open();

    component.search.set('az');
    expect(component.games().map((g) => g.id)).toEqual(['azul']);

    component.search.set('');
    component.players.set(5);
    expect(component.games().map((g) => g.id)).toEqual(['scythe']);

    component.players.set(null);
    component.maxDuration.set(60);
    expect(component.games().map((g) => g.id)).toEqual(['azul']);
  });

  it('should explain when the link no longer works', async () => {
    getSharedLibrary.mockResolvedValue(null);
    await open();

    expect(fixture.nativeElement.textContent).toContain("isn't available");
  });

  it('should tell a failed read apart from a missing shelf', async () => {
    getSharedLibrary.mockRejectedValue(new Error('offline'));
    await open();

    expect(fixture.nativeElement.textContent).toContain('Could not load this shelf');
  });
});

describe('toSharedGame', () => {
  it('should leave out personal notes and fields it does not know', () => {
    const game = {
      ...scythe,
      notes: 'Lent to my neighbour',
      addedAt: new Date(),
      futurePrivateField: 'secret',
    } as Game;

    const shared = toSharedGame(game);

    expect(Object.keys(shared)).not.toContain('notes');
    expect(Object.keys(shared)).not.toContain('addedAt');
    expect(Object.keys(shared)).not.toContain('futurePrivateField');
    expect(shared.name).toBe('Scythe');
  });

  it('should not produce undefined values, which Firestore rejects', () => {
    const shared = toSharedGame({ ...scythe, imageUrl: undefined });

    expect(Object.values(shared)).not.toContain(undefined);
  });
});
