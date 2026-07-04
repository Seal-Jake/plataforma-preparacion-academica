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

export const TIPOS_SESION = ['participacion', 'tarea', 'practica_calificada', 'examen_final'] as const;
export type TipoSesion = (typeof TIPOS_SESION)[number];

export const MIN_QUESTIONS_PER_TOPIC = 50;

export const TIPOS_EVALUACION = [
  'examen',
  'participacion_clase',
  'participacion_activa',
  'entrega',
  'generica',
] as const;
export type TipoEvaluacion = (typeof TIPOS_EVALUACION)[number];

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
