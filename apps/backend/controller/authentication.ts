import type { Request, Response } from "express";
import { prisma } from "@repo/db"
import { InternalTypes } from "@repo/shared-types";
import bcrypt from "bcryptjs";
import { signToken } from "../utils/jwt";

const BCRYPT_ROUNDS = 10;

/** Accounts created before hashing was added still hold the raw password. */
function isBcryptHash(value: string) {
    return /^\$2[aby]\$\d{2}\$/.test(value);
}

function passwordMatches(password: string, stored: string) {
    return isBcryptHash(stored) ? bcrypt.compare(password, stored) : Promise.resolve(stored === password);
}

function firstIssue(error: { issues: { message: string }[] }) {
    return error.issues[0]?.message ?? "please provide all fields";
}

function authResponse(user: { id: string; email: string }) {
    return {
        token: signToken(user.id),
        userId: user.id,
        user: { id: user.id, email: user.email },
    };
}

export async function signIn(req: Request, res: Response) {
    try {
        const parsed = InternalTypes.AUTHENTICATION_SCHEMA.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ msg: firstIssue(parsed.error) });
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        // Same message for unknown email and wrong password, so accounts can't be probed.
        const invalid = () => res.status(401).json({ msg: "Incorrect email or password" });
        if (!user) return invalid();

        if (!(await passwordMatches(password, user.password))) return invalid();
        if (!isBcryptHash(user.password)) {
            // Upgrade a legacy plain-text password to a hash on successful login.
            await prisma.user.update({
                where: { id: user.id },
                data: { password: await bcrypt.hash(password, BCRYPT_ROUNDS) },
            });
        }

        res.status(200).json(authResponse(user));
    } catch (error) {
        console.error('[signIn] error:', error);
        res.status(500).json({ msg: "internal server error" });
    }
}

export async function signUp(req: Request, res: Response) {
    try {
        const parsed = InternalTypes.SIGNUP_SCHEMA.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ msg: firstIssue(parsed.error) });
        }

        const { email, password } = parsed.data;

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ msg: "An account with this email already exists" });
        }

        const newUser = await prisma.user.create({
            data: { email, password: await bcrypt.hash(password, BCRYPT_ROUNDS) },
        });

        res.status(201).json(authResponse(newUser));
    } catch (error) {
        console.error('[signUp] error:', error);
        res.status(500).json({ msg: "internal server error" });
    }
}

/**
 * Changes the signed-in user's password. The current password is required, so a
 * stolen session token alone cannot take over the account.
 *
 * There is no "forgot password" flow: that needs a token delivered by email,
 * which this project does not send.
 */
export async function changePassword(req: Request, res: Response) {
    try {
        const parsed = InternalTypes.CHANGE_PASSWORD_SCHEMA.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ msg: firstIssue(parsed.error) });
        }

        const { currentPassword, newPassword } = parsed.data;
        const user = await prisma.user.findUnique({ where: { id: req.userId! } });
        if (!user || !(await passwordMatches(currentPassword, user.password))) {
            return res.status(401).json({ msg: "Current password is incorrect" });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
        });

        res.status(200).json({ ok: true, msg: "Password updated" });
    } catch (error) {
        console.error('[changePassword] error:', error);
        res.status(500).json({ msg: "internal server error" });
    }
}
