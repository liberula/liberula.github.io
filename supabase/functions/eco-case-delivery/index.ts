const MAX_BODY_BYTES = 8 * 1024;
const MAX_PARTICIPANTS = 10;
const MAX_DELIVERIES = 10;
const POSTMARK_TIMEOUT_MS = 5_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DELIVERY_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;
const ENTRY_PATH_PATTERN = /^\/[^?#]*$/;

type JsonObject = Record<string, unknown>;
type DeliveryStatus = "pending" | "sending" | "sent" | "failed" | "cancelled";
type PreparationError =
  | "invalid_request"
  | "not_found"
  | "ineligible_participant"
  | "internal_error";
export type PostmarkErrorCode =
  | "postmark_configuration_missing"
  | "postmark_timeout"
  | "postmark_network_error"
  | "postmark_unauthorized"
  | "postmark_rejected"
  | "postmark_server_error"
  | "postmark_invalid_response"
  | "postmark_result_unknown";

export type DeliveryPreparationRequest = {
  action: "prepare";
  caseId: string;
  participantIds: string[];
};

export type DeliverySendRequest = {
  action: "send";
  deliveryIds: string[];
};

export type PreparedDelivery = {
  participantId: string;
  deliveryId: string;
  result: "created" | "existing";
  status: DeliveryStatus;
  deliveryReference: string;
};

export type DeliveryPreparation = {
  caseId: string;
  entryPath: string;
  results: PreparedDelivery[];
};

type PublicDeliveryResult = {
  participant_id: string;
  delivery_id: string;
  result: "created" | "existing";
  status: DeliveryStatus;
  delivery_url: string;
};

type DeliveryClaim = {
  result: "claimed";
  deliveryId: string;
  status: "sending";
  caseId: string;
  entryPath: string;
  deliveryReference: string;
  participantEmail: string;
  participantName: string | null;
};

type DeliveryClaimRejection = {
  result:
    | "already_sent"
    | "ineligible_state"
    | "retry_limit_reached"
    | "not_found";
  status?: DeliveryStatus;
};

export type DeliveryClaimOutcome = DeliveryClaim | DeliveryClaimRejection;

export type DeliveryEmail = {
  deliveryId: string;
  caseId: string;
  recipientEmail: string;
  participantName: string | null;
  deliveryUrl: string;
};

export type PostmarkAccepted = { messageId: string };

type DeliveryLogEntry = {
  event: "eco_case_delivery_prepare" | "eco_case_delivery_send";
  action?: "prepare" | "send";
  result?: "success" | "started" | "sent" | "failed";
  resultCount?: number;
  errorCode?: PostmarkErrorCode | "internal_error";
  errorCategory?:
    | "authentication"
    | "validation"
    | "configuration"
    | "database";
};

export class DeliveryPreparationFailure extends Error {
  constructor(readonly code: Exclude<PreparationError, "internal_error">) {
    super(code);
    this.name = "DeliveryPreparationFailure";
  }
}

export class PostmarkFailure extends Error {
  constructor(readonly code: PostmarkErrorCode) {
    super(code);
    this.name = "PostmarkFailure";
  }
}

export type DeliveryPreparationDependencies = {
  secret?: string;
  publicBaseUrl?: string;
  prepare: (
    request: DeliveryPreparationRequest,
  ) => Promise<DeliveryPreparation>;
  claimDelivery?: (deliveryId: string) => Promise<DeliveryClaimOutcome>;
  completeDelivery?: (
    deliveryId: string,
    providerMessageId: string,
  ) => Promise<boolean>;
  failDelivery?: (
    deliveryId: string,
    errorCode: PostmarkErrorCode,
  ) => Promise<boolean>;
  sendEmail?: (email: DeliveryEmail) => Promise<PostmarkAccepted>;
  logger?: {
    info?: (entry: DeliveryLogEntry) => void;
    error?: (entry: DeliveryLogEntry) => void;
  };
};

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: JsonObject, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

export function parseDeliveryPreparationRequest(
  value: unknown,
): DeliveryPreparationRequest | null {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, ["action", "case_id", "participant_ids"]) ||
    value.action !== "prepare" ||
    typeof value.case_id !== "string" ||
    !Array.isArray(value.participant_ids)
  ) return null;

  const caseId = value.case_id.trim();
  if (!caseId || caseId.length > 100) return null;
  if (
    value.participant_ids.length < 1 ||
    value.participant_ids.length > MAX_PARTICIPANTS
  ) return null;

  const participantIds: string[] = [];
  const uniqueIds = new Set<string>();
  for (const candidate of value.participant_ids) {
    if (typeof candidate !== "string") return null;
    const participantId = candidate.trim().toLowerCase();
    if (!UUID_PATTERN.test(participantId) || uniqueIds.has(participantId)) {
      return null;
    }
    uniqueIds.add(participantId);
    participantIds.push(participantId);
  }

  return { action: "prepare", caseId, participantIds };
}

export function parseDeliverySendRequest(
  value: unknown,
): DeliverySendRequest | null {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, ["action", "delivery_ids"]) ||
    value.action !== "send" ||
    !Array.isArray(value.delivery_ids) ||
    value.delivery_ids.length < 1 ||
    value.delivery_ids.length > MAX_DELIVERIES
  ) return null;

  const deliveryIds: string[] = [];
  const uniqueIds = new Set<string>();
  for (const candidate of value.delivery_ids) {
    if (typeof candidate !== "string") return null;
    const deliveryId = candidate.trim().toLowerCase();
    if (!UUID_PATTERN.test(deliveryId) || uniqueIds.has(deliveryId)) {
      return null;
    }
    uniqueIds.add(deliveryId);
    deliveryIds.push(deliveryId);
  }
  return { action: "send", deliveryIds };
}

export function normalizePublicBaseUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.trim());
    const localHttp = parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" && !localHttp) ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.pathname !== "" && !/^\/+$/u.test(parsed.pathname))
    ) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function buildDeliveryUrl(
  publicBaseUrl: string,
  entryPath: string,
  deliveryReference: string,
): string | null {
  const baseUrl = normalizePublicBaseUrl(publicBaseUrl);
  if (
    !baseUrl || !ENTRY_PATH_PATTERN.test(entryPath) ||
    entryPath.startsWith("//") ||
    !DELIVERY_REFERENCE_PATTERN.test(deliveryReference)
  ) return null;
  return `${baseUrl}${entryPath}?delivery=${
    encodeURIComponent(deliveryReference)
  }`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
}

function formatAspirantDisplayName(value: string | null): string {
  const normalized = value?.trim().replace(/\s+/gu, " ") ?? "";
  if (!normalized) return "IDENTIDADE NÃO REGISTRADA";
  return Array.from(normalized.toLocaleUpperCase("pt-BR"))
    .slice(0, 80)
    .join("");
}

export function buildEcoEmblemUrl(publicBaseUrl: string): string | null {
  const baseUrl = normalizePublicBaseUrl(publicBaseUrl);
  if (!baseUrl || new URL(baseUrl).protocol !== "https:") return null;
  return `${baseUrl}/eco/eco-emblem.webp`;
}

export function buildDeliveryEmailContent(
  email: DeliveryEmail,
  publicBaseUrl: string,
) {
  const caseLabel = email.caseId.toUpperCase();
  const displayName = formatAspirantDisplayName(email.participantName);
  const emblemUrl = buildEcoEmblemUrl(publicBaseUrl);
  if (!emblemUrl) throw new PostmarkFailure("postmark_configuration_missing");
  const escapedDisplayName = escapeHtml(displayName);
  const escapedCase = escapeHtml(caseLabel);
  const escapedUrl = escapeHtml(email.deliveryUrl);
  const escapedEmblemUrl = escapeHtml(emblemUrl);
  const preheader =
    `Seu acesso individual ao Caso ${caseLabel} está disponível.`;
  return {
    subject: `E.C.O. | Acesso autorizado ao Caso ${caseLabel}`,
    preheader,
    textBody: `E.C.O.
ENCONTRAR. CONTER. OCULTAR.

TRANSMISSÃO AUTORIZADA
CLASSIFICAÇÃO: RESTRITO

ASPIRANTE: ${displayName}
CASO ${caseLabel}

MATERIAL DE AVALIAÇÃO DISPONÍVEL

O material de avaliação referente ao Caso ${caseLabel} foi liberado para este endereço.

Analise o dossiê e registre sua conclusão utilizando o canal indicado no material.

ACESSAR CASO:
${email.deliveryUrl}

Se o botão não funcionar, copie e cole o endereço acima no navegador.

Este acesso é individual. Não compartilhe o endereço de transmissão.

E.C.O.
ENCONTRAR. CONTER. OCULTAR.

Mensagem operacional referente ao acesso solicitado ao Caso ${caseLabel}.`,
    htmlBody: `<!doctype html>
<html lang="pt-BR">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapedCase}</title></head>
<body style="margin:0;padding:0;background-color:#111111;color:#f2f0e8;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${
      escapeHtml(preheader)
    }</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#111111" style="width:100%;background-color:#111111;border-collapse:collapse;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#1a1a1a" style="width:100%;max-width:600px;background-color:#1a1a1a;border:1px solid #3a3934;border-collapse:collapse;">
<tr><td style="padding:32px 28px 24px 28px;border-bottom:1px solid #3a3934;">
<img src="${escapedEmblemUrl}" width="64" height="64" alt="Emblema da E.C.O." style="display:block;width:64px;height:64px;border:0;margin:0 0 18px 0;">
<p style="margin:0 0 5px 0;color:#f2f0e8;font-size:22px;line-height:28px;font-weight:bold;letter-spacing:3px;">E.C.O.</p>
<p style="margin:0;color:#b8b3a7;font-size:11px;line-height:18px;font-weight:bold;letter-spacing:1.5px;">ENCONTRAR. CONTER. OCULTAR.</p>
</td></tr>
<tr><td style="padding:24px 28px 0 28px;">
<p style="margin:0 0 6px 0;color:#d2b65f;font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1.5px;">TRANSMISSÃO AUTORIZADA</p>
<p style="margin:0 0 28px 0;color:#b8b3a7;font-size:11px;line-height:17px;font-weight:bold;letter-spacing:1.2px;">CLASSIFICAÇÃO: RESTRITO</p>
<p style="margin:0 0 8px 0;color:#f2f0e8;font-size:14px;line-height:22px;font-weight:bold;letter-spacing:1px;">ASPIRANTE: ${escapedDisplayName}</p>
<p style="margin:0 0 28px 0;color:#b8b3a7;font-size:13px;line-height:20px;font-weight:bold;letter-spacing:1px;">CASO ${escapedCase}</p>
<h1 style="margin:0 0 22px 0;color:#f2f0e8;font-size:22px;line-height:30px;font-weight:bold;">MATERIAL DE AVALIAÇÃO DISPONÍVEL</h1>
<p style="margin:0 0 16px 0;color:#f2f0e8;font-size:15px;line-height:24px;">O material de avaliação referente ao Caso ${escapedCase} foi liberado para este endereço.</p>
<p style="margin:0 0 28px 0;color:#f2f0e8;font-size:15px;line-height:24px;">Analise o dossiê e registre sua conclusão utilizando o canal indicado no material.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 28px 0;"><tr><td bgcolor="#d2b65f" style="background-color:#d2b65f;"><a href="${escapedUrl}" style="display:inline-block;padding:15px 24px;color:#111111;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:18px;font-weight:bold;text-decoration:none;letter-spacing:1px;">ACESSAR CASO</a></td></tr></table>
<p style="margin:0 0 8px 0;color:#b8b3a7;font-size:12px;line-height:20px;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
<p style="margin:0 0 24px 0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapedUrl}" style="color:#d2b65f;text-decoration:underline;">${escapedUrl}</a></p>
<p style="margin:0;padding:18px 0 26px 0;border-top:1px solid #3a3934;color:#f2f0e8;font-size:13px;line-height:21px;font-weight:bold;">Este acesso é individual. Não compartilhe o endereço de transmissão.</p>
</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #3a3934;">
<p style="margin:0 0 4px 0;color:#f2f0e8;font-size:13px;line-height:20px;font-weight:bold;letter-spacing:1px;">E.C.O.</p>
<p style="margin:0 0 14px 0;color:#b8b3a7;font-size:10px;line-height:17px;font-weight:bold;letter-spacing:1px;">ENCONTRAR. CONTER. OCULTAR.</p>
<p style="margin:0;color:#b8b3a7;font-size:11px;line-height:18px;">Mensagem operacional referente ao acesso solicitado ao Caso ${escapedCase}.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
  };
}

export function createPostmarkSender(
  configuration: {
    token?: string;
    fromEmail?: string;
    replyTo?: string;
    messageStream?: string;
    publicBaseUrl?: string;
  },
  fetcher: typeof fetch = fetch,
) {
  return async (email: DeliveryEmail): Promise<PostmarkAccepted> => {
    const token = configuration.token?.trim();
    const fromEmail = configuration.fromEmail?.trim();
    const replyTo = configuration.replyTo?.trim();
    const messageStream = configuration.messageStream?.trim();
    const emblemUrl = configuration.publicBaseUrl
      ? buildEcoEmblemUrl(configuration.publicBaseUrl)
      : null;
    if (!token || !fromEmail || !replyTo || !messageStream || !emblemUrl) {
      throw new PostmarkFailure("postmark_configuration_missing");
    }

    const content = buildDeliveryEmailContent(
      email,
      configuration.publicBaseUrl!,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POSTMARK_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": token,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: email.recipientEmail,
          ReplyTo: replyTo,
          Subject: content.subject,
          TextBody: content.textBody,
          HtmlBody: content.htmlBody,
          MessageStream: messageStream,
          Tag: "eco-sp-001-delivery",
          Metadata: {
            case_id: email.caseId,
            delivery_id: email.deliveryId,
          },
        }),
        signal: controller.signal,
      });
    } catch {
      throw new PostmarkFailure("postmark_result_unknown");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      throw new PostmarkFailure("postmark_unauthorized");
    }
    if (response.status >= 500) {
      throw new PostmarkFailure("postmark_server_error");
    }
    if (response.status !== 200) {
      throw new PostmarkFailure("postmark_rejected");
    }

    const value = await response.json().catch(() => null);
    if (
      !isPlainObject(value) || value.ErrorCode !== 0 ||
      typeof value.MessageID !== "string" ||
      !UUID_PATTERN.test(value.MessageID)
    ) {
      throw new PostmarkFailure("postmark_invalid_response");
    }
    return { messageId: value.MessageID };
  };
}

function json(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function secretsMatch(
  expected: string,
  actual: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [expectedHash, actualHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const expectedBytes = new Uint8Array(expectedHash);
  const actualBytes = new Uint8Array(actualHash);
  let difference = expectedBytes.length ^ actualBytes.length;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    difference |= expectedBytes[index] ^ (actualBytes[index] ?? 0);
  }
  return difference === 0;
}

function publicError(code: PreparationError): Response {
  const status = code === "invalid_request"
    ? 400
    : code === "not_found"
    ? 404
    : code === "ineligible_participant"
    ? 409
    : 500;
  return json(status, { success: false, error: code });
}

export function createDeliveryPreparationHandler(
  dependencies: DeliveryPreparationDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return publicError("invalid_request");

    const publicBaseUrl = normalizePublicBaseUrl(dependencies.publicBaseUrl);
    if (!dependencies.secret || !publicBaseUrl) {
      dependencies.logger?.error?.({
        event: "eco_case_delivery_prepare",
        errorCategory: "configuration",
      });
      return publicError("internal_error");
    }

    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!token || !(await secretsMatch(dependencies.secret, token))) {
      dependencies.logger?.error?.({
        event: "eco_case_delivery_prepare",
        errorCategory: "authentication",
      });
      return json(401, { success: false, error: "unauthorized" });
    }

    if (
      !/^application\/json(?:\s*;|$)/i.test(
        request.headers.get("content-type") ?? "",
      )
    ) return publicError("invalid_request");

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return publicError("invalid_request");
    }

    let payload: unknown;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        return publicError("invalid_request");
      }
      payload = JSON.parse(rawBody);
    } catch {
      return publicError("invalid_request");
    }

    if (isPlainObject(payload) && payload.action === "send") {
      const sendRequest = parseDeliverySendRequest(payload);
      if (!sendRequest) {
        dependencies.logger?.error?.({
          event: "eco_case_delivery_send",
          errorCategory: "validation",
        });
        return publicError("invalid_request");
      }
      if (
        !dependencies.claimDelivery || !dependencies.completeDelivery ||
        !dependencies.failDelivery || !dependencies.sendEmail
      ) {
        dependencies.logger?.error?.({
          event: "eco_case_delivery_send",
          errorCategory: "configuration",
        });
        return publicError("internal_error");
      }

      const results: JsonObject[] = [];
      for (const deliveryId of sendRequest.deliveryIds) {
        dependencies.logger?.info?.({
          event: "eco_case_delivery_send",
          action: "send",
          result: "started",
        });
        let claim: DeliveryClaimOutcome;
        try {
          claim = await dependencies.claimDelivery(deliveryId);
        } catch {
          dependencies.logger?.error?.({
            event: "eco_case_delivery_send",
            action: "send",
            result: "failed",
            errorCategory: "database",
          });
          results.push({
            delivery_id: deliveryId,
            result: "failed",
            status: "failed",
            error: "internal_error",
          });
          continue;
        }

        if (claim.result !== "claimed") {
          results.push({
            delivery_id: deliveryId,
            result: claim.result,
            ...(claim.status ? { status: claim.status } : {}),
          });
          continue;
        }

        const deliveryUrl = buildDeliveryUrl(
          publicBaseUrl,
          claim.entryPath,
          claim.deliveryReference,
        );
        let failureCode: PostmarkErrorCode | null = deliveryUrl
          ? null
          : "postmark_invalid_response";

        if (!failureCode) {
          try {
            const accepted = await dependencies.sendEmail({
              deliveryId: claim.deliveryId,
              caseId: claim.caseId,
              recipientEmail: claim.participantEmail,
              participantName: claim.participantName,
              deliveryUrl: deliveryUrl!,
            });
            const completed = await dependencies.completeDelivery(
              claim.deliveryId,
              accepted.messageId,
            );
            if (!completed) {
              failureCode = "postmark_result_unknown";
            } else {
              dependencies.logger?.info?.({
                event: "eco_case_delivery_send",
                action: "send",
                result: "sent",
              });
              results.push({
                delivery_id: deliveryId,
                result: "sent",
                status: "sent",
              });
              continue;
            }
          } catch (error) {
            failureCode = error instanceof PostmarkFailure
              ? error.code
              : "postmark_result_unknown";
          }
        }

        try {
          await dependencies.failDelivery(claim.deliveryId, failureCode);
        } catch {
          failureCode = "postmark_result_unknown";
        }
        dependencies.logger?.error?.({
          event: "eco_case_delivery_send",
          action: "send",
          result: "failed",
          errorCode: failureCode,
        });
        results.push({
          delivery_id: deliveryId,
          result: "failed",
          status: "failed",
          error: failureCode,
        });
      }

      return json(200, { success: true, results });
    }

    const preparationRequest = parseDeliveryPreparationRequest(payload);
    if (!preparationRequest) {
      dependencies.logger?.error?.({
        event: "eco_case_delivery_prepare",
        errorCategory: "validation",
      });
      return publicError("invalid_request");
    }

    try {
      const preparation = await dependencies.prepare(preparationRequest);
      if (
        preparation.caseId !== preparationRequest.caseId ||
        !ENTRY_PATH_PATTERN.test(preparation.entryPath) ||
        preparation.entryPath.startsWith("//") ||
        preparation.results.length !==
          preparationRequest.participantIds.length ||
        preparation.results.some((item, index) =>
          item.participantId !== preparationRequest.participantIds[index]
        )
      ) throw new Error("invalid_preparation_response");

      const results: PublicDeliveryResult[] = preparation.results.map(
        (item) => {
          const deliveryUrl = buildDeliveryUrl(
            publicBaseUrl,
            preparation.entryPath,
            item.deliveryReference,
          );
          if (!deliveryUrl) throw new Error("invalid_preparation_response");
          return {
            participant_id: item.participantId,
            delivery_id: item.deliveryId,
            result: item.result,
            status: item.status,
            delivery_url: deliveryUrl,
          };
        },
      );

      dependencies.logger?.info?.({
        event: "eco_case_delivery_prepare",
        action: "prepare",
        result: "success",
        resultCount: results.length,
      });
      return json(200, {
        success: true,
        case_id: preparation.caseId,
        results,
      });
    } catch (error) {
      if (error instanceof DeliveryPreparationFailure) {
        return publicError(error.code);
      }
      dependencies.logger?.error?.({
        event: "eco_case_delivery_prepare",
        action: "prepare",
        errorCategory: "database",
      });
      return publicError("internal_error");
    }
  };
}

function parseRpcDelivery(value: unknown): PreparedDelivery | null {
  if (!isPlainObject(value)) return null;
  if (
    typeof value.participant_id !== "string" ||
    typeof value.delivery_id !== "string" ||
    (value.result !== "created" && value.result !== "existing") ||
    !["pending", "sending", "sent", "failed", "cancelled"].includes(
      String(value.status),
    ) ||
    typeof value.delivery_reference !== "string" ||
    !UUID_PATTERN.test(value.participant_id) ||
    !UUID_PATTERN.test(value.delivery_id) ||
    !DELIVERY_REFERENCE_PATTERN.test(value.delivery_reference)
  ) return null;
  return {
    participantId: value.participant_id,
    deliveryId: value.delivery_id,
    result: value.result,
    status: value.status as DeliveryStatus,
    deliveryReference: value.delivery_reference,
  };
}

export function createSupabaseDeliveryPreparation(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
) {
  return async (
    request: DeliveryPreparationRequest,
  ): Promise<DeliveryPreparation> => {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_server_configuration");
    }
    const response = await fetcher(
      `${supabaseUrl}/rest/v1/rpc/prepare_eco_case_deliveries`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({
          p_case_id: request.caseId,
          p_participant_ids: request.participantIds,
        }),
      },
    );
    if (!response.ok) throw new Error("delivery_preparation_failed");
    const value = await response.json().catch(() => null);
    if (!isPlainObject(value)) throw new Error("invalid_preparation_response");
    if (
      value.error === "invalid_request" || value.error === "not_found" ||
      value.error === "ineligible_participant"
    ) throw new DeliveryPreparationFailure(value.error);
    if (
      typeof value.case_id !== "string" ||
      typeof value.entry_path !== "string" ||
      !Array.isArray(value.results)
    ) throw new Error("invalid_preparation_response");
    const results = value.results.map(parseRpcDelivery);
    if (results.some((item) => item === null)) {
      throw new Error("invalid_preparation_response");
    }
    return {
      caseId: value.case_id,
      entryPath: value.entry_path,
      results: results as PreparedDelivery[],
    };
  };
}

export function createSupabaseDeliverySendStore(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
) {
  async function rpc(name: string, body: JsonObject): Promise<unknown> {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_server_configuration");
    }
    const response = await fetcher(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("delivery_send_database_failed");
    return await response.json().catch(() => null);
  }

  return {
    claimDelivery: async (
      deliveryId: string,
    ): Promise<DeliveryClaimOutcome> => {
      const value = await rpc("claim_eco_case_delivery_send", {
        p_delivery_id: deliveryId,
      });
      if (!isPlainObject(value) || typeof value.result !== "string") {
        throw new Error("invalid_delivery_claim_response");
      }
      if (
        [
          "already_sent",
          "ineligible_state",
          "retry_limit_reached",
          "not_found",
        ].includes(value.result)
      ) {
        const status = typeof value.status === "string" &&
            ["pending", "sending", "sent", "failed", "cancelled"].includes(
              value.status,
            )
          ? value.status as DeliveryStatus
          : undefined;
        return {
          result: value.result as DeliveryClaimRejection["result"],
          ...(status ? { status } : {}),
        };
      }
      if (
        value.result !== "claimed" || value.status !== "sending" ||
        typeof value.delivery_id !== "string" ||
        typeof value.case_id !== "string" ||
        typeof value.entry_path !== "string" ||
        typeof value.delivery_reference !== "string" ||
        typeof value.participant_email !== "string" ||
        (value.participant_name !== null &&
          typeof value.participant_name !== "string") ||
        !UUID_PATTERN.test(value.delivery_id) ||
        !DELIVERY_REFERENCE_PATTERN.test(value.delivery_reference)
      ) throw new Error("invalid_delivery_claim_response");
      return {
        result: "claimed",
        deliveryId: value.delivery_id,
        status: "sending",
        caseId: value.case_id,
        entryPath: value.entry_path,
        deliveryReference: value.delivery_reference,
        participantEmail: value.participant_email,
        participantName: value.participant_name,
      };
    },
    completeDelivery: async (
      deliveryId: string,
      providerMessageId: string,
    ): Promise<boolean> => {
      return await rpc("complete_eco_case_delivery_send", {
        p_delivery_id: deliveryId,
        p_provider_message_id: providerMessageId,
      }) === true;
    },
    failDelivery: async (
      deliveryId: string,
      errorCode: PostmarkErrorCode,
    ): Promise<boolean> => {
      return await rpc("fail_eco_case_delivery_send", {
        p_delivery_id: deliveryId,
        p_error_code: errorCode,
      }) === true;
    },
  };
}

if (import.meta.main) {
  const sendStore = createSupabaseDeliverySendStore(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  Deno.serve(createDeliveryPreparationHandler({
    secret: Deno.env.get("ECO_DELIVERY_ADMIN_SECRET"),
    publicBaseUrl: Deno.env.get("ECO_PUBLIC_BASE_URL"),
    prepare: createSupabaseDeliveryPreparation(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ),
    ...sendStore,
    sendEmail: createPostmarkSender({
      token: Deno.env.get("POSTMARK_SERVER_TOKEN"),
      fromEmail: Deno.env.get("POSTMARK_FROM_EMAIL"),
      replyTo: Deno.env.get("POSTMARK_REPLY_TO"),
      messageStream: Deno.env.get("POSTMARK_MESSAGE_STREAM"),
      publicBaseUrl: Deno.env.get("ECO_PUBLIC_BASE_URL"),
    }),
    logger: {
      info: (entry) => console.info(JSON.stringify(entry)),
      error: (entry) => console.error(JSON.stringify(entry)),
    },
  }));
}
