import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type RechargeOrderStatus = "CREATED" | "PAID" | "CLOSED";

export type RechargeOrder = {
  id: string;
  userId: string;
  packageId: string;
  points: number;
  amountFen: number;
  codeUrl: string;
  status: RechargeOrderStatus;
  createdAt: number;
  updatedAt: number;
  paidAt?: number | null;
};

export type PointsLedgerRow = {
  id: string;
  userId: string;
  orderId: string;
  points: number;
  createdAt: number;
};

type DbFileShape = {
  orders: Record<string, RechargeOrder>;
  ledgerByOrderId: Record<string, PointsLedgerRow>;
};

export function createDb(dbPath: string) {
  let loaded = false;
  let data: DbFileShape = { orders: {}, ledgerByOrderId: {} };
  let writeChain = Promise.resolve();

  const ensureLoaded = async () => {
    if (loaded) {
      return;
    }

    await mkdir(dirname(dbPath), { recursive: true });
    try {
      const content = await readFile(dbPath, "utf8");
      const parsed = JSON.parse(content) as DbFileShape;
      data = {
        orders: parsed.orders ?? {},
        ledgerByOrderId: parsed.ledgerByOrderId ?? {},
      };
    } catch {
      data = { orders: {}, ledgerByOrderId: {} };
    }

    loaded = true;
  };

  const persist = async () => {
    const snapshot = JSON.stringify(data, null, 2);
    writeChain = writeChain.then(() => writeFile(dbPath, snapshot, "utf8"));
    await writeChain;
  };

  return {
    insertOrder: async (order: RechargeOrder) => {
      await ensureLoaded();
      data.orders[order.id] = order;
      await persist();
    },
    getOrder: async (id: string) => {
      await ensureLoaded();
      return data.orders[id];
    },
    updateOrderStatus: async (params: {
      id: string;
      status: RechargeOrderStatus;
      updatedAt: number;
      paidAt?: number | null;
    }) => {
      await ensureLoaded();
      const order = data.orders[params.id];
      if (!order) {
        return;
      }
      data.orders[params.id] = {
        ...order,
        status: params.status,
        updatedAt: params.updatedAt,
        paidAt: params.paidAt ?? null,
      };
      await persist();
    },
    insertLedger: async (row: PointsLedgerRow) => {
      await ensureLoaded();
      data.ledgerByOrderId[row.orderId] = row;
      await persist();
    },
    getLedgerByOrder: async (orderId: string) => {
      await ensureLoaded();
      return data.ledgerByOrderId[orderId];
    },
  };
}
