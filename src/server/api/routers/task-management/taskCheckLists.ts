import { z } from 'zod'
import { pusher } from '~/utils/pusher/server'
import { createTRPCRouter, rawProtectedProcedure } from '../../trpc'

export const taskCheckListsRouter = createTRPCRouter({
  createOne: rawProtectedProcedure()
    .input(
      z.object({
        taskId: z.string().cuid(),
        name: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input: { taskId, name } }) => {
      const createdTaskCheckList = await prisma.taskCheckList.create({
        data: {
          taskId,
          name,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
      await pusher.trigger(
        `private-task-${taskId}`,
        'task-check-list-created',
        createdTaskCheckList
      )
      return createdTaskCheckList
    }),

  updateOne: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        name: z.string().optional()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input: { id, name } }) => {
      const updatedTaskCheckList = await prisma.taskCheckList.update({
        where: {
          id
        },
        data: {
          name,
          updatedById: session.user.id
        }
      })
      await pusher.trigger(
        `private-task-${updatedTaskCheckList.taskId}`,
        'task-check-list-updated',
        updatedTaskCheckList
      )
      return updatedTaskCheckList
    }),

  deleteOne: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid()
      })
    )
    .mutation(async ({ ctx: { prisma }, input: { id } }) => {
      const deletedTaskCheckList = await prisma.taskCheckList.delete({
        where: {
          id
        }
      })
      await pusher.trigger(
        `private-task-${deletedTaskCheckList.taskId}`,
        'task-check-list-deleted',
        deletedTaskCheckList.id
      )
      return deletedTaskCheckList
    }),

  getAll: rawProtectedProcedure()
    .input(
      z.object({
        taskId: z.string().cuid()
      })
    )
    .query(async ({ ctx: { prisma }, input: { taskId } }) => {
      return await prisma.taskCheckList.findMany({
        where: {
          taskId
        },
        include: {
          taskCheckListItems: {
            orderBy: {
              order: 'asc'
            }
          }
        }
      })
    })
})
