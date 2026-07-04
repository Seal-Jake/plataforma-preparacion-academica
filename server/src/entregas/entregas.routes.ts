import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, forbidden, badRequest } from '../lib/errors';
import { uploadDocument } from '../lib/upload';
import { calificarEntregaSchema, submitEntregaSchema } from './entregas.schemas';

export const entregasRouter = Router();

// Nunca se incluye archivoData (bytes) en las respuestas JSON: se sirve aparte por /archivo.
const entregaSelect = {
  id: true,
  sessionId: true,
  studentId: true,
  contenidoTexto: true,
  archivoMimeType: true,
  nota: true,
  feedback: true,
  entregadoAt: true,
} as const;

async function getSessionOrThrow(sessionId: string) {
  const session = await prisma.academicSession.findUnique({ where: { id: sessionId }, include: { unit: true } });
  if (!session) throw notFound('Sesión');
  return session;
}

async function assertEnrolled(studentId: string, courseId: string) {
  const enrolled = await prisma.enrollment.findUnique({ where: { studentId_courseId: { studentId, courseId } } });
  if (!enrolled) throw forbidden('No estás inscrito en el curso de esta sesión.');
}

entregasRouter.get(
  '/mine/:sessionId',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const session = await getSessionOrThrow(req.params.sessionId);
    await assertEnrolled(req.user!.sub, session.unit.courseId);

    const entrega = await prisma.entrega.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
      select: entregaSelect,
    });
    res.json(entrega ?? { sessionId: session.id, studentId: req.user!.sub, contenidoTexto: null, nota: null, feedback: null });
  })
);

entregasRouter.put(
  '/mine/:sessionId',
  requireAuth,
  requireRole('estudiante'),
  uploadDocument.single('archivo'),
  validate(submitEntregaSchema),
  asyncHandler(async (req, res) => {
    const session = await getSessionOrThrow(req.params.sessionId);
    await assertEnrolled(req.user!.sub, session.unit.courseId);

    const { contenidoTexto } = req.body as { contenidoTexto?: string };
    const file = req.file;
    if (!contenidoTexto && !file) throw badRequest('Debes escribir contenido o adjuntar un archivo.');

    const entrega = await prisma.entrega.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: req.user!.sub } },
      create: {
        sessionId: session.id,
        studentId: req.user!.sub,
        contenidoTexto: contenidoTexto || null,
        archivoData: file?.buffer ?? null,
        archivoMimeType: file?.mimetype ?? null,
        entregadoAt: new Date(),
      },
      update: {
        contenidoTexto: contenidoTexto || null,
        ...(file ? { archivoData: file.buffer, archivoMimeType: file.mimetype } : {}),
        entregadoAt: new Date(),
      },
      select: entregaSelect,
    });
    res.json(entrega);
  })
);

entregasRouter.get(
  '/mine/:sessionId/archivo',
  requireAuth,
  asyncHandler(async (req, res) => {
    const session = await getSessionOrThrow(req.params.sessionId);
    const studentId = req.user!.role === 'docente' ? (req.query.studentId as string) : req.user!.sub;
    if (!studentId) throw badRequest('studentId es requerido.');
    if (req.user!.role === 'estudiante') await assertEnrolled(req.user!.sub, session.unit.courseId);

    const entrega = await prisma.entrega.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    });
    if (!entrega?.archivoData) throw notFound('Archivo de entrega');
    res.setHeader('Content-Type', entrega.archivoMimeType || 'application/octet-stream');
    res.send(Buffer.from(entrega.archivoData));
  })
);

entregasRouter.get(
  '/session/:sessionId',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const entregas = await prisma.entrega.findMany({
      where: { sessionId: req.params.sessionId },
      select: { ...entregaSelect, student: { select: { id: true, name: true, email: true } } },
    });
    res.json(entregas);
  })
);

entregasRouter.patch(
  '/:sessionId/:studentId/calificar',
  requireAuth,
  requireRole('docente'),
  validate(calificarEntregaSchema),
  asyncHandler(async (req, res) => {
    const { sessionId, studentId } = req.params;
    const entrega = await prisma.entrega.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: { sessionId, studentId, nota: req.body.nota, feedback: req.body.feedback ?? null },
      update: { nota: req.body.nota, feedback: req.body.feedback ?? null },
      select: entregaSelect,
    });
    res.json(entrega);
  })
);
