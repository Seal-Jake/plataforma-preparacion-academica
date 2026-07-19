import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  danger: boolean;
  confirmLabel: string;
}

// Reemplaza confirm() nativo del navegador (bloquea la automatización, se ve
// anticuado y no respeta el estilo de la plataforma) por un modal propio.
// Cualquier componente inyecta este servicio y hace:
//   if (!(await this.confirmSvc.confirm('¿Seguro?'))) return;
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  request = signal<ConfirmRequest | null>(null);
  private resolver: ((value: boolean) => void) | null = null;

  confirm(message: string, options?: { title?: string; danger?: boolean; confirmLabel?: string }): Promise<boolean> {
    this.request.set({
      message,
      title: options?.title ?? 'Confirmar acción',
      danger: options?.danger ?? true,
      confirmLabel: options?.confirmLabel ?? 'Confirmar',
    });
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(value: boolean) {
    this.resolver?.(value);
    this.resolver = null;
    this.request.set(null);
  }
}
