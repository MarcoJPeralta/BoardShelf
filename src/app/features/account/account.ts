import { Component, inject, signal } from '@angular/core';
import {
  AuthService,
  authErrorMessage,
  isAuthPopupDismissed,
} from '../../core/services/auth.service';
import { GameService } from '../../core/services/game.service';
import { ShareService } from '../../core/services/share.service';
import { Sidebar } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-account',
  imports: [Sidebar],
  templateUrl: './account.html',
  styleUrl: './account.scss',
})
export class Account {
  public authService = inject(AuthService);
  private gameService = inject(GameService);
  private shareService = inject(ShareService);
  total = this.gameService.totalGames;

  isConfirmingDelete = signal(false);
  isDeleting = signal(false);
  password = signal('');
  deleteError = signal<string | null>(null);

  startDelete(): void {
    this.deleteError.set(null);
    this.password.set('');
    this.isConfirmingDelete.set(true);
  }

  cancelDelete(): void {
    this.isConfirmingDelete.set(false);
  }

  async confirmDelete(): Promise<void> {
    this.isDeleting.set(true);
    this.deleteError.set(null);

    try {
      // Reauthenticate first: a rejected login must not leave the account without its games
      await this.authService.reauthenticate(
        this.authService.usesPassword() ? this.password() : undefined,
      );
      // Public shelf and games go before the user, since security rules need the user to still exist
      await this.shareService.deleteAllShares();
      await this.gameService.deleteAllGames();
      await this.authService.deleteAccount();
    } catch (error) {
      if (!isAuthPopupDismissed(error)) {
        console.error('Failed to delete account:', error);
        this.deleteError.set(authErrorMessage(error));
      }
    } finally {
      this.isDeleting.set(false);
    }
  }
}
