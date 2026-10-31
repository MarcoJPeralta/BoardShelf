import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { Account } from './account';
import { AuthService } from '../../core/services/auth.service';
import { GameService } from '../../core/services/game.service';

describe('Account', () => {
  let component: Account;
  let fixture: ComponentFixture<Account>;
  const calls: string[] = [];
  const reauthenticate = vi.fn();
  const deleteAccount = vi.fn();
  const deleteAllGames = vi.fn();
  const usesPassword = vi.fn();

  beforeEach(async () => {
    calls.length = 0;
    usesPassword.mockReset().mockReturnValue(true);
    reauthenticate.mockReset().mockImplementation(async () => void calls.push('reauthenticate'));
    deleteAllGames.mockReset().mockImplementation(async () => void calls.push('deleteAllGames'));
    deleteAccount.mockReset().mockImplementation(async () => void calls.push('deleteAccount'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [Account],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ email: 'a@example.com' }),
            usesPassword,
            reauthenticate,
            deleteAccount,
          },
        },
        { provide: GameService, useValue: { totalGames: signal(3), deleteAllGames } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Account);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should ask for confirmation before deleting anything', async () => {
    component.startDelete();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain("can't be undone");
    expect(calls).toEqual([]);
  });

  it('should reauthenticate, then delete the games, then the user', async () => {
    component.password.set('secret');
    await component.confirmDelete();

    expect(reauthenticate).toHaveBeenCalledWith('secret');
    expect(calls).toEqual(['reauthenticate', 'deleteAllGames', 'deleteAccount']);
  });

  it('should confirm with the popup for accounts without a password', async () => {
    usesPassword.mockReturnValue(false);
    await component.confirmDelete();
    expect(reauthenticate).toHaveBeenCalledWith(undefined);
  });

  it('should keep the games when the password is wrong', async () => {
    reauthenticate.mockRejectedValue({ code: 'auth/invalid-credential' });
    await component.confirmDelete();

    expect(deleteAllGames).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(component.deleteError()).toContain('Incorrect');
  });

  it('should stay quiet and delete nothing when the Google popup is dismissed', async () => {
    reauthenticate.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    await component.confirmDelete();

    expect(deleteAllGames).not.toHaveBeenCalled();
    expect(component.deleteError()).toBeNull();
  });

  it('should keep the user when deleting the games fails', async () => {
    deleteAllGames.mockRejectedValue(new Error('offline'));
    await component.confirmDelete();

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(component.deleteError()).not.toBeNull();
    expect(component.isDeleting()).toBe(false);
  });
});
