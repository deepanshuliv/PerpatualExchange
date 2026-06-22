import type { Request, Response } from "express";
import { prisma } from "@repo/db"
import { InternalTypes } from "@repo/shared-types";
import jwt from "jsonwebtoken"

export async function signIn(req: Request, res: Response) {
    const { success, data } = InternalTypes.AUTHENTICATION_SCHEMA.safeParse(req.body);
    if (!success) {
        return res.status(411).json({
            msg: "please provide all fields"
        })
    }

    const { username, password } = data;

    const user = await prisma.user.findFirst({ where: { username } });
    if (!user) {
        return res.status(411).json({
            msg: "user is not present please go to signup "
        })
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

    res.status(201).json({
        token,
        userId: user.id,
    })
}

export async function signUp(req: Request, res: Response) {
    const { success, data } = InternalTypes.AUTHENTICATION_SCHEMA.safeParse(req.body);
    if (!success) {
        return res.status(411).json({
            message: "please provide all fields"
        })
    }

    const { username, password } = data;

    const user = await prisma.user.findFirst({ where: { username } });

    if (user) {
        return res.status(403).json({
            msg: "user is already exists, go to signin"
        })
    }

    const newUser = await prisma.user.create({ data: { username, password } });

    if (!newUser) {
        return res.status(403).json({
            msg: "internal server error"
        })
    }

    const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET!);

    res.status(201).json({
        token,
        userId: newUser.id
    })
}