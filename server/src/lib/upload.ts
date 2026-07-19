import multer, { FileFilterCallback } from 'multer';
import type { Request } from 'express';
import path from 'path';
import { badRequest } from './errors';

const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);

// Algunos navegadores/sistemas operativos no reportan un mimetype confiable
// para ciertos archivos (sobre todo PDFs escaneados o exportados desde apps
// de escaneo, que a veces llegan como "application/octet-stream" o vacío).
// En ese caso se acepta el archivo según su extensión en vez de rechazarlo.
const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.txt',
]);

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function documentFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) return cb(null, true);
  const mimetypeNoConfiable = !file.mimetype || file.mimetype === 'application/octet-stream';
  const extension = path.extname(file.originalname).toLowerCase();
  if (mimetypeNoConfiable && ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) return cb(null, true);
  cb(badRequest(`Tipo de archivo no permitido: "${file.originalname}".`));
}

function imageFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
  cb(badRequest('Solo se permiten imágenes (png, jpg, webp).'));
}

// Los archivos se guardan como bytes en la base de datos (no en disco), para que
// sobrevivan a reinicios/redeploys en hosting sin almacenamiento persistente.
// Material de clase, evidencia de examen, participación activa, entregas de texto/archivo.
// 50MB (antes 20MB): los PDFs escaneados de varias páginas suelen pesar más de 20MB.
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

// Foto de perfil.
export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});
