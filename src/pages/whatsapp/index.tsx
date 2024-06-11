import { PlusOutlined } from '@ant-design/icons'
import { WhatsAppMessage } from '@prisma/client'
import { Avatar, Button, Image, Input, List, Modal, Spin, Upload } from 'antd'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BsCardImage, BsFillCursorFill } from 'react-icons/bs'
import { FaFilePdf } from 'react-icons/fa'
import { HiDocumentText, HiUserGroup } from 'react-icons/hi'
import { IoMdCheckmark } from 'react-icons/io'
import { MdDownloadForOffline, MdNavigateBefore } from 'react-icons/md'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'
import { pusherClient } from '~/utils/pusher/client'

export const getServerSideProps: GetServerSideProps = async (ctx: any) => {
  const session = await getServerAuthSession(ctx)
  return {
    redirect: !session
      ? {
          destination: '/auth'
        }
      : !['ADMIN', 'ADMINVIEWER'].includes(session.user.role)
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const getTimeString = (date: Date) => {
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const amPm = hours >= 12 ? 'PM' : 'AM'
  const formattedHours = (hours % 12 || 12).toString().padStart(2, '0')

  return `${formattedHours}:${minutes} ${amPm}`
}

const formatDate = (dateString: string) => {
  const createdAtDate = new Date(dateString)
  const currentDate = new Date()

  if (isSameDay(createdAtDate, currentDate)) {
    return getTimeString(createdAtDate)
  } else if (isYesterday(createdAtDate, currentDate)) {
    return 'Yesterday'
  } else {
    const yearLastTwoDigits = createdAtDate.getFullYear().toString().slice(-2)
    const month = (createdAtDate.getMonth() + 1).toString().padStart(2, '0')
    const day = createdAtDate.getDate().toString().padStart(2, '0')

    return `${month}/${day}/${yearLastTwoDigits}`
  }
}

const isSameDay = (date1: Date, date2: Date) => {
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

const isYesterday = (date1: Date, date2: Date) => {
  const yesterday = new Date(date2)
  yesterday.setDate(date2.getDate() - 1)
  return isSameDay(date1, yesterday)
}

const WhatsappPage: NextPage = () => {
  const messageContainerRef = useRef<HTMLDivElement>(null)

  const [isInitialRendering, setIsInitialRendering] = useState(true)

  const [open, setOpen] = useState(false)

  const [userChat, setUserChat] = useState('')
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])

  const { data: session } = useSession()

  const [messageText, setMessageText] = useState('')

  const [currentPage, setCurrentPage] = useState<number>(1)

  const [isLoading, setIsLoading] = useState(false)

  const {
    data: contactsData,
    isLoading: isLoadingContacts,
    refetch
  } = api.whatsapp.getContacts.useQuery()
  const [preview, setPreview] = useState(false)
  const [fileType, setFileType] = useState('')

  const [previewContent, setPreviewContent] = useState('')

  const [file, setFile] = useState<any[]>([])

  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true)
  const {
    mutateAsync: getWhatsAppMessages,

    isLoading: messagedataLoading
  } = api.whatsapp.getMessages.useMutation()

  const { mutateAsync: updateMessageStatus } =
    api.whatsapp.updateOne.useMutation()

  const updateSeenStatus = useCallback(
    async (contactPhoneNumber: any, messageId: any) => {
      try {
        // Call the API
        await updateMessageStatus({
          contactPhoneNumber: contactPhoneNumber,
          seen: true, // Set "seen" to true since the chat is being opened
          messageId: messageId
        })
        refetch()
        // If needed, you can handle the response here (e.g., show a success message)
      } catch (error) {
        console.error('Error updating seen status:', error)
        // If needed, you can handle errors here (e.g., show an error message)
      }
    },

    [updateMessageStatus, refetch]
  )
  const sendMessage = async (
    value: any,
    contactPhoneNumber: any,
    type: any
  ) => {
    try {
      let messageObject = {}

      if (type === 'text') {
        messageObject = {
          recipient: contactPhoneNumber,
          type: 'text',
          text: value
        }
      } else {
        const formData = new FormData()
        formData.append('recipient', contactPhoneNumber)
        formData.append('type', type)
        formData.append('file', value)

        const res = await fetch('/api/whatsapp/send-message', {
          method: 'POST',
          body: formData
        })

        if (!res.ok) {
          console.error(
            'Error sending WhatsApp message. Response status:',
            res.status
          )
        }

        return
      }

      const res = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json' // Set the Content-Type header to indicate JSON data
        },
        body: JSON.stringify(messageObject) // Convert the object to JSON string
      })

      setMessageText('')

      if (!res.ok) {
        console.error(
          'Error sending WhatsApp message. Response status:',
          res.status
        )
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
    }
  }

  const fetchMessages = useCallback(
    async (contactPhoneNumber: any) => {
      try {
        // setCurrentPage(1)
        // setShouldScrollToBottom(true)
        // setIsInitialRendering(true)
        setUserChat(contactPhoneNumber)
        setIsLoading(true)

        const messagesData = await getWhatsAppMessages({
          contactPhoneNumber: contactPhoneNumber,
          skip: 0
        })

        if (messagesData) {
          setMessages(messagesData)
        }

        if (Array.isArray(messagesData)) {
          const unseenMessages = messagesData.filter(
            messageData => !messageData.seen
          )

          // Update the seen status of the unseen messages if there are any
          if (unseenMessages.length > 0) {
            unseenMessages.forEach(({ contactPhoneNumber, messageId }) => {
              updateSeenStatus(contactPhoneNumber, messageId)
            })
          }
          const formattedMessages = messagesData.map(messageData => ({
            id: messageData.id,
            messageId: messageData.messageId,
            contactPhoneNumber: messageData.contactPhoneNumber,
            direction: messageData.direction,
            type: messageData.type,
            status: messageData.status,
            sentAt: messageData.sentAt,
            deliveredAt: messageData.deliveredAt,
            readAt: messageData.readAt,
            latitude: messageData.latitude,
            longitude: messageData.longitude,
            address: messageData.address,
            locationName: messageData.locationName,
            text: messageData.text,
            templateName: messageData.templateName,
            mediaId: messageData.mediaId,
            mediaUrl: messageData.mediaUrl,
            mediaFilename: messageData.mediaFilename,
            reaction: messageData.reaction,
            seen: messageData.seen,
            createdAt: messageData.createdAt,
            updatedAt: messageData.updatedAt
          }))

          // Reverse the messages array to get older messages at the top and newer at the bottom
          const reversedMessages = formattedMessages.reverse()
          setMessages(reversedMessages)

          // Scroll to the bottom only on the initial rendering of the chat section
          if (isInitialRendering) {
            setShouldScrollToBottom(true)
            setIsInitialRendering(false)
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error)

        setIsLoading(false)
      }
    },
    [getWhatsAppMessages, updateSeenStatus, isInitialRendering]
  )

  // const resetChat = useCallback(async () => {
  //   setIsLoading(true)
  //   setIsInitialRendering(true)
  //   setMessages([])

  //   setCurrentPage(1)
  //   setShouldScrollToBottom(true)
  // }, [
  //   setIsLoading,
  //   setIsInitialRendering,
  //   setMessages,

  //   setCurrentPage,
  //   setShouldScrollToBottom
  // ])

  // useEffect(() => {
  //   if (userChat) {
  //     resetChat()
  //   }
  // }, [userChat, resetChat])
  const loadMoreMessages = useCallback(async () => {
    if (messagedataLoading) {
      return
    }

    try {
      const messagesPerPage = 20
      const newSkip = currentPage * messagesPerPage
      const newMessagesData = await getWhatsAppMessages({
        contactPhoneNumber: userChat,
        skip: newSkip
      })

      if (newMessagesData && Array.isArray(newMessagesData)) {
        const filteredMessages = newMessagesData.filter(
          messageData => messageData && messageData.messageId && messageData.id
        )

        const mappedMessages = filteredMessages.map(messageData => ({
          // ... (format the message data as before)
          id: messageData.id,
          messageId: messageData.messageId,
          contactPhoneNumber: messageData.contactPhoneNumber,
          direction: messageData.direction,
          type: messageData.type,
          status: messageData.status,
          sentAt: messageData.sentAt,
          deliveredAt: messageData.deliveredAt,
          readAt: messageData.readAt,
          latitude: messageData.latitude,
          longitude: messageData.longitude,
          address: messageData.address,
          locationName: messageData.locationName,
          text: messageData.text,
          templateName: messageData.templateName,
          mediaId: messageData.mediaId,
          mediaUrl: messageData.mediaUrl,
          mediaFilename: messageData.mediaFilename,
          reaction: messageData.reaction,
          seen: messageData.seen,
          createdAt: messageData.createdAt,
          updatedAt: messageData.updatedAt
        }))

        const reversedMessages = mappedMessages.reverse()

        setMessages(prevMessages => [...reversedMessages, ...prevMessages])

        // setTotalMessages(
        //   prevTotalMessages => prevTotalMessages + mappedMessages.length
        // )

        if (newMessagesData.length === 0) {
          setIsLoading(false)
        }
      }
    } catch (error) {
      console.error('Error fetching more messages:', error)

      setIsLoading(false)
    }

    setCurrentPage(prevPage => prevPage + 1)
  }, [currentPage, getWhatsAppMessages, userChat, messagedataLoading])

  const handleScroll = useCallback(async () => {
    const chatList = document.getElementById('chatList')
    if (chatList) {
      const scrollThreshold = 700

      if (isLoading === true && chatList.scrollTop <= scrollThreshold) {
        await loadMoreMessages()

        chatList.scrollTop += scrollThreshold
      }
    }
  }, [isLoading, loadMoreMessages])

  useEffect(() => {
    const container = messageContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)

      return () => {
        container.removeEventListener('scroll', handleScroll)
      }
    }

    return () => {}
  }, [handleScroll]) // Add handleScroll to the dependency array

  useEffect(() => {
    const container = messageContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)

      return () => {
        container.removeEventListener('scroll', handleScroll)
      }
    }

    return () => {}
  }, [handleScroll]) // Add handleScroll to the dependency array

  const scrollToBottom = () => {
    const container = messageContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }

  useEffect(() => {
    if (!userChat) return

    const timeout = setTimeout(() => {
      scrollToBottom()
    }, 100)
    setShouldScrollToBottom(true)

    return () => clearTimeout(timeout)
  }, [userChat])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (shouldScrollToBottom && messageContainerRef.current) {
        scrollToBottom()
        setShouldScrollToBottom(false)
      }
    }, 100)

    return () => clearTimeout(timeout)
  }, [messages, shouldScrollToBottom])

  const removeScrollListener = () => {
    const chatList = document.getElementById('chatList')
    if (chatList) {
      chatList.removeEventListener('scroll', debouncedHandleScroll)
    }
  }

  const debouncedHandleScroll = debounce(handleScroll, 500)

  useEffect(() => {
    const chatList = document.getElementById('chatList')
    if (chatList) {
      chatList.addEventListener('scroll', debouncedHandleScroll)
    }

    return () => {
      removeScrollListener()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  const onPreview = async (file: any) => {
    setPreview(true)

    setFile(file.file.originFileObj)

    // Determine file type (image or document)
    const isImage = file.file.type.startsWith('image/')

    setFileType(isImage ? 'image' : 'document')

    if (isImage) {
      // If the file is an image, set the previewContent to the image source
      let src = file.file.url
      if (!src) {
        src = await new Promise(resolve => {
          const reader = new FileReader()
          reader.readAsDataURL(
            file.file.originFileObj instanceof Blob
              ? file.file.originFileObj
              : new Blob([file.file.originFileObj])
          )
          reader.onload = () => resolve(reader.result as string)
        })
      }
      setPreviewContent(src)
    } else {
      // If the file is not an image, set the previewContent to the file name
      setPreviewContent(file.file.name)
    }
  }

  useEffect(() => {
    const sub = pusherClient.subscribe('private-whatsapp')

    const processNewMessage = (data: any) => {
      setMessages(prevMessages =>
        prevMessages ? [...prevMessages, data] : [data]
      )

      if (
        data.direction === 'incoming' &&
        data.contactPhoneNumber === userChat
      ) {
        updateSeenStatus(data.contactPhoneNumber, data.messageId)
      }
    }

    sub.bind(`new-message`, (data: any) => {
      processNewMessage(data)
      refetch()
    })

    sub.bind('update-message-status', (data: any) => {
      setMessages(prevMessages => {
        return prevMessages.map(message => {
          if (message.id === data.id) {
            return data
          }
          return message
        })
      })
    })

    sub.bind('message-reaction', (data: any) => {
      setMessages(prevMessages => {
        return prevMessages.map(message => {
          if (message.id === data.id) {
            return data
          }
          return message
        })
      })
    })

    return () => {
      sub.unsubscribe()
      sub.unbind_all()
      setMessages([])
    }
  }, [userChat, refetch, updateSeenStatus])

  return (
    <div>
      {isLoadingContacts ? (
        <div className="mt-40 ">
          <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-white opacity-75">
            <div className="text-center text-gray-800">
              <Spin size="large" />
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-1  md:grid-cols-3  lg:grid-cols-4">
            <div className="">
              <div
                className="col-span-4 h-[100vh] md:col-span-3  md:h-[98vh] lg:col-span-1"
                style={{ border: '1px solid #e6e6e6 ', borderRadius: '4px' }}
              >
                <div className=" h-[100%]">
                  <div className="bg- grid grid-cols-2 bg-white p-2">
                    <div className="flex items-center ">
                      <div>
                        <Avatar
                          size={{
                            xs: 32,
                            sm: 32,
                            md: 40,
                            lg: 40,
                            xl: 40,
                            xxl: 40
                          }}
                          style={{
                            backgroundColor: '#4299F0',
                            color: '#fff'
                          }}
                        >
                          {session?.user?.name?.charAt(0).toUpperCase()}
                        </Avatar>
                      </div>

                      <div className="ml-1 text-gray-800">
                        {session?.user?.name}
                      </div>
                    </div>
                    <div className="grid w-full  items-center justify-end gap-2">
                      {/* <HiUserGroup className="text-2xl  text-gray-600" />
                <HiOutlineRefresh className="text-2xl  text-gray-600" />
                <BiSolidMessageDetail className="text-2xl  text-gray-600" /> */}

                      {/* <Dropdown overlay={menu} placement="bottomLeft">
                        <Button className="border-none bg-transparent p-0">
                          <MenuUnfoldOutlined className="text-2xl  text-gray-600" />
                        </Button>
                      </Dropdown> */}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-2 p-2">
                      {/* <Space direction="vertical" className="w-full ">
                        <Input.Search
                          placeholder="input search text"
                          allowClear
                          onSearch={onSearch}
                        />
                      </Space> */}
                      {/* <BiFilter className="text-2xl  text-gray-600" /> */}
                    </div>

                    <List
                      itemLayout="horizontal"
                      dataSource={contactsData}
                      className={`h-[85vh]

                overflow-y-scroll md:h-[88vh] ${
                  open && userChat ? ' z-0' : ' z-10'
                }`}
                      renderItem={item => (
                        <List.Item
                          onClick={() => {
                            setOpen(true)
                            // setUserChat(item.contactPhoneNumber)
                            fetchMessages(item.contactPhoneNumber)
                          }}
                          className={`hover:cursor-pointer hover:bg-gray-200 ${
                            open && userChat === item.contactPhoneNumber
                              ? 'bg-gray-200'
                              : ''
                          }`}
                        >
                          <div className="flex w-full p-2  ">
                            <div className="pr-4">
                              <Avatar
                                size={{
                                  xs: 32,
                                  sm: 32,
                                  md: 40,
                                  lg: 40,
                                  xl: 40,
                                  xxl: 40
                                }}
                                className="flex items-center justify-center"
                                style={{
                                  backgroundColor: '#4299F0',
                                  color: '#547491'
                                }}
                              >
                                {' '}
                                {item.name ? (
                                  item.name.charAt(0).toUpperCase()
                                ) : (
                                  <HiUserGroup className="text-xl  text-white" />
                                )}
                              </Avatar>
                            </div>
                            <div className="flex w-full items-center justify-between">
                              <div>
                                <div className="text-base font-semibold">
                                  {item.name
                                    ? item.name
                                    : item.contactPhoneNumber}
                                </div>
                                <div className="text-sm">
                                  {item.type === 'text' ? (
                                    item.text
                                  ) : item.type === 'image' ? (
                                    <div className="flex  justify-start  ">
                                      {' '}
                                      <div className="pr-1">
                                        <BsCardImage className="text-lg text-gray-600" />
                                      </div>
                                      <div>Photo</div>
                                    </div>
                                  ) : item.type === 'document' ? (
                                    <div className="flex  justify-start  ">
                                      {' '}
                                      <div className="pr-1">
                                        <HiDocumentText className="text-lg text-gray-600" />
                                      </div>
                                      <div>Document</div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex flex-col items-end justify-end">
                                <div className="mb-1">
                                  <div
                                    className="text-xs font-semibold "
                                    style={{ color: '#4299F0' }}
                                  >
                                    {item.createdAt
                                      ? formatDate(item.createdAt.toISOString())
                                      : ''}
                                  </div>
                                </div>

                                {item.unseen && item.unseen > 0 ? (
                                  <div
                                    className="flex items-center justify-center gap-2"
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      backgroundColor: '#4299F0',
                                      color: 'white'
                                    }}
                                  >
                                    {' '}
                                    {item.unseen}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </List.Item>
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div
              className={`  h-full w-full md:col-span-2 lg:col-span-3 ${
                open && userChat
                  ? ' fixed block md:relative'
                  : ' relative hidden md:relative md:block'
              }`}
            >
              <div>
                {messagedataLoading ? (
                  <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-white opacity-75">
                    <Spin size="large" />
                  </div>
                ) : null}

                <div>
                  <div className=" relative block h-[100vh] w-full md:block md:h-[100vh] ">
                    {messages?.length === 0 ? (
                      <div className=" hidden h-full w-full flex-col items-center justify-center bg-gray-200 md:flex">
                        <Image
                          src="/chat.png"
                          alt="images"
                          style={{ objectFit: 'contain', maxWidth: '600px' }}
                        />
                        <div className="flex flex-col items-center justify-center p-4">
                          <div className="my-4 text-3xl text-slate-700">
                            WhatsApp Web
                          </div>
                          <div className="mb-2 text-lg text-slate-700">
                            Sends and receives messages from WhatsApp Web
                          </div>
                          <div className="mb-2 text-center text-lg text-slate-700">
                            To use WhatsApp on your computer: Open WhatsApp on
                            your phone
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="">
                        <div
                          className="flex h-[100vh] flex-col bg-white  md:h-[96vh]"
                          // style={{
                          //   backgroundImage: 'url("/back.png")',
                          //   backgroundSize: 'cover',
                          //   backgroundRepeat: 'no-repeat'
                          // }}
                        >
                          {contactsData?.map((item: any) =>
                            item?.contactPhoneNumber === userChat ? (
                              <div key={item.contactPhoneNumber}>
                                <div>
                                  <div
                                    className="z-20"
                                    style={{
                                      flex: 0,
                                      position: 'absolute',
                                      width: '100%',
                                      top: 0
                                    }}
                                  >
                                    <div className="relative grid grid-cols-2 bg-gray-200 p-2 pr-4">
                                      <div className="flex items-center  gap-2">
                                        <Button
                                          className=" m-0 block border-none bg-transparent p-0 md:hidden"
                                          onClick={() => {
                                            setOpen(false)
                                            setUserChat('')
                                          }}
                                        >
                                          <MdNavigateBefore className="text-3xl  text-gray-600" />
                                        </Button>
                                        <Avatar
                                          size={{
                                            xs: 24,
                                            sm: 32,
                                            md: 40,
                                            lg: 40,
                                            xl: 40,
                                            xxl: 40
                                          }}
                                          className="flex items-center justify-center"
                                          style={{
                                            backgroundColor: '#4299F0',
                                            color: '#547491'
                                          }}
                                        >
                                          {' '}
                                          {item.name ? (
                                            item.name.charAt(0).toUpperCase()
                                          ) : (
                                            <HiUserGroup className="text-xl  text-white" />
                                          )}
                                        </Avatar>
                                        <div className="text-base font-semibold text-gray-600">
                                          {item.name
                                            ? item.name
                                            : item.contactPhoneNumber}
                                        </div>
                                      </div>
                                      <div className="flex  items-center justify-end gap-4">
                                        {/* <SearchOutlined className="text-2xl  text-gray-600" />

                                        <Dropdown
                                          overlay={menu}
                                          placement="bottomLeft"
                                        >
                                          <Button className="border-none bg-transparent p-0">
                                            <MenuUnfoldOutlined className="text-2xl  text-gray-600" />
                                          </Button>
                                        </Dropdown> */}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-0">
                                    <div
                                      className="absolute bottom-0  m-2  mb-[10vh] flex h-[89vh] w-[99%]  flex-col overflow-y-scroll"
                                      id="chatList"
                                      ref={messageContainerRef}
                                    >
                                      <div className="mt-20 flex w-full flex-col   justify-end p-4  ">
                                        {messages?.map(data => (
                                          <div
                                            key={data.id}
                                            className={`mb-2 mr-8 flex w-full ${
                                              data.direction === 'incoming'
                                                ? 'justify-start'
                                                : 'justify-end'
                                            }`}
                                          >
                                            <div
                                              className={`flex  flex-col  p-1   ${
                                                data.direction === 'incoming'
                                                  ? 'bg-[#e8daf5] text-slate-700 '
                                                  : 'bg-[#fcf3d6] text-slate-700'
                                              }`}
                                              style={{
                                                borderRadius: '10px',
                                                boxShadow:
                                                  '12px 12px 16px 0 rgba(0, 0, 0, 0.25), -8px -8px 12px 0 rgba(255, 255, 255, 0.3)',

                                                maxWidth: '600px',
                                                minWidth: '180px',
                                                wordWrap: 'break-word',
                                                wordBreak: 'break-all'
                                              }}
                                            >
                                              <div className="">
                                                {data.type === 'text' ? (
                                                  <div className=" p-1 px-4 text-base">
                                                    {data.text}
                                                  </div>
                                                ) : data.type === 'image' ? (
                                                  <div className="p-1 px-1 text-lg">
                                                    <Image
                                                      src={
                                                        data.mediaUrl
                                                          ? data.mediaUrl
                                                          : ''
                                                      }
                                                      alt=""
                                                      width={300}
                                                      height={200}
                                                      style={{
                                                        objectFit: 'contain'
                                                      }}
                                                    />
                                                  </div>
                                                ) : data.type === 'video' ? (
                                                  <div className="p-1 px-4 text-lg">
                                                    <iframe
                                                      src={
                                                        data.mediaUrl
                                                          ? data.mediaUrl
                                                          : ''
                                                      }
                                                      width={200}
                                                      height={200}
                                                    />
                                                  </div>
                                                ) : data.type === 'audio' ? (
                                                  <div className="p-1 px-4 text-lg">
                                                    <audio controls>
                                                      <source
                                                        src={
                                                          data.mediaUrl
                                                            ? data.mediaUrl
                                                            : ''
                                                        }
                                                        type="audio/mpeg"
                                                      />
                                                    </audio>
                                                  </div>
                                                ) : data.type === 'document' ? (
                                                  <div className="p-1">
                                                    <div className="grid w-full grid-cols-3">
                                                      <div className="col-span-2 flex items-center justify-center">
                                                        <div>
                                                          <FaFilePdf className="text-2xl text-red-700" />
                                                        </div>
                                                        <div>
                                                          <div className="ml-2 text-base text-white hover:underline">
                                                            {data.mediaFilename}
                                                          </div>
                                                        </div>
                                                      </div>
                                                      <div className="flex items-center justify-end ">
                                                        <a
                                                          href={
                                                            data.mediaUrl
                                                              ? data.mediaUrl
                                                              : ''
                                                          }
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          download={
                                                            data.mediaUrl
                                                          }
                                                        >
                                                          <MdDownloadForOffline className="text-xl text-white" />
                                                        </a>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ) : data.type === 'location' ? (
                                                  <div className="p-1 px-4 text-lg">
                                                    Location
                                                  </div>
                                                ) : data.type === 'template' ? (
                                                  <div className="p-1 px-4 text-lg">
                                                    Template {data.templateName}
                                                  </div>
                                                ) : null}
                                              </div>

                                              <div className="float-right  flex  w-full  items-center justify-end  pr-1 pt-1 text-xs">
                                                <div>
                                                  {item.createdAt.toLocaleString()}
                                                </div>
                                                <div>
                                                  {data.direction ===
                                                    'outgoing' && (
                                                    <>
                                                      {data.direction ===
                                                        'outgoing' && (
                                                        <>
                                                          {data.status ===
                                                            'sent' && (
                                                            <IoMdCheckmark className="ml-1 text-lg text-gray-500" />
                                                          )}
                                                          {data.status ===
                                                            'delivered' && (
                                                            <IoMdCheckmark className="text-white-500 ml-1 text-lg" />
                                                          )}
                                                          {data.status ===
                                                            'read' && (
                                                            <IoMdCheckmark className="ml-1 text-lg text-blue-700" />
                                                          )}
                                                        </>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    className="z-20"
                                    style={{
                                      flex: 0,
                                      position: 'absolute',
                                      width: '100%',
                                      bottom: 0
                                    }}
                                  >
                                    <div className="mt-1 flex items-center justify-center gap-4 bg-gray-200 p-4 pl-6  pr-6">
                                      <Upload
                                        showUploadList={false}
                                        onChange={onPreview}
                                        multiple={false}
                                      >
                                        <PlusOutlined className="text-2xl  text-gray-600" />
                                      </Upload>

                                      <Input
                                        placeholder="Type a message"
                                        onKeyDown={event => {
                                          if (event.key === 'Enter') {
                                            event.preventDefault()
                                            sendMessage(
                                              messageText,
                                              item.contactPhoneNumber,
                                              'text'
                                            )
                                          }
                                        }}
                                        value={messageText}
                                        allowClear
                                        className="w-full  p-2"
                                        onChange={e => {
                                          const { value } = e.target
                                          setMessageText(value)
                                        }}
                                        style={{
                                          height: '40px', // Set the desired height here
                                          position: 'relative'
                                        }}
                                        // suffix={
                                        //   <div>
                                        //     <div>
                                        //       <Upload
                                        //         showUploadList={false}
                                        //         onChange={onPreview}
                                        //         multiple={false}
                                        //       >
                                        //         <PaperClipOutlined className="text-2xl text-gray-600" />
                                        //       </Upload>
                                        //     </div>
                                        //   </div>
                                        // }
                                      />
                                      {
                                        messageText ? (
                                          <div
                                            className="flex items-center justify-center"
                                            style={{
                                              width: '35px',
                                              height: '35px',
                                              background: '#4299F0',
                                              borderRadius: '50%'
                                            }}
                                            onClick={() => {
                                              sendMessage(
                                                messageText,
                                                item.contactPhoneNumber,
                                                'text'
                                              )
                                            }}
                                          >
                                            <BsFillCursorFill className="text-xl text-white" />
                                          </div>
                                        ) : null
                                        // <BsMicFill className="text-2xl text-gray-600" />
                                      }
                                    </div>
                                  </div>

                                  <Modal
                                    maskClosable={false}
                                    open={preview}
                                    footer={[
                                      <Button
                                        key="back"
                                        onClick={() => {
                                          setPreview(false)
                                        }}
                                      >
                                        Cancel
                                      </Button>,

                                      <Button
                                        key="link"
                                        type="primary"
                                        onClick={() => {
                                          sendMessage(
                                            file,
                                            item.contactPhoneNumber,
                                            fileType
                                          )
                                          setPreview(false)
                                        }}
                                      >
                                        Send
                                      </Button>
                                    ]} // You can remove the footer if you don't want any actions in the modal
                                  >
                                    {previewContent &&
                                      (fileType === 'image' ? (
                                        // Show image preview if the previewContent is a base64 image source
                                        <Image
                                          alt="Preview"
                                          style={{ width: '100%' }}
                                          src={previewContent}
                                        />
                                      ) : (
                                        // Show file name for other types of files
                                        <div>Send {previewContent} ?</div>
                                      ))}
                                  </Modal>
                                </div>
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WhatsappPage
