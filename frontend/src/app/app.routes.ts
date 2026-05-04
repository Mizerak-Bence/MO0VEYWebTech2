import { Routes } from '@angular/router';

import { adminGuard } from './core/admin.guard';
import { authGuard } from './core/auth.guard';
import { AdminUsersPage } from './pages/admin-users/admin-users.page';
import { LoginPage } from './pages/login/login.page';
import { PalinkaListPage } from './pages/palinka-list/palinka-list.page';
import { ProfilePage } from './pages/profile/profile.page';
import { RegisterPage } from './pages/register/register.page';

export const routes: Routes = [
	{ path: 'login', component: LoginPage },
	{ path: 'register', component: RegisterPage },
	{ path: 'admin/users', component: AdminUsersPage, canActivate: [adminGuard] },
	{ path: 'palinkas', component: PalinkaListPage, canActivate: [authGuard] },
	{ path: 'palinkas/new', loadComponent: () => import('./pages/palinka-add/palinka-add.page').then((module) => module.PalinkaAddPage), canActivate: [authGuard] },
	{ path: 'palinkas/:id/edit', loadComponent: () => import('./pages/palinka-add/palinka-add.page').then((module) => module.PalinkaAddPage), canActivate: [authGuard] },
	{ path: 'profile', component: ProfilePage, canActivate: [authGuard] },
	{ path: '', pathMatch: 'full', redirectTo: 'palinkas' },
	{ path: '**', redirectTo: 'palinkas' },
];
