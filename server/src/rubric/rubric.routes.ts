import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { calcularRubricaUnidad } from './rubric.data';

export const rubricRouter = Router();

rubricRouter.get(
  '/unit/:unitId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.findUnique({ where: { id: req.params.unitId } });
    if (!unit) throw notFound('Unidad');

    let studentId: string;
    if (req.user!.role === 'docente') {
      const q = req.query.studentId as string | undefined;
      if (!q) throw badRequest('studentId es requerido para el docente.');
      studentId = q;
    } else {
      studentId = req.user!.sub;
      const enrolled = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId, courseId: unit.courseId } },
      });
      if (!enrolled) throw forbidden('No estás inscrito en el curso de esta unidad.');
    }

    const rubrica = await calcularRubricaUnidad(unit.id, studentId);
    res.json(rubrica);
  })
);
