import type { Kind, MARKET, Positions, Type } from "types";

export default class  Lqiuidation{
    private positions : Positions;
    constructor(){
        this.positions = new Map()
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
        const userPos = this.getPosition(userId , market)
        if(!userPos){
            return null
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
            this.positions.set(userId , userPosToChange ?? [])

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

        // update the map with new positions
    }
    


}