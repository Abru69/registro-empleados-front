import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AttendanceService,
  AttendanceRecord,
  AttendanceListResponse,
  WeeklyRecord,
  WeeklyHoursResponse
} from '@core/services/attendance.service';
import { EmpleadoService, Empleado } from '@core/services/empleado.service';
import { ToastService } from '@shared/components/toast/toast.service';
import { ThemeService } from '@core/services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Filters - Attendance
  filterNombre = '';
  filterDesde = '';
  filterHasta = '';

  // Filters - Weekly
  filterNombreSemanal = '';
  filterSemana = '';

  // Data
  attendanceRows: AttendanceRecord[] = [];
  weeklyRows: WeeklyRecord[] = [];

  // Pagination - Registros
  currentPageRegistros = 1;
  itemsPerPage = 15;
  get paginatedRegistros(): AttendanceRecord[] {
    const start = (this.currentPageRegistros - 1) * this.itemsPerPage;
    return this.attendanceRows.slice(start, start + this.itemsPerPage);
  }
  get totalPagesRegistros(): number {
    return Math.ceil(this.attendanceRows.length / this.itemsPerPage) || 1;
  }

  // Pagination - Semanales
  currentPageWeekly = 1;
  get paginatedWeekly(): WeeklyRecord[] {
    const start = (this.currentPageWeekly - 1) * this.itemsPerPage;
    return this.weeklyRows.slice(start, start + this.itemsPerPage);
  }
  get totalPagesWeekly(): number {
    return Math.ceil(this.weeklyRows.length / this.itemsPerPage) || 1;
  }

  // Auto-refresh
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private weeklyRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private lastAttendanceSig = '';
  private lastWeeklySig = '';

  // Loading states
  isLoadingAttendance = true;
  isLoadingWeekly = true;

  // Stats
  totalEmpleados = 0;
  registrosHoy = 0;
  sinSalida = 0;

  // Tabs & Empleados Management
  activeTab: 'registros' | 'semanales' | 'empleados' = 'registros';
  empleados: Empleado[] = [];
  isLoadingEmpleadosList = true;
  nuevoEmpleadoNombre = '';
  isAddingEmpleado = false;

  // Delete modal state
  showDeleteModal = false;
  deleteTargetId: number | null = null;
  deleteTargetName = '';
  isDeletingEmpleado = false;

  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private themeSub!: Subscription;

  constructor(
    private attendanceService: AttendanceService,
    private empleadoService: EmpleadoService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAttendance();
    this.loadWeekly();
    this.startAutoRefresh();
    this.loadEmpleados();

    this.themeSub = this.themeService.theme$.subscribe(() => {
      this.cdr.detectChanges();
    });

    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.themeSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  // ---- Load Data ---- //

  loadAttendance(silent = false): void {
    if (!silent) this.isLoadingAttendance = true;

    const filters: { desde?: string; hasta?: string; nombre?: string } = {};
    if (this.filterDesde) filters.desde = this.filterDesde;
    if (this.filterHasta) filters.hasta = this.filterHasta;
    if (this.filterNombre) filters.nombre = this.filterNombre.trim();

    this.attendanceService.getAttendanceList(filters).subscribe({
      next: (response: AttendanceListResponse) => {
        if (response.error) {
          if (!silent) this.toastService.error(response.message || 'Error al cargar datos');
          return;
        }
        const rows = response.data || [];
        const sig = JSON.stringify(rows.map((r: AttendanceRecord) => `${r.id}-${r.hora_salida}-${r.total_hhmm}`));

        if (!silent || sig !== this.lastAttendanceSig) {
           this.attendanceRows = rows;
           this.lastAttendanceSig = sig;
           this.updateStats(rows);
           if (!silent) this.currentPageRegistros = 1;
        }
        this.isLoadingAttendance = false;
      },
      error: (_err: unknown) => {
        this.isLoadingAttendance = false;
        if (!silent) this.toastService.error('Error de conexión');
      }
    });
  }

  loadWeekly(silent = false): void {
    if (!silent) this.isLoadingWeekly = true;

    const filters: { nombre?: string; semana?: string } = {};
    if (this.filterNombreSemanal) filters.nombre = this.filterNombreSemanal.trim();
    if (this.filterSemana) filters.semana = this.filterSemana;

    this.attendanceService.getWeeklyHours(filters).subscribe({
      next: (response: WeeklyHoursResponse) => {
        if (response.error) {
          if (!silent) this.toastService.error(response.message || 'Error al cargar datos semanales');
          return;
        }
        const rows = response.data || [];
        const sig = JSON.stringify(rows.map((r: WeeklyRecord) => `${r.nombre}-${r.semana_iso}-${r.total_minutos}`));

        if (!silent || sig !== this.lastWeeklySig) {
          this.weeklyRows = rows;
          this.lastWeeklySig = sig;
           if (!silent) this.currentPageWeekly = 1;
        }
        this.isLoadingWeekly = false;
      },
      error: (_err: unknown) => {
        this.isLoadingWeekly = false;
        if (!silent) this.toastService.error('Error al cargar datos semanales');
      }
    });
  }

  private updateStats(rows: AttendanceRecord[]): void {
    const today = new Date().toISOString().split('T')[0];
    const todayRows = rows.filter(r => r.fecha === today);
    this.registrosHoy = todayRows.length;
    this.sinSalida = todayRows.filter(r => !r.hora_salida).length;

    const uniqueNames = new Set(rows.map(r => r.nombre));
    this.totalEmpleados = uniqueNames.size;
  }

  // ---- Filters ---- //

  filterAttendance(): void {
    this.loadAttendance(false);
  }

  clearAttendanceFilters(): void {
    this.filterNombre = '';
    this.filterDesde = '';
    this.filterHasta = '';
    this.loadAttendance(false);
  }

  filterWeekly(): void {
    this.loadWeekly(false);
  }

  clearWeeklyFilters(): void {
    this.filterNombreSemanal = '';
    this.filterSemana = '';
    this.loadWeekly(false);
  }

  // --- Export Functions --- //

  exportAttendance(): void {
    if (this.attendanceRows.length === 0) {
      this.toastService.error('No hay datos para exportar');
      return;
    }
    const header = ['Nombre del Empleado', 'Fecha', 'Hora Entrada', 'Hora Salida', 'Total Horas'];
    const csvContent = [
      header.join(','),
      ...this.attendanceRows.map(r => [
        `"${r.nombre}"`,
        `"${r.fecha}"`,
        `"${r.hora}"`,
        `"${r.hora_salida || 'Sin salida'}"`,
        `"${r.total_hhmm}"`
      ].join(','))
    ].join('\n');
    
    this.downloadCSV(csvContent, `asistencia_${new Date().toISOString().split('T')[0]}.csv`);
  }

  exportWeekly(): void {
    if (this.weeklyRows.length === 0) {
      this.toastService.error('No hay datos para exportar');
      return;
    }
    const header = ['Empleado', 'Semana', 'Inicio (Lunes)', 'Fin (Domingo)', 'Días Trabajados', 'Total por Semana'];
    const csvContent = [
      header.join(','),
      ...this.weeklyRows.map(r => [
        `"${r.nombre}"`,
        `"${r.semana_iso}"`,
        `"${r.fecha_inicio}"`,
        `"${r.fecha_fin}"`,
        `"${r.total_registros}"`,
        `"${this.formatWeeklyMinutes(r.total_minutos, r.total_horas_decimal)}"`
      ].join(','))
    ].join('\n');
    
    this.downloadCSV(csvContent, `horas_semanales_${new Date().toISOString().split('T')[0]}.csv`);
  }

  private downloadCSV(csvContent: string, fileName: string): void {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.toastService.success('Archivo exportado correctamente');
  }

  formatWeeklyMinutes(minutos?: number | null, decimal?: number | null): string {
    const formatMin = (totalMin: number): string => {
      if (!totalMin || totalMin <= 0) return '0:00 (0 horas con 0 minutos)';
      const h = Math.floor(totalMin / 60);
      const mm = totalMin % 60;
      const minutosStr = mm.toString().padStart(2, '0');
      const horasTexto = h === 1 ? '1 hora' : `${h} horas`;
      const minutosTexto = mm === 1 ? '1 minuto' : `${mm} minutos`;
      return `${h}:${minutosStr} (${horasTexto} con ${minutosTexto})`;
    };

    if (minutos !== null && minutos !== undefined) return formatMin(minutos);
    if (decimal || decimal === 0) return formatMin(Math.round(Number(decimal) * 60));
    return '0:00 (0 horas con 0 minutos)';
  }

  // ---- Misc & View logic ---- //

  private startAutoRefresh(): void {
    this.refreshInterval = setInterval(() => this.loadAttendance(true), 5000);
    this.weeklyRefreshInterval = setInterval(() => this.loadWeekly(true), 10000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.weeklyRefreshInterval) clearInterval(this.weeklyRefreshInterval);
  }

  private handleVisibility = (): void => {
    if (document.hidden) {
      this.stopAutoRefresh();
    } else {
      this.loadAttendance(true);
      this.loadWeekly(true);
      this.startAutoRefresh();
    }
  };

  get todayMax(): string {
    return new Date().toISOString().split('T')[0];
  }

  get todayLabel(): string {
    return new Date().toLocaleDateString('es-MX', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  get empleadosHoy(): number {
    const today = new Date().toISOString().split('T')[0];
    const uniqueNames = new Set(
      this.attendanceRows.filter(r => r.fecha === today).map(r => r.nombre)
    );
    return uniqueNames.size;
  }

  get totalEmpleadosActivos(): number {
    return this.empleados.length > 0 ? this.empleados.length : this.totalEmpleados;
  }

  onAttendanceKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.filterAttendance();
  }

  onWeeklyKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.filterWeekly();
  }

  setTab(tab: 'registros' | 'semanales' | 'empleados'): void {
    this.activeTab = tab;
    if (tab === 'empleados') {
       if (this.empleados.length > 0) {
         this.loadEmpleados(true);
       } else {
         this.loadEmpleados(false);
       }
    }
  }

  // ---- Empleados Management ---- //

  loadEmpleados(silent = false): void {
    if (!silent) this.isLoadingEmpleadosList = true;
    this.empleadoService.getEmpleados().subscribe({
      next: (res) => {
        this.isLoadingEmpleadosList = false;
        if (res && res.success) {
          this.empleados = (res.data || []) as Empleado[];
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoadingEmpleadosList = false;
        this.toastService.error('Error cargando empleados');
        this.cdr.detectChanges();
      }
    });
  }

  addEmpleado(): void {
    const nombre = this.nuevoEmpleadoNombre.trim();
    if (!nombre) {
      this.toastService.error('Ingresa un nombre');
      return;
    }
    
    this.isAddingEmpleado = true;
    this.empleadoService.addEmpleado(nombre).subscribe({
      next: (res) => {
        this.isAddingEmpleado = false;
        if (res.success) {
          this.toastService.success(res.message || 'Empleado agregado');
          this.nuevoEmpleadoNombre = '';
          if (res.data) {
             this.empleados = [...this.empleados, res.data as Empleado].sort((a,b) => a.nombre.localeCompare(b.nombre));
          } else {
             this.loadEmpleados(true);
          }
        } else {
          this.toastService.error(res.message || 'Error al agregar');
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isAddingEmpleado = false;
        this.toastService.error('Error del servidor');
        this.cdr.detectChanges();
      }
    });
  }

  deleteEmpleado(id: number): void {
    const emp = this.empleados.find(e => e.id === id);
    this.deleteTargetId = id;
    this.deleteTargetName = emp?.nombre ?? 'este empleado';
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.deleteTargetId = null;
    this.deleteTargetName = '';
    this.isDeletingEmpleado = false;
  }

  confirmDelete(): void {
    if (this.deleteTargetId === null) return;
    this.isDeletingEmpleado = true;

    this.empleadoService.deleteEmpleado(this.deleteTargetId).subscribe({
      next: (res) => {
        this.isDeletingEmpleado = false;
        this.showDeleteModal = false;
        if (res.success) {
          this.toastService.success(`Empleado "${this.deleteTargetName}" eliminado`);
          this.empleados = this.empleados.filter(e => e.id !== this.deleteTargetId);
          this.cdr.detectChanges();
        } else {
          this.toastService.error(res.message || 'Error al eliminar');
        }
        this.deleteTargetId = null;
        this.deleteTargetName = '';
      },
      error: () => {
        this.isDeletingEmpleado = false;
        this.showDeleteModal = false;
        this.toastService.error('Error del servidor');
        this.deleteTargetId = null;
      }
    });
  }
}
