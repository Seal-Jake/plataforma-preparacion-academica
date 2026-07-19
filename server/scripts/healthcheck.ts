import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Verifica que las cuentas demo (las que documentamos en el README y usamos
// para probar la plataforma) existan en el entorno al que apunta
// DATABASE_URL, con el rol correcto, y las re-crea si faltan. Idempotente:
// correrlo varias veces no duplica nada ni pisa contraseñas ya cambiadas.
//
// Nació de un incidente real: la cuenta demo de estudiante no existía en
// producción (posiblemente borrada sin querer en algún momento) y el login
// fallaba silenciosamente con "credenciales incorrectas", indistinguible de
// una contraseña real equivocada. Correr esto de vez en cuando (o antes de
// hacer una demo) detecta ese tipo de drift entre entornos.
//
// Uso:
//   npx ts-node scripts/healthcheck.ts                          (local, usa .env)
//   DATABASE_URL="postgresql://..." npm run db:prod:run -- scripts/healthcheck.ts   (producción)

interface CuentaEsperada {
  email: string;
  name: string;
  role: 'docente' | 'estudiante';
  defaultPassword: string;
  enrolarEnTodosLosCursos?: boolean;
}

const CUENTAS_ESPERADAS: CuentaEsperada[] = [
  { email: 'docente@curso.pe', name: 'Docente Demo', role: 'docente', defaultPassword: 'docente123' },
  {
    email: 'estudiante@curso.pe',
    name: 'Estudiante Demo',
    role: 'estudiante',
    defaultPassword: 'estudiante123',
    enrolarEnTodosLosCursos: true,
  },
];

async function main() {
  console.log(`Verificando cuentas demo contra: ${maskUrl(process.env.DATABASE_URL)}\n`);

  for (const esperada of CUENTAS_ESPERADAS) {
    const existente = await prisma.user.findUnique({ where: { email: esperada.email } });

    if (!existente) {
      const passwordHash = await bcrypt.hash(esperada.defaultPassword, 12);
      const creado = await prisma.user.create({
        data: { name: esperada.name, email: esperada.email, passwordHash, role: esperada.role },
      });
      console.log(`✗ FALTABA — creada: ${esperada.email} (${esperada.role}), id=${creado.id}`);
      if (esperada.enrolarEnTodosLosCursos) await enrolarEnTodosLosCursos(creado.id, esperada.email);
      continue;
    }

    if (existente.role !== esperada.role) {
      console.log(`⚠ ${esperada.email} existe pero con rol "${existente.role}" en vez de "${esperada.role}" — no se modifica automáticamente, revisar a mano.`);
      continue;
    }

    console.log(`✓ OK — ${esperada.email} (${esperada.role})`);
    if (esperada.enrolarEnTodosLosCursos) await enrolarEnTodosLosCursos(existente.id, esperada.email);
  }
}

async function enrolarEnTodosLosCursos(studentId: string, email: string) {
  const courses = await prisma.course.findMany();
  for (const course of courses) {
    const already = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId: course.id } },
    });
    if (!already) {
      await prisma.enrollment.create({ data: { studentId, courseId: course.id } });
      console.log(`  + inscrito ${email} en "${course.name}"`);
    }
  }
}

function maskUrl(url: string | undefined): string {
  if (!url) return '(sin DATABASE_URL, usando .env local)';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
