import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { CURRICULUM } from './curriculum';
import { crearCarpetasFijas } from '../src/lib/carpetasFijas';

const prisma = new PrismaClient();

// Cursos, unidades, temas y su contenido base: las 4 carpetas fijas por
// tema. Las tareas (TPA, Práctica Calificada, Examen de Unidad, etc.) ya no
// se crean automáticamente — el docente las crea libremente, tantas como
// quiera, desde la plataforma (ver TIPOS_TAREA).
async function seedCurriculo() {
  for (const [courseIdx, curso] of CURRICULUM.entries()) {
    const course = await prisma.course.create({
      data: { name: curso.name, orderIndex: courseIdx },
    });

    for (const [unitIdx, unidad] of curso.units.entries()) {
      const unit = await prisma.unit.create({
        data: { courseId: course.id, name: unidad.name, orderIndex: unitIdx },
      });

      for (const [topicIdx, topicName] of unidad.topics.entries()) {
        const topic = await prisma.topic.create({
          data: { unitId: unit.id, name: topicName, orderIndex: topicIdx },
        });
        await crearCarpetasFijas(topic.id);
      }
    }
  }
}

async function seedUsuariosDemo() {
  const docentePasswordHash = await bcrypt.hash('docente123', 12);
  const estudiantePasswordHash = await bcrypt.hash('estudiante123', 12);

  const docente = await prisma.user.create({
    data: { name: 'Docente Demo', email: 'docente@curso.pe', passwordHash: docentePasswordHash, role: 'docente' },
  });

  const estudiante = await prisma.user.create({
    data: {
      name: 'Estudiante Demo',
      email: 'estudiante@curso.pe',
      passwordHash: estudiantePasswordHash,
      role: 'estudiante',
    },
  });

  return { docente, estudiante };
}

async function main() {
  console.log('Sembrando usuarios demo...');
  const { estudiante } = await seedUsuariosDemo();

  console.log('Sembrando currículo (cursos, unidades, temas, carpetas fijas)...');
  await seedCurriculo();

  console.log('Inscribiendo estudiante demo en ambos cursos...');
  const courses = await prisma.course.findMany();
  for (const course of courses) {
    await prisma.enrollment.create({ data: { studentId: estudiante.id, courseId: course.id } });
  }

  console.log('Listo. Credenciales demo:');
  console.log('  Docente:    docente@curso.pe / docente123');
  console.log('  Estudiante: estudiante@curso.pe / estudiante123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
