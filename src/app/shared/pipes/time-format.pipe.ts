import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeFormat',
  standalone: true
})
export class TimeFormatPipe implements PipeTransform {
  transform(totalMinutes: number | null | undefined, format: 'hhmm' | 'readable' = 'readable'): string {
    if (totalMinutes === null || totalMinutes === undefined || totalMinutes <= 0) {
      return format === 'hhmm' ? '0:00' : '0 horas con 0 minutos';
    }

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const mm = m.toString().padStart(2, '0');

    if (format === 'hhmm') {
      return `${h}:${mm}`;
    }

    const horasTexto = h === 1 ? '1 hora' : `${h} horas`;
    const minutosTexto = m === 1 ? '1 minuto' : `${m} minutos`;
    return `${h}:${mm} (${horasTexto} con ${minutosTexto})`;
  }
}
