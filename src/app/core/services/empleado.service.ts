import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Empleado {
  id: number;
  nombre: string;
}

export interface EmpleadoResponse {
  success: boolean;
  data?: Empleado | Empleado[];
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class EmpleadoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getEmpleados(): Observable<EmpleadoResponse> {
    return this.http.get<EmpleadoResponse>(`${this.apiUrl}/api/empleados`, { withCredentials: true });
  }

  addEmpleado(nombre: string): Observable<EmpleadoResponse> {
    const formData = new FormData();
    formData.append('nombre', nombre);
    return this.http.post<EmpleadoResponse>(`${this.apiUrl}/api/empleados`, formData, { withCredentials: true });
  }

  deleteEmpleado(id: number): Observable<EmpleadoResponse> {
    return this.http.delete<EmpleadoResponse>(`${this.apiUrl}/api/empleados/${id}`, { withCredentials: true });
  }
}
