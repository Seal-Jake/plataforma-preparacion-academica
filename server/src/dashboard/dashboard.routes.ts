import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth, requireRole } from '../middleware/auth';
import { TIPOS_SESION_FIJOS_POR_ID } from '../lib/enums';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.sub;

    const enrollments = await prisma.enrollment.findMany({ where: { studentId }, include: { course: true } });
    const courseIds = enrollments.map((e) => e.courseId);
    const courseById = new Map(enrollments.map((e) => [e.courseId, e.course]));

    const units = await prisma.unit.findMany({ where: { courseId: { in: courseIds } } });
    const unitIds = units.map((u) => u.id);
    const unitById = new Map(units.map((u) => [u.id, u]));

    // Cubre los 3 niveles: sesiones de curso (courseId), y de unidad/tema
    // (ambas tienen unitId, las de tema además topicId).
    const sessions = await prisma.academicSession.findMany({
      where: {
        dueDate: { not: null },
        OR: [{ courseId: { in: courseIds } }, { unitId: { in: unitIds } }],
      },
    });

    const states = await prisma.studentSessionState.findMany({
      where: { studentId, sessionId: { in: sessions.map((s) => s.id) } },
    });
    const stateBySession = new Map(states.map((s) => [s.sessionId, s]));

    const pendientes = sessions
      .filter((s) => !stateBySession.get(s.id)?.submittedAt)
      .map((s) => {
        const unit = s.unitId ? unitById.get(s.unitId) : undefined;
        const course = unit ? courseById.get(unit.courseId) : s.courseId ? courseById.get(s.courseId) : undefined;
        return {
          sessionId: s.id,
          title: s.title,
          categoriaNombre: TIPOS_SESION_FIJOS_POR_ID[s.tipoFijo]?.nombre ?? s.title,
          unitId: unit?.id ?? null,
          unitName: unit?.name ?? null,
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
