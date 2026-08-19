import { createHash, randomUUID } from "node:crypto";
import { Firestore } from "@google-cloud/firestore";
import type { GatewayStore, SessionUsage, UsageCommit } from "../../ai-gateway/src/index.js";
import type { RequestGate } from "../../api-gateway/src/index.js";

type StoredSession = Partial<SessionUsage> & { leaseToken?: string; leaseExpiresAtMs?: number; ttlAt?: Date };
const emptyUsage = (): SessionUsage => ({ calls: 0, inputTokens: 0, outputTokens: 0, costKzt: 0 });
const money = (value: number) => Math.round(value * 100) / 100;
const id = (...parts: string[]) => createHash("sha256").update(parts.join("\0")).digest("hex");

/** Firestore-backed coordination shared by every Cloud Run instance. */
export class FirestoreCoordinationStore implements GatewayStore, RequestGate {
  constructor(
    private readonly db: Firestore,
    private readonly requestsPerMinute: number,
    private readonly now: () => number = Date.now,
    private readonly token: () => string = randomUUID,
  ) {
    if (!Number.isInteger(requestsPerMinute) || requestsPerMinute < 1)
      throw new Error("RPM must be a positive integer.");
  }

  private session(tenantId: string, sessionId: string) {
    return this.db.collection("mebelflowGatewaySessions").doc(id(tenantId, sessionId));
  }
  private tenant(tenantId: string) {
    return this.db.collection("mebelflowGatewayTenants").doc(id(tenantId));
  }

  async acquireSession(tenantId: string, sessionId: string, ttlSeconds: number) {
    const ref = this.session(tenantId, sessionId);
    const now = this.now();
    return this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const data = (snapshot.data() ?? {}) as StoredSession;
      if ((data.leaseExpiresAtMs ?? 0) > now) return null;
      const leaseToken = this.token();
      const expires = now + ttlSeconds * 1_000;
      tx.set(
        ref,
        { leaseToken, leaseExpiresAtMs: expires, ttlAt: new Date(expires + 86_400_000), updatedAt: new Date(now) },
        { merge: true },
      );
      return leaseToken;
    });
  }

  async releaseSession(tenantId: string, sessionId: string, leaseToken: string) {
    const ref = this.session(tenantId, sessionId);
    await this.db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const data = snapshot.data() as StoredSession | undefined;
      if (data?.leaseToken === leaseToken)
        tx.set(ref, { leaseToken: null, leaseExpiresAtMs: 0, updatedAt: new Date(this.now()) }, { merge: true });
    });
  }

  async getSessionUsage(tenantId: string, sessionId: string) {
    const data = (await this.session(tenantId, sessionId).get()).data() as StoredSession | undefined;
    return {
      calls: data?.calls ?? 0,
      inputTokens: data?.inputTokens ?? 0,
      outputTokens: data?.outputTokens ?? 0,
      costKzt: data?.costKzt ?? 0,
    };
  }

  async getTenantSpentKzt(tenantId: string) {
    return Number((await this.tenant(tenantId).get()).data()?.spentKzt ?? 0);
  }

  async reserveTenantBudget(tenantId: string, reservationId: string, amountKzt: number, budgetKzt: number) {
    const tenantRef = this.tenant(tenantId);
    const reservationKey = id(reservationId);
    const now = this.now();
    return this.db.runTransaction(async (tx) => {
      const tenantSnapshot = await tx.get(tenantRef);
      const tenant = tenantSnapshot.data() ?? {};
      const reservations = Object.fromEntries(
        Object.entries(
          (tenant.reservations ?? {}) as Record<string, { amountKzt: number; expiresAtMs: number }>,
        ).filter(([, value]) => value.expiresAtMs > now),
      );
      if (reservations[reservationKey]) return true;
      const spent = Number(tenant.spentKzt ?? 0);
      const reserved = money(Object.values(reservations).reduce((sum, value) => sum + value.amountKzt, 0));
      if (spent + reserved + amountKzt > budgetKzt) return false;
      reservations[reservationKey] = { amountKzt, expiresAtMs: now + 120_000 };
      tx.set(
        tenantRef,
        { reservations, reservedKzt: money(reserved + amountKzt), updatedAt: new Date(now) },
        { merge: true },
      );
      return true;
    });
  }

  async cancelTenantBudget(tenantId: string, reservationId: string, _amountKzt: number) {
    const tenantRef = this.tenant(tenantId);
    const reservationKey = id(reservationId);
    await this.db.runTransaction(async (tx) => {
      const tenantSnapshot = await tx.get(tenantRef);
      const tenant = tenantSnapshot.data() ?? {};
      const reservations = {
        ...((tenant.reservations ?? {}) as Record<string, { amountKzt: number; expiresAtMs: number }>),
      };
      if (!reservations[reservationKey]) return;
      delete reservations[reservationKey];
      const reservedKzt = money(Object.values(reservations).reduce((sum, value) => sum + value.amountKzt, 0));
      tx.set(tenantRef, { reservations, reservedKzt, updatedAt: new Date(this.now()) }, { merge: true });
    });
  }

  async commitUsage(input: UsageCommit) {
    const sessionRef = this.session(input.tenantId, input.sessionId);
    const tenantRef = this.tenant(input.tenantId);
    const reservationKey = id(input.reservationId);
    return this.db.runTransaction(async (tx) => {
      const [sessionSnapshot, tenantSnapshot] = await Promise.all([tx.get(sessionRef), tx.get(tenantRef)]);
      const current = { ...emptyUsage(), ...(sessionSnapshot.data() as Partial<SessionUsage> | undefined) };
      const tenant = tenantSnapshot.data() ?? {};
      const reservations = {
        ...((tenant.reservations ?? {}) as Record<string, { amountKzt: number; expiresAtMs: number }>),
      };
      if (!reservations[reservationKey]) throw new Error("BUDGET_RESERVATION_MISSING");
      delete reservations[reservationKey];
      const reservedKzt = money(Object.values(reservations).reduce((sum, value) => sum + value.amountKzt, 0));
      const next = {
        calls: current.calls + 1,
        inputTokens: current.inputTokens + input.usage.inputTokens,
        outputTokens: current.outputTokens + input.usage.outputTokens,
        costKzt: money(current.costKzt + input.costKzt),
      };
      tx.set(sessionRef, { ...next, updatedAt: new Date(this.now()) }, { merge: true });
      tx.set(
        tenantRef,
        {
          spentKzt: money(Number(tenant.spentKzt ?? 0) + input.costKzt),
          reservations,
          reservedKzt,
          updatedAt: new Date(this.now()),
        },
        { merge: true },
      );
      return next;
    });
  }

  async consume(input: { tenantId: string; sessionId: string; idempotencyKey: string; atMs: number }) {
    const windowStart = Math.floor(input.atMs / 60_000) * 60_000;
    const rateRef = this.db.collection("mebelflowGatewayRateWindows").doc(id(input.tenantId, String(windowStart)));
    const requestRef = this.db
      .collection("mebelflowGatewayRequests")
      .doc(id(input.tenantId, input.sessionId, input.idempotencyKey));
    return this.db.runTransaction(async (tx) => {
      const [requestSnapshot, rateSnapshot] = await Promise.all([tx.get(requestRef), tx.get(rateRef)]);
      if (requestSnapshot.exists) return "duplicate" as const;
      const count = Number(rateSnapshot.data()?.count ?? 0);
      if (count >= this.requestsPerMinute) return "rate_limited" as const;
      tx.create(requestRef, {
        tenantId: input.tenantId,
        createdAt: new Date(input.atMs),
        ttlAt: new Date(input.atMs + 86_400_000),
      });
      tx.set(
        rateRef,
        { count: count + 1, windowStartMs: windowStart, ttlAt: new Date(windowStart + 120_000) },
        { merge: true },
      );
      return "allowed" as const;
    });
  }
}

export function createFirestoreCoordinationStore(requestsPerMinute: number) {
  return new FirestoreCoordinationStore(new Firestore(), requestsPerMinute);
}
