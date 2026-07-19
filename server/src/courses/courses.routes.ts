import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, forbidden } from '../lib/errors';
import { LIMITE_TEORIA, LIMITE_TEXTO_CORTO } from '../lib/textLimits';
import { etiquetasCategoriasCurso } from '../rubric/rubric.data';

export const coursesRouter = Router();

const courseSchema = z.object({
  name: z.string().trim().min(1).max(LIMITE_TEXTO_CORTO),
  orderIndex: z.number().int().min(0).default(0),
});

const courseInfoSchema = z.object({
  infoEvaluacion: z.string().trim().max(LIMITE_TEORIA).optional().nullable(),
});

// Árbol completo curso -> unidad -> tema (sin contenido pesado de texto) para navegación.
coursesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    let courseIdsFilter: string[] | undefined;
    if (req.user!.role === 'estudiante') {
      const enrollments = await prisma.enrollment.findMany({ where: { studentId: req.user!.sub } });
      courseIdsFilter = enrollments.map((e) => e.courseId);
    }

    const courses = await prisma.course.findMany({
      where: courseIdsFilter ? { id: { in: courseIdsFilter } } : undefined,
      orderBy: { orderIndex: 'asc' },
      include: {
        units: {
          orderBy: { orderIndex: 'asc' },
          include: {
            topics: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true, unitId: true, name: true, orderIndex: true },
            },
          },
        },
      },
    });
    res.json(courses);
  })
);

coursesRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: { units: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!course) throw notFound('Curso');
    res.json(course);
  })
);

// Información de Curso: texto libre + tabla agregada de categorías/pesos por unidad.
coursesRouter.get(
  '/:id/info',
  requireAuth,
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.id } });
    if (!course) throw notFound('Curso');

    if (req.user!.role === 'estudiante') {
      const enrolled = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId: req.user!.sub, courseId: course.id } },
      });
      if (!enrolled) throw forbidden('No estás inscrito en este curso.');
    }

    // La rúbrica es una sola por curso (6 tipos de tarea con peso fijo, ver
    // TIPOS_TAREA): ya no hay una tabla de pesos distinta por unidad.
    res.json({
      infoEvaluacion: course.infoEvaluacion,
      categoriasCurso: etiquetasCategoriasCurso(),
    });
  })
);

coursesRouter.put(
  '/:id/info',
  requireAuth,
  requireRole('docente'),
  validate(courseInfoSchema),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.update({ where: { id: req.params.id }, data: req.body });
    res.json(course);
  })
);

coursesRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(courseSchema),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.create({ data: req.body });
    res.status(201).json(course);
  })
);

coursesRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(courseSchema.partial()),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.update({ where: { id: req.params.id }, data: req.body });
    res.json(course);
  })
);

coursesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
