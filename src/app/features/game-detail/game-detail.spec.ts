import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GameDetail } from './game-detail';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';

const game: Game = {
  id: 'scythe',
  name: 'Scythe',
  minPlayers: 1,
  maxPlayers: 5,
  minDurationMinutes: 90,
  maxDurationMinutes: 115,
  avgDurationMinutes: 115,
  categories: ['Strategy'],
  mode: 'pvp',
  complexity: 3,
  addedAt: new Date(),
};

describe('GameDetail', () => {
  let component: GameDetail;
  let fixture: ComponentFixture<GameDetail>;
  const games = signal<Game[]>([]);
  const gamesLoaded = signal(false);

  beforeEach(async () => {
    games.set([]);
    gamesLoaded.set(false);

    await TestBed.configureTestingModule({
      imports: [GameDetail],
      providers: [
        provideRouter([]),
        {
          provide: GameService,
          useValue: {
            gamesLoaded,
            gamesError: signal(null),
            getGameById: (id: string) => games().find((g) => g.id === id),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameDetail);
    fixture.componentRef.setInput('id', 'scythe');
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not claim the game is missing while games are loading', () => {
    expect(text()).toContain('Opening the vault');
    expect(text()).not.toContain('Game not found');
  });

  it('should show not found once loaded without the game', async () => {
    gamesLoaded.set(true);
    await fixture.whenStable();
    expect(text()).toContain('Game not found');
  });

  it('should show the game with its duration range and an edit link', async () => {
    games.set([game]);
    gamesLoaded.set(true);
    await fixture.whenStable();

    expect(text()).toContain('Scythe');
    expect(text()).toContain('90-115m');
    const links: HTMLAnchorElement[] = Array.from(fixture.nativeElement.querySelectorAll('a'));
    expect(links.map((link) => link.getAttribute('href'))).toContain('/game/scythe/edit');
  });
});
