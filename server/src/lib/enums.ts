export const ROLES = ['docente', 'estudiante'] as const;
export type Role = (typeof ROLES)[number];

export const SECCIONES = ['matematica', 'economia_aplicada'] as const;
export type Seccion = (typeof SECCIONES)[number];

export const NIVELES = ['basico', 'estandar', 'deco', 'admision', 'retos'] as const;
export type Nivel = (typeof NIVELES)[number];

export const TIPOS_PREGUNTA = [
  'operaciones',
  'enunciado',
  'problema_lectura',
  'interpretacion_grafica',
  'proposicion_vf',
] as const;
export type TipoPregunta = (typeof TIPOS_PREGUNTA)[number];

export const MIN_QUESTIONS_PER_TOPIC = 50;

// Rúbrica fija de la plataforma (ya no configurable por el docente).
// Cada tema/unidad/curso recibe automáticamente las sesiones fijas que le
// corresponden a su nivel, y la nota final se calcula con los pesos de
// PESOS_UNIDAD / PESOS_CURSO más abajo.
export type NivelSesionFijo = 'tema' | 'unidad' | 'curso';
export type ModoSesionFijo = 'examen' | 'evidencia';

export interface TipoSesionFijoDef {
  tipoFijo: string;
  nombre: string;
  nivel: NivelSesionFijo;
  modo: ModoSesionFijo;
  preguntasObjetivo?: number;
  duracionHoras?: number;
}

export const TIPOS_SESION_FIJOS: TipoSesionFijoDef[] = [
  { tipoFijo: 'participacion_clase', nombre: 'Participación en Clase', nivel: 'tema', modo: 'examen', preguntasObjetivo: 10 },
  { tipoFijo: 'practica', nombre: 'Práctica', nivel: 'tema', modo: 'examen', preguntasObjetivo: 5 },
  { tipoFijo: 'participacion_activa', nombre: 'Participación Activa', nivel: 'tema', modo: 'evidencia', duracionHoras: 120 },
  { tipoFijo: 'examen_unidad', nombre: 'Examen de Unidad', nivel: 'unidad', modo: 'examen', preguntasObjetivo: 20 },
  { tipoFijo: 'proyecto_unidad', nombre: 'Proyecto de Investigación de Unidad', nivel: 'unidad', modo: 'evidencia' },
  { tipoFijo: 'examen_final_curso', nombre: 'Examen Final del Curso', nivel: 'curso', modo: 'examen', preguntasObjetivo: 20 },
  { tipoFijo: 'proyecto_final_curso', nombre: 'Proyecto de Investigación Final', nivel: 'curso', modo: 'evidencia' },
];

export const TIPOS_SESION_FIJOS_POR_ID: Record<string, TipoSesionFijoDef> = Object.fromEntries(
  TIPOS_SESION_FIJOS.map((t) => [t.tipoFijo, t])
);

export const TIPO_SESION_FIJO_IDS = TIPOS_SESION_FIJOS.map((t) => t.tipoFijo) as [string, ...string[]];

// Peso (%) de cada componente en la nota final de una UNIDAD.
export const PESOS_UNIDAD: Record<string, number> = {
  examen_unidad: 20,
  proyecto_unidad: 20,
  practica: 20,
  participacion_clase: 20,
  participacion_activa: 20,
};

// Peso (%) de cada componente en la nota final del CURSO.
// Nota: practica/participacion_clase/participacion_activa se promedian sobre
// TODOS los temas del curso; proyecto_unidad/examen_unidad se promedian
// sobre todas las unidades del curso.
export const PESOS_CURSO: Record<string, number> = {
  examen_final_curso: 20,
  proyecto_final_curso: 20,
  practica: 10,
  proyecto_unidad: 15,
  examen_unidad: 15,
  participacion_clase: 10,
  participacion_activa: 10,
};

export interface CarpetaFija {
  tipoFijo: string;
  nombre: string;
}

// Las 4 carpetas raíz que se crean automáticamente en todo tema nuevo.
export const CARPETAS_FIJAS: CarpetaFija[] = [
  { tipoFijo: 'concepto_teoria', nombre: 'Concepto y Marco Teórico' },
  { tipoFijo: 'mecanica_ejemplos', nombre: 'Mecánica y Ejemplos' },
  { tipoFijo: 'actividad_practica', nombre: 'Actividad Práctica' },
  { tipoFijo: 'aplicacion_economia', nombre: 'Aplicación a la Economía y Administración' },
];
