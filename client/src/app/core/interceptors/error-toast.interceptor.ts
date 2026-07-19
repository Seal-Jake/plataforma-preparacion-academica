import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

// Ninguna petición debe fallar en silencio: si el backend responde con un
// error, se muestra su mensaje (ya en español y pensado para el usuario,
// ver server/src/lib/errors.ts) como notificación. Se excluyen /auth/login
// y /auth/me porque ya manejan su propio error inline o son chequeos
// silenciosos de sesión al cargar la app.
export const errorToastInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const esRutaSilenciosa = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/me');
      if (error instanceof HttpErrorResponse && !esRutaSilenciosa) {
        const mensaje = error.error?.error || 'Ocurrió un error inesperado. Intenta nuevamente.';
        toast.error(mensaje);
      }
      return throwError(() => error);
    })
  );
};
