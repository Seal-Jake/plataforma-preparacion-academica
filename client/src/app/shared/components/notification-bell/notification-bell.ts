import { Component, ElementRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsService } from '../../../core/services/notifications.service';
import { AuthService } from '../../../core/services/auth.service';
import { Icon } from '../icon/icon';
import { NotificationItem } from '../../../core/models/models';

// Campana de notificaciones calculada en vivo (fechas límite próximas,
// tareas vencidas, entregas por calificar) — sin tabla de notificaciones
// persistente, ver server/src/notifications/notifications.routes.ts. Solo se
// muestra si el usuario tiene notificationsEnabled activado en su perfil.
@Component({
  selector: 'app-notification-bell',
  imports: [Icon],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.css',
})
export class NotificationBell implements OnInit {
  private notificationsSvc = inject(NotificationsService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  protected auth = inject(AuthService);

  items = signal<NotificationItem[]>([]);
  open = signal(false);

  ngOnInit() {
    if (this.auth.user()?.notificationsEnabled !== false) this.reload();
  }

  reload() {
    this.notificationsSvc.get().subscribe((r) => this.items.set(r.items));
  }

  toggle() {
    const abriendo = !this.open();
    this.open.set(abriendo);
    if (abriendo) this.reload();
  }

  ir(item: NotificationItem) {
    this.open.set(false);
    this.router.navigate(item.link);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open() && !this.elementRef.nativeElement.contains(event.target)) {
      this.open.set(false);
    }
  }
}
