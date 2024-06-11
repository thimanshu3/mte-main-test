import { z } from 'zod'
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure
} from '~/server/api/trpc'

export const exampleRouter = createTRPCRouter({
  public: publicProcedure
    .input(
      z
        .object({
          name: z.string().optional()
        })
        .optional()
    )
    .query(({ input }) => {
      return {
        message: `Hello, ${input?.name || 'World'}!`
      }
    }),

  private: protectedProcedure.query(() => {
    return {
      message: `You can now see this secret message.`
    }
  })
})
