/** Traduce errores técnicos de captura a mensajes de producto. */
export function humanizeCaptureError(
  source: "meta" | "google" | "press" | string,
  raw?: string,
): string {
  const msg = (raw || "").toLowerCase();

  if (!raw) {
    if (source === "press") {
      return "No se pudo leer los portales desde el servidor (bloqueo o tiempo de espera).";
    }
    if (source === "meta") {
      return "No se pudo consultar Meta Ads Library. Revisa el acceso de captura.";
    }
    if (source === "google") {
      return "No se pudo consultar Google Ads Transparency. Revisa el acceso de captura.";
    }
    return "No se pudo completar esta fuente.";
  }

  if (
    msg.includes("token") ||
    msg.includes("unauthorized") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("authentication")
  ) {
    return "Acceso de captura no válido o sin permisos. Revisa la configuración del entorno.";
  }

  if (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("does not exist") ||
    msg.includes("actor-not-found")
  ) {
    return "La herramienta de captura no está disponible o no está contratada en la cuenta.";
  }

  if (
    msg.includes("payment") ||
    msg.includes("limit") ||
    msg.includes("quota") ||
    msg.includes("insufficient") ||
    msg.includes("rent")
  ) {
    return "Sin crédito o cuota suficiente para esta fuente de captura.";
  }

  if (
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("timed out") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("econn") ||
    msg.includes("enotfound")
  ) {
    return source === "press"
      ? "Los portales no respondieron a tiempo o bloquearon la lectura automática."
      : "La fuente no respondió a tiempo. Intenta de nuevo en unos minutos.";
  }

  if (msg.includes("http 4") || msg.includes("http 5")) {
    return source === "press"
      ? "El medio rechazó o no entregó la página al escáner."
      : "La fuente rechazó la consulta.";
  }

  // Mantener mensaje corto; no filtrar secretos.
  const clipped = raw.replace(/\s+/g, " ").trim().slice(0, 160);
  return clipped || "No se pudo completar esta fuente.";
}
