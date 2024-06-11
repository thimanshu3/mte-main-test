import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Typography
} from 'antd'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { Layout } from '~/components/Layout'
import { useNotificationApi } from '~/context/notifcationApi'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'

export const getServerSideProps: GetServerSideProps = async ctx => {
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

const Team: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [addNewUserModal, setAddNewUserModal] = useState(false)
  const [userSearch, setUserSearch] = useState<string | undefined>(undefined)

  // ? useQuery
  const {
    data: team,
    isLoading,
    refetch
  } = api.teams.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )
  const { data: users, isLoading: usersLoading } =
    api.users.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: userSearch
      },
      { enabled: !!session }
    )

  // ? useMutation
  const {
    mutateAsync: createOrUpdateTeam,
    isLoading: createOrUpdateTeamLoaading
  } = api.teams.createOrUpdate.useMutation()
  const { mutateAsync: addTeamUsers, isLoading: addTeamUsersLoading } =
    api.teams.addTeamUsers.useMutation()
  const { mutateAsync: removeTeamUser } = api.teams.removeTeamUser.useMutation()

  // ? useForm
  const [form] = Form.useForm()

  // ? useEffect
  useEffect(() => {
    if (form) form.resetFields()
  }, [id, form])

  // ? useMemo
  const debouncedUserSearch = useMemo(
    () =>
      debounce((search: string) => {
        setUserSearch(search || undefined)
      }, 500),
    []
  )

  // ? useNotification
  const notificationApi = useNotificationApi()

  return (
    <Layout
      loading={id !== 'new' && isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Task Management' },
        { label: 'Teams', link: '/task-management/teams' },
        {
          label: id === 'new' ? 'New' : team?.name || 'Loading'
        }
      ]}
      title={`Team - ${team?.name || id}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            try {
              const res = await createOrUpdateTeam({
                name: formData.name,
                id: id === 'new' ? undefined : id?.toString()
              })
              if (id === 'new') {
                notificationApi.success({
                  message: 'Team created'
                })
                router.push(`/task-management/teams/${res.id}`)
              } else {
                notificationApi.success({
                  message: 'Team updated'
                })
                refetch()
              }
            } catch (err) {
              notificationApi.error({
                message: 'Error creating Team'
              })
            }
          }}
          layout="vertical"
          initialValues={team}
        >
          <Space className="sticky top-0 z-20 mb-5 w-full bg-white py-2">
            {session?.user.role !== 'ADMINVIEWER' ? (
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={createOrUpdateTeamLoaading}
                htmlType="submit"
              >
                Save
              </Button>
            ) : null}
            {id !== 'new' && session?.user.role !== 'ADMINVIEWER' ? (
              <Link href="/task-management/teams/new">
                <Button
                  icon={<PlusOutlined />}
                  disabled={createOrUpdateTeamLoaading}
                >
                  New
                </Button>
              </Link>
            ) : null}
          </Space>
          <Typography.Title level={3}>Primary Information</Typography.Title>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {id !== 'new' ? (
          <>
            <Divider />
            <Typography.Title level={3}>Team Users</Typography.Title>
            <div className="mb-2 flex justify-between">
              <div />
              {session?.user.role === 'ADMIN' ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setAddNewUserModal(true)}
                >
                  Add new user
                </Button>
              ) : null}
            </div>
            <Table
              size="small"
              bordered
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Sr. No.',
                  render: (_1, _2, index) => index + 1,
                  width: 50
                },
                {
                  title: 'Name',
                  dataIndex: 'user',
                  render: user => user.name
                },
                ...(session?.user.role === 'ADMIN'
                  ? [
                      {
                        title: 'Actions',
                        dataIndex: 'id',
                        render: (id: string) => (
                          <Popconfirm
                            title="Are you sure?"
                            okText="Yes"
                            cancelText="No"
                            onConfirm={async () => {
                              try {
                                await removeTeamUser({ id })
                                notificationApi.success({
                                  message: 'User removed from team'
                                })
                                refetch()
                              } catch (error) {
                                notificationApi.error({
                                  message: 'Error removing user from team'
                                })
                              }
                            }}
                          >
                            <Button
                              icon={<DeleteOutlined />}
                              danger
                              size="small"
                            />
                          </Popconfirm>
                        )
                      }
                    ]
                  : [])
              ]}
              rowKey="id"
              dataSource={team?.users}
            />
          </>
        ) : null}

        <Divider />

        {team ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{team.id}</Descriptions.Item>
            {team.createdBy ? (
              <Descriptions.Item label="Created By">
                <Link href={`/users/${team.createdById}`}>
                  {team.createdBy.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            {team.updatedBy ? (
              <Descriptions.Item label="Updated By">
                <Link href={`/users/${team.updatedById}`}>
                  {team.updatedBy?.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Created At">
              {team.createdAt.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {team.updatedAt.toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      <Modal
        open={addNewUserModal}
        destroyOnClose
        onCancel={() => setAddNewUserModal(false)}
        footer={null}
      >
        <Form
          className="mt-6"
          onFinish={async formData => {
            if (!id || id === 'new') return
            const userIds = formData.userIds.filter(
              (userId: string) =>
                team?.users.every(user => user.user.id !== userId)
            )
            if (!formData.userIds.length)
              return notificationApi.error({
                message: 'Please select atleast one user'
              })
            if (!userIds.length)
              return notificationApi.error({
                message: 'All users are already added to team'
              })
            try {
              await addTeamUsers({
                teamId: id.toString(),
                userIds: formData.userIds.filter(
                  (userId: string) =>
                    team?.users.every(user => user.user.id !== userId)
                )
              })
              notificationApi.success({
                message: 'Users added to team'
              })
              setAddNewUserModal(false)
              await refetch()
            } catch (error) {
              notificationApi.error({
                message: 'Error adding users to team'
              })
            }
          }}
        >
          <Form.Item name="userIds" label="User">
            <Select
              mode="multiple"
              allowClear
              showSearch
              filterOption={false}
              onSearch={search => {
                debouncedUserSearch(search)
              }}
              notFoundContent={
                usersLoading ? (
                  <span className="flex items-center justify-center">
                    <Spin size="small" />
                  </span>
                ) : undefined
              }
              options={users?.users.map(item => ({
                label: (item.name || '') + ' (' + item.email + ')',
                value: item.id
              }))}
              onClear={() => setUserSearch(undefined)}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={addTeamUsersLoading}
            >
              Add
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

export default Team
