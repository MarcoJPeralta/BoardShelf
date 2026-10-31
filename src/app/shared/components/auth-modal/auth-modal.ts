import { Component, inject, signal } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
  AuthService,
  authErrorMessage,
  isAuthPopupDismissed,
} from '../../../core/services/auth.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-auth-modal',
  imports: [FormsModule],
  templateUrl: './auth-modal.html',
  styleUrl: './auth-modal.scss',
})
export class AuthModal {
  private authService = inject(AuthService);
  public dialogRef = inject(DialogRef);
  private inputData = inject(DIALOG_DATA);

  // Signal to switch between 'login' and 'signup'
  view = signal<'login' | 'signup'>((this.inputData?.mode as 'login' | 'signup') || 'login');
  errorMessage = signal<string | null>(null);

  email = '';
  password = '';

  switchView(view: 'login' | 'signup') {
    this.errorMessage.set(null);
    this.view.set(view);
  }

  async loginWithGoogle() {
    await this.authenticate(() => this.authService.loginWithGoogle());
  }

  async handleEmailAuth() {
    await this.authenticate(() =>
      this.view() === 'login'
        ? this.authService.loginWithEmail(this.email, this.password)
        : this.authService.registerWithEmail(this.email, this.password),
    );
  }

  private async authenticate(attempt: () => Promise<void>) {
    this.errorMessage.set(null);
    try {
      await attempt();
      this.dialogRef.close();
    } catch (error) {
      if (isAuthPopupDismissed(error)) return;
      this.errorMessage.set(authErrorMessage(error));
    }
  }
}
