import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface User {
  usuario: string;
  rol: string;
  user_id: number;
}

export interface LoginResponse {
  status: string;
  mensaje: string;
  usuario?: string;
  rol?: string;
  user_id?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      try {
        this.currentUserSubject.next(JSON.parse(stored));
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  get isAdmin(): boolean {
    return this.currentUser?.rol === 'admin';
  }

  login(usuario: string, password: string): Observable<LoginResponse> {
    const formData = new FormData();
    formData.append('usuario', usuario);
    formData.append('password', password);

    return this.http.post<LoginResponse>(`${this.apiUrl}/api/login`, formData).pipe(
      tap(response => {
        if (response.status === 'ok' && response.usuario) {
          const user: User = {
            usuario: response.usuario,
            rol: response.rol || 'user',
            user_id: response.user_id || 0
          };
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
        }
      })
    );
  }

  logout(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/logout`).pipe(
      tap(() => {
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
        this.router.navigate(['/login']);
      })
    );
  }

  forceLogout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }
}
