import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { AddGame } from './add-game';
import { Game } from '../../core/models/game.model';
import { AuthService } from '../../core/services/auth.service';
import { GameService } from '../../core/services/game.service';

const game: Game = {
  id: 'scythe',
  name: 'Scythe',
  imageUrl: 'https://example.com/scythe.png',
  minPlayers: 1,
  maxPlayers: 5,
  minDurationMinutes: 90,
  maxDurationMinutes: 115,
  avgDurationMinutes: 115,
  categories: ['Strategy', 'Economic'],
  mode: 'pvp',
  complexity: 3,
  notes: 'Bring snacks',
  bggId: '169786',
  addedAt: new Date(),
};

describe('AddGame', () => {
  let component: AddGame;
  let fixture: ComponentFixture<AddGame>;
  const games = signal<Game[]>([]);
  const gamesLoaded = signal(true);
  const addGame = vi.fn();
  const updateGame = vi.fn();

  const setup = async (id?: string) => {
    fixture = TestBed.createComponent(AddGame);
    if (id) fixture.componentRef.setInput('id', id);
    component = fixture.componentInstance;
    await fixture.whenStable();
  };

  beforeEach(async () => {
    games.set([game]);
    gamesLoaded.set(true);
    addGame.mockReset();
    updateGame.mockReset().mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [AddGame],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        {
          provide: GameService,
          useValue: {
            gamesLoaded,
            addGame,
            updateGame,
            getGameById: (id: string) => games().find((g) => g.id === id),
          },
        },
      ],
    }).compileComponents();

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('should start empty with the BGG search when adding', async () => {
    await setup();
    expect(component.gameForm.value.name).toBe('');
    expect(fixture.nativeElement.querySelector('.add-game__form-search')).not.toBeNull();
  });

  it('should fill the form and hide the BGG search when editing', async () => {
    await setup('scythe');
    expect(component.gameForm.value).toMatchObject({
      name: 'Scythe',
      categories: 'Strategy, Economic',
      notes: 'Bring snacks',
    });
    expect(fixture.nativeElement.querySelector('.add-game__form-search')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Save Changes');
  });

  it('should not overwrite the user input when the game changes in the background', async () => {
    await setup('scythe');
    component.gameForm.patchValue({ name: 'Typing...' });

    games.set([{ ...game, notes: 'Changed on another device' }]);
    await fixture.whenStable();

    expect(component.gameForm.value.name).toBe('Typing...');
  });

  it('should update the existing game instead of adding a new one', async () => {
    await setup('scythe');
    component.gameForm.patchValue({ name: 'Scythe: Encounters' });

    component.handleSubmit();
    await fixture.whenStable();

    expect(addGame).not.toHaveBeenCalled();
    expect(updateGame).toHaveBeenCalledWith(
      'scythe',
      expect.objectContaining({ name: 'Scythe: Encounters' }),
    );
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/game', 'scythe']);
  });

  it('should keep the BGG duration range when the duration is untouched', async () => {
    await setup('scythe');
    component.handleSubmit();

    // updateGame strips undefined values, so the stored range is left alone
    expect(updateGame.mock.calls[0][1].minDurationMinutes).toBeUndefined();
    expect(updateGame.mock.calls[0][1].maxDurationMinutes).toBeUndefined();
  });

  it('should collapse the BGG duration range when the duration is edited', async () => {
    await setup('scythe');
    component.gameForm.patchValue({ avgDurationMinutes: 60 });
    component.handleSubmit();

    expect(updateGame.mock.calls[0][1]).toMatchObject({
      avgDurationMinutes: 60,
      minDurationMinutes: 60,
      maxDurationMinutes: 60,
    });
  });

  it('should persist cleared notes and cover image', async () => {
    await setup('scythe');
    component.gameForm.patchValue({ notes: '', imageUrl: '' });
    component.handleSubmit();

    expect(updateGame.mock.calls[0][1]).toMatchObject({ notes: '', imageUrl: '' });
  });

  it('should stay on the page and show an error when saving fails', async () => {
    updateGame.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await setup('scythe');

    component.handleSubmit();
    await vi.waitFor(() => expect(component.saveError()).not.toBeNull());

    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('should go to the not-found page when the edited game does not exist', async () => {
    await setup('missing');
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/game', 'missing']);
  });

  it('should not claim success when adding the game fails', async () => {
    addGame.mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await setup();
    component.gameForm.patchValue({ name: 'Azul', categories: 'Abstract' });

    component.handleSubmit();
    await vi.waitFor(() => expect(component.saveError()).toContain('security rules'));

    expect(component.submitted()).toBe(false);
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
  });

  it('should drop blank categories', async () => {
    await setup();
    component.gameForm.patchValue({ name: 'Azul', categories: 'Abstract, ,Family,' });
    component.handleSubmit();

    expect(addGame.mock.calls[0][0].categories).toEqual(['Abstract', 'Family']);
  });
});
