import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SharedLibrary as Shelf } from '../../core/models/shared-library.model';
import { ShareService } from '../../core/services/share.service';
import { GameCard } from '../../shared/components/game-card/game-card';

@Component({
  selector: 'app-shared-library',
  imports: [RouterLink, GameCard],
  templateUrl: './shared-library.html',
  styleUrl: './shared-library.scss',
})
export class SharedLibrary implements OnInit {
  private shareService = inject(ShareService);

  shareId = input.required<string>();

  status = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  shelf = signal<Shelf | null>(null);

  search = signal('');
  players = signal<number | null>(null);
  maxDuration = signal<number | null>(null);

  games = computed(() => {
    const search = this.search().trim().toLowerCase();
    const players = this.players();
    const maxDuration = this.maxDuration();

    return (this.shelf()?.games ?? []).filter(
      (game) =>
        (!search || game.name.toLowerCase().includes(search)) &&
        (!players || (game.minPlayers <= players && game.maxPlayers >= players)) &&
        (!maxDuration || game.avgDurationMinutes <= maxDuration),
    );
  });

  async ngOnInit(): Promise<void> {
    try {
      const shelf = await this.shareService.getSharedLibrary(this.shareId());
      this.shelf.set(shelf);
      this.status.set(shelf ? 'ready' : 'missing');
    } catch (error) {
      console.error('Failed to load shared library:', error);
      this.status.set('error');
    }
  }

  toNumber(value: string): number | null {
    const parsed = parseInt(value, 10);
    return parsed > 0 ? parsed : null;
  }
}
