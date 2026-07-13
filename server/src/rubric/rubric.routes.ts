import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { calcularRubricaCurso, calcularRubricaUnidad, contarPendientesCalificacionUnidad } from './rubric.data';

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

// Planilla de notas: la rúbrica de TODOS los alumnos inscritos de una vez,
// para no tener que revisarlos uno por uno.
rubricRouter.get(
  '/unit/:unitId/planilla',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.findUnique({ where: { id: req.params.unitId } });
    if (!unit) throw notFound('Unidad');

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: unit.courseId },
      include: { student: { select: { id: true, name: true, email: true } } },
    });

    const filas = await Promise.all(
      enrollments.map(async (e) => ({
        studentId: e.studentId,
        studentName: e.student.name,
        rubrica: await calcularRubricaUnidad(unit.id, e.studentId),
      }))
    );

    res.json(filas);
  })
);

// Contador de trabajo pendiente de calificar en esta unidad (para avisar al
// docente sin que tenga que abrir sesión por sesión a revisar).
rubricRouter.get(
  '/unit/:unitId/pendientes',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const unit = await prisma.unit.findUnique({ where: { id: req.params.unitId } });
    if (!unit) throw notFound('Unidad');
    const conteo = await contarPendientesCalificacionUnidad(unit.id);
    res.json(conteo);
  })
);

rubricRouter.get(
  '/course/:courseId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) throw notFound('Curso');

    let studentId: string;
    if (req.user!.role === 'docente') {
      const q = req.query.studentId as string | undefined;
      if (!q) throw badRequest('studentId es requerido para el docente.');
      studentId = q;
    } else {
      studentId = req.user!.sub;
      const enrolled = await prisma.enrollment.findUnique({
        where: { studentId_courseId: { studentId, courseId: course.id } },
      });
      if (!enrolled) throw forbidden('No estás inscrito en este curso.');
    }

    const rubrica = await calcularRubricaCurso(course.id, studentId);
    res.json(rubrica);
  })
);
