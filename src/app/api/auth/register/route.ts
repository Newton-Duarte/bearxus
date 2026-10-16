import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { registrationSchema } from "@/lib/auth-validation";
import { requestEmailVerification } from "@/lib/email-verification";
import { isEmailVerificationEnabled } from "@/lib/email-verification-config";
import { checkAuthRateLimit, rateLimitResponse } from "@/lib/rate-limit";

interface RegistrationResponse {
  success: boolean;
  data: { id: string; name: string | null; email: string; verificationEmailSent: boolean; verificationRequired: boolean } | null;
  error: string | null;
}

function respond(body: RegistrationResponse, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = await checkAuthRateLimit("register", request.headers);
  if (!rateLimit.success) return rateLimitResponse(rateLimit);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return respond({ success: false, data: null, error: "Invalid JSON body." }, 400);
  }

  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return respond({ success: false, data: null, error: parsed.error.issues[0].message }, 400);
  }

  try {
    const { name, email, password } = parsed.data;
    const existing = await db.query.users.findFirst({
      columns: { id: true },
      where: sql`lower(${users.email}) = ${email}`,
    });
    if (existing) {
      return respond({ success: false, data: null, error: "Email is already registered." }, 409);
    }

    const passwordHash = await hash(password, 12);
    const verificationRequired = isEmailVerificationEnabled();
    const [user] = await db.insert(users).values({
      name, email, passwordHash, emailVerified: verificationRequired ? null : new Date(),
    })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, name: users.name, email: users.email });
    if (!user) {
      return respond({ success: false, data: null, error: "Email is already registered." }, 409);
    }

    let verificationEmailSent = false;
    if (verificationRequired) {
      try {
        verificationEmailSent = (await requestEmailVerification(email)).status === "sent";
      } catch {
        // Account creation succeeded; allow recovery through the resend flow.
      }
    }
    return respond({ success: true, data: { ...user, verificationEmailSent, verificationRequired }, error: null }, 201);
  } catch {
    return respond({ success: false, data: null, error: "Unable to register. Please try again." }, 500);
  }
}
