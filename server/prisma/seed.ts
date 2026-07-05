import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { CURRICULUM } from './curriculum';
import { CARPETAS_FIJAS } from '../src/lib/enums';
import { crearSesionesFijasCurso, crearSesionesFijasUnidad, crearSesionesFijasTema } from '../src/lib/sesionesFijas';

const prisma = new PrismaClient();

// Cursos, unidades, temas y su contenido base: las 4 carpetas fijas por
// tema, y las sesiones fijas de la rúbrica (ver TIPOS_SESION_FIJOS) en los
// 3 niveles (tema, unidad, curso). El banco de preguntas y el contenido de
// las carpetas los llena el docente desde la plataforma.
async function seedCurriculo() {
  for (const [courseIdx, curso] of CURRICULUM.entries()) {
    const course = await prisma.course.create({
      data: { name: curso.name, orderIndex: courseIdx },
    });
    await crearSesionesFijasCurso(course.id);

    for (const [unitIdx, unidad] of curso.units.entries()) {
      const unit = await prisma.unit.create({
        data: { courseId: course.id, name: unidad.name, orderIndex: unitIdx },
      });
      await crearSesionesFijasUnidad(unit.id);

      for (const [topicIdx, topicName] of unidad.topics.entries()) {
        const topic = await prisma.topic.create({
          data: { unitId: unit.id, name: topicName, orderIndex: topicIdx },
        });
        await prisma.folder.createMany({
          data: CARPETAS_FIJAS.map((carpeta, idx) => ({
            topicId: topic.id,
            nombre: carpeta.nombre,
            tipoFijo: carpeta.tipoFijo,
            orderIndex: idx,
          })),
        });
        await crearSesionesFijasTema(topic.id, unit.id);
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
