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
  // "opciones": alternativas de opción múltiple, se autocorrigen.
  // "abierta": el alumno escribe texto y/o adjunta un archivo; el docente la califica manualmente.
  modoRespuesta: z.enum(['opciones', 'abierta']).default('opciones'),
  enunciado: z.string().trim().min(1).max(LIMITE_ENUNCIADO),
  opciones: z.array(optionSchema).max(5).optional(),
  explicacion: z.string().trim().max(LIMITE_TEORIA).optional().nullable(),
  esModelo: z.boolean().default(false),
});

function validarOpcionesSegunModo(q: z.infer<typeof questionBaseSchema>, ctx: z.RefinementCtx) {
  if (q.modoRespuesta !== 'opciones') return;
  if (!q.opciones || q.opciones.length < 4 || q.opciones.length > 5) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debes indicar entre 4 y 5 alternativas.', path: ['opciones'] });
    return;
  }
  if (!q.opciones.some((o) => o.esCorrecta)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Debe haber al menos una alternativa correcta.', path: ['opciones'] });
  }
}

export const questionSchema = questionBaseSchema.superRefine(validarOpcionesSegunModo);

export const questionUpdateSchema = questionBaseSchema.partial().superRefine((q, ctx) => {
  if (q.modoRespuesta === undefined) return;
  validarOpcionesSegunModo(q as z.infer<typeof questionBaseSchema>, ctx);
});

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
