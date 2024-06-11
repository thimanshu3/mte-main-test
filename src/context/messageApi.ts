import { message } from 'antd'
import { MessageInstance } from 'antd/es/message/interface'
import { createContext, useContext } from 'react'

const MessageApiContext = createContext(message as MessageInstance)

export const MessageApiProvider = MessageApiContext.Provider

export const useMessageApi = () => {
  const messageApi = useContext(MessageApiContext)
  return messageApi
}
