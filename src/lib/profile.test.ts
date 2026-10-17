import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  findFirst: vi.fn(),
  select: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({ count: vi.fn(), eq: mocks.eq }));
vi.mock("@/db", () => ({
  db: {
    query: { users: { findFirst: mocks.findFirst } },
    select: mocks.select,
  },
}));
vi.mock("@/db/schema", () => ({
  learningResources: { userId: "userId" },
  notes: { userId: "userId" },
  projects: { userId: "userId" },
  tasks: { userId: "userId" },
  transactions: { userId: "userId" },
  users: { id: "id" },
}));

import { getProfileData } from "@/lib/profile";

let statCounts = [0, 0, 0, 0, 0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockImplementation((column: unknown, value: unknown) => ({ column, value }));
  statCounts = [2, 3, 5, 7, 11];
  mocks.findFirst.mockResolvedValue({
    name: "Bear",
    email: "user@example.com",
    image: "https://example.com/avatar.png",
    passwordHash: "stored-hash",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  mocks.select.mockImplementation(() => {
    const total = statCounts.shift() ?? 0;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total }]),
      }),
    };
  });
});

describe("getProfileData", () => {
  it("returns null when the requested user does not exist", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(getProfileData("missing-user")).resolves.toBeNull();
    expect(mocks.findFirst).toHaveBeenCalled();
    expect(mocks.select).toHaveBeenCalledTimes(5);
  });

  it("maps identity and user-scoped usage counts", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    mocks.findFirst.mockResolvedValue({
      name: "Bear",
      email: "user@example.com",
      image: null,
      passwordHash: null,
      createdAt,
    });

    await expect(getProfileData("user-1")).resolves.toEqual({
      user: {
        name: "Bear",
        email: "user@example.com",
        image: null,
        createdAt,
        canChangePassword: false,
      },
      stats: {
        notes: 2,
        projects: 3,
        tasks: 5,
        resources: 7,
        transactions: 11,
      },
    });
    expect(mocks.eq).toHaveBeenCalledTimes(6);
    expect(mocks.eq.mock.calls.every(([, value]) => value === "user-1")).toBe(true);
  });
});
