import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteReset: vi.fn(),
  deleteReturning: vi.fn(),
  deleteWhere: vi.fn(),
  and: vi.fn(),
  eq: vi.fn(),
  execute: vi.fn(),
  exists: vi.fn(),
  findFirst: vi.fn(),
  gt: vi.fn(),
  inArray: vi.fn(),
  isEmailVerificationEnabled: vi.fn(),
  isNotNull: vi.fn(),
  limit: vi.fn(),
  noRowsUpdate: vi.fn(),
  requestEmail: vi.fn(),
  select: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  update: vi.fn(),
  updateReturning: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  with: vi.fn(),
  withAs: vi.fn(),
  withUpdate: vi.fn(),
  withUpdateReturning: vi.fn(),
  withUpdateSet: vi.fn(),
  withUpdateWhere: vi.fn(),
}));

vi.mock("server-only", () => ({}));
import { createHash } from "node:crypto";

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  eq: mocks.eq,
  exists: mocks.exists,
  gt: mocks.gt,
  inArray: mocks.inArray,
  isNotNull: mocks.isNotNull,
  sql: vi.fn(() => "sql"),
}));
vi.mock("@/db", () => ({
  db: {
    $with: () => ({ as: mocks.withAs }),
    delete: mocks.deleteReset,
    execute: mocks.execute,
    query: { users: { findFirst: mocks.findFirst } },
    select: mocks.select,
    update: mocks.update,
    with: mocks.with,
  },
}));
vi.mock("@/db/schema", () => ({
  passwordResets: { deliveryStatus: "deliveryStatus", expiresAt: "expiresAt", lastSentAt: "lastSentAt", tokenHash: "tokenHash", userId: "userId" },
  users: { id: "id", passwordHash: "passwordHash" },
}));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: mocks.sendPasswordResetEmail }));

import {
  isUsablePasswordResetToken,
  requestPasswordReset,
  resetPasswordToken,
} from "@/lib/password-reset";

const user = { id: "user-1", email: "user@example.com" };
const token = "a".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.and.mockImplementation((...conditions: unknown[]) => conditions);
  mocks.eq.mockImplementation((left: unknown, right: unknown) => ({ left, right }));
  mocks.exists.mockImplementation((query: unknown) => ({ exists: query }));
  mocks.gt.mockImplementation((left: unknown, right: unknown) => ({ left, right }));
  mocks.inArray.mockImplementation((left: unknown, right: unknown) => ({ left, right }));
  mocks.isNotNull.mockImplementation((column: unknown) => ({ column, notNull: true }));
  vi.stubEnv("AUTH_URL", "https://bearxus.test");
  mocks.findFirst.mockResolvedValue(user);
  mocks.execute.mockResolvedValue({ rows: [{ user_id: "user-1" }] });
  mocks.sendPasswordResetEmail.mockResolvedValue(undefined);
  mocks.updateReturning.mockResolvedValue([{ userId: "user-1" }]);
  mocks.updateWhere.mockReturnValue({ returning: mocks.updateReturning });
  mocks.updateSet.mockReturnValue({ where: mocks.updateWhere });
  mocks.update.mockReturnValue({ set: mocks.updateSet });
  mocks.select.mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: mocks.limit }),
      }),
      where: vi.fn().mockReturnValue("subquery"),
    })),
  }));
  mocks.limit.mockResolvedValue([{ userId: "user-1" }]);
  mocks.withAs.mockImplementation((query: unknown) => query);
  mocks.deleteReturning.mockReturnValue([{ userId: "user-1" }]);
  mocks.deleteWhere.mockReturnValue({ returning: mocks.deleteReturning });
  mocks.deleteReset.mockReturnValue({ where: mocks.deleteWhere });
  mocks.withUpdateReturning.mockResolvedValue([{ id: "user-1" }]);
  mocks.withUpdateWhere.mockReturnValue({ returning: mocks.withUpdateReturning });
  mocks.withUpdateSet.mockReturnValue({ where: mocks.withUpdateWhere });
  mocks.withUpdate.mockReturnValue({ set: mocks.withUpdateSet });
  mocks.noRowsUpdate.mockReturnValue({
    set: () => ({
      where: () => ({ returning: () => [] }),
    }),
  });
  mocks.with.mockImplementation((consumed: unknown[]) => ({
    update: consumed.length ? mocks.withUpdate : mocks.noRowsUpdate,
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requestPasswordReset", () => {
  it("returns ineligible for an unknown or non-password account", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(requestPasswordReset(" USER@EXAMPLE.COM ")).resolves.toEqual({
      status: "ineligible",
      retryAfterSeconds: 60,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("returns failed without claiming a token for an invalid origin", async () => {
    vi.stubEnv("AUTH_URL", "https://bearxus.test/reset");

    await expect(requestPasswordReset("user@example.com")).resolves.toEqual({
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

    await expect(requestPasswordReset("user@example.com")).resolves.toEqual({
      status: "failed",
      retryAfterSeconds: 60,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("returns cooldown when the reset claim is rejected", async () => {
    mocks.execute.mockResolvedValue({ rows: [] });

    await expect(requestPasswordReset("user@example.com")).resolves.toEqual({
      status: "cooldown",
      retryAfterSeconds: 60,
    });
    expect(mocks.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("sends a reset email and marks the token ready", async () => {
    await expect(requestPasswordReset("user@example.com")).resolves.toEqual({
      status: "sent",
      retryAfterSeconds: 60,
    });
    expect(mocks.sendPasswordResetEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringMatching(/^https:\/\/bearxus\.test\/reset-password\?token=/),
    );
    expect(mocks.update).toHaveBeenCalled();
  });

  it("returns failed when marking a sent token ready updates no rows", async () => {
    mocks.updateReturning.mockResolvedValue([]);

    await expect(requestPasswordReset("user@example.com")).resolves.toEqual({
      status: "failed",
      retryAfterSeconds: 60,
    });
  });

  it("keeps provider failures neutral", async () => {
    mocks.sendPasswordResetEmail.mockRejectedValue(new Error("provider unavailable"));

    await expect(requestPasswordReset("user@example.com")).resolves.toEqual({
      status: "failed",
      retryAfterSeconds: 60,
    });
  });
});

describe("isUsablePasswordResetToken", () => {
  it("rejects malformed tokens without querying token state", async () => {
    await expect(isUsablePasswordResetToken("invalid")).resolves.toBe(false);
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("returns whether a ready, unexpired token exists", async () => {
    await expect(isUsablePasswordResetToken(token)).resolves.toBe(true);

    expect(mocks.eq).toHaveBeenCalledWith("tokenHash", createHash("sha256").update(token).digest("hex"));
    expect(mocks.eq).toHaveBeenCalledWith("deliveryStatus", "ready");
    expect(mocks.gt).toHaveBeenCalledWith("expiresAt", "sql");
    expect(mocks.isNotNull).toHaveBeenCalledWith("passwordHash");

    mocks.limit.mockResolvedValueOnce([]);
    await expect(isUsablePasswordResetToken(token)).resolves.toBe(false);
  });
});

describe("resetPasswordToken", () => {
  it("rejects malformed tokens before mutating the database", async () => {
    await expect(resetPasswordToken("invalid", "hashed-password")).resolves.toBe("invalid");
    expect(mocks.deleteReset).not.toHaveBeenCalled();
  });

  it("consumes a valid token and updates the password", async () => {
    await expect(resetPasswordToken(token, "hashed-password")).resolves.toBe("reset");

    expect(mocks.deleteReset).toHaveBeenCalled();
    expect(mocks.withUpdate).toHaveBeenCalled();
  });

  it("returns invalid when the conditional update changes no rows", async () => {
    mocks.withUpdateReturning.mockResolvedValue([]);

    await expect(resetPasswordToken(token, "hashed-password")).resolves.toBe("invalid");
  });

  it("does not update a user when the token CTE consumes no rows", async () => {
    mocks.deleteReturning.mockReturnValue([]);

    await expect(resetPasswordToken(token, "hashed-password")).resolves.toBe("invalid");

    expect(mocks.withUpdate).not.toHaveBeenCalled();
  });
});
