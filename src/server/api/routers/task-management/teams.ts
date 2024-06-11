import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '../../trpc'

export const teamsRouter = createTRPCRouter({
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
      const [teams, total] = await Promise.all([
        prisma.team.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          orderBy: {
            name: 'asc'
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
            }
          }
        }),
        prisma.team.count({
          where
        })
      ])
      return { teams, total }
    }),
  createOrUpdate: adminProtectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const { id, ...data } = input
      if (id) {
        return prisma.team.update({
          where: {
            id
          },
          data: {
            ...data,
            updatedById: session.user.id
          }
        })
      } else {
        return prisma.team.create({
          data: {
            ...data,
            users: {
              create: {
                userId: session.user.id
              }
            },
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
      }
    }),
  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.team.findUniqueOrThrow({
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
          users: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })
    }),
  addTeamUsers: adminProtectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        userIds: z.array(z.string())
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      await prisma.teamUser.createMany({
        data: input.userIds.map(userId => ({
          teamId: input.teamId,
          userId
        }))
      })
    }),
  removeTeamUser: adminProtectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      await prisma.teamUser.delete({
        where: {
          id: input.id
        }
      })
    })
})
