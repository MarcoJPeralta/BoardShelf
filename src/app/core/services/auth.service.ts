// src/app/core/services/auth.service.ts
import { Injectable, signal, inject } from '@angular/core';
import { auth } from '../firebase.config';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  deleteUser,
} from 'firebase/auth';
import { Router } from '@angular/router';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/user-mismatch': 'Please confirm with the Google account you are signed in with.',
};

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? '';
  return AUTH_ERROR_MESSAGES[code] ?? 'Something went wrong. Please try again.';
}

// Closing the Google popup is a choice, not a failure
export function isAuthPopupDismissed(error: unknown): boolean {
  const code = (error as { code?: string }).code ?? '';
  return ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(code);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private router = inject(Router);
  private isAuthInitialized = signal(false);
  private authInitializedPromise = new Promise<void>((resolve) => {
    onAuthStateChanged(auth, (user) => {
      this.currentUser.set(user);
      this.isAuthInitialized.set(true);
      resolve();

      // Shared shelves are public, so guests stay on them
      if (!user && !window.location.pathname.startsWith('/shared/')) {
        this.router.navigate(['/']); // Redirect if not logged in
      }
    });
  });

  // User state is a Signal
  currentUser = signal<User | null>(null);

  async waitForAuthInitialization() {
    if (this.isAuthInitialized()) return;
    await this.authInitializedPromise;
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    this.router.navigate(['/library']);
  }

  async loginWithEmail(email: string, pass: string) {
    await signInWithEmailAndPassword(auth, email, pass);
    this.router.navigate(['/library']);
  }

  async registerWithEmail(email: string, pass: string) {
    await createUserWithEmailAndPassword(auth, email, pass);
    this.router.navigate(['/library']);
  }

  usesPassword(): boolean {
    return !!this.currentUser()?.providerData.some((p) => p.providerId === 'password');
  }

  /** Firebase requires a recent login before deleting; pass the password for email accounts. */
  async reauthenticate(password?: string) {
    const user = this.currentUser();
    if (!user) return;
    if (password !== undefined && user.email) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }
  }

  /** The auth state listener redirects to the landing page afterwards. */
  async deleteAccount() {
    const user = this.currentUser();
    if (user) await deleteUser(user);
  }

  async logout() {
    await signOut(auth);
    this.router.navigate(['/']);
  }
}
