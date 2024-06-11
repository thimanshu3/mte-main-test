import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '~/server/db'
import { storageClient } from '~/utils/cloudStorage'

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse
) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - 30)
  const attachments = await prisma.attachment.findMany({
    where: {
      supplierId: null,
      inquiryId: null,
      taskId: null,
      whatsAppMessageId: null,
      inquiryImageId: null,
      createdAt: {
        lt: date
      }
    }
  })
  const toDelete: string[] = []
  await Promise.all(
    attachments.map(async a => {
      try {
        await storageClient.deleteFile(a.newFilename)
        toDelete.push(a.id)
      } catch (err) {}
    })
  )
  if (toDelete.length)
    await prisma.attachment.deleteMany({
      where: {
        id: {
          in: toDelete
        }
      }
    })
  return res.send('Done')
}
