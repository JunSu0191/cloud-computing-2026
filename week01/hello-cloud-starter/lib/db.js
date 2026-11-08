import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// 4주차: shortCode와 originalUrl 매핑 저장
// 같은 URL은 같은 shortCode(해시)를 만들기 때문에 PK 충돌이 나면 무시합니다.
export async function saveUrl(shortCode, originalUrl) {
  await sql`
    INSERT INTO urls (short_code, original_url)
    VALUES (${shortCode}, ${originalUrl})
    ON CONFLICT (short_code) DO NOTHING
  `;
}

// 5주차: shortCode로 originalUrl 조회
export async function findUrlByShortCode(shortCode) {
  const rows = await sql`
    SELECT original_url
    FROM urls
    WHERE short_code = ${shortCode}
    LIMIT 1
  `;

  return rows[0]?.original_url ?? null;
}

// 최종 과제 1: 이미 단축한 URL이면 기존 shortCode 조회
export async function findShortCodeByOriginalUrl(originalUrl) {
  const rows = await sql`
    SELECT short_code
    FROM urls
    WHERE original_url = ${originalUrl}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  return rows[0]?.short_code ?? null;
}
