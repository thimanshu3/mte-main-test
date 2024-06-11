import {
  DeleteOutlined,
  PlusOutlined,
  RestOutlined,
  SaveOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  Row,
  Table,
  Typography
} from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { ActionRibbon } from '~/components/ActionsRibbon'
import { Layout } from '~/components/Layout'
import { useNotificationApi } from '~/context/notifcationApi'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'
import { handleUndefinedInFormSubmit } from '~/utils/handleUndefinedInFormSubmit'

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerAuthSession(ctx)
  return {
    redirect: !session
      ? {
          destination: '/auth'
        }
      : undefined,
    props: {}
  }
}

const CustomerPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined
  })

  // ? useQuery
  const { data, isLoading, refetch } = api.customers.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )
  const { data: sitesData, isLoading: sitesLoading } =
    api.sites.getAll.useQuery(
      {
        ...variables,
        customerId: id?.toString() || ''
      },
      {
        enabled: !!session && !!id && id !== 'new'
      }
    )

  // ? useMutation
  const { mutateAsync, isLoading: isSaving } =
    api.customers.createOrUpdateOne.useMutation()
  const { mutateAsync: deleteAsync, isLoading: isDeleting } =
    api.customers.deleteOne.useMutation()

  // ? useForm
  const [form] = Form.useForm()

  // ? useEffect
  useEffect(() => {
    if (form) form.resetFields()
  }, [id, form])

  // ? useNotification
  const notificationApi = useNotificationApi()

  return (
    <Layout
      loading={id !== 'new' && isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Customers', link: '/customers' },
        {
          label: id === 'new' ? 'New' : data?.name || 'Loading'
        }
      ]}
      title={`Customer - ${data?.name || id}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            try {
              const res = await mutateAsync({
                ...handleUndefinedInFormSubmit(formData),
                id: id && id !== 'new' ? id.toString() : undefined
              })
              if (id === 'new' && res) {
                router.push(`/customers/${res.id}`)
                notificationApi.success({
                  message: 'Customer created'
                })
              } else {
                refetch()
                notificationApi.success({
                  message: 'Customer updated'
                })
              }
            } catch (err) {
              notificationApi.error({
                message: 'Error saving Customer'
              })
            }
          }}
          layout="vertical"
          initialValues={data}
        >
          <ActionRibbon>
            {session?.user.role !== 'ADMINVIEWER' ? (
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={isSaving}
                htmlType="submit"
              >
                Save
              </Button>
            ) : null}
            {id !== 'new' && session?.user.role !== 'ADMINVIEWER' ? (
              <Link href="/customers/new">
                <Button icon={<PlusOutlined />} disabled={isSaving}>
                  New
                </Button>
              </Link>
            ) : null}
            {id !== 'new' && session?.user.role !== 'ADMINVIEWER' ? (
              <Button
                icon={data?.deletedAt ? <RestOutlined /> : <DeleteOutlined />}
                onClick={async () => {
                  if (!id) return
                  await deleteAsync({
                    id: id.toString(),
                    activate: data?.deletedAt ? true : false
                  })
                  notificationApi.success({
                    message: `Customer ${
                      data?.deletedAt ? 'restored' : 'deleted'
                    }`
                  })
                  refetch()
                }}
                loading={isDeleting}
                danger
              >
                {data?.deletedAt ? 'Restore' : 'Delete'}
              </Button>
            ) : null}
          </ActionRibbon>

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
            <Col span={12}>
              <Form.Item
                name="id2"
                label="ID2"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="address" label="Address">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactName" label="Contact Person Name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactMobile" label="Contact Person Mobile">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactEmail" label="Email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactEmail2" label="Email2">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactEmail3" label="Email3">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
        {data ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
            {data.createdBy ? (
              <Descriptions.Item label="Created By">
                <Link href={`/users/${data.createdById}`}>
                  {data.createdBy.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.updatedBy ? (
              <Descriptions.Item label="Updated By">
                <Link href={`/users/${data.updatedById}`}>
                  {data.updatedBy?.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.deletedBy ? (
              <Descriptions.Item label="Deleted By">
                <Link href={`/users/${data.deletedById}`}>
                  {data.deletedBy.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Created At">
              {data.createdAt.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {data.updatedAt.toLocaleString()}
            </Descriptions.Item>
            {data.deletedAt ? (
              <Descriptions.Item label="Deleted At">
                {data.deletedAt.toLocaleString()}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        ) : null}
        {id !== 'new' ? (
          <>
            <Divider />
            <Typography.Title level={4}>
              Sites ({sitesData?.total || 0})
            </Typography.Title>
            <div className="mb-2 mt-4 flex items-center justify-between">
              <Input.Search
                className="w-96"
                placeholder="Type anything to search..."
                onSearch={searchStr => {
                  setVariables(prev => ({
                    ...prev,
                    page: 1,
                    search: searchStr ? searchStr : undefined
                  }))
                }}
              />
              <Link href={`/customers/${id}/sites/new`}>
                {session?.user.role !== 'ADMINVIEWER' ? (
                  <Button type="primary" icon={<PlusOutlined />}>
                    New
                  </Button>
                ) : null}
              </Link>
            </div>
            <Table
              loading={sitesLoading}
              size="middle"
              bordered
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Sr. No.',
                  render: (_1, _2, i) =>
                    (variables.page - 1) * variables.limit + i + 1
                },
                {
                  title: 'Name',
                  dataIndex: 'name',
                  render: (name, record) => (
                    <Link href={`/customers/${id}/sites/${record.id}`}>
                      <Button type="link">{name}</Button>
                    </Link>
                  )
                },
                {
                  title: 'Created By',
                  dataIndex: 'createdBy',
                  render: createdBy => (
                    <Link href={`/users/${createdBy?.id}`}>
                      {createdBy?.name}
                    </Link>
                  )
                },
                {
                  title: 'Updated By',
                  dataIndex: 'updatedBy',
                  render: updatedBy => (
                    <Link href={`/users/${updatedBy?.id}`}>
                      {updatedBy?.name}
                    </Link>
                  )
                },
                {
                  title: 'Created At',
                  dataIndex: 'createdAt',
                  render: date => date.toLocaleString()
                },
                {
                  title: 'Updated At',
                  dataIndex: 'updatedAt',
                  render: date => date.toLocaleString()
                }
              ]}
              dataSource={sitesData?.sites}
              rowKey="id"
              pagination={{
                current: variables.page,
                pageSize: variables.limit,
                total: sitesData?.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50],
                onChange: (page, limit) => {
                  setVariables(prev => ({
                    ...prev,
                    page,
                    limit
                  }))
                }
              }}
            />
          </>
        ) : null}
      </Card>
    </Layout>
  )
}

export default CustomerPage
