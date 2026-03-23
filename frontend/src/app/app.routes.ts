import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { LoginPage } from './pages/login/login.page';
import { PalinkaAddPage } from './pages/palinka-add/palinka-add.page';
import { PalinkaListPage } from './pages/palinka-list/palinka-list.page';
import { ProfilePage } from './pages/profile/profile.page';
import { RegisterPage } from './pages/register/register.page';

export const routes: Routes = [
	{ path: 'login', component: LoginPage },
	{ path: 'register', component: RegisterPage },
	{ path: 'palinkas', component: PalinkaListPage, canActivate: [authGuard] },
	{ path: 'palinkas/new', component: PalinkaAddPage, canActivate: [authGuard] },
	{ path: 'palinkas/:id/edit', component: PalinkaAddPage, canActivate: [authGuard] },
	{ path: 'profile', component: ProfilePage, canActivate: [authGuard] },
	{ path: '', pathMatch: 'full', redirectTo: 'palinkas' },
	{ path: '**', redirectTo: 'palinkas' },
];
