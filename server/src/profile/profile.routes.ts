import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { requireAuth } from '../middleware/auth';
import { badRequest, unauthorized } from '../lib/errors';
import { uploadAvatar } from '../lib/upload';
import { changePasswordSchema, updateProfileSchema } from './profile.schemas';

export const profileRouter = Router();

function toPublic(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  themePreference: string;
  notificationsEnabled: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    themePreference: user.themePreference,
    notificationsEnabled: user.notificationsEnabled,
  };
}

profileRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw unauthorized();
    res.json(toPublic(user));
  })
);

profileRouter.put(
  '/',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.user!.sub }, data: req.body });
    res.json(toPublic(user));
  })
);

profileRouter.put(
  '/password',
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw unauthorized();

    const valid = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
    if (!valid) throw badRequest('La contraseña actual no es correcta.');

    const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.status(204).send();
  })
);

profileRouter.post(
  '/avatar',
  requireAuth,
  uploadAvatar.single('avatar'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Debes adjuntar una imagen.');
    const avatarUrl = `/api/profile/avatar/${req.user!.sub}`;
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { avatarUrl, avatarData: req.file.buffer, avatarMimeType: req.file.mimetype },
    });
    res.json(toPublic(user));
  })
);

// Foto de perfil: bajo riesgo, se sirve de forma pública (sin requireAuth) igual que antes.
profileRouter.get(
  '/avatar/:userId',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: { avatarData: true, avatarMimeType: true },
    });
    if (!user?.avatarData) return res.status(404).end();
    res.setHeader('Content-Type', user.avatarMimeType || 'application/octet-stream');
    res.send(Buffer.from(user.avatarData));
  })
);
