import { z } from 'zod';
import { LIMITE_TEXTO_CORTO } from '../lib/textLimits';

// Las sesiones ya no se crean libremente: cada tema/unidad/curso recibe
// automáticamente sus sesiones fijas (ver TIPOS_SESION_FIJOS). El docente
// solo las configura: qué preguntas lleva, fecha límite, tiempo, evidencia.
export const sessionUpdateSchema = z.object({
  title: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO).optional(),
  questionIds: z.array(z.string().min(1)).optional(),
  dueDate: z.coerce.date().optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
  requiereEvidencia: z.boolean().optional(),
  pesoAciertos: z.number().min(0).max(100).optional(),
  pesoEvidencia: z.number().min(0).max(100).optional(),
});

export const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).min(1).max(5),
});

export const toggleAperturaSchema = z.object({
  abiertoParaTodos: z.boolean(),
});
