import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { LoginPage } from './pages/login/login.page';
import { PalinkaAddPage } from './pages/palinka-add/palinka-add.page';
import { PalinkaListPage } from './pages/palinka-list/palinka-list.page';

export const routes: Routes = [
	{ path: 'login', component: LoginPage },
	{ path: 'palinkas', component: PalinkaListPage, canActivate: [authGuard] },
	{ path: 'palinkas/new', component: PalinkaAddPage, canActivate: [authGuard] },
	{ path: '', pathMatch: 'full', redirectTo: 'palinkas' },
	{ path: '**', redirectTo: 'palinkas' },
];
