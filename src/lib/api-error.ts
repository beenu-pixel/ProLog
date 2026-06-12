// Wspólny błąd warstwy serwisowej API. Serwisy (src/lib/services/*) rzucają
// `ApiError(status, message)`, a wołające warstwy mapują go na odpowiedź:
//   • REST route → Response.json({ error: message }, { status })
//   • MCP tool   → { content: [{ type: "text", text: message }], isError: true }
// Dzięki temu logika walidacji/zapisu jest jedna, a oba wejścia zachowują się
// identycznie.

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Czy wyjątek to `ApiError` (z polem `status`). */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
