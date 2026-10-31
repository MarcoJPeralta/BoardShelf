import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameService } from '../../core/services/game.service';
import { GameCard } from '../../shared/components/game-card/game-card';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { FilterBar } from '../../shared/components/filter-bar/filter-bar';

@Component({
  selector: 'app-library',
  imports: [RouterLink, GameCard, Sidebar, FilterBar],
  templateUrl: './library.html',
  styleUrl: './library.scss',
})
export class Library {
  private gameService = inject(GameService);

  // Automatically react when the list changes
  gamesLoaded = this.gameService.gamesLoaded;
  gamesError = this.gameService.gamesError;
  games = this.gameService.filteredGames;
  hasFilteredGames = this.gameService.hasFilteredGames;
  total = this.gameService.totalGames;
  filteredTotal = computed(() => this.gameService.filteredGames().length);

  deleteGame(id: string) {
    this.gameService.deleteGame(id);
  }
}
