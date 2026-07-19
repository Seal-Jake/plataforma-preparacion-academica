import { execSync } from 'child_process';

// Corre un script one-off (ej. una migración de datos puntual) contra la base de
// datos de PRODUCCIÓN, sin dejar el entorno de desarrollo local roto al terminar:
//   DATABASE_URL="postgresql://..." npm run db:prod:run -- prisma/miScript.ts
//
// Automatiza el swap manual de schema.prisma <-> schema.production.prisma que
// antes había que hacer a mano en cada script contra producción (paso a paso
// propenso a error: fácil olvidar el generate final y dejar el cliente local
// apuntando al schema equivocado).
const scriptPath = process.argv[2];

if (!scriptPath) {
  console.error('Uso: DATABASE_URL="..." npm run db:prod:run -- <ruta-al-script.ts>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Pásala como variable de entorno con la cadena de conexión de producción.');
  process.exit(1);
}

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' });
}

try {
  console.log('--- Generando cliente Prisma contra schema.production.prisma ---');
  run('npx prisma generate --schema=prisma/schema.production.prisma');

  console.log(`--- Ejecutando ${scriptPath} contra producción ---`);
  run(`npx ts-node ${scriptPath}`);
} finally {
  console.log('--- Restaurando cliente Prisma de desarrollo (schema.prisma) ---');
  run('npx prisma generate --schema=prisma/schema.prisma');
}
