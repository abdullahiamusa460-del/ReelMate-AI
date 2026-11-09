import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = (process.env.BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const BACKEND_API_TOKEN = process.env.BACKEND_API_TOKEN || "";
const TIMEOUT_MS = Number(process.env.BACKEND_TIMEOUT_MS || 120_000);

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message, details: {}, request_id: null } }, { status });
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await context.params;
  if (
    path.length === 0 ||
    path.some(
      (segment) =>
        segment === ".." ||
        segment === "." ||
        segment.includes("/") ||
        segment.includes("\\") ||
        segment.length > 200,
    )
  ) {
    return errorResponse(400, "invalid_backend_path", "The backend path is invalid.");
  }

  const target = new URL(`/api/v1/${path.map(encodeURIComponent).join("/")}`, BACKEND_URL);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") || "application/json");
  const requestId = request.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);
  if (BACKEND_API_TOKEN) headers.set("authorization", `Bearer ${BACKEND_API_TOKEN}`);

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return errorResponse(
      503,
      timedOut ? "backend_timeout" : "backend_unreachable",
      timedOut
        ? "The ReelMate backend did not respond in time."
        : "The ReelMate backend is not reachable. Start it and check BACKEND_URL.",
    );
  }

  const responseHeaders = new Headers();
  for (const header of ["content-type", "content-disposition", "retry-after", "x-request-id"]) {
    const value = response.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export {
  proxy as DELETE,
  proxy as GET,
  proxy as HEAD,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
