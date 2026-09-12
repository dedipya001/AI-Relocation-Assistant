import axios from "axios";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { config } from "../core/config.js";

const DEVELOPMENT_JWT_SECRET = "dev-only-change-me-please";

export interface AccessTokenClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function assertJwtSecret(): void {
  if (config.ENVIRONMENT === "production" && config.JWT_SECRET === DEVELOPMENT_JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured before using account authentication in production.");
  }
}

function sign(input: string): string {
  assertJwtSecret();
  return createHmac("sha256", config.JWT_SECRET).update(input).digest("base64url");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algorithm, salt, expectedHex] = stored.split("$");
    if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, "hex");
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function issueAccessToken(userId: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AccessTokenClaims = {
    sub: userId,
    email,
    iat: now,
    exp: now + config.JWT_TTL_SECONDS,
  };
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const body = encodeJson(payload);
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid access token.");

  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("Invalid access token signature.");
  }

  let claims: AccessTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessTokenClaims;
  } catch {
    throw new Error("Invalid access token payload.");
  }

  if (!claims.sub || !claims.email || !claims.exp) throw new Error("Invalid access token claims.");
  if (claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("Access token expired.");
  return claims;
}

export function tokenFromAuthorizationHeader(header?: string): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const response = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
    params: { id_token: idToken },
    timeout: 8000,
  });
  const payload = response.data || {};
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  if (!payload.sub || !payload.email || !emailVerified) {
    throw new Error("Google identity token is not verified.");
  }
  if (config.GOOGLE_CLIENT_ID && payload.aud !== config.GOOGLE_CLIENT_ID) {
    throw new Error("Google identity token audience does not match this application.");
  }
  return { sub: String(payload.sub), email: String(payload.email).toLowerCase() };
}
