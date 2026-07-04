import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  template: `<p class="muted" style="padding: 2rem;">Cargando...</p>`,
})
export class Home implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    const role = this.auth.user()?.role;
    this.router.navigate([role === 'docente' ? '/docente' : '/estudiante']);
  }
}
