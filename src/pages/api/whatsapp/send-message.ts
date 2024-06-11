import { readFile } from 'fs/promises'
import { NextApiRequest, NextApiResponse } from 'next'
import { parseMultipartRequest } from '~/utils/parseMultipartRequest'
import { sendWhatsappMessage } from '~/utils/sendWhatsappMessage'

export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST')
    return res.status(405).send({ message: 'Method not allowed' })

  // const session = await getServerAuthSession({
  //   req,
  //   res
  // })

  // if (!session)
  //   return res.status(401).send({
  //     message: 'Unauthorized'
  //   })

  const { files, fields } = await parseMultipartRequest(req)

  const result = await sendWhatsappMessage({
    recipient: fields.recipient as any,
    type: fields.type as any,
    file: files.file
      ? await readFile((files.file as any)[0].filepath)
      : undefined,
    filename: files.file ? (files.file as any)[0].originalFilename : undefined,
    text: fields.text as any
  })

  res.send(result)
}
