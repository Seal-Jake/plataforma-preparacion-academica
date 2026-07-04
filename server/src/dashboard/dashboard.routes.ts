import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.sub;

    const enrollments = await prisma.enrollment.findMany({ where: { studentId }, include: { course: true } });
    const courseIds = enrollments.map((e) => e.courseId);

    const units = await prisma.unit.findMany({ where: { courseId: { in: courseIds } } });
    const unitIds = units.map((u) => u.id);
    const unitById = new Map(units.map((u) => [u.id, u]));
    const courseById = new Map(enrollments.map((e) => [e.courseId, e.course]));

    const sessions = await prisma.academicSession.findMany({
      where: { unitId: { in: unitIds }, dueDate: { not: null } },
      include: { categoria: true },
    });

    const states = await prisma.studentSessionState.findMany({
      where: { studentId, sessionId: { in: sessions.map((s) => s.id) } },
    });
    const stateBySession = new Map(states.map((s) => [s.sessionId, s]));

    const pendientes = sessions
      .filter((s) => !stateBySession.get(s.id)?.submittedAt)
      .map((s) => {
        const unit = unitById.get(s.unitId)!;
        const course = courseById.get(unit.courseId);
        return {
          sessionId: s.id,
          title: s.title,
          categoriaNombre: s.categoria.nombre,
          unitId: unit.id,
          unitName: unit.name,
          courseName: course?.name ?? '',
          dueDate: s.dueDate,
          vencido: s.dueDate ? new Date(s.dueDate).getTime() < Date.now() : false,
          estado: stateBySession.get(s.id) ? 'en_curso' : 'no_iniciado',
        };
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

    const topics = await prisma.topic.findMany({ where: { unitId: { in: unitIds } } });
    const folders = await prisma.folder.findMany({ where: { topicId: { in: topics.map((t) => t.id) } } });
    const marcas = await prisma.progressMark.findMany({
      where: { studentId, folderId: { in: folders.map((f) => f.id) } },
    });

    res.json({
      pendientes,
      progresoGeneral: {
        totalCarpetas: folders.length,
        completadas: marcas.length,
        porcentaje: folders.length > 0 ? Math.round((marcas.length / folders.length) * 100) : 0,
      },
    });
  })
);
