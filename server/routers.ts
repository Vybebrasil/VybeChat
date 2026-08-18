import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import {
  createChannelMessage,
  createWorkspaceCategory,
  createWorkspaceChannel,
  ensureChannelMembership,
  ensureWorkspaceMembership,
  ensureWorkspaceSeed,
  listChannelMessages,
  listWorkspace,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { normalizeChannelName, normalizeLabel } from "./chat.utils";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  workspace: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      await ensureWorkspaceSeed();
      await ensureWorkspaceMembership(ctx.user.id);
      return listWorkspace();
    }),
    createCategory: protectedProcedure
      .input(z.object({ name: z.string().min(2).max(80) }))
      .mutation(async ({ input }) => {
        await createWorkspaceCategory(normalizeLabel(input.name));
        return { success: true } as const;
      }),
    createChannel: protectedProcedure
      .input(
        z.object({
          categoryId: z.number().int().positive(),
          name: z.string().min(2).max(80),
          type: z.enum(["text", "voice"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await createWorkspaceChannel({ ...input, name: normalizeChannelName(input.name) });
        await ensureWorkspaceMembership(ctx.user.id);
        return { success: true } as const;
      }),
  }),
  messages: router({
    list: protectedProcedure
      .input(z.object({ channelId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await ensureChannelMembership(input.channelId, ctx.user.id);
        return listChannelMessages(input.channelId);
      }),
    create: protectedProcedure
      .input(
        z.object({
          channelId: z.number().int().positive(),
          content: z.string().trim().min(1).max(4000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureChannelMembership(input.channelId, ctx.user.id);
        await createChannelMessage({
          channelId: input.channelId,
          userId: ctx.user.id,
          content: input.content,
        });
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
