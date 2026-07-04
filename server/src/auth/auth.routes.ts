import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { validate } from '../lib/validate';
import { loginSchema, registerStudentSchema } from './auth.schemas';
import { clearSessionCookie, requireAuth, requireRole, setSessionCookie, signToken } from '../middleware/auth';
import { unauthorized, conflict } from '../lib/errors';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

// Registro público: cualquiera puede crear su propia cuenta de estudiante y queda
// matriculado automáticamente en todos los cursos existentes.
authRouter.post(
  '/register',
  registerRateLimiter,
  validate(registerStudentSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict('Ya existe una cuenta con ese correo.');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'estudiante' },
    });

    const courses = await prisma.course.findMany({ select: { id: true } });
    await prisma.enrollment.createMany({
      data: courses.map((c) => ({ studentId: user.id, courseId: c.id })),
    });

    const token = signToken({ sub: user.id, role: 'estudiante', name: user.name });
    setSessionCookie(res, token);
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      themePreference: user.themePreference,
      notificationsEnabled: user.notificationsEnabled,
    });
  })
);

authRouter.post(
  '/login',
  loginRateLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw unauthorized('Correo o contraseña incorrectos.');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw unauthorized('Correo o contraseña incorrectos.');

    const token = signToken({ sub: user.id, role: user.role as 'docente' | 'estudiante', name: user.name });
    setSessionCookie(res, token);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      themePreference: user.themePreference,
      notificationsEnabled: user.notificationsEnabled,
    });
  })
);

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user) throw unauthorized();
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      themePreference: user.themePreference,
      notificationsEnabled: user.notificationsEnabled,
    });
  })
);

// Lista de estudiantes, para inscribirlos en cursos o calificar su investigación.
authRouter.get(
  '/estudiantes',
  requireAuth,
  requireRole('docente'),
  asyncHandler(async (_req, res) => {
    const students = await prisma.user.findMany({
      where: { role: 'estudiante' },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json(students);
  })
);

// Solo un docente puede crear cuentas de estudiante (no hay registro público).
authRouter.post(
  '/register-estudiante',
  requireAuth,
  requireRole('docente'),
  validate(registerStudentSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict('Ya existe una cuenta con ese correo.');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: 'estudiante' },
    });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);
