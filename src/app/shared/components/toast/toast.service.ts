import { Injectable } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts: ToastMessage[] = [];
  private counter = 0;

  show(text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 4000): void {
    const id = ++this.counter;
    this.toasts.push({ id, text, type });

    setTimeout(() => this.remove(id), duration);
  }

  success(text: string, duration = 4000): void {
    this.show(text, 'success', duration);
  }

  error(text: string, duration = 5000): void {
    this.show(text, 'error', duration);
  }

  warning(text: string, duration = 4000): void {
    this.show(text, 'warning', duration);
  }

  remove(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }
}
