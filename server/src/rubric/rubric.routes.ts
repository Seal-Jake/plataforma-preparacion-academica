import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { calcularRubricaCurso, contarPendientesCalificacionCurso } from './rubric.data';

export const rubricRouter = Router();

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

// Planilla de notas: la rúbrica de TODOS los alumnos inscritos de una vez,
// para no tener que revisarlos uno por uno.
rubricRouter.get(
  '/course/:courseId/planilla',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) throw notFound('Curso');

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId: course.id },
      include: { student: { select: { id: true, name: true, email: true } } },
    });

    const filas = await Promise.all(
      enrollments.map(async (e) => ({
        studentId: e.studentId,
        studentName: e.student.name,
        rubrica: await calcularRubricaCurso(course.id, e.studentId),
      }))
    );

    res.json(filas);
  })
);

// Contador de trabajo pendiente de calificar en todo el curso (para avisar
// al docente sin que tenga que abrir tarea por tarea a revisar).
rubricRouter.get(
  '/course/:courseId/pendientes',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const course = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!course) throw notFound('Curso');
    const conteo = await contarPendientesCalificacionCurso(course.id);
    res.json(conteo);
  })
);
