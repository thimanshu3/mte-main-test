import axios from 'axios'
import { NextApiRequest, NextApiResponse } from 'next'
import { env } from '~/env.mjs'
import { prisma } from '~/server/db'
import { storageClient } from '~/utils/cloudStorage'
import { pusher } from '~/utils/pusher/server'
import { baseWhatsAppUrl } from '~/utils/whatsapp'

async function getMediaDataUrl(mediaId: string) {
  const response = await axios.get(`${baseWhatsAppUrl}/${mediaId}`, {
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_API_ACCESS_TOKEN}`
    }
  })
  const { url } = response.data
  const { data, headers } = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_API_ACCESS_TOKEN}`
    }
  })
  const extension = headers['content-type'].split('/').pop()
  const filename = mediaId + '.' + extension

  const uploadedUrl = await storageClient.addFile({
    data,
    filename
  })

  return { url: uploadedUrl, filename }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (
      mode &&
      token &&
      mode === 'subscribe' &&
      token === env.WHATSAPP_WEBHOOK_SECRET
    ) {
      return res.status(200).send(challenge)
    }

    return res.status(403).send('Forbidden')
  } else if (req.method === 'POST') {
    const body = req.body

    for (const entry of body.entry) {
      for (const change of entry.changes) {
        const value = change.value

        if (value.statuses) {
          for (const status of value.statuses) {
            const timestamp = new Date(parseInt(status.timestamp) * 1000)
            await prisma.$transaction(async tx => {
              const wm = await tx.whatsAppMessage.findUniqueOrThrow({
                where: {
                  messageId: status.id
                }
              })
              switch (status.status) {
                case 'sent': {
                  await tx.whatsAppMessage.update({
                    where: {
                      id: wm.id
                    },
                    data: {
                      status: !wm.status ? 'sent' : undefined,
                      sentAt: timestamp
                    }
                  })
                  pusher.trigger('private-whatsapp', 'update-message-status', {
                    messageId: wm.id,
                    status: 'sent'
                  })
                  break
                }
                case 'delivered': {
                  await tx.whatsAppMessage.update({
                    where: {
                      id: wm.id
                    },
                    data: {
                      status: wm.status === 'sent' ? 'delivered' : undefined,
                      deliveredAt: timestamp
                    }
                  })
                  pusher.trigger('private-whatsapp', 'update-message-status', {
                    messageId: wm.id,
                    status: 'delivered'
                  })
                  break
                }
                case 'read': {
                  await tx.whatsAppMessage.update({
                    where: {
                      id: wm.id
                    },
                    data: {
                      status:
                        wm.status === 'sent' || wm.status === 'delivered'
                          ? 'read'
                          : undefined,
                      readAt: timestamp
                    }
                  })
                  pusher.trigger('private-whatsapp', 'update-message-status', {
                    messageId: wm.id,
                    status: 'read'
                  })
                  break
                }
              }
            })
          }
        } else if (value.messages) {
          for (const message of value.messages) {
            const obj: any = {
              messageId: message.id,
              contactPhoneNumber: value.contacts?.[0]?.wa_id,
              direction: 'incoming',
              createdAt: new Date(parseInt(message.timestamp) * 1000)
            }

            const mediaObj: any = {}

            if (message.location) {
              obj.type = 'location'
              obj.latitude = message.location.latitude
              obj.longitude = message.location.longitude
              obj.address = message.location.address
              obj.locationName = message.location.name
            } else if (message.type) {
              switch (message.type) {
                case 'text': {
                  obj.type = 'text'
                  obj.text = message.text.body
                  break
                }
                case 'image': {
                  obj.type = 'image'
                  mediaObj.mediaId = message.image.id
                  const { url, filename } = await getMediaDataUrl(
                    message.image.id
                  )
                  mediaObj.mediaUrl = url
                  mediaObj.mediaFilename = filename
                  break
                }
                case 'audio': {
                  obj.type = 'audio'
                  mediaObj.mediaId = message.audio.id
                  const { url, filename } = await getMediaDataUrl(
                    message.audio.id
                  )
                  mediaObj.mediaUrl = url
                  mediaObj.mediaFilename = filename
                  break
                }
                case 'video': {
                  obj.type = 'video'
                  mediaObj.mediaId = message.video.id
                  const { url, filename } = await getMediaDataUrl(
                    message.video.id
                  )
                  mediaObj.mediaUrl = url
                  mediaObj.mediaFilename = filename
                  break
                }
                case 'document': {
                  obj.type = 'document'
                  mediaObj.mediaId = message.document.id
                  const { url, filename } = await getMediaDataUrl(
                    message.document.id
                  )
                  mediaObj.mediaUrl = url
                  mediaObj.mediaFilename = filename
                  break
                }
                case 'reaction': {
                  obj.type = 'reaction'
                  obj.reaction = message.reaction.emoji
                  obj.reactionMessageId = message.reaction.message_id
                  break
                }
              }
            }

            obj.mediaId = mediaObj.mediaId
            obj.mediaUrl = mediaObj.mediaUrl
            obj.mediaFilename = mediaObj.mediaFilename

            if (obj.type === 'reaction') {
              await prisma.whatsAppMessage.update({
                where: {
                  messageId: obj.reactionMessageId
                },
                data: {
                  reaction: obj.reaction
                }
              })
              pusher.trigger('private-whatsapp', 'message-reaction', {
                messageId: obj.reactionMessageId,
                reaction: obj.reaction
              })
            } else {
              await pusher.trigger(
                'private-whatsapp',
                'new-message',
                await prisma.whatsAppMessage.create({
                  data: {
                    ...obj,
                    seen: false,
                    whatsAppMessageAttachment: mediaObj.mediaId
                      ? {
                          create: {
                            newFilename: mediaObj.mediaFilename,
                            url: mediaObj.mediaUrl,
                            originalFilename: mediaObj.mediaFilename
                          }
                        }
                      : undefined
                  }
                })
              )
            }
          }
        }
      }
    }
    return res.send({ message: 'Done' })
  }
  return res.status(405).json({ message: 'Method not allowed' })
}
