import { z } from 'zod';
import { LIMITE_TEXTO_CORTO } from '../lib/textLimits';

export const sessionSchema = z.object({
  unitId: z.string().min(1),
  topicId: z.string().min(1).optional().nullable(),
  categoriaId: z.string().min(1),
  title: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  questionIds: z.array(z.string().min(1)).default([]),
  dueDate: z.coerce.date().optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(600).optional().nullable(),
  requiereEvidencia: z.boolean().default(false),
  pesoAciertos: z.number().min(0).max(100).default(40),
  pesoEvidencia: z.number().min(0).max(100).default(60),
});

export const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).min(1).max(5),
});

export const toggleAperturaSchema = z.object({
  abiertoParaTodos: z.boolean(),
});
