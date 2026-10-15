import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { registrationSchema } from "@/lib/auth-validation";

interface RegistrationResponse {
  success: boolean;
  data: { id: string; name: string | null; email: string } | null;
  error: string | null;
}

function respond(body: RegistrationResponse, status: number): Response {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
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
    const [user] = await db.insert(users).values({ name, email, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id, name: users.name, email: users.email });
    if (!user) {
      return respond({ success: false, data: null, error: "Email is already registered." }, 409);
    }

    return respond({ success: true, data: user, error: null }, 201);
  } catch {
    return respond({ success: false, data: null, error: "Unable to register. Please try again." }, 500);
  }
}
