import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { conflict } from '../lib/errors';

export const enrollmentsRouter = Router();

const enrollSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1),
});

enrollmentsRouter.get(
  '/',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const courseId = req.query.courseId as string | undefined;
    const enrollments = await prisma.enrollment.findMany({
      where: courseId ? { courseId } : undefined,
      include: { student: { select: { id: true, name: true, email: true } } },
    });
    res.json(enrollments);
  })
);

enrollmentsRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(enrollSchema),
  asyncHandler(async (req, res) => {
    const { studentId, courseId } = req.body;
    const existing = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (existing) throw conflict('El estudiante ya está inscrito en este curso.');
    const enrollment = await prisma.enrollment.create({ data: { studentId, courseId } });
    res.status(201).json(enrollment);
  })
);

enrollmentsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.enrollment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
