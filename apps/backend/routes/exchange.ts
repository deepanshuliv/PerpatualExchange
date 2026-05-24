import { Router } from "express";
import type { EngineRequest } from "types";
import { toEngine } from "../utils/toEngine";
import { isAuth } from "../middleware/authentication";
import { randomUUIDv5 } from "bun";

const exchangeRoutes = Router()

exchangeRoutes.post("/onramp", async (req, res) => {
    // TO DO add zod  validation 
    const { amount } = req.body;
    const engineRequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "add_balance",
        reponseStream: process.env.REPONSE_STREAM!,
        payload: {
            userId: req.userId,
            amount
        }

    }
    const engineResponse = await toEngine(engineRequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })

})
exchangeRoutes.get("/equity/available", isAuth, async (req, res) => {

    const engineReequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "equity_availabel",
        payload: {
            userId: req.userId
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })

})
exchangeRoutes.get("/positions/open/:marketId", isAuth, async (req, res) => {
    const engineReequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "open_position",
        payload: {
            userId: req.userId,
            status: "OPEN"
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })
});
exchangeRoutes.get("/positions/closed/:marketId", isAuth, async (req, res) => {
   // TO DO :- write zod validation to marketId param 
   // get market name or symbol from Db 
    const engineReequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "closed_position",
        payload: {
            userId: req.userId, 
            status:"CANCELLED",
            marketId:req.params.marketId
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })
});
exchangeRoutes.get("/orders/open/:marketId", isAuth,async (req, res) => { 
    const engineReequest: EngineRequest = {
        correlationId: crypto.randomUUID(),
        messageType: "open_orders",
        payload: {
            userId: req.userId, 
            marketid : req.params,
            status:"OPEN"
        },
        reponseStream: process.env.REPONSE_STREAM!,
    }

    const engineResponse = await toEngine(engineReequest);
    if (!engineResponse) {
        return res.status(403).json({
            msg: "some error occured"
        })

    }
    res.status(201).json({
        ok: true,
        data: engineResponse
    })
})
exchangeRoutes.get("/orders/:marketId", isAuth, (req, res) => { 
    //get from db order tables 
})
exchangeRoutes.get("/fills", isAuth, (req, res) => { 
        // get from Db for particular user    
});


export default exchangeRoutes;
