import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { AuthModal } from '../auth-modal/auth-modal';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, DialogModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  public authService = inject(AuthService);
  private dialog = inject(Dialog);

  openAuth(mode: 'login' | 'signup') {
    this.dialog.open(AuthModal, {
      minWidth: '320px',
      maxWidth: '450px',
      data: { mode },
    });
  }
}
