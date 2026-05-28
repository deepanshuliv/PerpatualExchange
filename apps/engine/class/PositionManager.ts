import type { MarketIndex, PositionDetails, Positions, userMarketOrderTypes } from "types";
import { Shared } from "shared-types";
export default class PostionManager {
    private positions: Positions;
    private markteIndex: MarketIndex;

    constructor() {
        this.positions = new Map()
        this.markteIndex = new Map<Shared.MARKET_AVAILABEL, Set<string>>()
    }

    getPosition(userId: string, market: Shared.MARKET_AVAILABEL) {
        const userPositions = this.positions.get(userId);
        if (!userPositions) {
            return null
        }
        const marketPos = userPositions.find((pos) => {
            return pos.market === market
        })
        if (!marketPos) {
            return null
        }
        return marketPos
    }

    changePosition(userId: string, market: Shared.MARKET_AVAILABEL, kind: Shared.KIND, qty: number, costBasis: number, margin: number) {
        // create , update , positon , delete postion if - 0
        const userPos = this.getPosition(userId, market);

        if (!userPos) {
            const positionDetails: PositionDetails = {
                costBasis,
                kind,
                margin,
                market,
                qty
            }
            if (!this.markteIndex.has(market)) {
                this.markteIndex.set(market, new Set());
            }
            this.positions.set(userId, [positionDetails]);
            this.markteIndex.get(market)?.add(userId);

            return userPos
        }

        if (userPos.kind === kind) {
            userPos.qty += qty;
            userPos.costBasis += costBasis
            userPos.margin += margin
        }
        else {
            // opposite side decrease qty fo positions
            if (userPos.qty === qty) {
                // pos = 0 
                // delete pos — filter out the position for this market
                let userPosToChange = this.positions.get(userId)
                userPosToChange = userPosToChange?.filter((pos) => {
                    return pos.market !== market // remove only the position for this market
                })
                this.positions.set(userId, userPosToChange ?? []);
                this.markteIndex.get(market)!.delete(userId)

            }
            else if (userPos.qty > qty) {
                // partial reduction — position kind stays the same
                userPos.qty -= qty;
                userPos.margin -= margin;
                userPos.costBasis -= costBasis
            }
            else if (userPos.qty < qty) {
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
        const userMarketOrder: userMarketOrderTypes[] = []
        const userPosOfmarket = this.markteIndex.get(market);
        if (!userPosOfmarket) {
            return null
        }

        userPosOfmarket.forEach((userId) => {
            const userPostion = this.positions.get(userId);

            userPostion?.forEach((pos) => {
                if (pos.market === market) {
                    let liquidationMarginLimit = pos.margin * 0.95;
                    let priceOfPostionAccordingToMarkPrice = markPrice * pos.qty;
                    let uPnl = priceOfPostionAccordingToMarkPrice - pos.costBasis;

                    if (uPnl + liquidationMarginLimit <= 0) {
                        userMarketOrder.push({ userId, qty: pos.qty, market: pos.market, kind: pos.kind, margin: pos.margin, costBasis: pos.costBasis })
                    }
                }
            })
        })
        return userMarketOrder;
    }
}