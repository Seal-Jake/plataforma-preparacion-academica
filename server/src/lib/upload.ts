import multer, { FileFilterCallback } from 'multer';
import type { Request } from 'express';

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

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function documentFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) return cb(null, true);
  cb(new Error('Tipo de archivo no permitido.'));
}

function imageFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) return cb(null, true);
  cb(new Error('Solo se permiten imágenes (png, jpg, webp).'));
}

// Los archivos se guardan como bytes en la base de datos (no en disco), para que
// sobrevivan a reinicios/redeploys en hosting sin almacenamiento persistente.
// Material de clase, evidencia de examen, participación activa, entregas de texto/archivo.
export const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

// Foto de perfil.
export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: imageFileFilter,
});
