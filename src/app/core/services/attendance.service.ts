import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RegistroResponse {
  status: string;
  mensaje: string;
}

export interface AttendanceRecord {
  id: number;
  nombre: string;
  fecha: string;
  hora: string;
  hora_salida: string | null;
  total_hhmm: string;
}

export interface AttendanceListResponse {
  data: AttendanceRecord[];
  error?: boolean;
  message?: string;
}

export interface WeeklyRecord {
  nombre: string;
  semana_iso: string;
  fecha_inicio: string;
  fecha_fin: string;
  rango_formato: string;
  total_registros: number;
  total_horas_decimal: number | null;
  total_minutos: number | null;
  datos_suficientes: boolean;
  mensaje: string | null;
}

export interface WeeklyHoursResponse {
  success: boolean;
  data: WeeklyRecord[];
  count: number;
  error?: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  registrar(nombre: string, accion: 'entrada' | 'salida'): Observable<RegistroResponse> {
    const formData = new FormData();
    formData.append('nombre', nombre);
    formData.append('accion', accion);

    return this.http.post<RegistroResponse>(`${this.apiUrl}/api/registrar`, formData, {
      withCredentials: true
    });
  }

  getAttendanceList(filters?: { desde?: string; hasta?: string; nombre?: string }): Observable<AttendanceListResponse> {
    const params: any = {};
    if (filters?.desde) params.desde = filters.desde;
    if (filters?.hasta) params.hasta = filters.hasta;
    if (filters?.nombre) params.nombre = filters.nombre;

    return this.http.get<AttendanceListResponse>(`${this.apiUrl}/api/attendance_list`, {
      params,
      withCredentials: true
    });
  }

  getWeeklyHours(filters?: { nombre?: string; semana?: string }): Observable<WeeklyHoursResponse> {
    const params: any = {};
    if (filters?.nombre) params.nombre = filters.nombre;
    if (filters?.semana) params.semana = filters.semana;

    return this.http.get<WeeklyHoursResponse>(`${this.apiUrl}/api/weekly_hours`, {
      params,
      withCredentials: true
    });
  }
}
