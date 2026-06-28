import type {
  MarketIndex,
  PositionDetails,
  Positions,
  userMarketOrderTypes,
  positonSnapshotInstanceType,
} from "@repo/shared-types/internal-types";
import { Shared } from "@repo/shared-types";

export default class PostionManager {
  private positions: Positions;
  private markteIndex: MarketIndex;
  private marketsMarkPrice: Map<Shared.MARKET_AVAILABEL, number>;

  constructor() {
    this.positions = new Map();
    this.markteIndex = new Map();
    this.marketsMarkPrice = new Map();
  }

  createSnapShot() {
    return {
      positions: JSON.stringify(Array.from(this.positions.entries())),
      marketIndex: JSON.stringify(
        Array.from(this.markteIndex.entries()).map(([m, set]) => [m, Array.from(set || [])]),
      ),
    };
  }

  loadSnapShot(snapshot: positonSnapshotInstanceType) {
    if (!snapshot) return;
    this.positions = new Map(JSON.parse(snapshot.positions || '[]'));
    const idx = JSON.parse(snapshot.marketIndex || '[]');
    this.markteIndex = new Map(
      idx.map(([k, v]: [any, any[]]) => [k, new Set(v)]),
    );
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
    this.markteIndex.get(market)?.delete(userId);

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
      if (!this.markteIndex.has(market)) {
        this.markteIndex.set(market, new Set());
      }
      this.positions.set(userId, [...userPositions, positionDetails]);
      this.markteIndex.get(market)?.add(userId);
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
    if (!this.markteIndex || !this.markteIndex.get) return null;

    const userPosOfmarket = this.markteIndex.get(market);
    if (!userPosOfmarket || userPosOfmarket.size === 0) return null;

    const userMarketOrder: userMarketOrderTypes[] = [];
    userPosOfmarket.forEach((userId) => {
      const userPositions = this.positions.get(userId);
      userPositions?.forEach((pos) => {
        if (pos.market === market) {
          const liquidationMarginLimit = pos.margin * 0.95;
          const priceOfPostionAccordingToMarkPrice = markPrice * pos.qty;
          const uPnl =
            pos.kind === 'LONG'
              ? priceOfPostionAccordingToMarkPrice - pos.costBasis
              : pos.costBasis - priceOfPostionAccordingToMarkPrice;

          if (uPnl + liquidationMarginLimit <= 0) {
            userMarketOrder.push({
              userId,
              qty: pos.qty,
              market: pos.market,
              kind: pos.kind,
              margin: pos.margin,
              costBasis: pos.costBasis,
            });
          }
        }
      });
    });

    return userMarketOrder;
  }

  claculateFundingRate(
    externalPrice: number,
    localPrice: number,
    market: Shared.MARKET_AVAILABEL,
  ) {
    if (!externalPrice || !localPrice) return null;
    if (!this.markteIndex || !this.markteIndex.get) return null;

    const marketUser = this.markteIndex.get(market);
    if (!marketUser || marketUser.size === 0) return null;

    const longUser: PositionDetails[] = [];
    const shortUser: PositionDetails[] = [];

    marketUser.forEach((userId) => {
      const userPositions = this.positions.get(userId);
      if (!userPositions) return;
      const longPos = userPositions.find((pos) => pos.market === market && pos.kind === 'LONG');
      const shortPos = userPositions.find((pos) => pos.market === market && pos.kind === 'SHORT');
      if (longPos) longUser.push(longPos);
      if (shortPos) shortUser.push(shortPos);
    });

    if (longUser.length === 0 || shortUser.length === 0) return null;

    const fundingBasis = localPrice - externalPrice;
    const MAX_FUNDING_RATE = 0.0005;
    const rawFundingRate = fundingBasis / externalPrice;
    const fundingRate = Math.max(-MAX_FUNDING_RATE, Math.min(MAX_FUNDING_RATE, rawFundingRate));

    if (fundingRate > 0) {
      longUser.forEach((pos) => {
        pos.margin -= pos.qty * externalPrice * fundingRate;
      });
      shortUser.forEach((pos) => {
        pos.margin += pos.qty * externalPrice * fundingRate;
      });
    } else if (fundingRate < 0) {
      const rate = Math.abs(fundingRate);
      shortUser.forEach((pos) => {
        pos.margin -= pos.qty * externalPrice * rate;
      });
      longUser.forEach((pos) => {
        pos.margin += pos.qty * externalPrice * rate;
      });
    }
  }

  updateMarkpriceMap(market: Shared.MARKET_AVAILABEL, price: number) {
    this.marketsMarkPrice.set(market, price);
  }

  getMarkpriceOfMarket(market: Shared.MARKET_AVAILABEL) {
    return this.marketsMarkPrice.get(market);
  }

  calculateAndGetHigestPnl(
    closeKind: Shared.KIND,
    market: Shared.MARKET_AVAILABEL,
    markPrice: number,
    excludeUserId?: string,
  ) {
    // Opposite side to the closing order (LONG close → find SHORT positions, etc.)
    const adlSide: Shared.KIND = closeKind === 'SHORT' ? 'LONG' : 'SHORT';

    if (!this.markteIndex?.get) return { profitableUser: null, markPrice };

    let highestPnl = -Infinity;
    let profitableUserId: string | null = null;

    this.markteIndex.get(market)?.forEach((userId) => {
      if (excludeUserId && userId === excludeUserId) return;

      const userPositions = this.positions.get(userId);
      const userMarketPos = userPositions?.find(
        (pos) => pos.kind === adlSide && pos.market === market,
      );
      if (!userMarketPos || userMarketPos.qty <= 0) return;

      const marketPositionValue = markPrice * userMarketPos.qty;
      const uPnl =
        userMarketPos.kind === 'LONG'
          ? marketPositionValue - userMarketPos.costBasis
          : userMarketPos.costBasis - marketPositionValue;

      if (uPnl > highestPnl) {
        highestPnl = uPnl;
        profitableUserId = userId;
      }
    });

    return {
      profitableUser:
        profitableUserId !== null ? ([highestPnl, profitableUserId] as [number, string]) : null,
      markPrice,
    };
  }
}
