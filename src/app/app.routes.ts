import { Routes } from '@angular/router';
import { Landing } from './features/landing/landing';
import { Library } from './features/library/library';
import { GamePicker } from './features/game-picker/game-picker';
import { GameDetail } from './features/game-detail/game-detail';
import { AddGame } from './features/add-game/add-game';
import { Account } from './features/account/account';
import { SharedLibrary } from './features/shared-library/shared-library';
import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';

export const routes: Routes = [
  { path: '', component: Landing, canActivate: [guestGuard] },
  { path: 'library', component: Library, canActivate: [authGuard] },
  { path: 'game-picker', component: GamePicker, canActivate: [authGuard] },
  { path: 'game/:id', component: GameDetail, canActivate: [authGuard] },
  { path: 'game/:id/edit', component: AddGame, canActivate: [authGuard] },
  { path: 'add-game', component: AddGame, canActivate: [authGuard] },
  { path: 'account', component: Account, canActivate: [authGuard] },
  { path: 'shared/:shareId', component: SharedLibrary },
  { path: '**', redirectTo: '' },
];
