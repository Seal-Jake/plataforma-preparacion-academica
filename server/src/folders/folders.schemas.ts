import { z } from 'zod';
import { LIMITE_TEORIA, LIMITE_TEXTO_CORTO } from '../lib/textLimits';

export const createFolderSchema = z.object({
  topicId: z.string().min(1),
  parentId: z.string().min(1),
  nombre: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
});

export const renameFolderSchema = z.object({
  nombre: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
});

export const createFileSchema = z.object({
  nombre: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  contenidoTexto: z.string().trim().max(LIMITE_TEORIA).optional(),
});
