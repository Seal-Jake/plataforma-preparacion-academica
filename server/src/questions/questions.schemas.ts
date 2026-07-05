import { z } from 'zod';
import { NIVELES, SECCIONES, TIPOS_PREGUNTA } from '../lib/enums';
import { LIMITE_ENUNCIADO, LIMITE_TEORIA, LIMITE_TEXTO_CORTO } from '../lib/textLimits';

const optionSchema = z.object({
  texto: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  esCorrecta: z.boolean().default(false),
});

// section/nivel/tipo ya no los elige el docente al crear una pregunta (se
// simplificó a un módulo pequeño por sesión): quedan con un valor por
// defecto interno, solo relevante para el selector de preguntas de Examen
// de Unidad / Examen Final (que sí muestra un badge de nivel).
const questionBaseSchema = z.object({
  topicId: z.string().min(1),
  section: z.enum(SECCIONES).default('matematica'),
  nivel: z.enum(NIVELES).default('basico'),
  tipo: z.enum(TIPOS_PREGUNTA).default('operaciones'),
  enunciado: z.string().trim().min(1).max(LIMITE_ENUNCIADO),
  opciones: z.array(optionSchema).min(4).max(5),
  explicacion: z.string().trim().max(LIMITE_TEORIA).optional().nullable(),
  esModelo: z.boolean().default(false),
});

export const questionSchema = questionBaseSchema.refine((q) => q.opciones.some((o) => o.esCorrecta), {
  message: 'Debe haber al menos una alternativa correcta.',
  path: ['opciones'],
});

export const questionUpdateSchema = questionBaseSchema.partial().refine(
  (q) => !q.opciones || q.opciones.some((o) => o.esCorrecta),
  { message: 'Debe haber al menos una alternativa correcta.', path: ['opciones'] }
);

// Se filtra por topicId (todas las preguntas de un tema, usado por el
// selector de Examen de Unidad / Examen Final) o por sessionId (solo las
// preguntas ya asignadas a esa sesión puntual, usado por el módulo pequeño
// de Participación en Clase / Práctica dentro de cada tema).
export const questionFilterSchema = z
  .object({
    topicId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
    nivel: z.enum(NIVELES).optional(),
    tipo: z.enum(TIPOS_PREGUNTA).optional(),
    section: z.enum(SECCIONES).optional(),
    q: z.string().trim().max(LIMITE_ENUNCIADO).optional(),
  })
  .refine((f) => !!f.topicId || !!f.sessionId, { message: 'Debes indicar topicId o sessionId.' });
