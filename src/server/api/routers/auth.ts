import { createTRPCRouter, publicProcedure } from "../trpc";
import type { Session } from "next-auth";

export const authRouter = createTRPCRouter({
  getSession: publicProcedure.query(({ ctx }): Session | null => {
    return ctx.session;
  }),
});
