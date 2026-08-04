export const FOUNDER_EMAIL_SUBJECT = "E.C.O. // Registro final do agente Quina";
export const FOUNDER_EMAIL_PREVIEW =
  "Seu acesso como agente fundador foi confirmado. Um fragmento adicional da operação ECO-SP-001 foi liberado.";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
}

function normalizedName(value) {
  const name = typeof value === "string"
    ? value.trim().replace(/\s+/gu, " ")
    : "";
  return name ? Array.from(name).slice(0, 120).join("") : null;
}

function formatAmount(amountCents, currency) {
  if (!Number.isInteger(amountCents) || amountCents < 1 || currency !== "BRL") {
    throw new Error("invalid_financial_summary");
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function absoluteHttpsUrl(value) {
  const url = new URL(String(value));
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("invalid_public_url");
  }
  return url.toString();
}

export function renderFounderPostPurchaseEmail(input) {
  const recordUrl = absoluteHttpsUrl(input.recordUrl);
  const imageUrl = absoluteHttpsUrl(input.imageUrl);
  const supportEmail = String(input.supportEmail ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(supportEmail)) {
    throw new Error("invalid_support_email");
  }
  const orderReference = String(input.orderReference ?? "").trim();
  if (!/^[A-Za-z0-9_-]{16,200}$/u.test(orderReference)) {
    throw new Error("invalid_order_reference");
  }
  const amount = formatAmount(input.amountCents, input.currency);
  const name = normalizedName(input.buyerName);
  const greeting = name ? `Agente fundador ${name},` : "Agente fundador,";
  const escaped = {
    amount: escapeHtml(amount),
    greeting: escapeHtml(greeting),
    imageUrl: escapeHtml(imageUrl),
    orderReference: escapeHtml(orderReference),
    recordUrl: escapeHtml(recordUrl),
    supportEmail: escapeHtml(supportEmail),
  };

  const textBody = `E.C.O. // ACESSO FUNDADOR CONFIRMADO

${greeting}

Seu pagamento foi confirmado e sua identificação como agente fundador foi registrada.

Como primeiro material reservado, liberamos um fragmento recuperado do canal operacional do agente Quina durante a incursão na central localizada a partir da investigação ECO-SP-001.

ÚLTIMO REGISTRO VISUAL ÍNTEGRO // DISPOSITIVO DE CAMPO QN-04
${imageUrl}

OUVIR REGISTRO RECUPERADO
${recordUrl}

INFORMAÇÕES DA RESERVA
Pagamento: confirmado
Valor pago: ${amount}
Referência: ${orderReference}
Formato: digital
Campanha: acesso fundador à próxima missão digital. Se a meta da campanha não for atingida, aplica-se o reembolso integral informado na reserva.
Suporte: ${supportEmail}

A Liberula é responsável pela produção deste projeto narrativo.`;

  const htmlBody = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${
    escapeHtml(FOUNDER_EMAIL_SUBJECT)
  }</title></head>
<body style="margin:0;padding:0;background:#080909;color:#f0ede5;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${
    escapeHtml(FOUNDER_EMAIL_PREVIEW)
  }</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#080909"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111313" style="width:100%;max-width:620px;border-collapse:collapse;">
<tr><td style="padding:38px 34px 18px;"><p style="margin:0 0 6px;font-size:25px;font-weight:900;letter-spacing:3px;">E.C.O.</p><p style="margin:0;color:#aaa69d;font-size:11px;letter-spacing:1.4px;">ENCONTRAR. CONTER. OCULTAR.</p></td></tr>
<tr><td style="padding:24px 34px 14px;"><p style="margin:0 0 13px;color:#d94b55;font:700 11px/18px Consolas,'Courier New',monospace;letter-spacing:1.4px;">ACESSO FUNDADOR CONFIRMADO</p><h1 style="margin:0 0 22px;font-size:28px;line-height:35px;">Você agora faz parte da E.C.O.</h1><p style="margin:0 0 16px;color:#d3cfc6;font-size:16px;line-height:25px;">${escaped.greeting}</p><p style="margin:0 0 14px;color:#bbb7ae;font-size:16px;line-height:25px;">Seu pagamento foi confirmado e sua identificação como agente fundador foi registrada.</p><p style="margin:0 0 28px;color:#bbb7ae;font-size:16px;line-height:25px;">Como primeiro material reservado, liberamos um fragmento recuperado do canal operacional do agente Quina durante a incursão na central localizada a partir da investigação ECO-SP-001.</p></td></tr>
<tr><td style="padding:0 18px;"><img src="${escaped.imageUrl}" width="584" alt="Último registro visual do agente Quina diante da passagem encontrada na central." style="display:block;width:100%;max-width:584px;height:auto;border:0;background:#1b1d1d;color:#bbb7ae;font-size:13px;line-height:20px;"></td></tr>
<tr><td style="padding:13px 34px 30px;"><p style="margin:0;color:#8e8a82;font:700 10px/17px Consolas,'Courier New',monospace;letter-spacing:1px;">ÚLTIMO REGISTRO VISUAL ÍNTEGRO // DISPOSITIVO DE CAMPO QN-04</p></td></tr>
<tr><td style="padding:0 34px 38px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#b62430"><a href="${escaped.recordUrl}" style="display:inline-block;padding:16px 22px;color:#fff;font-size:13px;font-weight:800;text-decoration:none;letter-spacing:1px;">OUVIR REGISTRO RECUPERADO</a></td></tr></table><p style="margin:18px 0 0;color:#8e8a82;font-size:12px;line-height:19px;">Se o botão não funcionar: <a href="${escaped.recordUrl}" style="color:#bbb7ae;word-break:break-all;">${escaped.recordUrl}</a></p></td></tr>
<tr><td style="padding:28px 34px;border-top:1px solid #303232;"><p style="margin:0 0 15px;color:#d3cfc6;font:700 11px/18px Consolas,'Courier New',monospace;letter-spacing:1.2px;">INFORMAÇÕES DA RESERVA</p><p style="margin:0;color:#aaa69d;font-size:13px;line-height:22px;">Pagamento: confirmado<br>Valor pago: ${escaped.amount}<br>Referência: ${escaped.orderReference}<br>Formato: digital<br>Campanha: acesso fundador à próxima missão digital.<br>Se a meta não for atingida, aplica-se o reembolso integral informado na reserva.<br>Suporte: <a href="mailto:${escaped.supportEmail}" style="color:#d3cfc6;">${escaped.supportEmail}</a></p></td></tr>
<tr><td style="padding:20px 34px;background:#0c0d0d;color:#77736c;font-size:11px;line-height:18px;">Projeto narrativo produzido pela Liberula.</td></tr>
</table></td></tr></table></body></html>`;

  return {
    subject: FOUNDER_EMAIL_SUBJECT,
    preheader: FOUNDER_EMAIL_PREVIEW,
    htmlBody,
    textBody,
  };
}
