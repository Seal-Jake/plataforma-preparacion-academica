import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth/auth.routes';
import { coursesRouter } from './courses/courses.routes';
import { unitsRouter } from './units/units.routes';
import { topicsRouter } from './topics/topics.routes';
import { foldersRouter } from './folders/folders.routes';
import { filesRouter } from './files/files.routes';
import { questionsRouter } from './questions/questions.routes';
import { sessionsRouter } from './sessions/sessions.routes';
import { enrollmentsRouter } from './enrollments/enrollments.routes';
import { entregasRouter } from './entregas/entregas.routes';
import { rubricRouter } from './rubric/rubric.routes';
import { exportRouter } from './export/export.routes';
import { dashboardRouter } from './dashboard/dashboard.routes';
import { profileRouter } from './profile/profile.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200',
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/units', unitsRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/files', filesRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/entregas', entregasRouter);
app.use('/api/rubric', rubricRouter);
app.use('/api/export', exportRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/profile', profileRouter);

app.use('/api', notFoundHandler);

// En producción, el build de Angular se sirve desde este mismo servidor
// (mismo origen: sin problemas de CORS ni de cookies cross-site).
const clientDist = path.join(__dirname, '..', '..', '..', 'client', 'dist', 'client', 'browser');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
