import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-toast',
  imports: [Icon],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
})
export class Toast {
  toastSvc = inject(ToastService);
}
