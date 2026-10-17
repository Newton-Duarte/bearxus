import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const authState = { configuration: undefined as unknown };

  return {
    authState,
    compare: vi.fn(),
    credentialsProvider: vi.fn((options: Record<string, unknown>) => ({ id: "credentials", ...options })),
    findFirst: vi.fn(),
    isEmailVerificationEnabled: vi.fn(),
    nextAuth: vi.fn((configuration: unknown) => {
      authState.configuration = configuration;
      return {
        auth: vi.fn(),
        handlers: { GET: vi.fn(), POST: vi.fn() },
        signIn: vi.fn(),
        signOut: vi.fn(),
      };
    }),
    update: vi.fn(),
    updateReturning: vi.fn(),
    updateSet: vi.fn(),
    updateWhere: vi.fn(),
  };
});

vi.mock("bcryptjs", () => ({ compare: mocks.compare }));
vi.mock("next-auth", () => {
  class AuthError extends Error {
    type = "AuthError";
  }

  class CredentialsSignin extends AuthError {
    type = "CredentialsSignin";
  }

  return { CredentialsSignin, default: mocks.nextAuth };
});
vi.mock("next-auth/providers/credentials", () => ({ default: mocks.credentialsProvider }));
vi.mock("next-auth/providers/github", () => ({ default: { id: "github" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), sql: vi.fn() }));
vi.mock("@/db", () => ({
  db: {
    query: { users: { findFirst: mocks.findFirst } },
    update: mocks.update,
  },
}));
vi.mock("@/db/auth-adapter", () => ({ authAdapter: {} }));
vi.mock("@/db/schema", () => ({ users: { email: "email", id: "id", emailVerified: "emailVerified" } }));
vi.mock("@/lib/email-verification-config", () => ({
  isEmailVerificationEnabled: mocks.isEmailVerificationEnabled,
}));

import { auth } from "@/auth";
import { EmailNotVerifiedError } from "@/lib/auth-errors";

void auth;

interface CredentialsProvider {
  id?: string;
  authorize?: (credentials: unknown) => Promise<unknown>;
}

interface AuthConfiguration {
  callbacks: {
    session: (input: { session: { user: Record<string, unknown> }; token: { sub?: string } }) => { user: Record<string, unknown> };
  };
  providers: CredentialsProvider[];
}

const configuration = mocks.authState.configuration as AuthConfiguration;
const authorize = configuration.providers.find((provider) => provider.id === "credentials")?.authorize;

if (!authorize) throw new Error("Credentials provider was not configured for tests.");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findFirst.mockResolvedValue({
    id: "user-1",
    name: "Bear",
    email: "user@example.com",
    image: null,
    passwordHash: "stored-hash",
    emailVerified: new Date("2026-01-01T00:00:00.000Z"),
  });
  mocks.compare.mockResolvedValue(true);
  mocks.isEmailVerificationEnabled.mockReturnValue(true);
  mocks.updateReturning.mockResolvedValue([{ id: "user-1" }]);
  mocks.updateWhere.mockReturnValue({ returning: mocks.updateReturning });
  mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
  mocks.update.mockReturnValue({ set: mocks.updateSet });
});

describe("credentials authorization", () => {
  it("rejects malformed credentials before querying the database", async () => {
    await expect(authorize({ email: "invalid", password: "short" })).resolves.toBeNull();

    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a missing user or incorrect password", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    await expect(authorize({ email: "user@example.com", password: "password123" })).resolves.toBeNull();

    mocks.findFirst.mockResolvedValueOnce({ passwordHash: "stored-hash" });
    mocks.compare.mockResolvedValueOnce(false);
    await expect(authorize({ email: "user@example.com", password: "password123" })).resolves.toBeNull();
  });

  it("returns the normalized verified user", async () => {
    const result = await authorize({ email: " USER@EXAMPLE.COM ", password: "password123" });

    expect(result).toEqual({ id: "user-1", name: "Bear", email: "user@example.com", image: null });
    expect(mocks.findFirst).toHaveBeenCalled();
    expect(mocks.compare).toHaveBeenCalledWith("password123", "stored-hash");
  });

  it("rejects an unverified user while verification is enabled", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "user-1",
      name: "Bear",
      email: "user@example.com",
      image: null,
      passwordHash: "stored-hash",
      emailVerified: null,
    });

    await expect(authorize({ email: "user@example.com", password: "password123" })).rejects.toBeInstanceOf(
      EmailNotVerifiedError,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("auto-verifies an unverified user when verification is disabled", async () => {
    mocks.isEmailVerificationEnabled.mockReturnValue(false);
    mocks.findFirst.mockResolvedValue({
      id: "user-1",
      name: "Bear",
      email: "user@example.com",
      image: null,
      passwordHash: "stored-hash",
      emailVerified: null,
    });

    await expect(authorize({ email: "user@example.com", password: "password123" })).resolves.toEqual({
      id: "user-1",
      name: "Bear",
      email: "user@example.com",
      image: null,
    });
    expect(mocks.update).toHaveBeenCalled();
  });

  it("rejects auto-verification when the conditional update changes no rows", async () => {
    mocks.isEmailVerificationEnabled.mockReturnValue(false);
    mocks.findFirst.mockResolvedValue({
      id: "user-1",
      name: "Bear",
      email: "user@example.com",
      image: null,
      passwordHash: "stored-hash",
      emailVerified: null,
    });
    mocks.updateReturning.mockResolvedValue([]);

    await expect(authorize({ email: "user@example.com", password: "password123" })).resolves.toBeNull();
  });
});

describe("session callback", () => {
  it("copies the JWT subject to the session user id", () => {
    const session = { user: { name: "Bear", email: "user@example.com", image: null } };

    expect(configuration.callbacks.session({ session, token: { sub: "user-1" } })).toEqual({
      user: { name: "Bear", email: "user@example.com", image: null, id: "user-1" },
    });
  });

  it("leaves the session unchanged when the JWT has no subject", () => {
    const session = { user: { name: "Bear", email: "user@example.com", image: null } };

    expect(configuration.callbacks.session({ session, token: {} })).toEqual({ user: session.user });
    expect(mocks.compare).not.toHaveBeenCalled();
  });
});
