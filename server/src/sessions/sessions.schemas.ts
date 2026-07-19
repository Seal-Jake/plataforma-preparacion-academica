import { z } from 'zod';
import { LIMITE_INVESTIGACION, LIMITE_TEXTO_CORTO } from '../lib/textLimits';
import { TIPO_TAREA_IDS } from '../lib/enums';

// El docente crea libremente tantas tareas de cada tipo como quiera. El
// ámbito (courseId/unitId/topicId) se valida en la ruta según a qué nivel
// pertenece ese tipo de tarea (ver TIPOS_TAREA_POR_ID).
export const crearTareaSchema = z.object({
  tipo: z.enum(TIPO_TAREA_IDS),
  courseId: z.string().min(1).optional(),
  unitId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  dueDate: z.coerce.date().optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
});

export const sessionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO).optional(),
  questionIds: z.array(z.string().min(1)).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
});

export const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).min(1).max(5),
});

// Preguntas de modoRespuesta="abierta": el alumno escribe texto y/o adjunta
// un archivo (llega por separado como multipart, ver uploadDocument).
export const answerAbiertaSchema = z.object({
  questionId: z.string().min(1),
  respuestaTexto: z.string().trim().max(LIMITE_INVESTIGACION).optional(),
});

// El docente califica manualmente una respuesta abierta (0-20, igual que una entrega).
export const calificarAttemptSchema = z.object({
  studentId: z.string().min(1),
  nota: z.number().min(0).max(20),
});

export const toggleAperturaSchema = z.object({
  abiertoParaTodos: z.boolean(),
});

// El docente reabre el intento de un alumno: borra su estado e intentos de
// esta sesión para que pueda rendirla de nuevo desde cero.
export const reabrirSesionSchema = z.object({
  studentId: z.string().min(1),
});
