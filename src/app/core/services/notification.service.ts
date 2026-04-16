import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AppNotification {
  tipo: 'entrada' | 'salida';
  nombre: string;
  hora: string;
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private eventSource: EventSource | null = null;
  private notificationSubject = new Subject<AppNotification>();
  public notifications$ = this.notificationSubject.asObservable();
  private hasPermission = false;

  constructor(private zone: NgZone) {
    this.requestPermission();
  }

  requestPermission() {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        this.hasPermission = permission === 'granted';
      });
    }
  }

  connect(token: string) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `${environment.apiUrl}/api/notifications?token=${token}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      this.zone.run(() => {
        try {
          const data: AppNotification = JSON.parse(event.data);
          this.notificationSubject.next(data);
          this.showNativeNotification(data);
        } catch (e) {
          console.error('Error parsing SSE data', e);
        }
      });
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      // Wait before trying to reconnect? EventSource handles reconnection natively
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private showNativeNotification(data: AppNotification) {
    if (this.hasPermission && 'Notification' in window) {
      const title = data.tipo === 'entrada' ? '✅ Entrada Registrada' : '👋 Salida Registrada';
      const options: NotificationOptions = {
        body: data.mensaje,
        icon: '/images/logo.webp',
        badge: '/favicon.webp'
      };
      
      const notification = new Notification(title, options);
      
      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    }
  }
}
