import { GCPStorageClient } from '@ejekanshjain/cloud-storage'
import { env } from '~/env.mjs'

export const storageClient = GCPStorageClient({
  projectId: env.FIREBASE_PROJECT_ID,
  privateKey: env.FIREBASE_PRIVATE_KEY,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  bucket: env.FIREBASE_STORAGE_BUCKET,
  defaultMediaPublic: true
})
