import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { notFound, forbidden, badRequest } from '../lib/errors';

export const filesRouter = Router();

async function assertCanAccessFile(userId: string, role: string, fileItemId: string) {
  const file = await prisma.fileItem.findUnique({
    where: { id: fileItemId },
    include: { folder: { include: { topic: { include: { unit: true } } } } },
  });
  if (!file) throw notFound('Archivo');
  if (!file.data) throw badRequest('Este elemento no tiene un archivo adjunto para descargar.');

  if (role === 'estudiante') {
    const courseId = file.folder.topic.unit.courseId;
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: userId, courseId } },
    });
    if (!enrolled) throw forbidden('No estás inscrito en el curso de este archivo.');
  }
  return file;
}

filesRouter.get(
  '/:id/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = await assertCanAccessFile(req.user!.sub, req.user!.role, req.params.id);
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.nombre)}"`);
    res.send(Buffer.from(file.data!));
  })
);

filesRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = await prisma.fileItem.findUnique({ where: { id: req.params.id } });
    if (!file) throw notFound('Archivo');
    if (req.user!.role !== 'docente') throw forbidden('Solo el docente puede eliminar archivos.');
    await prisma.fileItem.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);
