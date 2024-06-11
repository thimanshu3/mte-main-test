import axios from 'axios'
import FormData from 'form-data'
import { extname } from 'path'
import { env } from '~/env.mjs'
import { prisma } from '~/server/db'
import { storageClient } from './cloudStorage'
import { pusher } from './pusher/server'
import { baseWhatsAppUrl } from './whatsapp'

export type SendWhatsappMessageParams =
  | {
      type: 'image' | 'document' | 'audio' | 'video'
      recipient: string
      file: Buffer
      filename: string
    }
  | {
      type: 'text'
      recipient: string
      text: string
    }
  | {
      type: 'template'
      recipient: string
      templateName: string
      parameters?: { type: string; text: string }[]
    }

export const sendWhatsappMessage = async (body: SendWhatsappMessageParams) => {
  const { type, recipient } = body

  let mediaId: string | undefined
  let mediaFilename: string | undefined
  let uploadedFilename: string | undefined
  let uploadedUrl: string | undefined

  if (body.type !== 'text' && body.type !== 'template') {
    const { file, filename } = body
    const formData = new FormData()
    const buff = file
    mediaFilename = filename
    formData.append('messaging_product', 'whatsapp')
    formData.append('file', buff, mediaFilename)
    const { data } = await axios.request({
      method: 'POST',
      url: `${baseWhatsAppUrl}/${env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID}/media`,
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_API_ACCESS_TOKEN}`,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity,
      data: formData
    })
    mediaId = data.id

    uploadedFilename = mediaId + extname(mediaFilename!)
    const uploaded = await storageClient.addFile({
      filename: uploadedFilename,
      data: buff
    })
    uploadedUrl = uploaded
  }

  let payload: any

  switch (type) {
    case 'text':
      payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: {
          body: body.text
        }
      }
      break

    case 'image':
      payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'image',
        image: {
          id: mediaId
        }
      }
      break

    case 'document':
      payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'document',
        document: {
          id: mediaId
        }
      }
      break

    case 'audio':
      payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'audio',
        audio: {
          id: mediaId
        }
      }
      break

    case 'video':
      payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'video',
        video: {
          id: mediaId
        }
      }
      break

    case 'template':
      payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: body.templateName,
          language: {
            code: 'en'
          },
          components: body.parameters
            ? [{ type: 'body', parameters: body.parameters }]
            : undefined
        }
      }
      break

    default:
      throw new Error('Invalid message type')
  }

  const whatsappRes = await axios.post(
    `${baseWhatsAppUrl}/${env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID}/messages`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_API_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  )

  const messageObj: any = {
    messageId: whatsappRes.data.messages[0].id,
    contactPhoneNumber: recipient,
    direction: 'outgoing'
  }

  if (type === 'text') {
    messageObj.type = 'text'
    messageObj.text = body.text
  } else if (type === 'image') {
    messageObj.type = 'image'
    messageObj.mediaId = mediaId
    messageObj.mediaUrl = uploadedUrl
    messageObj.mediaFilename = mediaFilename
  } else if (type === 'document') {
    messageObj.type = 'document'
    messageObj.mediaId = mediaId
    messageObj.mediaUrl = uploadedUrl
    messageObj.mediaFilename = mediaFilename
  } else if (type === 'audio') {
    messageObj.type = 'audio'
    messageObj.mediaId = mediaId
    messageObj.mediaUrl = uploadedUrl
    messageObj.mediaFilename = mediaFilename
  } else if (type === 'video') {
    messageObj.type = 'video'
    messageObj.mediaId = mediaId
    messageObj.mediaUrl = uploadedUrl
    messageObj.mediaFilename = mediaFilename
  } else if (type === 'template') {
    messageObj.type = 'template'
    messageObj.templateName = body.templateName
  }

  const created = await prisma.whatsAppMessage.create({
    data: {
      ...messageObj,
      whatsAppMessageAttachment: messageObj.mediaId
        ? {
            create: {
              originalFilename: mediaFilename,
              newFilename: uploadedFilename,
              url: uploadedUrl
            }
          }
        : undefined
    }
  })

  await pusher.trigger('private-whatsapp', 'new-message', created)
  return created
}
