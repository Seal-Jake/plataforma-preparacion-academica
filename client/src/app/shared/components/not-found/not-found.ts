import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <div class="card" style="max-width: 480px; margin: 3rem auto; text-align: center;">
      <h1>404</h1>
      <p class="muted">La página que buscas no existe o fue movida.</p>
      <a routerLink="/">Volver al inicio</a>
    </div>
  `,
})
export class NotFound {}
