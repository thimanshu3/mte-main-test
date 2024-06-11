import { z } from 'zod'
import { pusher } from '~/utils/pusher/server'
import { createTRPCRouter, rawProtectedProcedure } from '../../trpc'

export const taskListsRouter = createTRPCRouter({
  getAll: rawProtectedProcedure()
    .input(
      z.object({
        teamId: z.string().cuid()
      })
    )
    .query(async ({ ctx: { prisma }, input: { teamId } }) => {
      return await prisma.taskList.findMany({
        where: {
          teamId,
          deletedAt: null
        },
        orderBy: {
          order: 'asc'
        }
      })
    }),

  create: rawProtectedProcedure()
    .input(
      z.object({
        teamId: z.string().cuid(),
        name: z.string(),
        order: z.number().optional()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input: { teamId, name } }) => {
      const createdTaskList = await prisma.taskList.create({
        data: {
          teamId,
          name,
          order:
            (await prisma.taskList.count({
              where: { teamId, deletedAt: null }
            })) + 1,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
      await pusher.trigger(
        `private-team-${teamId}`,
        'task-list-created',
        createdTaskList
      )
      return createdTaskList
    }),

  delete: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input: { id } }) => {
      const deletedTaskList = await prisma.taskList.update({
        where: {
          id
        },
        data: {
          order: -1,
          deletedById: session.user.id,
          deletedAt: new Date()
        }
      })
      await prisma.taskList.updateMany({
        where: {
          teamId: deletedTaskList.teamId,
          order: {
            gt: deletedTaskList.order
          }
        },
        data: {
          order: {
            decrement: 1
          }
        }
      })
      await pusher.trigger(
        `private-team-${deletedTaskList.teamId}`,
        'task-list-deleted',
        await prisma.taskList.findMany({
          where: {
            teamId: deletedTaskList.teamId,
            deletedAt: null
          },
          orderBy: {
            order: 'asc'
          }
        })
      )
      return deletedTaskList
    }),
  update: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string(),
        order: z.number()
      })
    )
    .mutation(
      async ({ ctx: { prisma, session }, input: { id, name, order } }) => {
        const taskList = await prisma.taskList.findUnique({
          where: {
            id
          }
        })

        if (taskList && order !== taskList.order) {
          await prisma.taskList.updateMany({
            where: {
              teamId: taskList.teamId,
              order:
                order > taskList.order
                  ? {
                      gte: taskList.order,
                      lte: order
                    }
                  : {
                      gte: order,
                      lte: taskList.order
                    },
              id: {
                not: id
              }
            },
            data: {
              order: {
                [order > taskList.order ? 'decrement' : 'increment']: 1
              }
            }
          })
        }

        const updatedTaskList = await prisma.taskList.update({
          where: {
            id
          },
          data: {
            name,
            order,
            updatedById: session.user.id
          }
        })
        await pusher.trigger(
          `private-team-${updatedTaskList.teamId}`,
          'task-list-updated',
          await prisma.taskList.findMany({
            where: {
              teamId: updatedTaskList.teamId,
              deletedAt: null
            },
            orderBy: {
              order: 'asc'
            }
          })
        )
        return updatedTaskList
      }
    )
})
