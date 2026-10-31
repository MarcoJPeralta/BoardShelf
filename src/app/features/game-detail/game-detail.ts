import { Component, input, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Game } from '../../core/models/game.model';
import { GameService } from '../../core/services/game.service';

@Component({
  selector: 'app-game-detail',
  imports: [RouterLink, Sidebar],
  templateUrl: './game-detail.html',
  styleUrl: './game-detail.scss',
})
export class GameDetail {
  private gameService = inject(GameService);
  private router = inject(Router);

  id = input.required<string>();

  gamesLoaded = this.gameService.gamesLoaded;
  gamesError = this.gameService.gamesError;
  game = computed(() => this.gameService.getGameById(this.id()));

  bggUrl = computed(() => {
    const bggId = this.game()?.bggId;
    return bggId ? `https://boardgamegeek.com/boardgame/${bggId}` : null;
  });

  async deleteGame(): Promise<void> {
    const game = this.game();
    if (!game || !confirm(`Delete ${game.name} from your vault?`)) return;

    await this.gameService.deleteGame(game.id);
    await this.router.navigate(['/library']);
  }

  formatAddedDate(game: Game): string {
    if (!(game.addedAt instanceof Date)) return 'Recently added';

    return new Intl.DateTimeFormat('en', {
      month: 'short',
      year: 'numeric',
    }).format(game.addedAt);
  }

  formatDuration(game: Game): string {
    const minDuration = game.minDurationMinutes;
    const maxDuration = game.maxDurationMinutes;
    if (minDuration && maxDuration && minDuration !== maxDuration) {
      return `${minDuration}-${maxDuration}m`;
    }

    return `${game.avgDurationMinutes}m`;
  }

  modeLabel(mode: Game['mode']): string {
    const labels: Record<Game['mode'], string> = {
      both: 'Competitive + Co-op',
      coop: 'Co-op',
      pvp: 'Competitive',
    };

    return labels[mode];
  }

  summary(game: Game): string {
    const category = game.categories[0]?.toLowerCase() ?? 'board game';
    const year = game.yearPublished ? `${game.yearPublished} ` : '';
    return `A ${year}${category} game for ${game.minPlayers}-${game.maxPlayers} players.`;
  }
}
