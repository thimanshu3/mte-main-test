import {
  CheckSquareOutlined,
  DeleteOutlined,
  FieldTimeOutlined,
  FileAddOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons'
import type { inferRouterOutputs } from '@trpc/server'
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Progress,
  Row,
  Select,
  Tooltip,
  Typography,
  Upload
} from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react'
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import { useMessageApi } from '~/context/messageApi'
import type { AppRouter } from '~/server/api/root'
import { api } from '~/utils/api'
import { pusherClient } from '~/utils/pusher/client'

dayjs.extend(relativeTime)
type RouterOutput = inferRouterOutputs<AppRouter>

type TaskType = RouterOutput['tasks']['getAllByTaskList'][0]

export const Task: FC<{
  task: TaskType
  teamId: string
  setTasks: Dispatch<SetStateAction<TaskType[] | undefined>>
}> = ({ task, setTasks, teamId }) => {
  const messageApi = useMessageApi()

  //? States
  const [attachments, setAttachments] = useState<
    {
      uid: string
      name: string
      filename: string
      url: string
    }[]
  >([])
  const [taskCheckLists, setTaskCheckLists] = useState<
    typeof taskCheckListsData
  >([])
  const [taskId, setTaskId] = useState<string | null>(null)

  //? Queries
  const { data: taskActivities } = api.tasks.getActivities.useQuery(
    {
      id: taskId || ''
    },
    {
      enabled: !!taskId
    }
  )
  const { data: team } = api.teams.getOne.useQuery({ id: teamId })

  const { data: taskAttachments, isLoading: getTaskAttachmentsLoading } =
    api.tasks.getAttachments.useQuery(taskId || '', {
      enabled: !!taskId
    })
  const { data: taskCheckListsData } = api.taskCheckLists.getAll.useQuery(
    { taskId: taskId || '' },
    {
      enabled: !!taskId
    }
  )

  //? Mutations
  const { mutateAsync: deleteTask } = api.tasks.deleteOne.useMutation()
  const { mutateAsync: updateOne } = api.tasks.updateOne.useMutation()
  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()
  const { mutateAsync: resyncTask } = api.tasks.reSyncTask.useMutation()
  const { mutateAsync: attachFiles } = api.tasks.attachFiles.useMutation()
  const { mutateAsync: createTaskChecklist } =
    api.taskCheckLists.createOne.useMutation()
  const { mutateAsync: updateTaskChecklist } =
    api.taskCheckLists.updateOne.useMutation()
  const { mutateAsync: deleteTaskChecklist } =
    api.taskCheckLists.deleteOne.useMutation()
  const { mutateAsync: createTaskChecklistItem } =
    api.taskCheckListItems.createOne.useMutation()
  const { mutateAsync: updateTaskChecklistItem } =
    api.taskCheckListItems.updateOne.useMutation()
  const { mutateAsync: deleteTaskChecklistItem } =
    api.taskCheckListItems.deleteOne.useMutation()
  const { mutateAsync: updateTaskCheckListItemOrder } =
    api.taskCheckListItems.updateOrder.useMutation()

  //? UseEffects
  useEffect(() => {
    if (taskId) {
      setAttachments(
        taskAttachments?.map(a => ({
          uid: a.id,
          name: a.originalFilename,
          filename: a.originalFilename,
          url: a.url
        })) || []
      )

      setTaskCheckLists(taskCheckListsData)

      const sub = pusherClient.subscribe(`private-task-${taskId}`)
      sub.bind('attachments-created', (attachments: any[]) => {
        setAttachments(prev => {
          return [
            ...prev,
            ...attachments
              .filter(a => !prev?.find(p => p.uid === a.id))
              .map(a => ({
                uid: a.id,
                name: a.originalFilename,
                filename: a.newFilename,
                url: a.url
              }))
          ]
        })
      })
      sub.bind('attachment-deleted', (deletedId: string) => {
        setAttachments(prev => prev.filter(a => a.uid !== deletedId))
      })
      sub.bind('task-check-list-created', (taskCheckList: any) => {
        setTaskCheckLists(prev => [...(prev || []), taskCheckList])
      })
      sub.bind('task-check-list-updated', (updatedTaskCheckList: any) => {
        setTaskCheckLists(
          prev =>
            prev?.map(list =>
              list.id === updatedTaskCheckList.id ? updatedTaskCheckList : list
            )
        )
      })
      sub.bind('task-check-list-deleted', (deletedId: string) => {
        setTaskCheckLists(prev => prev?.filter(list => list.id !== deletedId))
      })
      sub.bind('task-check-list-item-created', (checklistItem: any) => {
        setTaskCheckLists(
          prev =>
            prev?.map(list =>
              list.id === checklistItem.taskCheckListId
                ? {
                    ...list,
                    taskCheckListItems: [
                      ...(list.taskCheckListItems || []),
                      checklistItem
                    ]
                  }
                : list
            )
        )
      })
      sub.bind('task-check-list-item-updated', (updatedChecklistItem: any) => {
        setTaskCheckLists(
          prev =>
            prev?.map(list =>
              list.id === updatedChecklistItem.taskCheckListId
                ? {
                    ...list,
                    taskCheckListItems: list.taskCheckListItems?.map(item =>
                      item.id === updatedChecklistItem.id
                        ? updatedChecklistItem
                        : item
                    )
                  }
                : list
            )
        )
      })

      sub.bind(
        'task-check-list-items-reorder',
        ({
          taskCheckListId,
          taskCheckListItems
        }: {
          taskCheckListId: string
          taskCheckListItems: any[]
        }) => {
          setTaskCheckLists(
            prev =>
              prev?.map(list =>
                list.id === taskCheckListId
                  ? {
                      ...list,
                      taskCheckListItems: taskCheckListItems
                    }
                  : list
              )
          )
        }
      )
      return () => {
        sub.unbind_all()
        sub.unsubscribe()
        setAttachments([])
        setTaskCheckLists([])
      }
    }
    return () => {}
  }, [taskAttachments, taskCheckListsData, taskId])

  return (
    <>
      <Card
        className="relative mb-2 w-full max-w-[330px]"
        bodyStyle={{
          padding: 8
        }}
        onClick={() => setTaskId(task.id)}
      >
        <Typography.Text>{task.title}</Typography.Text>
        <div className="float-right">
          {task.assignedTo && task.assignedTo.length ? (
            <Avatar.Group maxCount={4} size="small" maxPopoverTrigger="hover">
              {task.assignedTo?.map(user => (
                <Tooltip key={user.id} title={user?.user.name} placement="top">
                  <Avatar className="bg-[#87d068]">
                    {user.user.name?.[0]?.toUpperCase()}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
          ) : null}
        </div>
        {task.startDate && task.endDate ? (
          <div className="flex items-center gap-2">
            <FieldTimeOutlined />

            <span
              className={`rounded-md px-1 ${
                new Date() > new Date(task.endDate) || task.completed
                  ? 'text-white'
                  : 'text-[#A9A9A9]'
              } font-bold ${
                task.completed
                  ? 'bg-green-500'
                  : new Date(task.endDate) < new Date()
                  ? 'bg-[#FF7F71]'
                  : 'bg-white'
              }`}
            >
              {dayjs(task.startDate).format('DD/MM/YYYY') +
                ' - ' +
                dayjs(task.endDate).format('DD/MM/YYYY')}
            </span>
          </div>
        ) : task.completed ? (
          <div className="flex items-center gap-2">
            <FieldTimeOutlined />
            <span className="rounded-md bg-green-500 px-1 font-bold text-white">
              Completed
            </span>
          </div>
        ) : null}
      </Card>

      <Modal
        title={
          <Typography.Title
            level={5}
            editable={{
              triggerType: ['icon', 'text'],
              onChange: async e => {
                if (e === task.title) return
                if (!e) {
                  messageApi.error('Title cannot be empty')
                  return
                }
                const old = task.title
                try {
                  setTasks(
                    prev =>
                      prev?.map(t =>
                        t.id === task.id ? { ...t, title: e } : t
                      )
                  )
                  await updateOne({
                    id: task.id,
                    title: e
                  })
                } catch (err) {
                  setTasks(
                    prev =>
                      prev?.map(t =>
                        t.id === task.id ? { ...t, title: old } : t
                      )
                  )
                }
              }
            }}
          >
            {task.title}
          </Typography.Title>
        }
        open={task.id === taskId}
        onCancel={() => {
          setTaskId(null)
          setAttachments([])
        }}
        footer={null}
        maskClosable={false}
        width={900}
        destroyOnClose
      >
        <Row
          gutter={14}
          style={{ padding: '20px', paddingTop: '30px' }}
          className="p-5 pt-8"
        >
          <Col span={18}>
            <Typography.Title level={5}>Members</Typography.Title>
            {task.assignedTo.length ? (
              <Avatar.Group
                maxCount={4}
                maxPopoverTrigger="click"
                maxStyle={{
                  color: '#f56a00',
                  backgroundColor: '#fde3cf',
                  cursor: 'pointer'
                }}
              >
                {task.assignedTo?.map(user => (
                  <Tooltip
                    key={user?.user?.id}
                    title={user?.user?.name}
                    placement="top"
                  >
                    <Avatar className="bg-green-500">
                      {user?.user?.name?.[0]?.toUpperCase()}
                    </Avatar>
                  </Tooltip>
                ))}
              </Avatar.Group>
            ) : (
              <Typography.Text type="secondary">No members</Typography.Text>
            )}

            <Typography.Title level={5}>Description</Typography.Title>
            <Typography.Paragraph
              className="mt-2 border"
              editable={{
                triggerType: ['icon', 'text'],
                onChange: async e => {
                  if (e === task.description) return
                  const old = task.description
                  try {
                    setTasks(
                      prev =>
                        prev?.map(t =>
                          t.id === task.id ? { ...t, description: e } : t
                        )
                    )
                    await updateOne({
                      id: task.id,
                      description: e
                    })
                  } catch (err) {
                    setTasks(
                      prev =>
                        prev?.map(t =>
                          t.id === task.id ? { ...t, description: old } : t
                        )
                    )
                  }
                }
              }}
            >
              {task.description ? (
                task.description
              ) : (
                <Typography.Text type="secondary">
                  No Description
                </Typography.Text>
              )}
            </Typography.Paragraph>
            <Divider />
            <Typography.Title level={5}>Check Lists</Typography.Title>
            <DragDropContext
              onDragEnd={async e => {
                if (!e.destination || !taskId) return

                const sourceIndex = e.source.index
                const destinationIndex = e.destination.index || 1
                const sourceId = e.source.droppableId
                const destinationId = e.destination.droppableId

                if (sourceId === destinationId) {
                  if (sourceIndex === destinationIndex) return
                  await updateTaskCheckListItemOrder({
                    id: e.draggableId,
                    order: destinationIndex,
                    taskId
                  })
                } else {
                  const taskListId = destinationId
                  if (!taskId) return
                  await updateTaskCheckListItemOrder({
                    id: e.draggableId,
                    order: destinationIndex,
                    taskId,
                    taskCheckListId: taskListId
                  })
                }
              }}
            >
              {taskCheckLists?.map(checklist => (
                <div key={checklist.id}>
                  <div className="flex w-full items-center gap-2">
                    <CheckSquareOutlined className="text-blue-500" />
                    <Typography.Title
                      className="!mb-0 leading-none"
                      level={5}
                      editable={{
                        triggerType: ['text'],
                        onChange: async name => {
                          if (!name)
                            return messageApi.error('Name is required!')
                          if (name === checklist.name) return
                          return await updateTaskChecklist({
                            id: checklist.id,
                            name
                          })
                        }
                      }}
                    >
                      {checklist.name}
                    </Typography.Title>

                    <Popconfirm
                      title="Are you sure to delete this checklist?"
                      okText="Confirm"
                      cancelText="Cancel"
                      onConfirm={async () => {
                        await deleteTaskChecklist({
                          id: checklist.id
                        })
                        messageApi.success('Checklist deleted Successfully!')
                      }}
                    >
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        type="link"
                        size="small"
                      ></Button>
                    </Popconfirm>

                    <Popover
                      destroyTooltipOnHide
                      content={
                        <Form
                          onFinish={async ({ name }) => {
                            if (!name || !name.trim()) {
                              return messageApi.error('Name is required!')
                            }
                            if (!taskId) return
                            return await createTaskChecklistItem({
                              taskId,
                              taskCheckListId: checklist.id,
                              title: name.trim()
                            })
                          }}
                        >
                          <Form.Item name="name" label="Name">
                            <Input />
                          </Form.Item>
                          <Form.Item>
                            <Button type="primary" htmlType="submit">
                              Create
                            </Button>
                          </Form.Item>
                        </Form>
                      }
                      placement="right"
                      trigger="click"
                    >
                      <Button icon={<PlusOutlined />} size="small">
                        Add Items
                      </Button>
                    </Popover>
                  </div>

                  <Progress
                    percent={parseFloat(
                      (
                        ((checklist.taskCheckListItems?.filter(
                          item => item.isComplete
                        ).length || 0) /
                          (checklist.taskCheckListItems?.length || 1)) *
                        100
                      ).toFixed(2)
                    )}
                  />

                  <Droppable droppableId={checklist.id}>
                    {provided => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="pb-2"
                      >
                        {checklist.taskCheckListItems?.map(item => (
                          <Draggable
                            key={item.id}
                            draggableId={item.id}
                            index={item.order}
                          >
                            {provided => (
                              <div
                                ref={provided.innerRef}
                                {...provided.dragHandleProps}
                                {...provided.draggableProps}
                              >
                                <Card
                                  key={item.id}
                                  bodyStyle={{ padding: 4 }}
                                  className="mb-2 ml-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      checked={item.isComplete}
                                      onChange={async e => {
                                        if (!taskId) return
                                        return await updateTaskChecklistItem({
                                          id: item.id,
                                          taskId: taskId,
                                          completed: e.target.checked
                                        })
                                      }}
                                    />

                                    <Typography.Paragraph
                                      editable={{
                                        triggerType: ['text'],
                                        onChange: async name => {
                                          if (!taskId || name === item.title)
                                            return
                                          if (!name)
                                            return messageApi.error(
                                              'Name is required!'
                                            )
                                          return await updateTaskChecklistItem({
                                            id: item.id,
                                            taskId: taskId,
                                            title: name
                                          })
                                        }
                                      }}
                                      className={`${
                                        item.isComplete ? 'line-through' : ''
                                      } !mb-0 leading-none`}
                                    >
                                      {item.title}
                                    </Typography.Paragraph>
                                    <div>
                                      <Popconfirm
                                        title="Delete Item"
                                        onConfirm={async () => {
                                          if (!taskId) return
                                          return await deleteTaskChecklistItem({
                                            id: item.id,
                                            taskId
                                          })
                                        }}
                                      >
                                        <Button
                                          icon={<DeleteOutlined />}
                                          type="link"
                                          danger
                                          size="small"
                                        />
                                      </Popconfirm>
                                    </div>
                                  </div>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                  <Divider />
                </div>
              ))}
            </DragDropContext>
          </Col>
          <Col span={6}>
            <div className="sticky top-4">
              <Typography.Title level={5}>Actions</Typography.Title>
              <div className="flex flex-col gap-2">
                <Button
                  block
                  icon={<Checkbox checked={task.completed} />}
                  className={`${
                    task.completed
                      ? 'border-green-500 text-green-500'
                      : 'border-yellow-500 text-yellow-500'
                  } text-start`}
                  onClick={async () => {
                    await updateOne({
                      id: task.id,
                      completed: !task.completed
                    })
                  }}
                >
                  {task.completed ? 'Mark as Incomplete' : 'Mark as Complete'}
                </Button>

                <Popover
                  destroyTooltipOnHide
                  content={
                    <Form
                      initialValues={{
                        userIds: task.assignedTo.map(u => u.userId)
                      }}
                      onFinish={async values => {
                        try {
                          await updateOne({
                            id: task.id,
                            userIds: values.userIds
                          })
                          messageApi.success('Members updated successfully!')
                        } catch (err) {
                          messageApi.error('Something went wrong!')
                        }
                      }}
                    >
                      <Button
                        type="primary"
                        htmlType="submit"
                        block
                        icon={<SaveOutlined />}
                      >
                        Save
                      </Button>
                      <Form.Item name="userIds" className="mb-0 mt-2">
                        <Select
                          placeholder="Select Users"
                          mode="multiple"
                          className="min-w-[200px]"
                          options={team?.users.map(u => ({
                            label: u.user.name,
                            value: u.user.id
                          }))}
                        />
                      </Form.Item>
                    </Form>
                  }
                  placement="left"
                  trigger="click"
                >
                  <Button
                    block
                    className="text-start"
                    icon={<UsergroupAddOutlined />}
                  >
                    Members
                  </Button>
                </Popover>

                <Popover
                  destroyTooltipOnHide
                  content={
                    <Form
                      onFinish={async values => {
                        await updateOne({
                          id: task.id,
                          startDate: values?.dateRange?.[0]?.toDate() || null,
                          endDate: values?.dateRange?.[1]?.toDate() || null
                        })
                      }}
                      initialValues={{
                        dateRange: [
                          task.startDate ? dayjs(task.startDate) : null,
                          task.endDate ? dayjs(task.endDate) : null
                        ]
                      }}
                    >
                      <Button
                        type="primary"
                        htmlType="submit"
                        block
                        icon={<SaveOutlined />}
                      >
                        Save
                      </Button>
                      <Form.Item className="mb-0 mt-2" name="dateRange">
                        <DatePicker.RangePicker showTime />
                      </Form.Item>
                    </Form>
                  }
                  placement="left"
                  trigger="click"
                >
                  <Button
                    block
                    className="text-start"
                    icon={<FieldTimeOutlined />}
                  >
                    Dates
                  </Button>
                </Popover>

                <Popover
                  destroyTooltipOnHide
                  content={
                    <Form
                      onFinish={async () => {
                        await attachFiles({
                          id: task.id,
                          attachmentIds: attachments.map(a => a.uid)
                        })
                      }}
                      layout="vertical"
                    >
                      {attachments.length !== taskAttachments?.length ? (
                        <Button
                          htmlType="submit"
                          type="primary"
                          className="mb-2"
                          icon={<SaveOutlined />}
                          block
                        >
                          Save
                        </Button>
                      ) : null}
                      <Upload
                        className="block"
                        multiple={true}
                        beforeUpload={async file => {
                          const formData = new FormData()
                          formData.append('file', file)

                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                          })
                          const json = await res.json()
                          if (json?.attachments)
                            setAttachments(prev => [
                              ...prev,
                              ...json.attachments.map((a: any) => ({
                                uid: a.id,
                                name: a.originalFilename,
                                filename: a.newFilename,
                                url: a.url
                              }))
                            ])
                        }}
                        onRemove={async file => {
                          setAttachments(prev =>
                            prev.filter(a => a.uid !== file.uid)
                          )
                          await deleteAttachment({
                            id: file.uid
                          })
                          await resyncTask(task.id)
                        }}
                        fileList={attachments}
                      >
                        <Button
                          block
                          icon={<UploadOutlined />}
                          className="w-full"
                        >
                          Select Files
                        </Button>
                      </Upload>
                    </Form>
                  }
                  showArrow={false}
                  placement="left"
                  trigger="click"
                >
                  <Button
                    block
                    className="text-start"
                    icon={<FileAddOutlined />}
                    loading={getTaskAttachmentsLoading}
                  >
                    Attachments
                  </Button>
                </Popover>

                <Popover
                  destroyTooltipOnHide
                  content={
                    <Form
                      onFinish={async ({ name }) => {
                        if (!name || !name.trim()) {
                          return messageApi.error('Name is required!')
                        }
                        if (!taskId) return
                        return await createTaskChecklist({
                          taskId,
                          name: name.trim()
                        })
                      }}
                    >
                      <Form.Item name="name" label="Name">
                        <Input />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit">
                          Create
                        </Button>
                      </Form.Item>
                    </Form>
                  }
                  placement="left"
                  trigger="click"
                >
                  <Button block icon={<PlusOutlined />} className="text-start">
                    Add Checklist
                  </Button>
                </Popover>

                <Popconfirm
                  title="Are you sure to delete this task?"
                  okText="Confirm"
                  cancelText="Cancel"
                  onConfirm={async () => {
                    await deleteTask({ id: task.id })
                    await messageApi.success('Task deleted Successfully!')
                  }}
                >
                  <Button
                    block
                    className="text-start"
                    icon={<DeleteOutlined />}
                    danger
                  >
                    Delete
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </Col>
          <Col span={24}>
            {taskActivities?.activities?.map(activity => (
              <ul id={activity.id} key={activity.id}>
                <li>
                  <Avatar
                    style={{
                      color: '#FFF',
                      backgroundColor: '#007020'
                    }}
                  >
                    {activity.createdBy.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <div>
                    {activity.action.replace(/_/g, ' ')}
                    {activity.action === 'Task_Assigned' ||
                    activity.action === 'Task_Unassigned' ? (
                      <span
                        style={{
                          fontSize: 14,
                          lineHeight: '20px',
                          fontWeight: 700,
                          marginLeft: 8
                        }}
                      >
                        {activity.additionalUser?.name}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: 12 }}>
                    {dayjs(activity.createdAt).fromNow()}
                  </div>
                </li>
              </ul>
            ))}
          </Col>
        </Row>
      </Modal>
    </>
  )
}
