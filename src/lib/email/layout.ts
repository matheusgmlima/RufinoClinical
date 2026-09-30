// Shared look of every e-mail: the same card, colors and footer as supabase/templates/*.html.
// E-mail clients ignore <style> and most CSS, so everything is inline and table-based.

const FONT = "Manrope, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = "#1f1a1b";
const MUTED = "#6f615f";
const WINE = "#6e0b1e";
const CREAM = "#fbf7f4";
const LINE = "#e8ddd8";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML. Every value that came from the database goes through it. */
export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

export const paragraph = (html: string) =>
  `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${MUTED}">${html}</p>`;

export const strong = (text: string | number) => `<strong style="color: ${INK}">${escapeHtml(text)}</strong>`;

/** Label/value rows (order lines, totals). The last row can be emphasized. */
export function rows(items: { label: string; detail?: string; value: string }[], { emphasizeLast = false } = {}) {
  const body = items
    .map((item, index) => {
      const last = emphasizeLast && index === items.length - 1;
      const border = last ? `border-top: 1px solid ${LINE};` : "";
      return `<tr>
        <td style="padding: 8px 0; ${border} font-size: 14px; line-height: 1.5; color: ${INK}; ${last ? "font-weight: 600;" : ""}">
          ${escapeHtml(item.label)}${item.detail ? `<br /><span style="color: ${MUTED}">${escapeHtml(item.detail)}</span>` : ""}
        </td>
        <td align="right" style="padding: 8px 0 8px 16px; ${border} font-size: 14px; line-height: 1.5; color: ${INK}; white-space: nowrap; vertical-align: top; ${last ? "font-weight: 600;" : ""}">
          ${escapeHtml(item.value)}
        </td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 24px">${body}</table>`;
}

/** Highlighted box, for a tracking code or a deadline. */
export const callout = (html: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px"><tr><td style="background-color: ${CREAM}; border-radius: 14px; padding: 16px 20px; font-size: 15px; line-height: 1.6; color: ${INK}">${html}</td></tr></table>`;

export function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0 0">
    <tr>
      <td style="border-radius: 9999px; background-color: ${WINE}">
        <a href="${escapeHtml(href)}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 600; color: ${CREAM}; text-decoration: none; border-radius: 9999px">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** Full document: logo, white card with the content, footer. */
export function layout({ title, preheader, content, siteUrl }: { title: string; preheader: string; content: string; siteUrl: string }) {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${CREAM}">
    <div style="display: none; max-height: 0; overflow: hidden">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${CREAM}">
      <tr>
        <td align="center" style="padding: 40px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px">
            <tr>
              <td style="padding: 0 8px 28px">
                <img src="${escapeHtml(siteUrl)}/brand/logo-email.png" width="160" height="38" alt="Rufino Clinical" style="display: block; border: 0" />
              </td>
            </tr>
            <tr>
              <td style="background-color: #ffffff; border: 1px solid ${LINE}; border-radius: 20px; padding: 40px 32px; font-family: ${FONT}; color: ${INK}">
                <h1 style="margin: 0 0 16px; font-size: 24px; line-height: 1.25; font-weight: 600">${escapeHtml(title)}</h1>
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 8px 0; font-family: ${FONT}; font-size: 12px; line-height: 1.6; color: ${MUTED}; text-align: center">
                Rufino Clinical · Produtos para fisioterapia dermatofuncional<br />
                Você recebe este <span style="white-space: nowrap">e-mail</span> porque fez um pedido na loja.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
