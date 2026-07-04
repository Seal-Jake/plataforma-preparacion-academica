import { z } from 'zod';
import { NIVELES, SECCIONES, TIPOS_PREGUNTA } from '../lib/enums';
import { LIMITE_ENUNCIADO, LIMITE_TEORIA, LIMITE_TEXTO_CORTO } from '../lib/textLimits';

const optionSchema = z.object({
  texto: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  esCorrecta: z.boolean().default(false),
});

const questionBaseSchema = z.object({
  topicId: z.string().min(1),
  section: z.enum(SECCIONES),
  nivel: z.enum(NIVELES),
  tipo: z.enum(TIPOS_PREGUNTA),
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

export const questionFilterSchema = z.object({
  topicId: z.string().min(1),
  nivel: z.enum(NIVELES).optional(),
  tipo: z.enum(TIPOS_PREGUNTA).optional(),
  section: z.enum(SECCIONES).optional(),
  q: z.string().trim().max(LIMITE_ENUNCIADO).optional(),
});

export const importSchema = z.object({
  topicId: z.string().min(1),
  csv: z.string().min(1).max(2_000_000),
});

const LETRAS = ['A', 'B', 'C', 'D', 'E'];

// Formato: section|nivel|tipo|enunciado|opciones (separadas por ";")|correctas (letras separadas por ",")
export const csvRowSchema = z
  .object({
    section: z.enum(SECCIONES),
    nivel: z.enum(NIVELES),
    tipo: z.enum(TIPOS_PREGUNTA),
    enunciado: z.string().trim().min(1).max(LIMITE_ENUNCIADO),
    opciones: z.string().trim().min(1),
    correctas: z.string().trim().min(1),
  })
  .transform((row) => {
    const textos = row.opciones.split(';').map((t) => t.trim()).filter(Boolean);
    const letrasCorrectas = row.correctas.split(',').map((l) => l.trim().toUpperCase());
    const opciones = textos.map((texto, idx) => ({
      texto,
      esCorrecta: letrasCorrectas.includes(LETRAS[idx]),
    }));
    return { ...row, opciones };
  })
  .refine((row) => row.opciones.length >= 4 && row.opciones.length <= 5, {
    message: 'Debe haber 4 o 5 alternativas separadas por ";"',
  })
  .refine((row) => row.opciones.some((o) => o.esCorrecta), {
    message: 'Debe haber al menos una alternativa correcta válida (A-E)',
  });
