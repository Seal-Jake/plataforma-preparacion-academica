import { AmbitoTarea, ModoTarea, Nivel, Seccion, TipoPregunta, TipoTarea } from '../models/models';

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

// Los 6 tipos de tarea de la plataforma (ver TIPOS_TAREA en el backend,
// server/src/lib/enums.ts). El docente los crea libremente, tantas veces
// como quiera; la nota final del curso promedia todas las instancias de
// cada tipo y pondera ese promedio con el peso fijo (ver rubric.data.ts).
export interface TipoTareaDef {
  tipo: TipoTarea;
  nombre: string;
  ayuda: string;
  ambito: AmbitoTarea;
  modo: ModoTarea;
  peso: number;
}

export const TIPOS_TAREA: TipoTareaDef[] = [
  {
    tipo: 'tpa',
    nombre: 'Tarea de Participación Activa',
    ayuda: 'El alumno sube evidencia de una actividad en clase. Al activarla, la fecha límite se fija automáticamente 120 horas después.',
    ambito: 'tema',
    modo: 'entrega',
    peso: 15,
  },
  {
    tipo: 'practica_calificada',
    nombre: 'Práctica Calificada',
    ayuda: 'Preguntas del banco de este tema que el alumno responde y se autocalifican.',
    ambito: 'tema',
    modo: 'examen',
    peso: 15,
  },
  {
    tipo: 'examen_unidad',
    nombre: 'Examen de Unidad',
    ayuda: 'Examen con preguntas de cualquier tema de esta unidad. Actívalo cuando quieras que los alumnos puedan rendirlo.',
    ambito: 'unidad',
    modo: 'examen',
    peso: 15,
  },
  {
    tipo: 'examen_final',
    nombre: 'Examen Final',
    ayuda: 'Examen final con preguntas de cualquier tema del curso.',
    ambito: 'curso',
    modo: 'examen',
    peso: 20,
  },
  {
    tipo: 'investigacion_unidad',
    nombre: 'Investigación de Unidad',
    ayuda: 'El alumno entrega una investigación de la unidad; tú la calificas manualmente.',
    ambito: 'unidad',
    modo: 'entrega',
    peso: 15,
  },
  {
    tipo: 'investigacion_final',
    nombre: 'Investigación Final',
    ayuda: 'El alumno entrega la investigación final del curso; tú la calificas manualmente.',
    ambito: 'curso',
    modo: 'entrega',
    peso: 20,
  },
];

const TIPOS_TAREA_POR_ID: Record<string, TipoTareaDef> = Object.fromEntries(TIPOS_TAREA.map((t) => [t.tipo, t]));

export function tiposTareaDeAmbito(ambito: AmbitoTarea): TipoTareaDef[] {
  return TIPOS_TAREA.filter((t) => t.ambito === ambito);
}

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
  return TIPOS_TAREA_POR_ID[v]?.nombre ?? v;
}

export function ayudaTipoSesionFijo(v: string): string {
  return TIPOS_TAREA_POR_ID[v]?.ayuda ?? '';
}

export function esSesionDeEvidencia(v: string): boolean {
  return TIPOS_TAREA_POR_ID[v]?.modo === 'entrega';
}

export function etiquetaCantidadPreguntas(n: number): string {
  return n === 1 ? '1 pregunta' : `${n} preguntas`;
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
