export type AdminTokenType = "admin-session" | "admin-access";

type AdminTokenPayload = {
  sub: "admin";
  type: AdminTokenType;
  exp: number;
  v: 1;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign", "verify"],
  );
}

export function createAdminTokenPayload(type: AdminTokenType, maxAgeSeconds: number): AdminTokenPayload {
  return {
    sub: "admin",
    type,
    exp: Date.now() + maxAgeSeconds * 1000,
    v: 1,
  };
}

export async function signAdminToken(secret: string, payload: AdminTokenPayload): Promise<string> {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  const unsigned = `${header}.${body}`;
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(unsigned));

  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminToken(
  token: string,
  secret: string,
  expectedType?: AdminTokenType,
): Promise<AdminTokenPayload | null> {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) {
      return null;
    }

    const key = await importHmacKey(secret);
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      encoder.encode(`${header}.${body}`),
    );

    if (!verified) {
      return null;
    }

    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as Partial<AdminTokenPayload>;

    if (
      payload.sub !== "admin" ||
      payload.v !== 1 ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now() ||
      (expectedType && payload.type !== expectedType)
    ) {
      return null;
    }

    if (payload.type !== "admin-session" && payload.type !== "admin-access") {
      return null;
    }

    return payload as AdminTokenPayload;
  } catch {
    return null;
  }
}