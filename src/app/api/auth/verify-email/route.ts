import { verifyEmailToken } from "@/lib/email-verification";

const privateHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

export async function GET(request: Request): Promise<Response> {
  let destination = "/verify-email?status=invalid";
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    if (await verifyEmailToken(token) === "verified") destination = "/sign-in?verified=1";
  } catch {
    destination = "/verify-email?status=error";
  }
  return new Response(null, { status: 303, headers: { ...privateHeaders, Location: destination } });
}

export function HEAD(): Response {
  return new Response(null, { status: 405, headers: { ...privateHeaders, Allow: "GET" } });
}
