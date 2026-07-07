import type {
  PositionDetails,
  Positions,
  userMarketOrderTypes,
  positonSnapshotInstanceType,
} from '@repo/shared-types/internal-types';
import { Shared } from '@repo/shared-types';

export default class PostionManager {
  private positions: Positions;
  private marketsMarkPrice: Record<string, number>;

  constructor() {
    this.positions = new Map();
    this.marketsMarkPrice = {};
  }

  createSnapShot() {
    return {
      positions: JSON.stringify(Array.from(this.positions.entries())),
      marketIndex: '[]',
    };
  }

  loadSnapShot(snapshot: positonSnapshotInstanceType) {
    if (!snapshot) return;
    this.positions = new Map(JSON.parse(snapshot.positions || '[]'));
  }

  getPosition(userId: string, market: Shared.MARKET_AVAILABEL) {
    const userPositions = this.positions.get(userId);
    if (!userPositions) return null;
    return userPositions.find((pos) => pos.market === market) || null;
  }

  getPositionsForUser(userId: string) {
    return this.positions.get(userId) || [];
  }

  private removePositionEntry(userId: string, market: Shared.MARKET_AVAILABEL) {
    const userPositions = this.positions.get(userId);
    if (!userPositions) return;

    const remaining = userPositions.filter((pos) => pos.market !== market);

    if (remaining.length === 0) {
      this.positions.delete(userId);
    } else {
      this.positions.set(userId, remaining);
    }
  }

  changePosition(
    userId: string,
    market: Shared.MARKET_AVAILABEL,
    kind: Shared.KIND,
    qty: number,
    costBasis: number,
    margin: number,
  ) {
    const userPositions = this.positions.get(userId) || [];
    const userPos = userPositions.find((pos) => pos.market === market) ?? null;

    if (!userPos) {
      const positionDetails: PositionDetails = { costBasis, kind, margin, market, qty };
      this.positions.set(userId, [...userPositions, positionDetails]);
      return positionDetails;
    }

    if (userPos.kind === kind) {
      userPos.qty += qty;
      userPos.costBasis += costBasis;
      userPos.margin += margin;
    } else if (userPos.qty > qty) {
      userPos.qty -= qty;
      userPos.margin -= margin;
      userPos.costBasis -= costBasis;
    } else if (userPos.qty === qty) {
      this.removePositionEntry(userId, market);
      return userPos;
    } else {
      userPos.qty = qty - userPos.qty;
      userPos.margin = margin;
      userPos.costBasis = costBasis;
      userPos.kind = kind;
    }

    if (userPos.qty <= 0) {
      this.removePositionEntry(userId, market);
      return userPos;
    }

    return userPos;
  }

  calculateLiquidation(market: Shared.MARKET_AVAILABEL, markPrice: number) {
    const toLiquidate: userMarketOrderTypes[] = [];

    for (const [userId, userPositions] of this.positions) {
      for (const pos of userPositions) {
        if (pos.market !== market || pos.qty <= 0) continue;

        const maxLoss = pos.margin * 0.95;
        const positionValue = markPrice * pos.qty;
        let uPnl = 0;
        if (pos.kind === 'LONG') {
          uPnl = positionValue - pos.costBasis;
        } else {
          uPnl = pos.costBasis - positionValue;
        }

        if (uPnl + maxLoss <= 0) {
          toLiquidate.push({
            userId,
            qty: pos.qty,
            market: pos.market,
            kind: pos.kind,
            margin: pos.margin,
            costBasis: pos.costBasis,
          });
        }
      }
    }

    if (toLiquidate.length === 0) return null;
    return toLiquidate;
  }

  claculateFundingRate(
    externalPrice: number,
    localPrice: number,
    market: Shared.MARKET_AVAILABEL,
  ): number | null {
    if (!externalPrice || !localPrice) return null;

    const longs: PositionDetails[] = [];
    const shorts: PositionDetails[] = [];

    for (const userPositions of this.positions.values()) {
      for (const pos of userPositions) {
        if (pos.market !== market || pos.qty <= 0) continue;
        if (pos.kind === 'LONG') longs.push(pos);
        if (pos.kind === 'SHORT') shorts.push(pos);
      }
    }

    if (longs.length === 0 || shorts.length === 0) return null;

    const fundingBasis = localPrice - externalPrice;
    const MAX_FUNDING_RATE = 0.0005;
    const rawFundingRate = fundingBasis / externalPrice;
    const fundingRate = Math.max(-MAX_FUNDING_RATE, Math.min(MAX_FUNDING_RATE, rawFundingRate));

    if (fundingRate > 0) {
      for (const pos of longs) {
        pos.margin -= pos.qty * externalPrice * fundingRate;
      }
      for (const pos of shorts) {
        pos.margin += pos.qty * externalPrice * fundingRate;
      }
    } else if (fundingRate < 0) {
      const rate = Math.abs(fundingRate);
      for (const pos of shorts) {
        pos.margin -= pos.qty * externalPrice * rate;
      }
      for (const pos of longs) {
        pos.margin += pos.qty * externalPrice * rate;
      }
    }

    return fundingRate;
  }

  updateMarkpriceMap(market: Shared.MARKET_AVAILABEL, price: number) {
    this.marketsMarkPrice[market] = price;
  }

  getMarkpriceOfMarket(market: Shared.MARKET_AVAILABEL) {
    return this.marketsMarkPrice[market];
  }

  calculateAndGetHigestPnl(
    closeKind: Shared.KIND,
    market: Shared.MARKET_AVAILABEL,
    markPrice: number,
    excludeUserId?: string,
  ) {
    const adlSide: Shared.KIND = closeKind === 'SHORT' ? 'LONG' : 'SHORT';

    let highestPnl = -Infinity;
    let profitableUserId: string | null = null;

    for (const [userId, userPositions] of this.positions) {
      if (excludeUserId && userId === excludeUserId) continue;

      for (const pos of userPositions) {
        if (pos.market !== market || pos.kind !== adlSide || pos.qty <= 0) continue;

        const positionValue = markPrice * pos.qty;
        let uPnl = 0;
        if (pos.kind === 'LONG') {
          uPnl = positionValue - pos.costBasis;
        } else {
          uPnl = pos.costBasis - positionValue;
        }

        if (uPnl > highestPnl) {
          highestPnl = uPnl;
          profitableUserId = userId;
        }
      }
    }

    return {
      profitableUser:
        profitableUserId !== null ? ([highestPnl, profitableUserId] as [number, string]) : null,
      markPrice,
    };
  }
}
