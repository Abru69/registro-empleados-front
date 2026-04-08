import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  ModuleRegistry,
  ColDef,
  GridApi,
  GridReadyEvent,
  GridSizeChangedEvent,
  themeQuartz
} from 'ag-grid-community';
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

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
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

  // Grid data
  attendanceRows: AttendanceRecord[] = [];
  weeklyRows: WeeklyRecord[] = [];

  // AG-Grid APIs
  private attendanceGridApi!: GridApi;
  private weeklyGridApi!: GridApi;

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

  private cdr = inject(ChangeDetectorRef);
  private themeService = inject(ThemeService);
  private themeSub!: Subscription;

  // AG-Grid themes
  private darkGridTheme = themeQuartz.withParams({
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    foregroundColor: '#e2e8f0',
    headerBackgroundColor: 'rgba(30, 41, 59, 0.8)',
    headerFontWeight: 600,
    rowHoverColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    cellHorizontalPaddingScale: 1.2,
    headerFontSize: 13,
    fontSize: 14,
    rowBorder: true,
    wrapperBorderRadius: 12,
    headerColumnResizeHandleColor: 'rgba(99, 102, 241, 0.4)',
    selectedRowBackgroundColor: 'rgba(99, 102, 241, 0.12)',
    rangeSelectionBorderColor: '#6366f1'
  });

  private lightGridTheme = themeQuartz.withParams({
    backgroundColor: '#ffffff',
    foregroundColor: '#1e293b',
    headerBackgroundColor: '#f1f5f9',
    headerFontWeight: 600,
    rowHoverColor: 'rgba(79, 70, 229, 0.06)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    cellHorizontalPaddingScale: 1.2,
    headerFontSize: 13,
    fontSize: 14,
    rowBorder: true,
    wrapperBorderRadius: 12,
    headerColumnResizeHandleColor: 'rgba(79, 70, 229, 0.3)',
    selectedRowBackgroundColor: 'rgba(79, 70, 229, 0.08)',
    rangeSelectionBorderColor: '#4f46e5'
  });

  gridTheme = this.themeService.isDark ? this.darkGridTheme : this.lightGridTheme;

  // Attendance columns
  attendanceColDefs: ColDef<AttendanceRecord>[] = [
    {
      field: 'nombre',
      headerName: 'Nombre del Empleado',
      filter: 'agTextColumnFilter',
      flex: 2,
      minWidth: 180
    },
    {
      field: 'fecha',
      headerName: 'Fecha',
      filter: 'agDateColumnFilter',
      flex: 1,
      minWidth: 130
    },
    {
      field: 'hora',
      headerName: 'Hora Entrada',
      flex: 1,
      minWidth: 120
    },
    {
      field: 'hora_salida',
      headerName: 'Hora Salida',
      flex: 1,
      minWidth: 120,
      valueFormatter: (params) => params.value || 'Sin salida',
      cellStyle: (params) => {
        if (!params.value) {
          return { color: '#f59e0b', fontStyle: 'italic' } as Record<string, string>;
        }
        return null;
      }
    },
    {
      field: 'total_hhmm',
      headerName: 'Total Horas',
      flex: 1,
      minWidth: 130,
      cellStyle: { fontWeight: '600', color: '#34d399' }
    }
  ];

  // Weekly columns
  weeklyColDefs: ColDef<WeeklyRecord>[] = [
    {
      field: 'nombre',
      headerName: 'Empleado',
      flex: 2,
      minWidth: 180,
      pinned: 'left' as const
    },
    {
      field: 'semana_iso',
      headerName: 'Semana',
      flex: 1,
      minWidth: 120
    },
    {
      field: 'fecha_inicio',
      headerName: 'Inicio (Lunes)',
      flex: 1.2,
      minWidth: 130
    },
    {
      field: 'fecha_fin',
      headerName: 'Fin (Domingo)',
      flex: 1.2,
      minWidth: 130
    },
    {
      field: 'total_registros',
      headerName: 'Días Trabajados',
      flex: 1,
      minWidth: 140,
      cellStyle: { textAlign: 'center' }
    },
    {
      field: 'total_horas_decimal',
      headerName: 'Total por Semana',
      flex: 1.5,
      minWidth: 200,
      valueFormatter: (params) => {
        const data = params.data;
        if (!data) return '0:00';
        const minutos = data.total_minutos;

        const formatMin = (totalMin: number): string => {
          if (!totalMin || totalMin <= 0) return '0:00 (0 horas con 0 minutos)';
          const h = Math.floor(totalMin / 60);
          const mm = totalMin % 60;
          const minutosStr = mm.toString().padStart(2, '0');
          const horasTexto = h === 1 ? '1 hora' : `${h} horas`;
          const minutosTexto = mm === 1 ? '1 minuto' : `${mm} minutos`;
          return `${h}:${minutosStr} (${horasTexto} con ${minutosTexto})`;
        };

        if (minutos !== null && minutos !== undefined) {
          return formatMin(minutos);
        }

        const decimalVal = params.value;
        if (decimalVal || decimalVal === 0) {
          return formatMin(Math.round(Number(decimalVal) * 60));
        }

        return '0:00 (0 horas con 0 minutos)';
      },
      cellStyle: { fontWeight: '700', color: '#34d399', fontSize: '14px' }
    }
  ];

  // Default column definition
  defaultColDef: ColDef = {
    sortable: true,
    resizable: true
  };

  // Pagination
  paginationPageSize = 15;
  paginationPageSizeSelector = [15, 25, 50, 100];

  // AG-Grid locale
  localeText: Record<string, string> = {
    page: 'Página',
    more: 'Más',
    to: 'a',
    of: 'de',
    next: 'Siguiente',
    last: 'Último',
    first: 'Primero',
    previous: 'Anterior',
    loadingOoo: 'Cargando...',
    noRowsToShow: 'No hay registros para mostrar',
    filterOoo: 'Filtrar...',
    searchOoo: 'Buscar...',
    selectAll: 'Seleccionar todo',
    equals: 'Igual',
    notEqual: 'Diferente',
    lessThan: 'Menor que',
    greaterThan: 'Mayor que',
    contains: 'Contiene',
    notContains: 'No contiene',
    startsWith: 'Comienza con',
    endsWith: 'Termina con'
  };

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

    this.themeSub = this.themeService.theme$.subscribe(theme => {
      this.gridTheme = theme === 'dark' ? this.darkGridTheme : this.lightGridTheme;
      this.cdr.detectChanges();
    });

    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.themeSub?.unsubscribe();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  // Grid Ready handlers
  onAttendanceGridReady(params: GridReadyEvent): void {
    this.attendanceGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  onWeeklyGridReady(params: GridReadyEvent): void {
    this.weeklyGridApi = params.api;
    params.api.sizeColumnsToFit();
  }

  // Load Attendance Data
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
          if (this.attendanceGridApi) {
            setTimeout(() => this.attendanceGridApi.sizeColumnsToFit(), 100);
          }
        }

        this.isLoadingAttendance = false;
      },
      error: (_err: unknown) => {
        this.isLoadingAttendance = false;
        if (!silent) this.toastService.error('Error de conexión');
      }
    });
  }

  // Load Weekly Data
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
          if (this.weeklyGridApi) {
            setTimeout(() => this.weeklyGridApi.sizeColumnsToFit(), 100);
          }
        }

        this.isLoadingWeekly = false;
      },
      error: (_err: unknown) => {
        this.isLoadingWeekly = false;
        if (!silent) this.toastService.error('Error al cargar datos semanales');
      }
    });
  }

  // Stats
  private updateStats(rows: AttendanceRecord[]): void {
    const today = new Date().toISOString().split('T')[0];
    const todayRows = rows.filter(r => r.fecha === today);
    this.registrosHoy = todayRows.length;
    this.sinSalida = todayRows.filter(r => !r.hora_salida).length;

    const uniqueNames = new Set(rows.map(r => r.nombre));
    this.totalEmpleados = uniqueNames.size;
  }

  // Filter actions
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

  // Export
  exportAttendance(): void {
    if (this.attendanceGridApi) {
      this.attendanceGridApi.exportDataAsCsv({
        fileName: `asistencia_${new Date().toISOString().split('T')[0]}.csv`
      });
      this.toastService.success('Archivo exportado correctamente');
    }
  }

  exportWeekly(): void {
    if (this.weeklyGridApi) {
      this.weeklyGridApi.exportDataAsCsv({
        fileName: `horas_semanales_${new Date().toISOString().split('T')[0]}.csv`
      });
      this.toastService.success('Archivo exportado correctamente');
    }
  }

  // Auto-refresh
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

  // Handle grid resize
  onGridSizeChanged(params: GridSizeChangedEvent): void {
    params.api.sizeColumnsToFit();
  }

  // Today max for date inputs
  get todayMax(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Enter key handler
  onAttendanceKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.filterAttendance();
  }

  onWeeklyKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.filterWeekly();
  }

  // Tabs Logic
  setTab(tab: 'registros' | 'semanales' | 'empleados'): void {
    this.activeTab = tab;
    if (tab === 'empleados') {
       // Carga instantánea usando estado en memoria si ya existen
       if (this.empleados.length > 0) {
         this.loadEmpleados(true); // actualiza debajo del cajón (silencioso)
       } else {
         this.loadEmpleados(false);
       }
    } else {
       // Timeout para que el DOM muestre el grid antes de redimensionar
       setTimeout(() => {
          if (tab === 'registros' && this.attendanceGridApi) this.attendanceGridApi.sizeColumnsToFit();
          if (tab === 'semanales' && this.weeklyGridApi) this.weeklyGridApi.sizeColumnsToFit();
       }, 50);
    }
  }

  // Empleados Management Logic
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
          
          // Actualización optimista de la tabla al instante:
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
    if (!confirm('¿Seguro que deseas eliminar a este empleado?')) return;
    
    this.empleadoService.deleteEmpleado(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success('Empleado eliminado');
          this.loadEmpleados();
        } else {
          this.toastService.error('Error al eliminar');
        }
      },
      error: () => {
        this.toastService.error('Error del servidor');
      }
    });
  }
}
