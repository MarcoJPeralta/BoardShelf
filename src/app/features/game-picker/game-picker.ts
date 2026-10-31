import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from '../../core/services/game.service';
import { Sidebar } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-game-picker',
  imports: [RouterLink, Sidebar],
  templateUrl: './game-picker.html',
  styleUrl: './game-picker.scss',
})
export class GamePicker {
  private gameService = inject(GameService);

  gamesLoaded = this.gameService.gamesLoaded;
  gamesError = this.gameService.gamesError;
  total = this.gameService.totalGames;

  players = signal<number | null>(null);
  maxDuration = signal<number | null>(null);
  maxComplexity = signal<number | null>(null);
  rollCount = signal(0);
  private pickedGameId = signal<string | null>(null);

  readonly complexityLevels = [1, 2, 3, 4, 5];

  candidates = computed(() => {
    const players = this.players();
    const maxDuration = this.maxDuration();
    const maxComplexity = this.maxComplexity();

    return this.gameService
      .games()
      .filter(
        (game) =>
          (!players || (game.minPlayers <= players && game.maxPlayers >= players)) &&
          (!maxDuration || game.avgDurationMinutes <= maxDuration) &&
          (!maxComplexity || game.complexity <= maxComplexity),
      );
  });

  // Looked up in the candidates so the pick disappears once it stops matching the filters
  pickedGame = computed(() => this.candidates().find((game) => game.id === this.pickedGameId()));

  roll(): void {
    const candidates = this.candidates();
    if (candidates.length === 0) return;

    // Never repeat the current pick when there is another option
    const pool =
      candidates.length > 1
        ? candidates.filter((game) => game.id !== this.pickedGameId())
        : candidates;

    this.pickedGameId.set(pool[Math.floor(Math.random() * pool.length)].id);
    this.rollCount.update((count) => count + 1);
  }
}
