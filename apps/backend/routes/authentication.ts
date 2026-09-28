import { Router } from "express";
import { resetPassword, signIn, signUp } from "../controller/authentication";

const authenticationRoutes = Router()

authenticationRoutes.post("/signup" , signUp);
authenticationRoutes.post("/signin" , signIn);
authenticationRoutes.post("/reset-password" , resetPassword);


export default authenticationRoutes;
