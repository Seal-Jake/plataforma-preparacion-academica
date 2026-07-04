export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const notFound = (entidad = 'Recurso') => new ApiError(404, `${entidad} no encontrado.`);
export const badRequest = (message = 'Solicitud inválida.') => new ApiError(400, message);
export const unauthorized = (message = 'No autenticado.') => new ApiError(401, message);
export const forbidden = (message = 'No tienes permiso para esta acción.') => new ApiError(403, message);
export const conflict = (message = 'El recurso ya existe.') => new ApiError(409, message);
