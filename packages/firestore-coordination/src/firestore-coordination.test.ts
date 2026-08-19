import type { Firestore } from "@google-cloud/firestore";
import { describe, expect, it } from "vitest";
import { FirestoreCoordinationStore } from "./index.js";

type FakeTransaction = {
  get: (ref: FakeRef) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
  set: (ref: FakeRef, value: Record<string, unknown>, options?: { merge?: boolean }) => void;
  create: (ref: FakeRef, value: Record<string, unknown>) => void;
  delete: (ref: FakeRef) => void;
};

class FakeRef {
  constructor(
    readonly path: string,
    private readonly db: FakeFirestore,
  ) {}
  get() {
    return Promise.resolve(this.db.snapshot(this));
  }
}
class FakeFirestore {
  readonly data = new Map<string, Record<string, unknown>>();
  collection(name: string) {
    return { doc: (key: string) => new FakeRef(`${name}/${key}`, this) };
  }
  snapshot(ref: FakeRef) {
    const value = this.data.get(ref.path);
    return { exists: Boolean(value), data: () => (value ? structuredClone(value) : undefined) };
  }
  async runTransaction<T>(work: (tx: FakeTransaction) => Promise<T>) {
    const writes: (() => void)[] = [];
    const tx = {
      get: (ref: FakeRef) => Promise.resolve(this.snapshot(ref)),
      set: (ref: FakeRef, value: Record<string, unknown>, options?: { merge?: boolean }) =>
        writes.push(() =>
          this.data.set(ref.path, options?.merge ? { ...this.data.get(ref.path), ...value } : structuredClone(value)),
        ),
      create: (ref: FakeRef, value: Record<string, unknown>) =>
        writes.push(() => {
          if (this.data.has(ref.path)) throw new Error("already exists");
          this.data.set(ref.path, structuredClone(value));
        }),
      delete: (ref: FakeRef) =>
        writes.push(() => {
          this.data.delete(ref.path);
        }),
    };
    const result = await work(tx);
    writes.forEach((write) => {
      write();
    });
    return result;
  }
}

describe("FirestoreCoordinationStore", () => {
  it("uses expiring lease tokens and ignores stale release", async () => {
    const db = new FakeFirestore();
    let now = 1_000;
    let token = 0;
    const store = new FirestoreCoordinationStore(
      db as unknown as Firestore,
      2,
      () => now,
      () => `lease-${++token}`,
    );
    const first = await store.acquireSession("tenant", "session", 1);
    expect(first).toBe("lease-1");
    expect(await store.acquireSession("tenant", "session", 1)).toBeNull();
    now = 2_001;
    const second = await store.acquireSession("tenant", "session", 1);
    await store.releaseSession("tenant", "session", first!);
    expect(await store.acquireSession("tenant", "session", 1)).toBeNull();
    await store.releaseSession("tenant", "session", second!);
    expect(await store.acquireSession("tenant", "session", 1)).toBe("lease-3");
  });

  it("persists usage atomically in session and tenant ledgers", async () => {
    const store = new FirestoreCoordinationStore(new FakeFirestore() as unknown as Firestore, 2);
    await store.reserveTenantBudget("tenant", "r1", 2, 10);
    await store.commitUsage({
      tenantId: "tenant",
      sessionId: "session",
      usage: { inputTokens: 10, outputTokens: 3 },
      costKzt: 0.51,
      reservationId: "r1",
      reservedKzt: 2,
    });
    await store.reserveTenantBudget("tenant", "r2", 2, 10);
    const usage = await store.commitUsage({
      tenantId: "tenant",
      sessionId: "session",
      usage: { inputTokens: 5, outputTokens: 2 },
      costKzt: 0.52,
      reservationId: "r2",
      reservedKzt: 2,
    });
    expect(usage).toEqual({ calls: 2, inputTokens: 15, outputTokens: 5, costKzt: 1.03 });
    expect(await store.getTenantSpentKzt("tenant")).toBe(1.03);
  });

  it("reserves budget atomically and releases it after provider failure", async () => {
    const store = new FirestoreCoordinationStore(new FakeFirestore() as unknown as Firestore, 2);
    expect(await store.reserveTenantBudget("tenant", "r1", 8, 10)).toBe(true);
    expect(await store.reserveTenantBudget("tenant", "r2", 8, 10)).toBe(false);
    await store.cancelTenantBudget("tenant", "r1", 8);
    expect(await store.reserveTenantBudget("tenant", "r2", 8, 10)).toBe(true);
  });

  it("reclaims an abandoned reservation after its lease expires", async () => {
    let now = 1_000;
    const store = new FirestoreCoordinationStore(new FakeFirestore() as unknown as Firestore, 2, () => now);
    expect(await store.reserveTenantBudget("tenant", "r1", 8, 10)).toBe(true);
    now += 120_001;
    expect(await store.reserveTenantBudget("tenant", "r2", 8, 10)).toBe(true);
  });

  it("coordinates idempotency and rate limit in one transaction", async () => {
    const store = new FirestoreCoordinationStore(new FakeFirestore() as unknown as Firestore, 2);
    const base = { tenantId: "tenant", sessionId: "session", atMs: 100_000 };
    expect(await store.consume({ ...base, idempotencyKey: "request-1" })).toBe("allowed");
    expect(await store.consume({ ...base, idempotencyKey: "request-1" })).toBe("duplicate");
    expect(await store.consume({ ...base, idempotencyKey: "request-2" })).toBe("allowed");
    expect(await store.consume({ ...base, idempotencyKey: "request-3" })).toBe("rate_limited");
    expect(await store.consume({ ...base, idempotencyKey: "request-3", atMs: 180_000 })).toBe("allowed");
  });
});
