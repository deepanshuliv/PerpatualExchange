import type { Kind, MARKET, MarketIndex, PositionDetails, Positions,  userMarketOrderTypes } from "types";

export default class  Lqiuidation{
    private positions : Positions;
    private markteIndex : MarketIndex;

    constructor(){
        this.positions = new Map()
        this.markteIndex = new Map<MARKET ,Set<string>>()

    }

    getPosition(userId : string , market:MARKET){
        const userPositions = this.positions.get(userId);
        if(!userPositions){
            return null
        }
        const marketPos = userPositions.find((pos)=>{
            return pos.market === market
        })
        if(!marketPos){
            return null
        }
        return marketPos
    }

    changePosition(userId : string , market : MARKET , kind : Kind , qty:number , costBasis:number, margin:number){
        // create , update , positon , delete postion if - 0
        const userPos = this.getPosition(userId , market);
        
        if(!userPos){
            const positionDetails : PositionDetails = {
                costBasis,
                kind,
                margin,
                market, 
                qty
            }
            if (!this.markteIndex.has(market)) {
                this.markteIndex.set(market, new Set());
            }
            this.positions.set(userId , [positionDetails]);
            this.markteIndex.get(market)?.add(userId);

            return userPos
        }

        if(userPos.kind === kind){
            userPos.qty+=qty;
            userPos.costBasis += costBasis
            userPos.margin += margin
        }
        else{
            // opposite side decrease qty fo positions
            if(userPos.qty === qty){
                // pos = 0 
                // delete pos
                // TODO :- find out better way to delete 
             let userPosToChange = this.positions.get(userId)
             userPosToChange = userPosToChange?.filter((pos)=>{
                return !(pos.market === market && pos.kind === kind)
             })
            this.positions.set(userId , userPosToChange ?? []);
            this.markteIndex.get(market)!.delete(userId)

            }
            else if(userPos.qty > qty){
                // pos not change
                userPos.qty-=qty;
                userPos.margin-=margin;
                userPos.kind = kind === "LONG" ? "SHORT" : "LONG";
                userPos.costBasis -= costBasis
            }
            else if(userPos.qty < qty){
                // pos will change
                userPos.qty-=qty;
                userPos.margin-=margin;
                userPos.kind = kind === "LONG" ? "SHORT" : "LONG";
                userPos.costBasis -= costBasis
            }
         
        }

        return userPos;        
    }
    
    calculateLiquidation( market :MARKET , kind :Kind , markPrice:number){
        // go to each user calculate pnl
        // before margin - 5% liquidate person 
        // return { qty , kind , market , userId , margin}
        const userMarketOrder:userMarketOrderTypes[] =[] 
       const userPosOfmarket = this.markteIndex.get(market); 
        if(!userPosOfmarket){
            return null
        }
         
        userPosOfmarket.forEach((userId)=>{
            const userPostion = this.positions.get(userId);

           userPostion?.forEach((pos)=>{
            if(pos.market === market && pos.kind === kind){
                let liquidationPrice = pos.margin * 0.95;
                let priceOfPostionAccordingToMarkPrice = markPrice * pos.qty;
                let uPnl = priceOfPostionAccordingToMarkPrice - pos.costBasis ;

                if(uPnl - liquidationPrice === 0 ){
                    userMarketOrder.push({qty : pos.qty , market : pos.market , kind : pos.kind , margin : pos.margin})
                }
            }
           })
        })
       return userMarketOrder; 
    }

}