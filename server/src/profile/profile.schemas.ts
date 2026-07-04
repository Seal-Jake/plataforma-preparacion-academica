import { z } from 'zod';
import { LIMITE_TEXTO_CORTO } from '../lib/textLimits';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO).optional(),
  themePreference: z.enum(['dark', 'light']).optional(),
  notificationsEnabled: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(LIMITE_TEXTO_CORTO),
});
