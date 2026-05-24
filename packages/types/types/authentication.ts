import z from "zod";

export const authentication_schema  = z.object({
    username : z.string(),
    password:z.string().min(1)
})