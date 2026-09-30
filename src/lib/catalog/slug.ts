/** Store address fragment from a name: "Kinesio Tape 5 cm (Bege)" → "kinesio-tape-5-cm-bege". */
export function slugify(name: string, maxLength = 120): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
