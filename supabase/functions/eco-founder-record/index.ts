const TOKEN_PATTERN = /^[a-f0-9]{64}$/u;

type JsonObject = Record<string, unknown>;
export type FounderRecordRepository = {
  consumeRateLimit: (rateKey: string) => Promise<boolean>;
  hasAccess: (token: string) => Promise<boolean>;
};
export type FounderRecordDependencies = {
  rateLimitSalt?: string;
  allowedOrigins?: string[];
  recordApiUrl?: string;
  repository: FounderRecordRepository;
  loadImage?: () => Promise<Uint8Array>;
  logger?: {
    info?: (message: string) => void;
    error?: (message: string) => void;
  };
};

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)].map((item) =>
    item.toString(16).padStart(2, "0")
  ).join("");
}

function response(status: number, body: string, contentType: string): Response {
  return new Response(status === 204 ? null : body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; img-src https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}

function withCors(response: Response, origin: string | null): Response {
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Vary", "Origin");
  }
  return response;
}

function allowedOrigin(
  origin: string | null,
  additional: string[] = [],
): boolean {
  if (!origin) return true;
  // The protected document is rendered in a sandboxed iframe. Subresources
  // requested from that opaque origin can legitimately carry `Origin: null`.
  // Access still requires the unguessable token and a paid-order lookup.
  if (origin === "null") return true;
  try {
    const url = new URL(origin);
    return origin === "https://liberula.com" ||
      origin === "https://www.liberula.com" ||
      additional.includes(origin) ||
      ((url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
        (url.protocol === "http:" || url.protocol === "https:"));
  } catch {
    return false;
  }
}

function denied(): Response {
  return response(404, "Registro indisponível.", "text/plain; charset=utf-8");
}

function imageResponse(body: Uint8Array): Response {
  return new Response(Uint8Array.from(body).buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function protectedImageUrl(
  recordApiUrl: string | undefined,
  token: string,
): string | undefined {
  if (!recordApiUrl) return undefined;
  try {
    const url = new URL(recordApiUrl);
    if (
      url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash
    ) return undefined;
    url.searchParams.set("access", token);
    url.searchParams.set("asset", "image");
    return url.toString();
  } catch {
    return undefined;
  }
}

export function renderFounderRecordPage(imageUrl?: string): string {
  const tracking =
    `<script>(()=>{const send=(data)=>parent.postMessage({source:'eco-founder-record',...data},'*');const resize=()=>send({height:document.documentElement.scrollHeight});addEventListener('load',resize);addEventListener('resize',resize);new ResizeObserver(resize).observe(document.body)})();</script>`;
  const image = imageUrl
    ? `<figure><img src="${
      escapeHtml(imageUrl)
    }" alt="Último registro visual do agente Quina diante da passagem encontrada na central." style="display:block;width:100%;height:auto;background:#171919"><figcaption class="meta">ÚLTIMO REGISTRO VISUAL ÍNTEGRO // DISPOSITIVO DE CAMPO QN-04</figcaption></figure>`
    : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>E.C.O. // Registro complementar</title><style>html{background:#080909;color:#eeeae1;font-family:Arial,Helvetica,sans-serif}body{margin:0}.page{max-width:760px;margin:auto;padding:32px 18px 72px}header{border-bottom:1px solid #353737;padding-bottom:24px;margin-bottom:34px}.brand{font-size:26px;font-weight:900;letter-spacing:.16em}.meta,.speaker,.label{font-family:Consolas,'Courier New',monospace;letter-spacing:.08em}.meta{color:#9d9990;font-size:12px;line-height:1.8}.label{color:#d94b55;font-size:12px;font-weight:700}.transcript{border-left:2px solid #3d4040;padding-left:18px}.line{margin:20px 0}.speaker{display:block;color:#d3cfc6;font-size:12px;font-weight:700;margin-bottom:6px}.direction{color:#918d85;font-style:italic}.closing{border-top:1px solid #353737;margin-top:38px;padding-top:26px;color:#bbb7ae;line-height:1.7}figure{margin:28px 0}figcaption{margin-top:10px}p{line-height:1.65}h1{font-size:clamp(27px,6vw,42px);line-height:1.12;margin:12px 0 18px}@media(max-width:480px){.page{padding-inline:14px}.transcript{padding-left:13px}}</style></head><body><main class="page"><header><div class="brand">E.C.O.</div><p class="meta">REGISTRO COMPLEMENTAR ECO-SP-001<br>ORIGEM: DISPOSITIVO DE CAMPO QN-04<br>ESTADO: FRAGMENTADO<br>ACESSO: AGENTES FUNDADORES</p></header><p class="label">TRANSMISSÃO RECUPERADA</p><h1>Transcrição operacional do agente Quina</h1>${image}<section class="transcript" aria-label="Transcrição operacional completa"><p class="meta">02:23:11</p>
${
    [
      ["CONTROLE", "Quina, confirme condição do outro lado."],
      ["QUINA", "Confirmo. Estou dentro."],
      ["CONTROLE", "Descreva o ambiente."],
      ["QUINA", "Não sei por onde começar."],
      ["CONTROLE", "Comece pelo que está vendo."],
      ["QUINA", "É maior que o prédio. Muito maior."],
      ["CONTROLE", "Estrutura?"],
      ["QUINA", "Corredores. Escadas. Portas."],
      ["QUINA", "Mas não faz sentido."],
      ["CONTROLE", "Seja específico."],
      [
        "QUINA",
        "Tem uma escada passando por cima de mim e terminando embaixo. Tem portas em paredes que não levam a lugar nenhum. Algumas parecem antigas. Outras parecem novas.",
      ],
      ["QUINA", "Controle, isso é..."],
      ["CONTROLE", "Quina?"],
      ["QUINA", "Isso é fantástico."],
      ["CONTROLE", "Não avance além do alcance visual da entrada."],
      ["QUINA", "Eu consigo ver dezenas de níveis. Talvez centenas."],
      ["QUINA", "Jonas esteve aqui."],
      ["CONTROLE", "Não temos confirmação."],
      ["QUINA", "Ele esteve. Eu sei que esteve."],
      ["", "[RUÍDO NÃO IDENTIFICADO]"],
      ["", "[SILÊNCIO, 3 SEGUNDOS]"],
      ["QUINA", "Cacete..."],
      ["CONTROLE", "O que houve?"],
      ["QUINA", "Tem alguma coisa atrás de mim."],
      ["CONTROLE", "Quina, retorne imediatamente."],
      ["CONTROLE, AFASTANDO-SE DO MICROFONE", "CÓDIGO ÍNDIGO! CÓDIGO ÍNDIGO!"],
      ["QUINA", "Eu..."],
      ["CONTROLE", "Quina, mexa-se. Agora."],
      ["QUINA", "Sinto que, se eu me mexer, alguma coisa ruim vai acontecer."],
      ["", "[PASSOS RÁPIDOS]"],
      ["", "[IMPACTO]"],
      ["QUINA", "Merda! Ele está indo para a porta!"],
      ["CONTROLE", "Retorne imediatamente!"],
      ["QUINA", "Tem uma entidade fugindo!"],
      ["CONTROLE", "Quina, saia daí!"],
      ["", "[CORRIDA]"],
      ["", "[PORTA BATENDO]"],
      ["QUINA", "Nã..."],
      ["", "[INTERFERÊNCIA FORTE]"],
      ["QUINA", "NÃO!"],
      ["CONTROLE", "Quina, responda!"],
      ["QUINA", "Ela fechou a porta!"],
      ["CONTROLE", "Estamos enviando reforço. Aguente firme!"],
      ["QUINA", "ABRE!"],
      ["QUINA", "ABRE ESSA PORRA!"],
      ["", "[INTERFERÊNCIA]"],
      ["QUINA", "ME TIRA DAQUI!"],
      ["QUINA", "ME TIRA DAQUI!"],
      ["", "[TRANSMISSÃO INTERROMPIDA]"],
    ].map(([speaker, line]) =>
      `<p class="line ${speaker ? "" : "direction"}">${
        speaker ? `<span class="speaker">${speaker}</span>` : ""
      }${line}</p>`
    ).join("")
  }
</section><section class="closing"><p>A transmissão acima não fazia parte do relatório liberado durante a investigação.</p><p>O agente Quina permaneceu do outro lado da passagem. A porta foi encontrada fechada quando a equipe de apoio chegou ao local.</p><p>A entidade ainda não foi identificada ou classificada.</p><p><strong>Novas instruções serão enviadas quando a próxima operação for autorizada.</strong></p></section></main>${tracking}</body></html>`;
}

export function createFounderRecordHandler(
  dependencies: FounderRecordDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (!dependencies.rateLimitSalt || dependencies.rateLimitSalt.length < 32) {
      return denied();
    }
    const origin = request.headers.get("origin");
    if (!allowedOrigin(origin, dependencies.allowedOrigins)) return denied();
    if (request.method === "OPTIONS") {
      const preflight = response(204, "", "text/plain; charset=utf-8");
      preflight.headers.set(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS",
      );
      return withCors(preflight, origin);
    }
    if (request.method !== "GET") return denied();
    const url = new URL(request.url);
    const token = url.searchParams.get("access") ?? "";
    const asset = url.searchParams.get("asset");
    const keys = [...url.searchParams.keys()].sort();
    const validAsset = asset === "image";
    const validKeys = request.method === "GET" && validAsset
      ? JSON.stringify(keys) === JSON.stringify(["access", "asset"])
      : asset === null && JSON.stringify(keys) === JSON.stringify(["access"]);
    if (!TOKEN_PATTERN.test(token) || !validKeys) return denied();
    const client = (request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown")
      .trim().slice(0, 80);
    try {
      const rateKey = await sha256(
        `${dependencies.rateLimitSalt}:${client}:${token}`,
      );
      if (!(await dependencies.repository.consumeRateLimit(rateKey))) {
        return response(
          429,
          "Tente novamente em instantes.",
          "text/plain; charset=utf-8",
        );
      }
      if (!(await dependencies.repository.hasAccess(token))) return denied();
    } catch {
      dependencies.logger?.error?.("eco_founder_record_access_failed");
      return response(
        503,
        "Registro temporariamente indisponível.",
        "text/plain; charset=utf-8",
      );
    }
    if (request.method === "GET" && asset === "image") {
      if (!dependencies.loadImage) return denied();
      try {
        return withCors(imageResponse(await dependencies.loadImage()), origin);
      } catch {
        dependencies.logger?.error?.("eco_founder_record_image_failed");
        return response(
          503,
          "Registro temporariamente indisponível.",
          "text/plain; charset=utf-8",
        );
      }
    }
    dependencies.logger?.info?.("eco_founder_record_opened");
    const imageUrl = protectedImageUrl(dependencies.recordApiUrl, token);
    return withCors(
      response(
        200,
        renderFounderRecordPage(imageUrl),
        "text/plain; charset=utf-8",
      ),
      origin,
    );
  };
}

export function createSupabaseFounderRecordRepository(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
): FounderRecordRepository {
  async function rpc(name: string, body: JsonObject): Promise<unknown> {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_configuration");
    }
    const response = await fetcher(
      `${supabaseUrl.replace(/\/+$/u, "")}/rest/v1/rpc/${name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error("database_failure");
    return await response.json().catch(() => null);
  }
  return {
    consumeRateLimit: async (rateKey) => {
      const value = await rpc("consume_eco_status_rate_limit", {
        p_rate_key: rateKey,
        p_window_seconds: 60,
        p_request_limit: 20,
      });
      return isPlainObject(value) && value.allowed === true;
    },
    hasAccess: async (token) => {
      const value = await rpc("get_eco_founder_record_access", {
        p_access_token: token,
      });
      return isPlainObject(value) && value.allowed === true;
    },
  };
}

if (import.meta.main) {
  const repository = createSupabaseFounderRecordRepository(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  let image: Promise<Uint8Array> | undefined;
  Deno.serve(createFounderRecordHandler({
    rateLimitSalt: Deno.env.get("ECO_FOUNDER_RECORD_RATE_LIMIT_SALT"),
    allowedOrigins: (Deno.env.get("ECO_ALLOWED_ORIGINS") ?? "").split(",").map((
      value,
    ) => value.trim()).filter(Boolean),
    recordApiUrl: Deno.env.get("ECO_FOUNDER_RECORD_API_URL"),
    repository,
    loadImage: () =>
      image ??= Deno.readFile(
        new URL("./assets/quina-final-transmission.png", import.meta.url),
      ),
    logger: {
      info: (message) => console.info(message),
      error: (message) => console.error(message),
    },
  }));
}
