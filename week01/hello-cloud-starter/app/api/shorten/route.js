import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { saveUrl, findShortCodeByOriginalUrl } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_URL_LENGTH = 2048;

const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/*
 * createShortCode()
 *
 * 원본 URL을 입력받아 SHA-256 해시를 생성하고,
 * 그 값을 이용해 6자리 short code를 만듭니다.
 */
function createShortCode(originalUrl, length = 6) {
  const hex = createHash("sha256").update(originalUrl).digest("hex");

  let code = "";

  for (let i = 0; i < length; i++) {
    const value = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    code += ALPHABET[value % ALPHABET.length];
  }

  return code;
}

function errorResponse(code, message, status) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function normalizeHost(host) {
  return (host ?? "").trim().toLowerCase().replace(/\.$/, "").split(":")[0];
}

/*
 * 요청이 들어온 서비스의 origin (예: https://my-app.vercel.app)
 */
function getServiceOrigin(request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (!host) {
    return new URL(request.url).origin;
  }
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto?.split(",")[0].trim() ||
    new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host.split(",")[0].trim()}`;
}

/*
 * 최종 과제 2: 자기 서비스 도메인 목록
 * - 현재 요청의 Host
 * - Vercel이 제공하는 Production / Deployment / Branch 도메인
 * - (선택) SELF_HOSTNAMES 환경변수: 쉼표로 구분한 추가 도메인
 */
function getSelfHostnames(request) {
  const hosts = new Set();

  hosts.add(normalizeHost(new URL(getServiceOrigin(request)).host));
  hosts.add(normalizeHost(request.headers.get("host")));

  for (const value of [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    ...(process.env.SELF_HOSTNAMES ?? "").split(","),
  ]) {
    if (value) hosts.add(normalizeHost(value));
  }

  hosts.delete("");
  return hosts;
}

/*
 * POST()
 *
 * 클라이언트가 보낸 URL을 검사하고,
 * 문제가 없으면 short URL을 생성하여 반환합니다.
 */
export async function POST(request) {
  try {
    // 1. 요청 body 읽기
    const body = await request.json().catch(() => null);

    const raw = body?.originalUrl;
    const originalUrl = typeof raw === "string" ? raw.trim() : "";

    // 2. URL이 입력되지 않은 경우 → 400
    if (!originalUrl) {
      return errorResponse("MISSING_URL", "Original URL is required.", 400);
    }

    // 3. URL이 너무 긴 경우 → 400
    if (originalUrl.length > MAX_URL_LENGTH) {
      return errorResponse(
        "URL_TOO_LONG",
        `URL must be ${MAX_URL_LENGTH} characters or fewer.`,
        400
      );
    }

    // 4. URL 형식 검사 → 400
    let parsedUrl;
    try {
      parsedUrl = new URL(originalUrl);
    } catch {
      return errorResponse(
        "INVALID_URL",
        "URL must start with http:// or https://.",
        400
      );
    }

    // 5. 프로토콜 검사 (javascript:, ftp: 등 차단) → 400
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return errorResponse(
        "INVALID_URL",
        "URL must start with http:// or https://.",
        400
      );
    }

    // 6. 최종 과제 2: 자기 서비스 URL 단축 방지 → 400
    if (getSelfHostnames(request).has(normalizeHost(parsedUrl.hostname))) {
      return errorResponse(
        "SELF_URL_NOT_ALLOWED",
        "URLs of this URL shortener cannot be shortened.",
        400
      );
    }

    const baseUrl = getServiceOrigin(request);

    // 7. 최종 과제 1: 이미 단축한 URL이면 기존 shortCode 반환 → 200
    const existingCode = await findShortCodeByOriginalUrl(originalUrl);
    if (existingCode) {
      return NextResponse.json(
        {
          shortCode: existingCode,
          shortUrl: `${baseUrl}/${existingCode}`,
          originalUrl,
        },
        { status: 200 }
      );
    }

    // 8. 새 shortCode 생성 후 DB 저장 → 201
    const shortCode = createShortCode(originalUrl);
    await saveUrl(shortCode, originalUrl);

    return NextResponse.json(
      {
        shortCode,
        shortUrl: `${baseUrl}/${shortCode}`,
        originalUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    // 9. 서버 내부 오류 → 500
    console.error("Failed to create short URL", error);
    return errorResponse("INTERNAL_ERROR", "Failed to create short URL.", 500);
  }
}
