import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Servicio que hace ping al backend de Render cada 14 minutos
 * para evitar que el servidor entre en estado de "sleep" en el plan gratuito.
 * Render duerme el servidor tras 15 min de inactividad → esto lo previene.
 */
@Injectable({ providedIn: 'root' })
export class KeepAliveService implements OnDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  /** 14 minutos en ms (Render duerme a los 15) */
  private readonly PING_INTERVAL_MS = 14 * 60 * 1000;
  private readonly pingUrl = `${environment.apiUrl}/api/logout`; // endpoint público, no requiere auth

  constructor(private http: HttpClient) {}

  start(): void {
    if (this.intervalId) return; // ya está corriendo
    // Ping inmediato al abrir la app para despertar el servidor cuanto antes
    this.ping();
    this.intervalId = setInterval(() => this.ping(), this.PING_INTERVAL_MS);
  }

  private ping(): void {
    this.http.get(this.pingUrl, { responseType: 'json' }).subscribe({
      error: () => { /* silencioso — si falla no afecta al usuario */ }
    });
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
