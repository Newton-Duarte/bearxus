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
  accounts: { userId: "userId", provider: "provider" },
  users: { id: "id" },
}));

import { getProfileData } from "@/lib/profile";

let statCounts = [0, 0, 0, 0, 0];
let linkedProviders: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockImplementation((column: unknown, value: unknown) => ({ column, value }));
  statCounts = [2, 3, 5, 7, 11];
  linkedProviders = [];
  mocks.findFirst.mockResolvedValue({
    name: "Bear",
    email: "user@example.com",
    image: "https://example.com/avatar.png",
    passwordHash: "stored-hash",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  mocks.select.mockImplementation((fields: Record<string, unknown>) => {
    if ("provider" in fields) {
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(linkedProviders.map(provider => ({ provider }))),
        }),
      };
    }

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
  });

  it("maps identity, user-scoped usage counts, and an unavailable GitHub application", async () => {
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
      authorizedApplications: [
        { provider: "github", connected: false, canDisconnect: false },
      ],
      stats: {
        notes: 2,
        projects: 3,
        tasks: 5,
        resources: 7,
        transactions: 11,
      },
    });
    expect(mocks.eq.mock.calls.every(([, value]) => value === "user-1")).toBe(true);
  });

  it("marks GitHub as connected and disconnectable when a password remains", async () => {
    linkedProviders = ["github"];

    await expect(getProfileData("user-1")).resolves.toMatchObject({
      authorizedApplications: [
        { provider: "github", connected: true, canDisconnect: true },
      ],
    });
  });

  it("prevents disconnecting the only linked GitHub sign-in method", async () => {
    linkedProviders = ["github"];
    mocks.findFirst.mockResolvedValue({
      name: "Bear",
      email: "user@example.com",
      image: null,
      passwordHash: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(getProfileData("user-1")).resolves.toMatchObject({
      authorizedApplications: [
        { provider: "github", connected: true, canDisconnect: false },
      ],
    });
  });

  it("allows disconnecting GitHub when another OAuth provider remains", async () => {
    linkedProviders = ["github", "gitlab"];
    mocks.findFirst.mockResolvedValue({
      name: "Bear",
      email: "user@example.com",
      image: null,
      passwordHash: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(getProfileData("user-1")).resolves.toMatchObject({
      authorizedApplications: [
        { provider: "github", connected: true, canDisconnect: true },
      ],
    });
  });
});
