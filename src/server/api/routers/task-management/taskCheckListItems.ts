import { z } from 'zod'
import { pusher } from '~/utils/pusher/server'
import { createTRPCRouter, rawProtectedProcedure } from '../../trpc'

export const taskCheckListItemsRouter = createTRPCRouter({
  createOne: rawProtectedProcedure()
    .input(
      z.object({
        taskCheckListId: z.string().cuid(),
        title: z.string(),
        taskId: z.string()
      })
    )
    .mutation(
      async ({
        ctx: { prisma, session },
        input: { taskCheckListId, title, taskId }
      }) => {
        const createdTaskCheckListItem = await prisma.taskCheckListItem.create({
          data: {
            taskCheckListId,
            title,
            createdById: session.user.id,
            updatedById: session.user.id,
            order:
              (await prisma.taskCheckListItem.count({
                where: {
                  taskCheckListId
                }
              })) + 1
          }
        })
        await pusher.trigger(
          `private-task-${taskId}`,
          'task-check-list-item-created',
          createdTaskCheckListItem
        )
        return createdTaskCheckListItem
      }
    ),

  updateOne: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().optional(),
        completed: z.boolean().optional(),
        taskId: z.string()
      })
    )
    .mutation(
      async ({
        ctx: { prisma, session },
        input: { id, title, completed, taskId }
      }) => {
        const updatedTaskCheckListItem = await prisma.taskCheckListItem.update({
          where: {
            id
          },
          data: {
            title,
            isComplete: completed,
            updatedById: session.user.id
          }
        })
        await pusher.trigger(
          `private-task-${taskId}`,
          'task-check-list-item-updated',
          updatedTaskCheckListItem
        )
        return updatedTaskCheckListItem
      }
    ),

  updateOrder: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        order: z.number(),
        taskId: z.string(),
        taskCheckListId: z.string().optional()
      })
    )
    .mutation(
      async ({
        ctx: { prisma, session },
        input: { id, order, taskId, taskCheckListId }
      }) => {
        const taskCheckListItem =
          await prisma.taskCheckListItem.findUniqueOrThrow({
            where: {
              id
            }
          })
        if (!taskCheckListId) {
          if (taskCheckListItem.order === order) {
            return
          }
          await Promise.all([
            prisma.taskCheckListItem.updateMany({
              where: {
                taskCheckListId: taskCheckListItem.taskCheckListId,
                order:
                  order > taskCheckListItem.order
                    ? {
                        gte: taskCheckListItem.order,
                        lte: order
                      }
                    : {
                        gte: order,
                        lte: taskCheckListItem.order
                      },
                id: {
                  not: id
                }
              },
              data: {
                order: {
                  [order > taskCheckListItem.order
                    ? 'decrement'
                    : 'increment']: 1
                }
              }
            }),
            prisma.taskCheckListItem.update({
              where: {
                id
              },
              data: {
                order,
                updatedById: session.user.id
              }
            })
          ])

          const taskCheckListItems = await prisma.taskCheckListItem.findMany({
            where: {
              taskCheckListId: taskCheckListItem.taskCheckListId
            },
            orderBy: {
              order: 'asc'
            }
          })

          await pusher.trigger(
            `private-task-${taskId}`,
            `task-check-list-items-reorder`,
            {
              taskCheckListId: taskCheckListItem.taskCheckListId,
              taskCheckListItems
            }
          )

          return taskCheckListItems
        } else {
          await Promise.all([
            prisma.taskCheckListItem.updateMany({
              where: {
                taskCheckListId: taskCheckListItem.taskCheckListId,
                order: {
                  gt: taskCheckListItem.order
                }
              },
              data: {
                order: {
                  decrement: 1
                }
              }
            }),
            prisma.taskCheckListItem.updateMany({
              where: {
                taskCheckListId,
                order: {
                  gte: order
                }
              },
              data: {
                order: {
                  increment: 1
                }
              }
            })
          ])

          await prisma.taskCheckListItem.update({
            where: {
              id
            },
            data: {
              order,
              taskCheckListId,
              updatedById: session.user.id
            }
          })

          const [t1, t2] = await Promise.all([
            prisma.taskCheckListItem.findMany({
              where: {
                taskCheckListId: taskCheckListItem.taskCheckListId
              },
              orderBy: {
                order: 'asc'
              }
            }),
            prisma.taskCheckListItem.findMany({
              where: {
                taskCheckListId
              },
              orderBy: {
                order: 'asc'
              }
            })
          ])

          await Promise.all([
            pusher.trigger(
              `private-task-${taskId}`,
              'task-check-list-items-reorder',
              {
                taskCheckListId: taskCheckListItem.taskCheckListId,
                taskCheckListItems: t1
              }
            ),
            pusher.trigger(
              `private-task-${taskId}`,
              'task-check-list-items-reorder',
              {
                taskCheckListId,
                taskCheckListItems: t2
              }
            )
          ])

          return [...t1, ...t2]
        }
      }
    ),

  deleteOne: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        taskId: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma }, input: { id, taskId } }) => {
      const taskCheckListItem =
        await prisma.taskCheckListItem.findUniqueOrThrow({
          where: {
            id
          }
        })

      await Promise.all([
        prisma.taskCheckListItem.updateMany({
          where: {
            taskCheckListId: taskCheckListItem.taskCheckListId,
            order: {
              gt: taskCheckListItem.order
            }
          },
          data: {
            order: {
              decrement: 1
            }
          }
        }),
        prisma.taskCheckListItem.delete({
          where: {
            id
          }
        })
      ])
      await pusher.trigger(
        `private-task-${taskId}`,
        'task-check-list-items-reorder',
        {
          taskCheckListId: taskCheckListItem.taskCheckListId,
          taskCheckListItems: await prisma.taskCheckListItem.findMany({
            where: {
              taskCheckListId: taskCheckListItem.taskCheckListId
            },
            orderBy: {
              order: 'asc'
            }
          })
        }
      )
      return taskCheckListItem
    })
})
