import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '~/server/api/trpc'

export const sitesRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        customerId: z.string().optional(),
        limit: z.number().default(10),
        search: z.string().optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: any =
        input.search || input.customerId
          ? {
              OR: [
                {
                  customerId: input.customerId,
                  id: input.search
                },
                {
                  customerId: input.customerId,
                  name: {
                    contains: input.search,
                    mode: 'insensitive' as const
                  }
                }
              ]
            }
          : undefined
      const [sites, total] = await Promise.all([
        prisma.site.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          include: {
            createdBy: {
              select: {
                id: true,
                name: true
              }
            },
            updatedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.site.count({
          where
        })
      ])
      return { sites, total }
    }),

  getAllMini: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        customerId: z.string().optional(),
        limit: z.number().default(10),
        search: z.string().optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: any =
        input.search || input.customerId
          ? {
              OR: [
                {
                  customerId: input.customerId,
                  id: input.search
                },
                {
                  customerId: input.customerId,
                  name: {
                    contains: input.search,
                    mode: 'insensitive' as const
                  }
                }
              ]
            }
          : undefined
      const [sites, total] = await Promise.all([
        prisma.site.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            name: true,
            customerId: true
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.site.count({
          where
        })
      ])
      return { sites, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.site.findUniqueOrThrow({
        where: {
          id: input.id
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
          updatedBy: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    }),

  createOrUpdateOne: adminProtectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        customerId: z.string(),
        name: z.string().min(1)
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (input.id)
        return await prisma.site.update({
          where: {
            id: input.id
          },
          data: {
            name: input.name,
            updatedById: session.user.id
          }
        })
      return await prisma.site.create({
        data: {
          name: input.name,
          createdById: session.user.id,
          customerId: input.customerId,
          updatedById: session.user.id
        }
      })
    })
})
