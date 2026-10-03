export class ServiceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function requireThat(condition: unknown, message: string, status?: number): asserts condition {
  if (!condition) throw new ServiceError(message, status);
}
