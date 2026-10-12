import { Router } from "express";
import { changePassword, signIn, signUp } from "../controller/authentication";
import { isAuth } from "../middleware/authentication";

const authenticationRoutes = Router()

authenticationRoutes.post("/signup" , signUp);
authenticationRoutes.post("/signin" , signIn);
authenticationRoutes.post("/change-password" , isAuth, changePassword);


export default authenticationRoutes;
