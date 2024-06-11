import { NextApiRequest, NextApiResponse } from 'next'
import { pusher } from '~/utils/pusher/server'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST')
    return res.status(405).send({
      message: 'Method not allowed'
    })

  const socketId = req.body.socket_id
  const channel = req.body.channel_name
  if (!socketId || !channel) return res.status(400).send('Invalid request')

  const authResponse = pusher.authorizeChannel(socketId, channel)
  return res.send(authResponse)
}
