import Pusher from 'pusher-js'
import { env } from '~/env.mjs'

export const pusherClient = new Pusher(env.NEXT_PUBLIC_SOCKET_APP_KEY, {
  wsHost: env.NEXT_PUBLIC_SOCKET_HOST,
  wsPort: env.NEXT_PUBLIC_SOCKET_PORT
    ? parseInt(env.NEXT_PUBLIC_SOCKET_PORT)
    : undefined,
  forceTLS: env.NEXT_PUBLIC_SOCKET_USE_TLS,
  disableStats: true,
  enabledTransports: ['ws', 'wss'],
  cluster: env.NEXT_PUBLIC_SOCKET_CLUSTER,
  channelAuthorization: {
    endpoint: '/api/pusher/channel-auth',
    transport: 'ajax'
  }
})
