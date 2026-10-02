/**
 * Separa el emoji inicial de un nombre («🏠 Hipoteca» → emoji «🏠», resto
 * «Hipoteca») para pintarlo en su cajita de 24 px. Si no hay emoji, `emoji`
 * es null y el nombre queda igual.
 */
const EMOJI_INICIAL =
  /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|⃣|\p{Emoji_Modifier}|‍(?:\p{Extended_Pictographic}|️))*)\s*/u;

export function separarEmoji(nombre: string): {
  emoji: string | null;
  resto: string;
} {
  const m = EMOJI_INICIAL.exec(nombre);
  if (!m || m[0].length === nombre.length) {
    return { emoji: null, resto: nombre };
  }
  return { emoji: m[1], resto: nombre.slice(m[0].length) };
}
