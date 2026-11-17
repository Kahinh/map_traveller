/** Message lisible d'une erreur quelconque (rejet de promesse, exception, message de Rust). */
export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
