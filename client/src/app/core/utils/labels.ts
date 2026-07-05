import { Nivel, Seccion, TipoPregunta, TipoSesionFijo } from '../models/models';

// Traduce los valores internos (usados en la base de datos y la API) a
// texto natural en español para mostrar en la interfaz. Los <select> siguen
// guardando el valor interno; solo cambia lo que el usuario lee.

const NIVEL_LABELS: Record<Nivel, string> = {
  basico: 'Básico',
  estandar: 'Estándar',
  deco: 'DECO',
  admision: 'Admisión',
  retos: 'Retos',
};

const SECCION_LABELS: Record<Seccion, string> = {
  matematica: 'Matemática',
  economia_aplicada: 'Economía Aplicada',
};

const TIPO_PREGUNTA_LABELS: Record<TipoPregunta, string> = {
  operaciones: 'Operaciones',
  enunciado: 'Enunciado',
  problema_lectura: 'Problema de Lectura',
  interpretacion_grafica: 'Interpretación Gráfica',
  proposicion_vf: 'Verdadero / Falso',
};

// La rúbrica es fija en toda la plataforma (ver TIPOS_SESION_FIJOS en el
// backend, server/src/lib/enums.ts): estas 7 sesiones existen siempre,
// automáticamente, en cada tema/unidad/curso. El docente ya no crea
// categorías, solo las configura (preguntas, fecha límite, evidencia).
const TIPO_SESION_FIJO_LABELS: Record<TipoSesionFijo, string> = {
  participacion_clase: 'Participación en Clase',
  practica: 'Práctica',
  participacion_activa: 'Participación Activa',
  examen_unidad: 'Examen de Unidad',
  proyecto_unidad: 'Proyecto de Investigación de Unidad',
  examen_final_curso: 'Examen Final del Curso',
  proyecto_final_curso: 'Proyecto de Investigación Final',
};

const TIPO_SESION_FIJO_AYUDA: Record<TipoSesionFijo, string> = {
  participacion_clase: 'Preguntas rápidas del banco de este tema (objetivo: 10 preguntas).',
  practica: 'Ejercicios de práctica de este tema (objetivo: 5 preguntas).',
  participacion_activa: 'El alumno sube evidencia de una actividad en clase. Al activarla, la fecha límite se fija automáticamente 120 horas después.',
  examen_unidad: 'Examen con preguntas de cualquier tema de esta unidad (objetivo: 20 preguntas). Actívalo cuando quieras que los alumnos puedan rendirlo.',
  proyecto_unidad: 'El alumno entrega un proyecto de investigación de la unidad; tú lo calificas manualmente.',
  examen_final_curso: 'Examen final con preguntas de cualquier tema del curso (objetivo: 20 preguntas).',
  proyecto_final_curso: 'El alumno entrega el proyecto de investigación final del curso; tú lo calificas manualmente.',
};

export function etiquetaNivel(v: string): string {
  return NIVEL_LABELS[v as Nivel] ?? v;
}

export function etiquetaSeccion(v: string): string {
  return SECCION_LABELS[v as Seccion] ?? v;
}

export function etiquetaTipoPregunta(v: string): string {
  return TIPO_PREGUNTA_LABELS[v as TipoPregunta] ?? v;
}

export function etiquetaTipoSesionFijo(v: string): string {
  return TIPO_SESION_FIJO_LABELS[v as TipoSesionFijo] ?? v;
}

export function ayudaTipoSesionFijo(v: string): string {
  return TIPO_SESION_FIJO_AYUDA[v as TipoSesionFijo] ?? '';
}

export function esSesionDeEvidencia(v: string): boolean {
  return v === 'participacion_activa' || v === 'proyecto_unidad' || v === 'proyecto_final_curso';
}

const ESTADO_SESION_LABELS: Record<string, string> = {
  no_iniciado: 'No iniciado',
  en_curso: 'En curso',
  entregado: 'Entregado',
};

export function etiquetaEstadoSesion(v: string): string {
  return ESTADO_SESION_LABELS[v] ?? v;
}

export const NIVELES_OPCIONES = Object.entries(NIVEL_LABELS) as [Nivel, string][];
export const SECCIONES_OPCIONES = Object.entries(SECCION_LABELS) as [Seccion, string][];
export const TIPOS_PREGUNTA_OPCIONES = Object.entries(TIPO_PREGUNTA_LABELS) as [TipoPregunta, string][];
