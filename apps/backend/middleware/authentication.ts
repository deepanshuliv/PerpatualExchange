import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

export const isAuth = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header) {
        return res.status(403).json({
            msg: "invalid token"
        });
    }

    const token = header.split(" ")[1];
    if (!token) {
        return res.status(403).json({
            msg: "invalid token"
        });
    }

    try {
        const isValid = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        if (!isValid || !isValid.userId) {
            return res.status(403).json({
                msg: "invalid token"
            });
        }
        req.userId = isValid.userId;
        next();
    } catch (err) {
        return res.status(403).json({
            msg: "invalid token"
        });
    }
};
