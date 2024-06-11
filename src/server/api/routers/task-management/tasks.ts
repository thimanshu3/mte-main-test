import { z } from 'zod'
import { pusher } from '~/utils/pusher/server'
import { createTRPCRouter, rawProtectedProcedure } from '../../trpc'

const include = {
  assignedTo: {
    include: {
      user: {
        select: {
          id: true,
          name: true
        }
      }
    }
  }
}

export const tasksRouter = createTRPCRouter({
  getAllByTaskList: rawProtectedProcedure()
    .input(
      z.object({
        taskListId: z.string().cuid()
      })
    )
    .query(async ({ ctx: { prisma }, input: { taskListId } }) => {
      return await prisma.task.findMany({
        where: {
          taskListId,
          deletedAt: null
        },
        include,
        orderBy: {
          order: 'asc'
        }
      })
    }),
  createOne: rawProtectedProcedure()
    .input(
      z.object({
        taskListId: z.string().cuid(),
        title: z.string()
      })
    )
    .mutation(
      async ({ ctx: { prisma, session }, input: { taskListId, title } }) => {
        const createdTask = await prisma.task.create({
          data: {
            taskListId,
            title,
            createdById: session.user.id,
            updatedById: session.user.id,
            order:
              (await prisma.task.count({
                where: { taskListId, deletedAt: null }
              })) + 1
          },
          include
        })
        await pusher.trigger(
          `private-taskList-${taskListId}`,
          `task-created`,
          createdTask
        )
        return createdTask
      }
    ),
  updateOne: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().optional(),
        description: z.string().optional(),
        completed: z.boolean().optional(),
        userIds: z.array(z.string()).optional(),
        startDate: z.date().optional().nullable(),
        endDate: z.date().optional().nullable(),
        attachmentIds: z.array(z.string()).optional()
      })
    )
    .mutation(
      async ({
        ctx: { prisma, session },
        input: {
          id,
          title,
          description,
          completed,
          userIds,
          startDate,
          endDate
        }
      }) => {
        const promises = []

        if (userIds?.length) {
          const existingUserIds = await prisma.taskAssignedUser.findMany({
            where: {
              taskId: id
            }
          })
          const toDelete = existingUserIds.filter(
            ({ userId }) => !userIds.includes(userId)
          )
          const toCreate = userIds.filter(
            userId =>
              !existingUserIds.map(({ userId }) => userId).includes(userId)
          )
          if (toDelete.length) {
            promises.push(
              prisma.taskAssignedUser.deleteMany({
                where: {
                  taskId: id,
                  userId: {
                    in: toDelete.map(({ userId }) => userId)
                  }
                }
              })
            )
            promises.push(
              prisma.taskActivity.createMany({
                data: toDelete.map(({ userId }) => ({
                  taskId: id,
                  action: 'Task_Unassigned',
                  createdById: session.user.id,
                  additionalUserId: userId
                }))
              })
            )
          }
          if (toCreate.length) {
            promises.push(
              prisma.taskAssignedUser.createMany({
                data: toCreate.map(userId => ({
                  taskId: id,
                  userId,
                  createdById: session.user.id
                }))
              })
            )
            promises.push(
              prisma.taskActivity.createMany({
                data: toCreate.map(userId => ({
                  taskId: id,
                  action: 'Task_Assigned',
                  createdById: session.user.id,
                  additionalUserId: userId
                }))
              })
            )
          }
        }
        await prisma.task.update({
          where: {
            id
          },
          data: {
            title,
            description,
            completed,
            updatedById: session.user.id,
            startDate,
            endDate
          }
        })
        if (title || description || startDate || endDate) {
          promises.push(
            prisma.taskActivity.create({
              data: {
                taskId: id,
                action: 'Task_Updated',
                createdById: session.user.id,
                description: `${title ? 'Title' : ''}${
                  title && description ? ', ' : ''
                }${description ? 'Description' : ''}${
                  description && startDate ? ', ' : ''
                }
              ${startDate ? 'Start Date' : ''}${
                startDate && endDate ? ', ' : ''
              }${endDate ? 'End Date' : ''}${endDate?.toLocaleString()}`
              }
            })
          )
        }
        if (completed !== undefined) {
          promises.push(
            prisma.taskActivity.create({
              data: {
                taskId: id,
                action: 'Task_Completed',
                createdById: session.user.id,
                description: `${completed ? 'Completed' : 'Uncompleted'}`
              }
            })
          )
        }

        await Promise.all(promises)
        const updated = await prisma.task.findUniqueOrThrow({
          where: {
            id
          },
          include
        })
        await pusher.trigger(
          `private-taskList-${updated.taskListId}`,
          `task-updated`,
          updated
        )
      }
    ),
  updateOrder: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        order: z.number(),
        taskListId: z.string().optional()
      })
    )
    .mutation(
      async ({
        ctx: { prisma, session },
        input: { id, order, taskListId }
      }) => {
        const task = await prisma.task.findUniqueOrThrow({
          where: {
            id
          }
        })

        if (!taskListId) {
          if (task.order === order) {
            return
          }
          await Promise.all([
            prisma.task.updateMany({
              where: {
                taskListId: task.taskListId,
                order:
                  order > task.order
                    ? {
                        gte: task.order,
                        lte: order
                      }
                    : {
                        gte: order,
                        lte: task.order
                      },
                id: {
                  not: id
                }
              },
              data: {
                order: {
                  [order > task.order ? 'decrement' : 'increment']: 1
                }
              }
            }),
            prisma.task.update({
              where: {
                id
              },
              data: {
                order,
                updatedById: session.user.id
              }
            })
          ])

          const tasks = await prisma.task.findMany({
            where: {
              taskListId: task.taskListId,
              deletedAt: null
            },
            include,
            orderBy: {
              order: 'asc'
            }
          })

          await pusher.trigger(
            `taskList-${task.taskListId}`,
            `task-reorder`,
            tasks
          )

          return [{ taskListId, tasks }]
        } else {
          await Promise.all([
            prisma.task.updateMany({
              where: {
                taskListId: task.taskListId,
                order: {
                  gt: task.order
                }
              },
              data: {
                order: {
                  decrement: 1
                }
              }
            }),
            prisma.task.updateMany({
              where: {
                taskListId,
                order: {
                  gte: order
                }
              },
              data: {
                order: {
                  increment: 1
                }
              }
            }),
            prisma.taskActivity.create({
              data: {
                taskId: id,
                action: 'Task_Moved',
                taskListId: task.taskListId,
                movedToTaskListId: taskListId,
                createdById: session.user.id
              }
            })
          ])

          await prisma.task.update({
            where: {
              id
            },
            data: {
              order,
              taskListId,
              updatedById: session.user.id
            }
          })

          const [t1, t2] = await Promise.all([
            prisma.task.findMany({
              where: {
                taskListId: task.taskListId,
                deletedAt: null
              },
              include,
              orderBy: {
                order: 'asc'
              }
            }),
            prisma.task.findMany({
              where: {
                taskListId,
                deletedAt: null
              },
              include,
              orderBy: {
                order: 'asc'
              }
            })
          ])

          await Promise.all([
            pusher.trigger(
              `private-taskList-${task.taskListId}`,
              'task-reorder',
              t1
            ),
            pusher.trigger(`private-taskList-${taskListId}`, 'task-reorder', t2)
          ])

          return [
            {
              taskListId: task.taskListId,
              tasks: t1
            },
            {
              taskListId,
              tasks: t2
            }
          ]
        }
      }
    ),
  deleteOne: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input: { id } }) => {
      const task = await prisma.task.findUniqueOrThrow({
        where: {
          id
        }
      })

      await Promise.all([
        prisma.task.updateMany({
          where: {
            taskListId: task.taskListId,
            order: {
              gt: task.order
            }
          },
          data: {
            order: {
              decrement: 1
            }
          }
        }),
        prisma.task.update({
          where: {
            id
          },
          data: {
            order: -1,
            deletedAt: new Date(),
            updatedById: session.user.id
          }
        }),
        prisma.taskActivity.create({
          data: {
            taskId: id,
            action: 'Task_Deleted',
            createdById: session.user.id
          }
        })
      ])

      const tasks = await prisma.task.findMany({
        where: {
          taskListId: task.taskListId,
          deletedAt: null
        },
        include,
        orderBy: {
          order: 'asc'
        }
      })

      await pusher.trigger(
        `private-taskList-${task.taskListId}`,
        'task-reorder',
        tasks
      )

      return [{ taskListId: task.taskListId, tasks }]
    }),
  reSyncTask: rawProtectedProcedure()
    .input(z.string().cuid())
    .mutation(async ({ ctx: { prisma }, input: id }) => {
      const task = await prisma.task.findUniqueOrThrow({
        where: {
          id
        },
        include
      })

      await pusher.trigger(
        `private-taskList-${task.taskListId}`,
        'task-updated',
        task
      )
      return true
    }),
  getAttachments: rawProtectedProcedure()
    .input(z.string().cuid())
    .query(async ({ ctx: { prisma }, input: id }) => {
      return await prisma.attachment.findMany({
        where: {
          taskId: id
        }
      })
    }),
  attachFiles: rawProtectedProcedure()
    .input(
      z.object({
        id: z.string().cuid(),
        attachmentIds: z.array(z.string())
      })
    )
    .mutation(
      async ({ ctx: { prisma, session }, input: { attachmentIds, id } }) => {
        const updated = await prisma.attachment.updateMany({
          where: {
            id: {
              in: attachmentIds
            },
            taskId: null
          },
          data: {
            taskId: id
          }
        })
        if (updated.count) {
          await Promise.all([
            prisma.taskActivity.create({
              data: {
                taskId: id,
                action: 'Task_Attachment_Added',
                description: `${updated.count} attachment${
                  updated.count > 1 ? 's' : ''
                } added`,
                createdById: session.user.id
              }
            }),
            pusher.trigger(
              `private-task-${id}`,
              `attachments-created`,
              await prisma.attachment.findMany({
                where: {
                  taskId: id,
                  id: {
                    in: attachmentIds
                  }
                }
              })
            )
          ])
        }
      }
    ),

  getActivities: rawProtectedProcedure()
    .input(z.object({ id: z.string().cuid(), page: z.number().default(1) }))
    .query(async ({ ctx: { prisma }, input: { id, page } }) => {
      const [count, activities] = await Promise.all([
        prisma.taskActivity.count({
          where: {
            taskId: id
          },
          take: 10,
          skip: (page - 1) * 10
        }),
        prisma.taskActivity.findMany({
          where: {
            taskId: id
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true
              }
            },
            additionalUser: {
              select: {
                id: true,
                name: true
              }
            }
          },
          take: 10,
          skip: (page - 1) * 10
        })
      ])
      return {
        count,
        activities
      }
    }),
  getByUser: rawProtectedProcedure().query(
    async ({ ctx: { prisma, session } }) => {
      return await prisma.task.findMany({
        where: {
          assignedTo: {
            some: {
              userId: session.user.id
            }
          },
          deletedAt: null,
          completed: false,
          taskList: {
            deletedAt: null
          }
        },
        include: {
          ...include,
          taskList: {
            select: {
              teamId: true
            }
          }
        },
        orderBy: {
          endDate: 'asc'
        }
      })
    }
  )
})
