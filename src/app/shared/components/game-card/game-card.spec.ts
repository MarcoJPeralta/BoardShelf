import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GameCard } from './game-card';
import { Game } from '../../../core/models/game.model';

const game: Game = {
  id: 'scythe',
  name: 'Scythe',
  minPlayers: 1,
  maxPlayers: 5,
  avgDurationMinutes: 115,
  categories: ['Strategy'],
  mode: 'pvp',
  complexity: 3,
  addedAt: new Date(),
};

describe('GameCard', () => {
  let component: GameCard;
  let fixture: ComponentFixture<GameCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameCard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GameCard);
    fixture.componentRef.setInput('game', game);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render a broken image when the game has no cover', () => {
    expect(fixture.nativeElement.querySelector('img.game-card__image')).toBeNull();
  });

  it('should describe the complexity to screen readers', () => {
    const stars = fixture.nativeElement.querySelector('.game-card__stars');
    expect(stars.getAttribute('aria-label')).toBe('3 out of 5');
  });
});
