import { z } from 'zod'
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'
import { pusher } from '~/utils/pusher/server'

export const attachmentsRouter = createTRPCRouter({
  deleteOne: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const a = await prisma.attachment.findUnique({
        where: {
          id: input.id
        }
      })
      if (!a) return false
      await storageClient.deleteFile(a.newFilename)
      const deleted = await prisma.attachment.delete({
        where: {
          id: input.id
        },
        include: {
          task: {
            select: {
              taskListId: true
            }
          }
        }
      })
      if (deleted.taskId) {
        await Promise.all([
          prisma.taskActivity.create({
            data: {
              taskId: deleted.taskId,
              action: 'Task_Attachment_Deleted',
              createdById: session.user.id,
              description: `Attachment ${deleted.originalFilename} deleted`
            }
          }),
          pusher.trigger(
            `private-task-${deleted.taskId}`,
            'attachment-deleted',
            deleted.id
          )
        ])
      }
      return true
    })
})
