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
    markPrice: number,
    indexPrice: number,
    market: Shared.MARKET_AVAILABEL,
  ) {
    // get all user for a market
    const marketUser = this.markteIndex.get(market);
    if (!marketUser) {
      return null;
    }
    let longUser: PositionDetails[] = [];
    let shortUser: PositionDetails[] = [];
    marketUser.forEach((userId) => {
      const userPositions = this.positions.get(userId)!;
      let templongUser = userPositions.find((pos) => {
        return pos.market === market && pos.kind === "LONG";
      })!;
      let tempshortUser = userPositions.find((pos) => {
        return pos.market === market && pos.kind === "SHORT";
      });
      if (!templongUser || !tempshortUser) return;

      longUser.push(templongUser);
      shortUser.push(tempshortUser);
    });
    if (!shortUser || !longUser) return null;

    const fundingRatio = markPrice / indexPrice;

    if (markPrice > indexPrice) {
      // short  should pay to long
      // find out show
      const shortTotalMargin = shortUser.reduce((acc, curr) => {
        return acc + curr.margin;
      }, 0);

      const fundingRateAmount = shortTotalMargin * fundingRatio;
      const longUsersTotalQty = longUser.reduce(
        (acc, curr) => acc + curr.qty,
        0,
      );

      longUser.forEach((userPos) => {
        {
          userPos.margin +=
            (userPos.qty / longUsersTotalQty) * fundingRateAmount;
        }
      });

      shortUser.forEach((userPos) => {
        userPos.margin -= (userPos.qty / longUsersTotalQty) * fundingRateAmount;
      });
    }
    if (indexPrice > markPrice) {
      // long should pay short
      const longTotalMargin = longUser.reduce((acc, curr) => {
        return acc + curr.margin;
      }, 0);

      const fundingRateAmount = longTotalMargin * fundingRatio;
      const shortUsersTotalQty = shortUser.reduce(
        (acc, curr) => acc + curr.qty,
        0,
      );

      shortUser.forEach((userPos) => {
        {
          userPos.margin +=
            (userPos.qty / shortUsersTotalQty) * fundingRateAmount;
        }
      });

      longUser.forEach((userPos) => {
        userPos.margin -=
          (userPos.qty / shortUsersTotalQty) * fundingRateAmount;
      });
    }
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
