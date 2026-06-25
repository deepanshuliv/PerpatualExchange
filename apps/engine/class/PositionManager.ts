import type {
  MarketIndex,
  MarketMarkPrice,
  PositionDetails,
  Positions,
  userMarketOrderTypes,
  positonSnapshotInstanceType,
} from "@repo/shared-types/internal-types";
import { Shared } from "@repo/shared-types";
import { OrderedMap } from "js-sdsl";
export default class PostionManager {
  private positions: Positions;
  private markteIndex: MarketIndex;
  private marketsMarkPrice: MarketMarkPrice;

  constructor() {
    this.positions = new Map();
    this.markteIndex = new Map<Shared.MARKET_AVAILABEL, Set<string>>();
    this.marketsMarkPrice = new Map();
  }

  createPositionSnapshot() {
    return {
      positions: JSON.stringify(this.positions),
      marketIndex: JSON.stringify(this.markteIndex),
    };
  }
  loadPositionSnapshot(positonSnapshotInstance: positonSnapshotInstanceType) {
    this.positions = JSON.parse(positonSnapshotInstance.positions);
    this.markteIndex = JSON.parse(positonSnapshotInstance.marketIndex);
  }

  getPosition(userId: string, market: Shared.MARKET_AVAILABEL) {
    const userPositions = this.positions.get(userId);
    if (!userPositions) {
      return null;
    }
    const marketPos = userPositions.find((pos) => {
      return pos.market === market;
    });
    if (!marketPos) {
      return null;
    }
    return marketPos;
  }

  getPositionsForUser(userId: string) {
    return this.positions.get(userId) ?? [];
  }

  changePosition(
    userId: string,
    market: Shared.MARKET_AVAILABEL,
    kind: Shared.KIND,
    qty: number,
    costBasis: number,
    margin: number,
  ) {
    // create , update , positon , delete postion if - 0
    const userPos = this.getPosition(userId, market);

    if (!userPos) {
      const positionDetails: PositionDetails = {
        costBasis,
        kind,
        margin,
        market,
        qty,
      };
      if (!this.markteIndex.has(market)) {
        this.markteIndex.set(market, new Set());
      }
      this.positions.set(userId, [positionDetails]);
      this.markteIndex.get(market)?.add(userId);

      return userPos;
    }

    if (userPos.kind === kind) {
      userPos.qty += qty;
      userPos.costBasis += costBasis;
      userPos.margin += margin;
    } else {
      // opposite side decrease qty of positions
      if (userPos.qty === qty) {
        // pos = 0
        // delete pos — filter out the position for this market
        let userPosToChange = this.positions.get(userId);
        userPosToChange = userPosToChange?.filter((pos) => {
          return pos.market !== market; // remove only the position for this market
        });
        this.positions.set(userId, userPosToChange ?? []);
        this.markteIndex.get(market)!.delete(userId);
      } else if (userPos.qty > qty) {
        // partial reduction — position kind stays the same
        userPos.qty -= qty;
        userPos.margin -= margin;
        userPos.costBasis -= costBasis;
      } else if (userPos.qty < qty) {
        // position flip — directly set the new flipped position values
        userPos.qty = qty;
        userPos.margin = margin;
        userPos.costBasis = costBasis;
        userPos.kind = kind; // flip to the new direction
      }
    }

    return userPos;
  }

  calculateLiquidation(market: Shared.MARKET_AVAILABEL, markPrice: number) {
    // go to each user calculate pnl
    // before margin - 5% liquidate person
    // return { qty , kind , market , userId , margin}
    const userMarketOrder: userMarketOrderTypes[] = [];
    const userPosOfmarket = this.markteIndex.get(market);
    if (!userPosOfmarket) {
      return null;
    }

    userPosOfmarket.forEach((userId) => {
      const userPostion = this.positions.get(userId);

      userPostion?.forEach((pos) => {
        if (pos.market === market) {
          let liquidationMarginLimit = pos.margin * 0.95;
          let priceOfPostionAccordingToMarkPrice = markPrice * pos.qty;
          let uPnl = priceOfPostionAccordingToMarkPrice - pos.costBasis;

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
    // Guard: both prices must be valid
    if (!externalPrice || !localPrice) return null;

    const marketUser = this.markteIndex.get(market);
    if (!marketUser) return null;

    const longUser: PositionDetails[] = [];
    const shortUser: PositionDetails[] = [];

    marketUser.forEach((userId) => {
      const userPositions = this.positions.get(userId);
      if (!userPositions) return;
      const longPos = userPositions.find((pos) => pos.market === market && pos.kind === 'LONG');
      const shortPos = userPositions.find((pos) => pos.market === market && pos.kind === 'SHORT');
      // Both sides must exist for funding to apply (internal zero-sum)
      if (longPos) longUser.push(longPos);
      if (shortPos) shortUser.push(shortPos);
    });

    if (longUser.length === 0 || shortUser.length === 0) return null;

    // --- Industry-standard funding rate formula ---
    // 1. Funding Basis: how much the local futures price deviates from external index
    const fundingBasis = localPrice - externalPrice;

    // 2. Funding Rate as a %: basis relative to external price
    //    Capped at ±0.05% per period (industry standard cap, e.g. Binance uses ±0.05%)
    const MAX_FUNDING_RATE = 0.0005; // 0.05%
    const rawFundingRate = fundingBasis / externalPrice;
    const fundingRate = Math.max(-MAX_FUNDING_RATE, Math.min(MAX_FUNDING_RATE, rawFundingRate));

    // 3. Per-position payment: positionNotionalValue × fundingRate
    //    notionalValue = qty × externalPrice (valued at fair external price)
    //    Positive fundingRate → longs pay shorts (local premium, incentivise selling)
    //    Negative fundingRate → shorts pay longs (local discount, incentivise buying)

    if (fundingRate > 0) {
      // Longs pay shorts
      longUser.forEach((pos) => {
        const notional = pos.qty * externalPrice;
        pos.margin -= notional * fundingRate;
      });
      shortUser.forEach((pos) => {
        const notional = pos.qty * externalPrice;
        pos.margin += notional * fundingRate;
      });
    } else if (fundingRate < 0) {
      // Shorts pay longs (fundingRate is negative, so flip sign for debit)
      shortUser.forEach((pos) => {
        const notional = pos.qty * externalPrice;
        pos.margin -= notional * Math.abs(fundingRate);
      });
      longUser.forEach((pos) => {
        const notional = pos.qty * externalPrice;
        pos.margin += notional * Math.abs(fundingRate);
      });
    }
    // If fundingRate === 0, prices are equal — no payment needed
  }

  updateMarkpriceMap(market: Shared.MARKET_AVAILABEL, price: number) {
    this.marketsMarkPrice.set(market, price);
  }

  getMarkpriceOfMarket(market: Shared.MARKET_AVAILABEL) {
    return this.marketsMarkPrice.get(market);
  }

  calculateAndGetHigestPnl(kind: Shared.KIND, market: Shared.MARKET_AVAILABEL) {
    const oppSide = kind === "SHORT" ? "LONG" : "SHORT";
    const markPrice = this.marketsMarkPrice.get(market) || 0;

    const oppSideMaxPnlUsers = new OrderedMap<number, string>();
    this.markteIndex.get(market)?.forEach((userId) => {
      const userPositions = this.positions.get(userId);
      const userMarketPos = userPositions?.find((pos) => {
        return pos.kind === oppSide && pos.market === market;
      })!;

      const marketPositionValue = markPrice * userMarketPos.qty;
      const uPnl = marketPositionValue - userMarketPos.costBasis;

      oppSideMaxPnlUsers.setElement(uPnl, userId);
    });
    return { profitableUser: oppSideMaxPnlUsers.front(), markPrice };
  }
}
