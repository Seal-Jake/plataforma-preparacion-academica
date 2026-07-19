import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'error' | 'success';
}

// Notificaciones globales (esquina de la pantalla) para que ninguna acción
// falle en silencio: el interceptor de errores HTTP las dispara automáticamente,
// y cualquier componente puede llamar success() para confirmaciones puntuales.
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  messages = signal<ToastMessage[]>([]);

  error(text: string) {
    this.push(text, 'error');
  }

  success(text: string) {
    this.push(text, 'success');
  }

  dismiss(id: number) {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== id));
  }

  private push(text: string, type: ToastMessage['type']) {
    const id = this.nextId++;
    this.messages.update((msgs) => [...msgs, { id, text, type }]);
    setTimeout(() => this.dismiss(id), 6000);
  }
}
