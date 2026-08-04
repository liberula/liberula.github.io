"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./FounderRecord.module.css";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const TRACK_EVENTS = new Set([
  "eco_founder_audio_started",
  "eco_founder_audio_completed",
]);

function configuredEndpoint(): string | null {
  const value = process.env.NEXT_PUBLIC_ECO_FOUNDER_RECORD_API_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.protocol === "http:";
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export default function FounderRecord() {
  const search = useSearchParams();
  const token = search.get("access") ?? "";
  const endpoint = useMemo(configuredEndpoint, []);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [document, setDocument] = useState<string | null>(null);
  const [height, setHeight] = useState(900);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!endpoint || !TOKEN_PATTERN.test(token)) {
      setFailed(true);
      return;
    }
    const controller = new AbortController();
    const url = `${endpoint}?access=${encodeURIComponent(token)}`;
    fetch(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("record_unavailable");
        const content = await response.text();
        if (!content.startsWith("<!doctype html>")) throw new Error("invalid_record");
        setDocument(content);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, [endpoint, token]);

  useEffect(() => {
    if (!endpoint || !TOKEN_PATTERN.test(token)) return;
    const listener = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow || !event.data || event.data.source !== "eco-founder-record") return;
      if (Number.isFinite(event.data.height)) {
        setHeight(Math.min(10000, Math.max(600, Math.ceil(event.data.height))));
      }
      if (typeof event.data.event === "string" && TRACK_EVENTS.has(event.data.event)) {
        fetch(`${endpoint}?access=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: event.data.event }),
          credentials: "omit",
          referrerPolicy: "no-referrer",
          keepalive: true,
        }).catch(() => undefined);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [endpoint, token]);

  if (failed) {
    return <section className={styles.state}><strong>REGISTRO INDISPONÍVEL</strong><span>Confirme se você abriu o endereço individual recebido por e-mail.</span></section>;
  }
  if (!document) return <p className={styles.state}>VALIDANDO ACESSO...</p>;
  return (
    <iframe
      ref={iframe}
      className={styles.frame}
      style={{ height }}
      title="Registro operacional final do agente Quina"
      sandbox="allow-scripts"
      srcDoc={document}
    />
  );
}
