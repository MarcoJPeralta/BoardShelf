import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AuthModal } from './auth-modal';
import { AuthService } from '../../../core/services/auth.service';

describe('AuthModal', () => {
  let component: AuthModal;
  let fixture: ComponentFixture<AuthModal>;
  const close = vi.fn();
  const loginWithEmail = vi.fn();
  const loginWithGoogle = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    loginWithEmail.mockReset();
    loginWithGoogle.mockReset();

    await TestBed.configureTestingModule({
      imports: [AuthModal],
      providers: [
        { provide: DialogRef, useValue: { close } },
        { provide: DIALOG_DATA, useValue: { mode: 'login' } },
        { provide: AuthService, useValue: { loginWithEmail, loginWithGoogle } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should close after a successful login', async () => {
    loginWithEmail.mockResolvedValue(undefined);
    await component.handleEmailAuth();
    expect(close).toHaveBeenCalled();
  });

  it('should stay open and explain a failed login', async () => {
    loginWithEmail.mockRejectedValue({ code: 'auth/invalid-credential' });
    await component.handleEmailAuth();
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Incorrect email or password',
    );
  });

  it('should show nothing when the Google popup is dismissed', async () => {
    loginWithGoogle.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    await component.loginWithGoogle();

    expect(component.errorMessage()).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});
