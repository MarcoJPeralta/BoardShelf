import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AuthModal } from '../../shared/components/auth-modal/auth-modal';
import { Dialog, DialogModule } from '@angular/cdk/dialog';

@Component({
  selector: 'app-landing',
  imports: [DialogModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
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
