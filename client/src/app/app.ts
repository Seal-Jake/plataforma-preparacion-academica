import { Component, effect, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PreferencesService } from './core/services/preferences.service';
import { Icon } from './shared/components/icon/icon';
import { Toast } from './shared/components/toast/toast';
import { ConfirmDialog } from './shared/components/confirm-dialog/confirm-dialog';

const CLASES_ACENTO = ['accent-azul', 'accent-magenta', 'accent-violeta', 'accent-cian'];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Icon, Toast, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected auth = inject(AuthService);
  private router = inject(Router);
  private prefs = inject(PreferencesService);

  menuOpen = signal(false);

  constructor() {
    effect(() => {
      const tema = this.auth.user()?.themePreference ?? 'dark';
      document.documentElement.classList.toggle('theme-light', tema === 'light');
    });
    // Preferencias de interfaz (estética/comodidad/mecánica): puramente
    // visuales, se aplican como clases en <html> (no <body>) sin pasar por
    // el backend, para que la cascada de custom properties llegue a todo,
    // incluida la propia regla de tamaño de fuente en <html>.
    effect(() => {
      const p = this.prefs.prefs();
      document.documentElement.classList.remove(...CLASES_ACENTO);
      document.documentElement.classList.add(`accent-${p.acento}`);
      document.documentElement.classList.toggle('texto-grande', p.tamanoTexto === 'grande');
      document.documentElement.classList.toggle('densidad-compacta', p.densidad === 'compacta');
      document.documentElement.classList.toggle('reducir-animaciones', p.reducirAnimaciones);
    });
    // Cierra el menú móvil al navegar (incluye el propio clic en un enlace,
    // que ya lo cierra, y también botones "atrás/adelante" del navegador).
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.menuOpen.set(false);
    });
  }

  logout() {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}
