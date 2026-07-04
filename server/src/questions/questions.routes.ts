import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, badRequest } from '../lib/errors';
import { csvRowSchema, importSchema, questionFilterSchema, questionSchema, questionUpdateSchema } from './questions.schemas';

export const questionsRouter = Router();

questionsRouter.get(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(questionFilterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { topicId, nivel, tipo, section, q } = req.query as unknown as {
      topicId: string;
      nivel?: string;
      tipo?: string;
      section?: string;
      q?: string;
    };
    const questions = await prisma.question.findMany({
      where: {
        topicId,
        ...(nivel && { nivel }),
        ...(tipo && { tipo }),
        ...(section && { section }),
        ...(q && { enunciado: { contains: q } }),
      },
      include: { opciones: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(questions);
  })
);

questionsRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(questionSchema),
  asyncHandler(async (req, res) => {
    const { opciones, ...rest } = req.body;
    const question = await prisma.question.create({
      data: {
        ...rest,
        opciones: { create: opciones.map((o: { texto: string; esCorrecta: boolean }, idx: number) => ({ ...o, orderIndex: idx })) },
      },
      include: { opciones: true },
    });
    res.status(201).json(question);
  })
);

questionsRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(questionUpdateSchema),
  asyncHandler(async (req, res) => {
    const { opciones, ...rest } = req.body;
    if (opciones) {
      await prisma.questionOption.deleteMany({ where: { questionId: req.params.id } });
    }
    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(opciones && {
          opciones: { create: opciones.map((o: { texto: string; esCorrecta: boolean }, idx: number) => ({ ...o, orderIndex: idx })) },
        }),
      },
      include: { opciones: true },
    });
    res.json(question);
  })
);

questionsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// Importador CSV: section|nivel|tipo|enunciado|opciones (separadas por ";")|correctas (letras A-E separadas por ",")
questionsRouter.post(
  '/import',
  requireAuth,
  requireRole('docente'),
  validate(importSchema),
  asyncHandler(async (req, res) => {
    const { topicId, csv } = req.body as { topicId: string; csv: string };

    const topic = await prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) throw notFound('Tema');

    let rawRows: Record<string, string>[];
    try {
      rawRows = parse(csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: '|',
      });
    } catch (e) {
      throw badRequest('No se pudo interpretar el CSV. Verifica el formato con separador "|".');
    }

    if (rawRows.length === 0) throw badRequest('El CSV no contiene filas.');

    const errores: { fila: number; error: string }[] = [];
    const validas: ReturnType<typeof csvRowSchema.parse>[] = [];

    rawRows.forEach((row, idx) => {
      const result = csvRowSchema.safeParse(row);
      if (!result.success) {
        errores.push({ fila: idx + 2, error: result.error.issues.map((i) => i.message).join('; ') });
      } else {
        validas.push(result.data);
      }
    });

    for (const row of validas) {
      await prisma.question.create({
        data: {
          topicId,
          section: row.section,
          nivel: row.nivel,
          tipo: row.tipo,
          enunciado: row.enunciado,
          esModelo: false,
          opciones: { create: row.opciones.map((o, idx) => ({ ...o, orderIndex: idx })) },
        },
      });
    }

    res.status(201).json({ importadas: validas.length, errores });
  })
);
