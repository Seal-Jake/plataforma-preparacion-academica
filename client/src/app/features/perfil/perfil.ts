import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { Acento, Densidad, PreferencesService, TamanoTexto } from '../../core/services/preferences.service';
import { ThemePreference } from '../../core/models/models';
import { Icon } from '../../shared/components/icon/icon';

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, FormsModule, Icon],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil implements OnInit {
  private profileSvc = inject(ProfileService);
  protected auth = inject(AuthService);
  protected prefs = inject(PreferencesService);
  private fb = inject(FormBuilder);

  guardando = signal(false);
  guardado = signal(false);
  avatarSeleccionado: File | null = null;

  passwordError = signal<string | null>(null);
  passwordGuardada = signal(false);

  perfilForm = this.fb.group({
    name: ['', Validators.required],
    themePreference: ['dark' as ThemePreference, Validators.required],
    notificationsEnabled: [true],
  });

  passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit() {
    this.profileSvc.get().subscribe((p) => {
      this.perfilForm.reset({
        name: p.name,
        themePreference: p.themePreference || 'dark',
        notificationsEnabled: p.notificationsEnabled ?? true,
      });
    });
  }

  guardarPerfil() {
    if (this.perfilForm.invalid) return;
    this.guardando.set(true);
    const value = this.perfilForm.getRawValue() as {
      name: string;
      themePreference: ThemePreference;
      notificationsEnabled: boolean;
    };
    this.profileSvc.update(value).subscribe((p) => {
      this.guardando.set(false);
      this.guardado.set(true);
      this.auth.patchLocalUser(p);
      setTimeout(() => this.guardado.set(false), 2000);
    });
  }

  onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.avatarSeleccionado = input.files?.[0] ?? null;
    if (this.avatarSeleccionado) {
      this.profileSvc.uploadAvatar(this.avatarSeleccionado).subscribe((p) => this.auth.patchLocalUser(p));
    }
  }

  cambiarPassword() {
    if (this.passwordForm.invalid) return;
    this.passwordError.set(null);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.profileSvc.changePassword(currentPassword!, newPassword!).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.passwordGuardada.set(true);
        setTimeout(() => this.passwordGuardada.set(false), 2000);
      },
      error: (err: HttpErrorResponse) => {
        this.passwordError.set(err.error?.error || 'No se pudo cambiar la contraseña.');
      },
    });
  }

  // Preferencias de interfaz: se aplican al instante (sin botón "Guardar"),
  // ya que solo afectan a este dispositivo y no hay nada que perder si el
  // usuario cambia de opinión — probar un acento no debería sentirse como
  // un compromiso.
  setAcento(acento: Acento) {
    this.prefs.update({ acento });
  }

  setTamanoTexto(tamanoTexto: TamanoTexto) {
    this.prefs.update({ tamanoTexto });
  }

  setDensidad(densidad: Densidad) {
    this.prefs.update({ densidad });
  }

  toggleReducirAnimaciones(valor: boolean) {
    this.prefs.update({ reducirAnimaciones: valor });
  }

  toggleDocenteAutoAbrirPlanilla(valor: boolean) {
    this.prefs.update({ docenteAutoAbrirPlanilla: valor });
  }

  toggleAlumnoSoloVencidas(valor: boolean) {
    this.prefs.update({ alumnoSoloVencidas: valor });
  }
}
