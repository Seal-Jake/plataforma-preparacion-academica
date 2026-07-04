import { z } from 'zod';
import { LIMITE_FEEDBACK, LIMITE_INVESTIGACION } from '../lib/textLimits';

export const submitEntregaSchema = z.object({
  contenidoTexto: z.string().trim().max(LIMITE_INVESTIGACION).optional(),
});

export const calificarEntregaSchema = z.object({
  nota: z.number().min(0).max(20),
  feedback: z.string().trim().max(LIMITE_FEEDBACK).optional().nullable(),
});
