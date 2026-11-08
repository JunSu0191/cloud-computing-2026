import { findUrlByShortCode } from "../../lib/db";
import { recordClick } from "../../lib/stats";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { shortCode } = await params;

  const originalUrl = await findUrlByShortCode(shortCode);

  // 5주차: 존재하지 않는 shortCode → 404 (Redirect 하지 않음)
  if (!originalUrl) {
    // 6주차: 운영자가 Runtime Logs에서 확인할 수 있도록 로그
    console.warn("Short URL not found", { shortCode });

    return new Response("Not Found", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  // 6주차: 원본 URL을 찾은 경우에만 클릭 기록 (실패해도 Redirect는 수행)
  try {
    await recordClick(shortCode);
  } catch (error) {
    console.error("Failed to record click", { shortCode });
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: originalUrl,
      "Cache-Control": "no-store",
    },
  });
}
