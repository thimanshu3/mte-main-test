import { notification } from 'antd'
import { NotificationInstance } from 'antd/es/notification/interface'
import { createContext, useContext } from 'react'

const NotificationApiContext = createContext(
  notification as NotificationInstance
)

export const NotificationApiProvider = NotificationApiContext.Provider

export const useNotificationApi = () => {
  const notifcationApi = useContext(NotificationApiContext)
  return notifcationApi
}
