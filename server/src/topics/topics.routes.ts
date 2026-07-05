import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, forbidden } from '../lib/errors';
import { LIMITE_TEXTO_CORTO } from '../lib/textLimits';
import { CARPETAS_FIJAS } from '../lib/enums';
import { crearSesionesFijasTema } from '../lib/sesionesFijas';

export const topicsRouter = Router();

const topicSchema = z.object({
  unitId: z.string().min(1),
  name: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  orderIndex: z.number().int().min(0).default(0),
  subtemas: z.string().trim().max(LIMITE_TEXTO_CORTO * 5).optional().nullable(),
});

async function assertEnrolledForTopic(studentId: string, topicId: string) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { unit: true } });
  if (!topic) throw notFound('Tema');
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: topic.unit.courseId } },
  });
  if (!enrolled) throw forbidden('No estás inscrito en el curso de este tema.');
  return topic;
}

topicsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'estudiante') {
      await assertEnrolledForTopic(req.user!.sub, req.params.id);
    }
    const topic = await prisma.topic.findUnique({ where: { id: req.params.id } });
    if (!topic) throw notFound('Tema');

    if (req.user!.role === 'docente') {
      const questionCount = await prisma.question.count({ where: { topicId: topic.id } });
      return res.json({ ...topic, questionCount });
    }
    res.json(topic);
  })
);

// Crea el tema y, de inmediato, sus 4 carpetas raíz fijas (Concepto y Marco
// Teórico, Mecánica y Ejemplos, Actividad Práctica, Aplicación a la Economía
// y Administración), tal como pide el diseño de "explorador de archivos".
topicsRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(topicSchema),
  asyncHandler(async (req, res) => {
    const topic = await prisma.topic.create({ data: req.body });
    await prisma.folder.createMany({
      data: CARPETAS_FIJAS.map((carpeta, idx) => ({
        topicId: topic.id,
        nombre: carpeta.nombre,
        tipoFijo: carpeta.tipoFijo,
        orderIndex: idx,
      })),
    });
    await crearSesionesFijasTema(topic.id, topic.unitId);
    res.status(201).json(topic);
  })
);

topicsRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(topicSchema.partial()),
  asyncHandler(async (req, res) => {
    const topic = await prisma.topic.update({ where: { id: req.params.id }, data: req.body });
    res.json(topic);
  })
);

topicsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.topic.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
