import  {Router}   from "express"
import authenticationRoutes from "./exchange";
import exchangeRoutes from "./exchange";


const appRouter  = Router();

appRouter.use(authenticationRoutes)
appRouter.use(exchangeRoutes)


export default appRouter