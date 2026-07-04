import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { UserInfo } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<UserInfo | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isDocente = computed(() => this._user()?.role === 'docente');
  readonly isEstudiante = computed(() => this._user()?.role === 'estudiante');

  private meLoaded = false;

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<UserInfo> {
    return this.http
      .post<UserInfo>('/api/auth/login', { email, password })
      .pipe(tap((user) => this._user.set(user)));
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(tap(() => this._user.set(null)));
  }

  loadMe(): Observable<UserInfo> {
    return this.http.get<UserInfo>('/api/auth/me').pipe(tap((user) => this._user.set(user)));
  }

  hasTriedLoadingMe(): boolean {
    return this.meLoaded;
  }

  markMeLoaded() {
    this.meLoaded = true;
  }

  registerEstudiante(name: string, email: string, password: string): Observable<UserInfo> {
    return this.http.post<UserInfo>('/api/auth/register-estudiante', { name, email, password });
  }

  /** Registro público de estudiante: crea la cuenta, la matricula en todos los cursos e inicia sesión. */
  register(name: string, email: string, password: string): Observable<UserInfo> {
    return this.http
      .post<UserInfo>('/api/auth/register', { name, email, password })
      .pipe(tap((user) => this._user.set(user)));
  }

  /** Actualiza localmente el usuario en sesión (p.ej. tras editar el perfil). */
  patchLocalUser(patch: Partial<UserInfo>) {
    const current = this._user();
    if (current) this._user.set({ ...current, ...patch });
  }
}
