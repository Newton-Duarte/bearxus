import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteEmail: vi.fn(),
  deleteReturning: vi.fn(),
  deleteWhere: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
  execute: vi.fn(),
  findFirst: vi.fn(),
  gt: vi.fn(),
  inArray: vi.fn(),
  isEmailVerificationEnabled: vi.fn(),
  isNotNull: vi.fn(),
  isNull: vi.fn(),
  noRowsUpdate: vi.fn(),
  sendVerificationEmail: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  updateReturning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  verifyUpdate: vi.fn(),
  verifyUpdateReturning: vi.fn(),
  verifyUpdateSet: vi.fn(),
  verifyUpdateWhere: vi.fn(),
  with: vi.fn(),
  withAs: vi.fn(),
}));

vi.mock("server-only", () => ({}));
import { createHash } from "node:crypto";

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  eq: mocks.eq,
  gt: mocks.gt,
  inArray: mocks.inArray,
  isNotNull: mocks.isNotNull,
  isNull: mocks.isNull,
  sql: vi.fn(() => "sql"),
}));
vi.mock("@/db", () => ({
  db: {
    $with: () => ({ as: mocks.withAs }),
    delete: mocks.deleteEmail,
    execute: mocks.execute,
    query: { users: { findFirst: mocks.findFirst } },
    select: mocks.select,
    update: mocks.update,
    with: mocks.with,
  },
}));
vi.mock("@/db/schema", () => ({
  emailVerifications: {
    expiresAt: "expiresAt",
    lastSentAt: "lastSentAt",
    tokenHash: "tokenHash",
    userId: "userId",
  },
  users: { email: "email", emailVerified: "emailVerified", id: "id", passwordHash: "passwordHash" },
}));
vi.mock("@/lib/email", () => ({ sendVerificationEmail: mocks.sendVerificationEmail }));
vi.mock("@/lib/email-verification-config", () => ({
  isEmailVerificationEnabled: mocks.isEmailVerificationEnabled,
}));

import { requestEmailVerification, verifyEmailToken } from "@/lib/email-verification";

const user = { id: "user-1", email: "user@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.and.mockImplementation((...conditions: unknown[]) => conditions);
  mocks.eq.mockImplementation((left: unknown, right: unknown) => ({ left, right }));
  mocks.gt.mockImplementation((left: unknown, right: unknown) => ({ left, right }));
  mocks.inArray.mockImplementation((left: unknown, right: unknown) => ({ left, right }));
  mocks.isNotNull.mockImplementation((column: unknown) => ({ column, notNull: true }));
  mocks.isNull.mockImplementation((column: unknown) => ({ column, isNull: true }));
  mocks.isEmailVerificationEnabled.mockReturnValue(true);
  mocks.findFirst.mockResolvedValue(user);
  mocks.execute.mockResolvedValue({ rows: [{ user_id: "user-1" }] });
  mocks.select.mockReturnValue({ from: vi.fn() });
  mocks.sendVerificationEmail.mockResolvedValue(undefined);
  mocks.updateWhere.mockResolvedValue([]);
  mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
  mocks.update.mockReturnValue({ set: mocks.updateSet });
  mocks.deleteReturning.mockReturnValue([{ userId: "user-1" }]);
  mocks.deleteWhere.mockReturnValue({ returning: mocks.deleteReturning });
  mocks.deleteEmail.mockReturnValue({ where: mocks.deleteWhere });
  mocks.withAs.mockImplementation((query: unknown) => query);
  mocks.verifyUpdateReturning.mockResolvedValue([{ id: "user-1" }]);
  mocks.verifyUpdateWhere.mockReturnValue({ returning: mocks.verifyUpdateReturning });
  mocks.verifyUpdateSet.mockReturnValue({ where: mocks.verifyUpdateWhere });
  mocks.verifyUpdate.mockReturnValue({ set: mocks.verifyUpdateSet });
  mocks.noRowsUpdate.mockReturnValue({
    set: () => ({
      where: () => ({ returning: () => [] }),
    }),
  });
  mocks.with.mockImplementation((consumed: unknown[]) => ({
    update: consumed.length ? mocks.verifyUpdate : mocks.noRowsUpdate,
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requestEmailVerification", () => {
  it("returns ineligible when verification is disabled", async () => {
    mocks.isEmailVerificationEnabled.mockReturnValue(false);

    await expect(requestEmailVerification("user@example.com")).resolves.toEqual({
      status: "ineligible",
      retryAfterSeconds: 60,
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns ineligible when no password account is pending verification", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(requestEmailVerification(" USER@EXAMPLE.COM ")).resolves.toEqual({
      status: "ineligible",
      retryAfterSeconds: 60,
    });
  });

  it("returns failed without claiming a token for an invalid auth origin", async () => {
    vi.stubEnv("AUTH_URL", "https://bearxus.test/path");

    await expect(requestEmailVerification("user@example.com")).resolves.toEqual({
      status: "failed",
      retryAfterSeconds: 60,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, "production"],
    ["https://user:pass@bearxus.test", "test"],
    ["https://bearxus.test/path", "test"],
    ["https://bearxus.test/?next=1", "test"],
    ["ftp://bearxus.test", "test"],
  ])("fails closed for unsafe AUTH_URL %j in %s", async (authUrl, nodeEnv) => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    vi.stubEnv("AUTH_URL", authUrl);

    await expect(requestEmailVerification("user@example.com")).resolves.toEqual({
      status: "failed",
      retryAfterSeconds: 60,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("returns cooldown when the database claim is rejected", async () => {
    vi.stubEnv("AUTH_URL", "https://bearxus.test");
    mocks.execute.mockResolvedValue({ rows: [] });

    await expect(requestEmailVerification("user@example.com")).resolves.toEqual({
      status: "cooldown",
      retryAfterSeconds: 60,
    });
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("claims a token and sends a verification URL", async () => {
    vi.stubEnv("AUTH_URL", "https://bearxus.test");

    await expect(requestEmailVerification("user@example.com")).resolves.toEqual({
      status: "sent",
      retryAfterSeconds: 60,
    });
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringMatching(/^https:\/\/bearxus\.test\/api\/auth\/verify-email\?token=/),
    );
  });

  it("invalidates a claimed token when delivery fails", async () => {
    vi.stubEnv("AUTH_URL", "https://bearxus.test");
    mocks.sendVerificationEmail.mockRejectedValue(new Error("provider unavailable"));

    await expect(requestEmailVerification("user@example.com")).resolves.toEqual({
      status: "failed",
      retryAfterSeconds: 60,
    });
    expect(mocks.update).toHaveBeenCalled();
  });
});

describe("verifyEmailToken", () => {
  it("rejects malformed tokens before touching the database", async () => {
    await expect(verifyEmailToken("invalid")).resolves.toBe("invalid");

    expect(mocks.deleteEmail).not.toHaveBeenCalled();
  });

  it("atomically consumes a valid token and verifies the user", async () => {
    await expect(verifyEmailToken("a".repeat(64))).resolves.toBe("verified");

    expect(mocks.deleteEmail).toHaveBeenCalled();
    expect(mocks.verifyUpdate).toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith("tokenHash", createHash("sha256").update("a".repeat(64)).digest("hex"));
    expect(mocks.gt).toHaveBeenCalledWith("expiresAt", "sql");
    expect(mocks.isNull).toHaveBeenCalledWith("emailVerified");
    expect(mocks.isNotNull).toHaveBeenCalledWith("passwordHash");
  });

  it("returns invalid when token consumption verifies no user", async () => {
    mocks.verifyUpdateReturning.mockResolvedValue([]);

    await expect(verifyEmailToken("a".repeat(64))).resolves.toBe("invalid");
  });

  it("does not update a user when the token CTE consumes no rows", async () => {
    mocks.deleteReturning.mockReturnValue([]);

    await expect(verifyEmailToken("a".repeat(64))).resolves.toBe("invalid");

    expect(mocks.verifyUpdate).not.toHaveBeenCalled();
  });
});
