import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GamePicker } from './game-picker';
import { Game } from '../../core/models/game.model';
import { AuthService } from '../../core/services/auth.service';
import { GameService } from '../../core/services/game.service';

const makeGame = (id: string, changes: Partial<Game> = {}): Game => ({
  id,
  name: `Game ${id}`,
  minPlayers: 2,
  maxPlayers: 4,
  avgDurationMinutes: 60,
  categories: [],
  mode: 'pvp',
  complexity: 3,
  addedAt: new Date(),
  ...changes,
});

describe('GamePicker', () => {
  let component: GamePicker;
  let fixture: ComponentFixture<GamePicker>;
  const games = signal<Game[]>([]);
  const gamesLoaded = signal(true);
  const gamesError = signal<string | null>(null);

  beforeEach(async () => {
    games.set([
      makeGame('solo', { minPlayers: 1, maxPlayers: 1 }),
      makeGame('long', { avgDurationMinutes: 180 }),
      makeGame('heavy', { complexity: 5 }),
    ]);
    gamesLoaded.set(true);

    await TestBed.configureTestingModule({
      imports: [GamePicker],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: {} },
        {
          provide: GameService,
          useValue: { games, gamesLoaded, gamesError, totalGames: () => games().length },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GamePicker);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const candidateIds = () => component.candidates().map((game) => game.id);
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should offer every game without filters', () => {
    expect(candidateIds()).toEqual(['solo', 'long', 'heavy']);
  });

  it('should filter by player count, time and complexity', () => {
    component.players.set(3);
    expect(candidateIds()).toEqual(['long', 'heavy']);

    component.maxDuration.set(90);
    expect(candidateIds()).toEqual(['heavy']);

    component.maxComplexity.set(4);
    expect(candidateIds()).toEqual([]);
  });

  it('should never repeat the current pick when another game is available', () => {
    component.roll();
    for (let i = 0; i < 20; i++) {
      const previous = component.pickedGame()?.id;
      component.roll();
      expect(component.pickedGame()?.id).not.toBe(previous);
    }
  });

  it('should keep the only candidate when rolling again', () => {
    component.maxComplexity.set(3);
    component.maxDuration.set(90);
    component.players.set(1);
    component.roll();
    component.roll();
    expect(component.pickedGame()?.id).toBe('solo');
  });

  it('should drop the pick when it stops matching the filters', () => {
    component.players.set(1);
    component.roll();
    expect(component.pickedGame()?.id).toBe('solo');

    component.players.set(2);
    expect(component.pickedGame()).toBeUndefined();
  });

  it('should not pick anything when nothing matches', async () => {
    component.players.set(99);
    component.roll();
    expect(component.pickedGame()).toBeUndefined();
    expect(component.rollCount()).toBe(0);

    await fixture.whenStable();
    expect(text()).toContain('No games match');
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
  });

  it('should show the picked game with a link to its details', async () => {
    component.players.set(1);
    component.roll();
    await fixture.whenStable();

    expect(text()).toContain('Game solo');
    expect(fixture.nativeElement.querySelector('.game-picker__result a').getAttribute('href')).toBe(
      '/game/solo',
    );
  });

  it('should invite the user to add games when the vault is empty', async () => {
    games.set([]);
    await fixture.whenStable();
    expect(text()).toContain('Add your first game');
  });

  it('should report a failed load instead of an empty vault', async () => {
    games.set([]);
    gamesError.set('Firestore denied access');
    await fixture.whenStable();

    expect(text()).toContain('Firestore denied access');
    expect(text()).not.toContain('Add your first game');
    gamesError.set(null);
  });

  it('should show a loading state until games arrive', async () => {
    gamesLoaded.set(false);
    await fixture.whenStable();
    expect(text()).toContain('Opening the vault');
  });
});
