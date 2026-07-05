import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, forbidden } from '../lib/errors';
import { LIMITE_TEXTO_CORTO } from '../lib/textLimits';
import { crearSesionesFijasUnidad } from '../lib/sesionesFijas';

export const unitsRouter = Router();

const unitSchema = z.object({
  courseId: z.string().min(1),
  name: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  orderIndex: z.number().int().min(0).default(0),
});

async function assertEnrolled(studentId: string, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw notFound('Unidad');
  const enrolled = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: unit.courseId } },
  });
  if (!enrolled) throw forbidden('No estás inscrito en el curso de esta unidad.');
  return unit;
}

unitsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'estudiante') {
      await assertEnrolled(req.user!.sub, req.params.id);
    }
    const unit = await prisma.unit.findUnique({
      where: { id: req.params.id },
      include: { topics: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!unit) throw notFound('Unidad');
    res.json(unit);
  })
);

unitsRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(unitSchema),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.create({ data: req.body });
    await crearSesionesFijasUnidad(unit.id);
    res.status(201).json(unit);
  })
);

unitsRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(unitSchema.partial()),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.update({ where: { id: req.params.id }, data: req.body });
    res.json(unit);
  })
);

unitsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.unit.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
