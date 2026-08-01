/**
 * Server-side E.C.O. delivery email renderer.
 *
 * These literal values are copied from the participant-facing experience so
 * the email does not depend on the website CSS bundle:
 * - app/eco/eco-sp-001/EcoCase.module.css (.casePage, primary actions)
 * - app/eco/eco-sp-001/iniciar/DeliveryLanding.module.css
 *   (.delivery, .classification, .eyebrow, .primaryAction)
 */
export const ECO_EMAIL_COLORS = Object.freeze({
  page: "#080909",
  surface: "#111313",
  text: "#f0ede5",
  body: "#bbb7ae",
  muted: "#8e8a82",
  accent: "#d94b55",
  action: "#b62430",
  actionText: "#ffffff",
});

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export function normalizeAspirantName(value) {
  const normalized = typeof value === "string"
    ? value.trim().replace(/\s+/gu, " ")
    : "";
  if (!normalized) return null;
  return Array.from(normalized.toLocaleUpperCase("pt-BR")).slice(0, 80).join("");
}

export function renderEcoDeliveryEmail(input) {
  const caseLabel = String(input.caseId).trim().toLocaleUpperCase("pt-BR");
  const deliveryUrl = String(input.deliveryUrl);
  const aspirantName = normalizeAspirantName(input.participantName);
  const aspirantLabel = aspirantName ? `ASPIRANTE: ${aspirantName}` : "ASPIRANTE";
  const subject = `E.C.O. — Caso ${caseLabel} disponível`;
  const preheader = `Seu acesso individual ao Caso ${caseLabel} está disponível.`;
  const escapedCase = escapeHtml(caseLabel);
  const escapedUrl = escapeHtml(deliveryUrl);
  const escapedAspirant = escapeHtml(aspirantLabel);
  const colors = ECO_EMAIL_COLORS;

  const textBody = `E.C.O.
Encontrar. Conter. Ocultar.

TRANSMISSÃO ${caseLabel}
${aspirantLabel}

Seu primeiro caso está disponível.

Seu acesso ao Caso ${caseLabel} foi autorizado.

O dossiê está disponível para análise no endereço individual abaixo.

ACESSAR CASO
${deliveryUrl}

Após analisar o material, registre sua conclusão pelo canal indicado no dossiê.

Este acesso é individual. Não compartilhe o link.`;

  const htmlBody = `<!doctype html>
<html lang="pt-BR">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background-color:${colors.page};color:${colors.text};font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${colors.page}" style="width:100%;background-color:${colors.page};border-collapse:collapse;">
<tr><td align="center" style="padding:36px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${colors.surface}" style="width:100%;max-width:600px;background-color:${colors.surface};border-collapse:collapse;">
<tr><td style="padding:48px 44px 18px 44px;">
<p style="margin:0 0 7px 0;color:${colors.text};font-size:25px;line-height:31px;font-weight:900;letter-spacing:3px;">E.C.O.</p>
<p style="margin:0;color:${colors.body};font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.3px;">Encontrar. Conter. Ocultar.</p>
</td></tr>
<tr><td style="padding:34px 44px 48px 44px;">
<p style="margin:0 0 11px 0;color:${colors.accent};font-size:11px;line-height:18px;font-family:Consolas,'Courier New',monospace;font-weight:700;letter-spacing:1.5px;">TRANSMISSÃO ${escapedCase}</p>
<p style="margin:0 0 38px 0;color:${colors.muted};font-size:11px;line-height:18px;font-family:Consolas,'Courier New',monospace;font-weight:700;letter-spacing:1.1px;">${escapedAspirant}</p>
<h1 style="margin:0 0 24px 0;color:${colors.text};font-size:28px;line-height:36px;font-weight:900;letter-spacing:-0.5px;">Seu primeiro caso está disponível.</h1>
<p style="margin:0 0 14px 0;color:${colors.body};font-size:16px;line-height:26px;">Seu acesso ao Caso ${escapedCase} foi autorizado.</p>
<p style="margin:0 0 32px 0;color:${colors.body};font-size:16px;line-height:26px;">O dossiê está disponível para análise no endereço individual abaixo.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 34px 0;"><tr><td bgcolor="${colors.action}" style="background-color:${colors.action};"><a href="${escapedUrl}" style="display:inline-block;padding:16px 25px;color:${colors.actionText};font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;font-weight:800;text-decoration:none;letter-spacing:1px;">ACESSAR CASO</a></td></tr></table>
<p style="margin:0 0 9px 0;color:${colors.muted};font-size:12px;line-height:19px;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
<p style="margin:0 0 30px 0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapedUrl}" style="color:${colors.body};text-decoration:underline;">${escapedUrl}</a></p>
<p style="margin:0 0 28px 0;color:${colors.body};font-size:14px;line-height:23px;">Após analisar o material, registre sua conclusão pelo canal indicado no dossiê.</p>
<p style="margin:0;padding-top:22px;border-top:1px solid rgba(232,229,220,0.16);color:${colors.text};font-size:13px;line-height:21px;font-weight:700;">Este acesso é individual. Não compartilhe o link.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, preheader, htmlBody, textBody };
}
