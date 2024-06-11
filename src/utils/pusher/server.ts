import Pusher from 'pusher'
import { env } from '~/env.mjs'

export const pusher = new Pusher({
  appId: env.SOCKET_APP_ID,
  secret: env.SOCKET_APP_SECRET,
  key: env.NEXT_PUBLIC_SOCKET_APP_KEY,
  host: env.NEXT_PUBLIC_SOCKET_HOST,
  port: env.NEXT_PUBLIC_SOCKET_PORT || undefined,
  useTLS: env.NEXT_PUBLIC_SOCKET_USE_TLS,
  cluster: env.NEXT_PUBLIC_SOCKET_CLUSTER
})
