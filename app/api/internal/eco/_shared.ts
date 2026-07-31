import { NextRequest, NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const DELIVERY_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

type LocalConfiguration = {
  supabaseUrl: string;
  secretKey: string;
  deliveryFunctionUrl: string;
  deliveryAdminSecret: string;
};

function parseHttpsUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash
    ) return null;
    return url;
  } catch {
    return null;
  }
}

export function isLocalDevelopmentRequest(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (!LOCAL_HOSTS.has(request.nextUrl.hostname)) return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function unavailableResponse() {
  return NextResponse.json(
    { success: false, error: "unauthorized" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export function genericResponse(error: string, status = 500) {
  return NextResponse.json(
    { success: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function successResponse(body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export function readLocalConfiguration(): LocalConfiguration | null {
  const supabase = parseHttpsUrl(process.env.ECO_ADMIN_SUPABASE_URL);
  const secretKey = process.env.ECO_ADMIN_SUPABASE_SECRET_KEY?.trim();
  const deliveryAdminSecret = process.env.ECO_DELIVERY_ADMIN_SECRET?.trim();
  if (
    !supabase || !secretKey?.startsWith("sb_secret_") ||
    !deliveryAdminSecret
  ) return null;

  const configuredFunction = process.env.ECO_DELIVERY_FUNCTION_URL?.trim();
  const deliveryFunction = configuredFunction
    ? parseHttpsUrl(configuredFunction)
    : new URL("/functions/v1/eco-case-delivery", supabase);
  if (
    !deliveryFunction || deliveryFunction.origin !== supabase.origin ||
    deliveryFunction.pathname.replace(/\/+$/, "") !==
      "/functions/v1/eco-case-delivery"
  ) return null;

  return {
    supabaseUrl: supabase.origin,
    secretKey,
    deliveryFunctionUrl: deliveryFunction.toString(),
    deliveryAdminSecret,
  };
}

export async function readBoundedJson(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return null;
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 8 * 1024) return null;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8 * 1024) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
