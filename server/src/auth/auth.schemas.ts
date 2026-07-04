import { z } from 'zod';
import { ROLES } from '../lib/enums';
import { LIMITE_TEXTO_CORTO } from '../lib/textLimits';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(LIMITE_TEXTO_CORTO),
  password: z.string().min(1).max(LIMITE_TEXTO_CORTO),
});

export const registerStudentSchema = z.object({
  name: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  email: z.string().trim().toLowerCase().email().max(LIMITE_TEXTO_CORTO),
  password: z.string().min(6).max(LIMITE_TEXTO_CORTO),
  role: z.enum(ROLES).default('estudiante'),
});
