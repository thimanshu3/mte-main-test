import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '~/server/api/trpc'

const updateCreate = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  address: z.string().min(1)
})

export const exporterDetailsRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where = input.search
        ? {
            OR: [
              {
                id: input.search
              },
              {
                name: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              }
            ]
          }
        : undefined
      const [exporterDetails, total] = await Promise.all([
        prisma.exporterDetails.findMany({
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
            },
            deletedBy: {
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
        prisma.exporterDetails.count({
          where
        })
      ])
      return { exporterDetails, total }
    }),

  getAllMini: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where = input.search
        ? {
            OR: [
              {
                id: input.search
              },
              {
                name: {
                  contains: input.search,
                  mode: 'insensitive' as const
                },
                deletedAt: null
              }
            ]
          }
        : {
            deletedAt: null
          }
      const [exporterDetails, total] = await Promise.all([
        prisma.exporterDetails.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            name: true,
            address: true
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.exporterDetails.count({
          where
        })
      ])
      return { exporterDetails, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.exporterDetails.findUniqueOrThrow({
        where: {
          id: input.id
        },
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
          },
          deletedBy: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    }),

  createOrUpdateOne: adminProtectedProcedure
    .input(updateCreate)
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (input.id)
        return await prisma.exporterDetails.update({
          where: {
            id: input.id
          },
          data: {
            name: input.name,
            address: input.address,
            updatedById: session.user.id
          }
        })
      return await prisma.exporterDetails.create({
        data: {
          name: input.name,
          address: input.address,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }),

  deleteOne: adminProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        activate: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.exporterDetails.update({
        where: {
          id: input.id
        },
        data: input.activate
          ? {
              deletedAt: null,
              deletedById: null
            }
          : {
              deletedAt: new Date(),
              deletedById: session.user.id
            }
      })
    })
})
