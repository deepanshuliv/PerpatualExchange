export type commandType = "create_order" | "cancel_order" | "get_order" | "get_balance" | "add_balance" | "equity_availabel" | "open_orders" | "closed_orders" | "closed_position"

/*
create order pyaload {
    qty:1 . 
    price:100, 
    market:"SOL", 
    kind:"LONG", 
    type:"LIMIT" 
    equity:100
    }
*/


export type EngineResponse = {
    ok: boolean,
    reponseStream: string,
    messageType: commandType,
    correlationId: string,
    payload?: unknown,
    error?: unknown,
}
export interface EngineRequest {
    messageType: commandType,
    reponseStream: string,
    correlationId: string,
    payload: unknown,
}