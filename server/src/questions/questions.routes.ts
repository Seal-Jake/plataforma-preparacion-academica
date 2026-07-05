import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound } from '../lib/errors';
import { questionSchema, questionUpdateSchema, questionFilterSchema } from './questions.schemas';

export const questionsRouter = Router();

questionsRouter.get(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(questionFilterSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { topicId, sessionId, nivel, tipo, section, q } = req.query as unknown as {
      topicId?: string;
      sessionId?: string;
      nivel?: string;
      tipo?: string;
      section?: string;
      q?: string;
    };

    let effectiveTopicId = topicId;
    let idsFilter: string[] | undefined;
    if (sessionId) {
      const session = await prisma.academicSession.findUnique({ where: { id: sessionId } });
      if (!session) throw notFound('Sesión');
      idsFilter = JSON.parse(session.questionIds);
    }

    const questions = await prisma.question.findMany({
      where: {
        ...(effectiveTopicId && { topicId: effectiveTopicId }),
        ...(idsFilter && { id: { in: idsFilter } }),
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
    // Al borrar una pregunta, se limpia también cualquier referencia colgante
    // en questionIds de las sesiones que la tuvieran asignada (Examen de
    // Unidad, Examen Final, Participación en Clase, Práctica).
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { topic: { include: { unit: true } } },
    });
    if (!question) throw notFound('Pregunta');

    const sessions = await prisma.academicSession.findMany({
      where: {
        OR: [
          { topicId: question.topicId },
          { unitId: question.topic.unitId, topicId: null },
          { courseId: question.topic.unit.courseId },
        ],
      },
    });
    for (const s of sessions) {
      const ids: string[] = JSON.parse(s.questionIds);
      if (ids.includes(req.params.id)) {
        await prisma.academicSession.update({
          where: { id: s.id },
          data: { questionIds: JSON.stringify(ids.filter((id) => id !== req.params.id)) },
        });
      }
    }

    await prisma.question.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
