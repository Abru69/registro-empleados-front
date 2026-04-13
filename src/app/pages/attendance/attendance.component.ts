import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService } from '@core/services/attendance.service';
import { EmpleadoService, Empleado } from '@core/services/empleado.service';
import { ToastService } from '@shared/components/toast/toast.service';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.css'
})
export class AttendanceComponent implements OnInit, OnDestroy {
  nombre = '';
  horaActual = '';
  fechaActual = '';
  isRegistering = false;
  registrationSuccess = false;
  private successTimer: ReturnType<typeof setTimeout> | null = null;
  lastAction: 'entrada' | 'salida' | null = null;
  private clockInterval: ReturnType<typeof setInterval> | null = null;
  empleados: Empleado[] = [];
  isLoadingEmpleados = true;

  constructor(
    private attendanceService: AttendanceService,
    private empleadoService: EmpleadoService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
    this.cargarEmpleados();
  }

  private cargarEmpleados(): void {
    this.empleadoService.getEmpleados().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.empleados = res.data as Empleado[];
        }
        this.isLoadingEmpleados = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingEmpleados = false;
        this.toastService.error('Hubo un error cargando la lista de empleados.');
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    if (this.successTimer) clearTimeout(this.successTimer);
  }

  private updateClock(): void {
    const now = new Date();
    this.horaActual = now.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    this.fechaActual = now.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  registrar(accion: 'entrada' | 'salida'): void {
    const nombreTrimmed = this.nombre.trim();

    if (!nombreTrimmed) {
      this.toastService.error('Por favor, ingresa tu nombre');
      return;
    }

    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    const fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    this.isRegistering = true;
    this.lastAction = accion;
    this.cdr.detectChanges();

    this.attendanceService.registrar(nombreTrimmed, accion, fecha, hora).subscribe({
      next: (response) => {
        this.isRegistering = false;
        if (response.status === 'ok') {
          this.toastService.success(response.mensaje);
          this.nombre = '';
          this.registrationSuccess = true;
          if (this.successTimer) clearTimeout(this.successTimer);
          this.successTimer = setTimeout(() => {
            this.registrationSuccess = false;
            this.cdr.detectChanges();
          }, 3500);
        } else {
          this.toastService.error(response.mensaje);
          this.registrationSuccess = false;
        }
        this.cdr.detectChanges();
      },
      error: (_err: unknown) => {
        this.isRegistering = false;
        this.registrationSuccess = false;
        this.toastService.error('Error al registrar. Intenta de nuevo.');
        this.cdr.detectChanges();
      }
    });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.registrar('entrada');
    }
  }
}
