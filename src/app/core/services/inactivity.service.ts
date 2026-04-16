import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Subscription, fromEvent, merge } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class InactivityService implements OnDestroy {
  private timeoutId: any;
  private readonly TIMEOUT_MS = 60 * 1000; // 1 minuto
  private activitySubscription: Subscription | null = null;
  private authSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone,
    private toastService: ToastService
  ) {}

  startMonitoring() {
    this.authSubscription = this.authService.currentUser$.subscribe(user => {
      // Solo monitorear si el usuario está autenticado y es admin
      if (user && user.rol === 'admin') {
        this.setupActivityListeners();
        this.resetTimeout();
      } else {
        this.stopMonitoring();
      }
    });
  }

  private setupActivityListeners() {
    if (this.activitySubscription) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      const events$ = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'click'),
        fromEvent(document, 'scroll')
      ).pipe(
        throttleTime(2000) // Limitar a un evento cada 2 segundos
      );

      this.activitySubscription = events$.subscribe(() => {
        this.resetTimeout();
      });
    });
  }

  private resetTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.ngZone.runOutsideAngular(() => {
      this.timeoutId = setTimeout(() => {
        this.ngZone.run(() => {
          this.handleInactivity();
        });
      }, this.TIMEOUT_MS);
    });
  }

  private handleInactivity() {
    if (this.authService.isAdmin) {
      this.authService.logout().subscribe({
        next: () => {
          this.toastService.warning('Sesión cerrada por inactividad');
        },
        error: () => {
          this.authService.forceLogout();
          this.toastService.warning('Sesión cerrada por inactividad');
        }
      });
    }
  }

  private stopMonitoring() {
    if (this.activitySubscription) {
      this.activitySubscription.unsubscribe();
      this.activitySubscription = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  ngOnDestroy() {
    this.stopMonitoring();
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }
}

