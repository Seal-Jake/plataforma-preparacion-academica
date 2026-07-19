import { Injectable, signal } from '@angular/core';

export type Acento = 'azul' | 'magenta' | 'violeta' | 'cian';
export type TamanoTexto = 'normal' | 'grande';
export type Densidad = 'comoda' | 'compacta';

export interface Preferencias {
  acento: Acento;
  tamanoTexto: TamanoTexto;
  densidad: Densidad;
  reducirAnimaciones: boolean;
  // Específicas de rol: se guardan todas en el mismo objeto (más simple),
  // pero solo el rol correspondiente las lee/muestra en Perfil.
  docenteAutoAbrirPlanilla: boolean;
  alumnoSoloVencidas: boolean;
}

const DEFAULTS: Preferencias = {
  acento: 'azul',
  tamanoTexto: 'normal',
  densidad: 'comoda',
  reducirAnimaciones: false,
  docenteAutoAbrirPlanilla: false,
  alumnoSoloVencidas: false,
};

const STORAGE_KEY = 'preferencias-interfaz';

// Preferencias puramente de interfaz (no de negocio): viven en localStorage,
// no en la base de datos. A diferencia de themePreference/notificationsEnabled
// (que sí son del usuario y viajan con su cuenta), esto es solo "cómo se ve
// y se siente la app en este dispositivo" — no justifica una migración de
// esquema ni sincronización entre dispositivos.
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private _prefs = signal<Preferencias>(this.cargar());
  prefs = this._prefs.asReadonly();

  private cargar(): Preferencias {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  update(cambios: Partial<Preferencias>) {
    const next = { ...this._prefs(), ...cambios };
    this._prefs.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // almacenamiento no disponible (modo privado, cuota llena, etc.): la
      // preferencia sigue aplicada en memoria para esta sesión, solo no persiste
    }
  }
}
