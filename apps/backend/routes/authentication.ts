import { Router } from "express";
import { signIn, signUp } from "../controller/authentication"; 

const authenticationRoutes = Router()

authenticationRoutes.post("/signup" , signUp);
authenticationRoutes.post("/signin" , signIn);


export default authenticationRoutes;
