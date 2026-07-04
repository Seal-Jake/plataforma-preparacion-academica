import { Nivel, Seccion, TipoEvaluacion, TipoPregunta } from '../models/models';

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

const TIPO_EVALUACION_LABELS: Record<TipoEvaluacion, string> = {
  examen: 'Examen',
  participacion_clase: 'Participación en Clase',
  participacion_activa: 'Participación Activa',
  entrega: 'Entrega / Proyecto',
  generica: 'Genérica',
};

const TIPO_EVALUACION_AYUDA: Record<TipoEvaluacion, string> = {
  examen: 'Preguntas con corrección automática. Puede tener temporizador, activación manual y pedir evidencia además de las respuestas.',
  participacion_clase: 'Preguntas rápidas que el docente elige directamente del banco de un tema.',
  participacion_activa: 'El alumno sube una foto o archivo como evidencia de una actividad en clase.',
  entrega: 'El alumno entrega texto y/o un archivo (ensayo, proyecto, tarea); el docente lo califica manualmente.',
  generica: 'Cualquier otro tipo de evaluación con preguntas o entrega, sin comportamiento especial.',
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

export function etiquetaTipoEvaluacion(v: string): string {
  return TIPO_EVALUACION_LABELS[v as TipoEvaluacion] ?? v;
}

export function ayudaTipoEvaluacion(v: string): string {
  return TIPO_EVALUACION_AYUDA[v as TipoEvaluacion] ?? '';
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
export const TIPOS_EVALUACION_OPCIONES = Object.entries(TIPO_EVALUACION_LABELS) as [TipoEvaluacion, string][];
