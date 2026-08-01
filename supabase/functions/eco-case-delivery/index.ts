import { renderEcoDeliveryEmail } from "../../../lib/eco/delivery-email.mjs";

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

export const buildDeliveryEmailContent = renderEcoDeliveryEmail;

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
    if (!token || !fromEmail || !replyTo || !messageStream) {
      throw new PostmarkFailure("postmark_configuration_missing");
    }

    const content = renderEcoDeliveryEmail(email);
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
