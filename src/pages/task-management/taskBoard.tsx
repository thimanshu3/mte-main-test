import { DashOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Popconfirm,
  Popover,
  Space,
  Typography,
  message
} from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd'
import { Layout } from '~/components/Layout'
import { Tasks } from '~/components/task-management/Tasks'
import { useMessageApi } from '~/context/messageApi'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'
import { pusherClient } from '~/utils/pusher/client'

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerAuthSession(ctx)
  const teamId = ctx.query.teamId as string

  return {
    redirect: !session
      ? {
          destination: '/auth'
        }
      : !teamId
      ? {
          destination: '/task-management/teams'
        }
      : undefined,
    props: {
      teamId
    }
  }
}

const TaskBoard: NextPage<{ teamId: string }> = ({ teamId }) => {
  const { data: session } = useSession()
  const { data: team, isLoading: getTeamLoading } = api.teams.getOne.useQuery({
    id: teamId
  })
  const { data: taskListsData, isLoading: getTaskListsLoading } =
    api.taskLists.getAll.useQuery({
      teamId
    })
  const { mutateAsync: createTaskList, isLoading: createTaskListLoading } =
    api.taskLists.create.useMutation()
  const { mutateAsync: updateTaskList, isLoading: updateTaskListLoading } =
    api.taskLists.update.useMutation()
  const { mutateAsync: deleteTaskList } = api.taskLists.delete.useMutation()
  updateTaskListLoading
  const { mutateAsync: createTask } = api.tasks.createOne.useMutation()
  const { mutateAsync: updateTaskOrder } = api.tasks.updateOrder.useMutation()

  //? Forms
  const [addTaskListForm] = Form.useForm()
  const [addTaskForm] = Form.useForm()

  //? States
  const [taskLists, setTaskLists] = useState<typeof taskListsData>([])
  const [showAddTaskCardListId, setShowAddTaskCardListId] = useState('')
  const [showAddTaskList, setShowAddTaskList] = useState(false)

  useEffect(() => {
    if (taskListsData?.length) setTaskLists(taskListsData)
  }, [taskListsData])

  useEffect(() => {
    if (!session) return
    if (
      team &&
      !['ADMIN', 'ADMINVIEWER'].includes(session.user.role) &&
      !team.users.find(u => u.user.id === session.user.id)
    ) {
      window.location.href = '/task-management/teams'
    }
  }, [session, team])

  useEffect(() => {
    if (!session || !team || pusherClient.connection.state !== 'connected')
      return
    const sub = pusherClient.subscribe(`private-team-${team.id}`)
    sub.bind('task-list-created', (data: any) => {
      setTaskLists(prev => (prev ? [...prev, data] : [data]))
    })
    sub.bind('task-list-updated', (data: any) => {
      setTaskLists(data)
    })
    sub.bind('task-list-deleted', (data: any) => {
      setTaskLists(data)
    })
    return () => {
      sub.unbind_all()
      sub.unsubscribe()
    }
  }, [session, team])

  const messageApi = useMessageApi()

  return (
    <Layout title={team?.name} loading={getTeamLoading || getTaskListsLoading}>
      <div className="relative h-[80vh] w-full overflow-y-hidden overflow-x-scroll">
        <DragDropContext
          onDragEnd={async e => {
            if (!e.destination) return
            const sourceIndex = e.source.index
            const destinationIndex = e.destination.index || 1
            const sourceId = e.source.droppableId
            const destinationId = e.destination.droppableId
            if (sourceId === destinationId) {
              if (sourceIndex === destinationIndex) return
              if (sourceId === 'board') {
                const taskList = taskLists?.find(t => t.order === sourceIndex)
                if (!taskList) return
                setTaskLists(prev => {
                  const newTaskLists: typeof taskLists = []
                  prev
                    ?.map((t, i) => {
                      const currIndex = i + 1
                      if (t.id === taskList.id)
                        return { ...t, order: destinationIndex }
                      if (destinationIndex > sourceIndex) {
                        if (
                          currIndex > sourceIndex &&
                          currIndex <= destinationIndex
                        )
                          return { ...t, order: currIndex - 1 }
                      } else if (destinationIndex < sourceIndex) {
                        if (
                          currIndex >= destinationIndex &&
                          currIndex < sourceIndex
                        ) {
                          return { ...t, order: currIndex + 1 }
                        }
                      }
                      return t
                    })
                    .forEach(t => {
                      newTaskLists[t.order - 1] = t
                    })
                  return newTaskLists
                })
                await updateTaskList({
                  id: taskList.id,
                  order: destinationIndex,
                  name: taskList.name
                })
              } else {
                await updateTaskOrder({
                  id: e.draggableId,
                  order: destinationIndex
                })
              }
            } else {
              await updateTaskOrder({
                id: e.draggableId,
                order: destinationIndex,
                taskListId: destinationId
              })
            }
          }}
        >
          <Droppable droppableId="board" type="COLUMN" direction="horizontal">
            {provided => (
              <div
                className="inline-flex flex-grow"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {taskLists?.map(list => (
                  <Draggable
                    draggableId={list.id}
                    index={list.order}
                    key={list.id}
                  >
                    {provided => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <Card
                          bodyStyle={{
                            padding: '1px',
                            maxHeight: '60dvh',
                            height: 'fit-content'
                            // overflowY: 'hidden'
                          }}
                          className="mx-2 mt-2 min-w-[330px] p-1"
                          actions={[
                            <div
                              style={{ borderRadius: '8px', float: 'left' }}
                              key={list.id}
                            >
                              {showAddTaskCardListId !== list.id ? (
                                <Button
                                  type="link"
                                  icon={<PlusOutlined />}
                                  onClick={() => {
                                    setShowAddTaskCardListId(list.id)
                                  }}
                                >
                                  Add Task
                                </Button>
                              ) : (
                                <div>
                                  <Button
                                    type="primary"
                                    onClick={() => addTaskForm.submit()}
                                  >
                                    Add
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      setShowAddTaskCardListId('')
                                      addTaskForm.resetFields()
                                    }}
                                    type="link"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </div>
                          ]}
                          headStyle={{
                            padding: 0
                          }}
                          title={
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingInline: '5px'
                              }}
                            >
                              <Typography.Text
                                editable={{
                                  triggerType: ['icon', 'text'],
                                  onChange: async e => {
                                    if (!e) {
                                      messageApi.error('Title cannot be empty')
                                      return
                                    }
                                    const oldListName = list.name
                                    try {
                                      setTaskLists(
                                        prev =>
                                          prev?.map(t =>
                                            t.id === list.id
                                              ? { ...t, name: e }
                                              : t
                                          )
                                      )
                                      await updateTaskList({
                                        id: list.id,
                                        name: e,
                                        order: list.order
                                      })
                                    } catch (e) {
                                      setTaskLists(
                                        prev =>
                                          prev?.map(t =>
                                            t.id === list.id
                                              ? { ...t, name: oldListName }
                                              : t
                                          )
                                      )
                                    }
                                  }
                                }}
                                style={{
                                  cursor: 'pointer'
                                }}
                              >
                                {list.name}
                              </Typography.Text>
                              <div>
                                <Popover
                                  content={
                                    <div
                                      style={{
                                        paddingLeft: '12px',
                                        paddingRight: 12
                                      }}
                                    >
                                      <Popconfirm
                                        title="Are you sure to delete this taskList?"
                                        okText="Confirm"
                                        cancelText="Cancel"
                                        onConfirm={async () => {
                                          await deleteTaskList({ id: list.id })
                                          message.success(
                                            'TaskList deleted Successfully!'
                                          )
                                        }}
                                      >
                                        <p style={{ cursor: 'pointer' }}>
                                          Delete
                                        </p>
                                      </Popconfirm>
                                      <p
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                          // context.archiveTaskList(list.id)
                                          // refetchArchivedTaskLists()
                                          message.success(
                                            'TaskList archived Successfully'
                                          )
                                        }}
                                      >
                                        Archive
                                      </p>
                                    </div>
                                  }
                                  trigger="click"
                                  placement="left"
                                >
                                  <DashOutlined
                                    style={{
                                      fontSize: '25px',
                                      marginLeft: '22px',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      borderRadius: '15px',
                                      marginBottom: '6px'
                                    }}
                                  />
                                </Popover>
                              </div>
                            </div>
                          }
                        >
                          <Droppable droppableId={list.id}>
                            {provided => (
                              <div
                                style={{
                                  minHeight: '100px',
                                  marginTop: '10px'
                                }}
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                // className="mt-2 flex h-fit min-h-[100px] flex-grow flex-col"
                              >
                                <Tasks teamId={teamId} taskListId={list.id} />
                                {showAddTaskCardListId === list.id && (
                                  <Form
                                    style={{
                                      margin: 0,
                                      padding: 0,
                                      height: 'fit-content',
                                      display: 'flex',
                                      alignItems: 'center',
                                      width: '100%',

                                      alignContent: 'center'
                                    }}
                                    id={list.id}
                                    form={addTaskForm}
                                    onFinish={async (values: any) => {
                                      await createTask({
                                        taskListId: list.id,
                                        title: values.taskName
                                      })
                                      addTaskForm.resetFields()
                                      const el = document.getElementById(
                                        list.id
                                      )?.children[1]
                                      if (!el) return
                                      setTimeout(() => {
                                        el.scroll({
                                          top: el.scrollHeight,
                                          behavior: 'smooth'
                                        })
                                      }, 300)
                                    }}
                                  >
                                    <Form.Item
                                      name="taskName"
                                      rules={[
                                        {
                                          required: true,
                                          message: 'Please enter task name!'
                                        }
                                      ]}
                                      style={{
                                        width: '100%',
                                        padding: 0,
                                        margin: 0
                                      }}
                                    >
                                      <Input
                                        style={{ height: 60 }}
                                        placeholder="Enter a title for this card"
                                        autoFocus
                                        onKeyDown={e => {
                                          if (e.key === 'Escape') {
                                            addTaskForm.resetFields()
                                            setShowAddTaskCardListId('')
                                          }
                                        }}
                                      />
                                    </Form.Item>
                                  </Form>
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                <Col className="w-[330px]">
                  <Card
                    style={{
                      minWidth: 240,
                      marginLeft: '20px',
                      marginTop: '10px'
                    }}
                  >
                    {!showAddTaskList ? (
                      <Button
                        block
                        size="large"
                        onClick={() => setShowAddTaskList(true)}
                        icon={<PlusOutlined />}
                      >
                        Add List
                      </Button>
                    ) : (
                      <Form
                        form={addTaskListForm}
                        onFinish={async (values: any) => {
                          if (!values.listName) return
                          await createTaskList({
                            teamId,
                            name: values.listName
                          })
                          addTaskListForm.resetFields()
                          setTimeout(scroll, 300)
                        }}
                      >
                        <Form.Item name="listName">
                          <Input
                            type="text"
                            placeholder="Enter List Name"
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Escape') {
                                addTaskListForm.resetFields()
                                setShowAddTaskList(false)
                              }
                            }}
                          />
                        </Form.Item>

                        <Space>
                          <Button type="primary" htmlType="submit">
                            Add
                          </Button>
                          <Button
                            onClick={() => {
                              setShowAddTaskList(false)
                              addTaskListForm.resetFields()
                            }}
                            loading={createTaskListLoading}
                            type="primary"
                          >
                            Cancel
                          </Button>
                        </Space>
                      </Form>
                    )}
                  </Card>
                </Col>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </Layout>
  )
}

export default TaskBoard
