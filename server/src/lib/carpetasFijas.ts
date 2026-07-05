import { prisma } from './prisma';
import { CARPETAS_FIJAS, CarpetaFija } from './enums';

// Crea recursivamente el árbol de carpetas fijas de un tema (ver
// CARPETAS_FIJAS): 4 carpetas raíz, con sus propios árboles de subcarpetas
// fijas dentro de Actividad Práctica y Economía Aplicada.
export async function crearCarpetasFijas(topicId: string) {
  async function crear(defs: CarpetaFija[], parentId: string | null) {
    for (const [idx, def] of defs.entries()) {
      const folder = await prisma.folder.create({
        data: { topicId, parentId, nombre: def.nombre, tipoFijo: def.tipoFijo, orderIndex: idx },
      });
      if (def.children) await crear(def.children, folder.id);
    }
  }
  await crear(CARPETAS_FIJAS, null);
}
