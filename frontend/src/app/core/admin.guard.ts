import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn) {
    router.navigateByUrl('/login');
    return false;
  }

  if (auth.currentUserRole === 'admin') {
    return true;
  }

  router.navigateByUrl('/palinkas');
  return false;
};