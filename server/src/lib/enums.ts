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

// Tipos de tarea de la plataforma. A diferencia del modelo anterior (una
// sesión fija por tema/unidad/curso, creada automáticamente), el docente
// ahora crea libremente tantas tareas de cada tipo como quiera, en el
// ámbito que le corresponde a ese tipo. La nota final del curso promedia
// TODAS las instancias de cada tipo (sin importar en qué tema/unidad estén)
// y pondera ese promedio con el peso fijo del tipo — ver calcularRubricaCurso.
export type AmbitoTarea = 'tema' | 'unidad' | 'curso';
// 'examen': el alumno responde preguntas, se autocalifica al instante.
// 'entrega': el alumno escribe texto y/o sube un archivo; el docente califica
// manualmente. En ambos casos el docente puede sobreescribir la nota a mano
// en cualquier momento, haya o no haya algo entregado.
export type ModoTarea = 'examen' | 'entrega';

export interface TipoTareaDef {
  tipo: string;
  nombre: string;
  ambito: AmbitoTarea;
  modo: ModoTarea;
  peso: number; // % en la nota final del curso — TIPOS_TAREA suma exactamente 100.
  duracionHoras?: number; // si se define, al abrir la tarea se fija la fecha límite automáticamente a esta duración desde ese momento (si no tenía una ya puesta).
}

export const TIPOS_TAREA: TipoTareaDef[] = [
  { tipo: 'tpa', nombre: 'Tarea de Participación Activa', ambito: 'tema', modo: 'entrega', peso: 15, duracionHoras: 120 },
  { tipo: 'practica_calificada', nombre: 'Práctica Calificada', ambito: 'tema', modo: 'examen', peso: 15 },
  { tipo: 'examen_unidad', nombre: 'Examen de Unidad', ambito: 'unidad', modo: 'examen', peso: 15 },
  { tipo: 'examen_final', nombre: 'Examen Final', ambito: 'curso', modo: 'examen', peso: 20 },
  { tipo: 'investigacion_unidad', nombre: 'Investigación de Unidad', ambito: 'unidad', modo: 'entrega', peso: 15 },
  { tipo: 'investigacion_final', nombre: 'Investigación Final', ambito: 'curso', modo: 'entrega', peso: 20 },
];

export const TIPOS_TAREA_POR_ID: Record<string, TipoTareaDef> = Object.fromEntries(
  TIPOS_TAREA.map((t) => [t.tipo, t])
);

export const TIPO_TAREA_IDS = TIPOS_TAREA.map((t) => t.tipo) as [string, ...string[]];

// Migración desde el modelo anterior (sesiones fijas): cada tipo viejo se
// reasigna a su equivalente nuevo más cercano, sin perder ningún dato ya
// calificado. "participacion_clase" y "practica" se fusionan en
// "practica_calificada" (ambas eran tareas rápidas de tema con preguntas):
// si un tema ya tenía las dos, simplemente pasa a tener dos tareas de tipo
// "Práctica Calificada" en vez de una de cada — el nuevo modelo lo permite.
export const MIGRACION_TIPOS_TAREA: Record<string, string> = {
  participacion_clase: 'practica_calificada',
  practica: 'practica_calificada',
  participacion_activa: 'tpa',
  proyecto_unidad: 'investigacion_unidad',
  examen_unidad: 'examen_unidad',
  proyecto_final_curso: 'investigacion_final',
  examen_final_curso: 'examen_final',
};

export interface CarpetaFija {
  tipoFijo: string;
  nombre: string;
  children?: CarpetaFija[];
}

// Las 4 carpetas raíz que se crean automáticamente en todo tema nuevo, cada
// una con su propio árbol de subcarpetas fijas (ninguna se puede renombrar,
// mover ni eliminar; el docente solo agrega subcarpetas libres dentro).
export const CARPETAS_FIJAS: CarpetaFija[] = [
  { tipoFijo: 'concepto_teoria', nombre: 'Conceptos y Marco Teórico' },
  { tipoFijo: 'mecanica_ejemplos', nombre: 'Mecánica y Ejemplos' },
  {
    tipoFijo: 'actividad_practica',
    nombre: 'Actividad Práctica',
    children: [
      { tipoFijo: 'nivel_basico', nombre: 'Nivel Básico' },
      { tipoFijo: 'nivel_estandar', nombre: 'Nivel Estándar' },
      { tipoFijo: 'nivel_intermedio', nombre: 'Nivel Intermedio' },
      { tipoFijo: 'nivel_deco', nombre: 'Nivel DECO' },
      { tipoFijo: 'nivel_admision', nombre: 'Nivel Modelo de Admisión' },
      { tipoFijo: 'retos_rm', nombre: 'Retos y R.M.' },
    ],
  },
  {
    tipoFijo: 'aplicacion_economia',
    nombre: 'Economía Aplicada',
    children: [
      { tipoFijo: 'fundamentos_aplicaciones', nombre: 'Fundamentos y Aplicaciones' },
      { tipoFijo: 'modelos_demostraciones', nombre: 'Modelos y Demostraciones' },
      {
        tipoFijo: 'analisis_propuesta_solucion',
        nombre: 'Análisis, Propuesta y Solución',
        children: [
          { tipoFijo: 'estructura_clasica', nombre: 'Estructura Clásica' },
          { tipoFijo: 'casos_reales', nombre: 'Casos Reales' },
          { tipoFijo: 'analisis_solucion', nombre: 'Análisis y Solución' },
        ],
      },
    ],
  },
];
