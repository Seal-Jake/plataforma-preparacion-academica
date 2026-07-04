import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFound, forbidden, badRequest } from '../lib/errors';
import { uploadDocument } from '../lib/upload';
import { createFileSchema, createFolderSchema, renameFolderSchema } from './folders.schemas';

export const foldersRouter = Router();

async function assertEnrolledForTopic(userId: string, role: string, topicId: string) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { unit: true } });
  if (!topic) throw notFound('Tema');
  if (role === 'estudiante') {
    const enrolled = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: userId, courseId: topic.unit.courseId } },
    });
    if (!enrolled) throw forbidden('No estás inscrito en el curso de este tema.');
  }
  return topic;
}

interface FolderNode {
  id: string;
  nombre: string;
  tipoFijo: string | null;
  orderIndex: number;
  archivos: { id: string; nombre: string; contenidoTexto: string | null; mimeType: string | null; sizeBytes: number | null; createdAt: Date }[];
  completado: boolean;
  children: FolderNode[];
}

function buildTree(
  folders: { id: string; parentId: string | null; nombre: string; tipoFijo: string | null; orderIndex: number }[],
  archivosByFolder: Map<string, FolderNode['archivos']>,
  completadoIds: Set<string>
): FolderNode[] {
  const byParent = new Map<string | null, typeof folders>();
  for (const f of folders) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }

  function build(parentId: string | null): FolderNode[] {
    const children = (byParent.get(parentId) ?? []).sort((a, b) => a.orderIndex - b.orderIndex);
    return children.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      tipoFijo: f.tipoFijo,
      orderIndex: f.orderIndex,
      archivos: archivosByFolder.get(f.id) ?? [],
      completado: completadoIds.has(f.id),
      children: build(f.id),
    }));
  }

  return build(null);
}

foldersRouter.get(
  '/topic/:topicId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertEnrolledForTopic(req.user!.sub, req.user!.role, req.params.topicId);

    const folders = await prisma.folder.findMany({ where: { topicId: req.params.topicId } });
    const archivos = await prisma.fileItem.findMany({
      where: { folderId: { in: folders.map((f) => f.id) } },
      select: { id: true, folderId: true, nombre: true, contenidoTexto: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    const archivosByFolder = new Map<string, FolderNode['archivos']>();
    for (const a of archivos) {
      const list = archivosByFolder.get(a.folderId) ?? [];
      list.push({
        id: a.id,
        nombre: a.nombre,
        contenidoTexto: a.contenidoTexto,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt,
      });
      archivosByFolder.set(a.folderId, list);
    }

    let completadoIds = new Set<string>();
    if (req.user!.role === 'estudiante') {
      const marcas = await prisma.progressMark.findMany({
        where: { studentId: req.user!.sub, folderId: { in: folders.map((f) => f.id) } },
      });
      completadoIds = new Set(marcas.map((m) => m.folderId));
    }

    const tree = buildTree(folders, archivosByFolder, completadoIds);
    const totalCarpetas = folders.length;
    const completadas = completadoIds.size;

    res.json({
      tree,
      progreso: {
        totalCarpetas,
        completadas,
        porcentaje: totalCarpetas > 0 ? Math.round((completadas / totalCarpetas) * 100) : 0,
      },
    });
  })
);

foldersRouter.post(
  '/',
  requireAuth,
  requireRole('docente'),
  validate(createFolderSchema),
  asyncHandler(async (req, res) => {
    const { topicId, parentId, nombre } = req.body;
    const parent = await prisma.folder.findUnique({ where: { id: parentId } });
    if (!parent || parent.topicId !== topicId) throw badRequest('La carpeta padre no pertenece a este tema.');

    const siblingCount = await prisma.folder.count({ where: { parentId } });
    const folder = await prisma.folder.create({
      data: { topicId, parentId, nombre, orderIndex: siblingCount },
    });
    res.status(201).json(folder);
  })
);

foldersRouter.put(
  '/:id',
  requireAuth,
  requireRole('docente'),
  validate(renameFolderSchema),
  asyncHandler(async (req, res) => {
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    if (!folder) throw notFound('Carpeta');
    if (folder.tipoFijo) throw badRequest('Esta carpeta es fija y no se puede renombrar.');
    const updated = await prisma.folder.update({ where: { id: req.params.id }, data: { nombre: req.body.nombre } });
    res.json(updated);
  })
);

foldersRouter.delete(
  '/:id',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (req, res) => {
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    if (!folder) throw notFound('Carpeta');
    if (folder.tipoFijo) throw badRequest('Esta carpeta es fija y no se puede eliminar.');
    await prisma.folder.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

// Sube un archivo y/o crea una nota de texto dentro de una carpeta.
foldersRouter.post(
  '/:id/archivos',
  requireAuth,
  requireRole('docente'),
  uploadDocument.single('archivo'),
  validate(createFileSchema),
  asyncHandler(async (req, res) => {
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    if (!folder) throw notFound('Carpeta');

    const file = req.file;
    const { nombre, contenidoTexto } = req.body as { nombre: string; contenidoTexto?: string };
    if (!file && !contenidoTexto) throw badRequest('Debes adjuntar un archivo o escribir contenido de texto.');

    const created = await prisma.fileItem.create({
      data: {
        folderId: folder.id,
        nombre,
        contenidoTexto: contenidoTexto || null,
        data: file?.buffer ?? null,
        mimeType: file?.mimetype ?? null,
        sizeBytes: file?.size ?? null,
        subidoPor: req.user!.sub,
      },
      select: { id: true, folderId: true, nombre: true, contenidoTexto: true, mimeType: true, sizeBytes: true, subidoPor: true, createdAt: true },
    });
    res.status(201).json(created);
  })
);

foldersRouter.post(
  '/:id/progreso',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    const folder = await prisma.folder.findUnique({ where: { id: req.params.id } });
    if (!folder) throw notFound('Carpeta');
    await assertEnrolledForTopic(req.user!.sub, req.user!.role, folder.topicId);

    const mark = await prisma.progressMark.upsert({
      where: { studentId_folderId: { studentId: req.user!.sub, folderId: folder.id } },
      create: { studentId: req.user!.sub, folderId: folder.id },
      update: {},
    });
    res.status(201).json(mark);
  })
);

foldersRouter.delete(
  '/:id/progreso',
  requireAuth,
  requireRole('estudiante'),
  asyncHandler(async (req, res) => {
    await prisma.progressMark
      .delete({ where: { studentId_folderId: { studentId: req.user!.sub, folderId: req.params.id } } })
      .catch(() => undefined);
    res.status(204).send();
  })
);
