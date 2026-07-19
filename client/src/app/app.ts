import { Component, effect, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { Icon } from './shared/components/icon/icon';
import { Toast } from './shared/components/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Icon, Toast],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected auth = inject(AuthService);
  private router = inject(Router);

  menuOpen = signal(false);

  constructor() {
    effect(() => {
      const tema = this.auth.user()?.themePreference ?? 'dark';
      document.body.classList.toggle('theme-light', tema === 'light');
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
