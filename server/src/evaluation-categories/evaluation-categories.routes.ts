import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, forbidden } from '../lib/errors';
import { TIPOS_EVALUACION } from '../lib/enums';
import { LIMITE_TEXTO_CORTO } from '../lib/textLimits';

export const evaluationCategoriesRouter = Router();

const categorySchema = z.object({
  unitId: z.string().min(1),
  nombre: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  peso: z.number().min(0).max(100),
  tipoEvaluacion: z.enum(TIPOS_EVALUACION),
  promediarPorTema: z.boolean().default(false),
});

async function assertAccesoUnidad(userId: string, role: string, unitId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) throw notFound('Unidad');
  if (role === 'estudiante') {
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: userId, courseId: unit.courseId } },
    });
    if (!enrolled) throw forbidden('No estás inscrito en el curso de esta unidad.');
  }
  return unit;
}

evaluationCategoriesRouter.get(
  '/unit/:unitId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertAccesoUnidad(req.user!.sub, req.user!.role, req.params.unitId);
    const categorias = await prisma.evaluationCategory.findMany({ where: { unitId: req.params.unitId } });
    const pesoTotal = categorias.reduce((acc, c) => acc + c.peso, 0);
    res.json({ categorias, pesoTotal, pesoValido: Math.abs(pesoTotal - 100) < 0.01 });
  })
);

evaluationCategoriesRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    const categoria = await prisma.evaluationCategory.create({ data: req.body });
    res.status(201).json(categoria);
  })
);

evaluationCategoriesRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(categorySchema.partial()),
  asyncHandler(async (req, res) => {
    const categoria = await prisma.evaluationCategory.update({ where: { id: req.params.id }, data: req.body });
    res.json(categoria);
  })
);

evaluationCategoriesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.evaluationCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
