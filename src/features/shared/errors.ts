/**
 * Texte brut d'une erreur quelconque : exception, rejet de promesse, message de Rust ou d'un
 * plugin (qui rejettent souvent avec une chaîne ou un objet `{ message }`). Ne lève jamais.
 */
export function errorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === 'string') return m;
  }
  try {
    return String(error);
  } catch {
    // Objet sans prototype ni `toString` : rien de lisible.
    return '';
  }
}
