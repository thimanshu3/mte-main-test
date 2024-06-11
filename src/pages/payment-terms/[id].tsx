import {
  DeleteOutlined,
  EditOutlined,
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
  InputNumber,
  Row,
  Space,
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
import { useMessageApi } from '~/context/messageApi'
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
      : undefined,
    props: {}
  }
}

type Condition = {
  order: number
  percentage: number
  description?: string | null
  days?: number | null
  edit?: boolean
}

const PaymentTermPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [conditions, setConditions] = useState<Condition[]>([])

  // ? useQuery
  const { data, isLoading, refetch } = api.paymentTerms.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )

  // ? useMutation
  const { mutateAsync, isLoading: isSaving } =
    api.paymentTerms.createOne.useMutation()
  const { mutateAsync: deleteAsync, isLoading: isDeleting } =
    api.paymentTerms.deleteOne.useMutation()

  // ? useForm
  const [form] = Form.useForm()

  // ? useEffect
  useEffect(() => {
    if (form) form.resetFields()
  }, [id, form])

  useEffect(() => {
    if (data)
      setConditions(
        data.conditions.map(c => ({
          order: c.order,
          percentage: c.percentage,
          description: c.description,
          days: c.days
        }))
      )
    else setConditions([])
  }, [data])

  // ? useNotification
  const notificationApi = useNotificationApi()

  // ? useMessage
  const messageApi = useMessageApi()

  return (
    <Layout
      loading={id !== 'new' && isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Payment Terms', link: '/payment-terms' },
        {
          label: id === 'new' ? 'New' : data?.name || 'Loading'
        }
      ]}
      title={`Payment Term - ${data?.name || id}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            if (conditions.length) {
              for (const c of conditions) {
                if (c.percentage <= 0) {
                  messageApi.error('Percentage must be greater than 0')
                  return
                }

                if (typeof c.days === 'number' && c.days < 0) {
                  messageApi.error('Days must be greater than 0')
                  return
                }
              }

              const totalPercentage = conditions
                .reduce((acc, cur) => acc + cur.percentage, 0)
                .toFixed()
              if (totalPercentage !== '100') {
                messageApi.error('Total Percentage must be 100')
                return
              }
            }

            try {
              const res = await mutateAsync({
                name: formData.name,
                conditions
              })
              router.push(`/payment-terms/${res.id}`)
              notificationApi.success({
                message: 'Payment Term created'
              })
            } catch (err: any) {
              notificationApi.error({
                message: 'Error creating Payment Term'
              })
            }
          }}
          layout="vertical"
          initialValues={data}
        >
          <ActionRibbon>
            {id === 'new' && session?.user.role !== 'ADMINVIEWER' ? (
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
              <Link href="/payment-terms/new">
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
                    message: `Payment Term ${
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
                <Input readOnly={id !== 'new'} />
              </Form.Item>
            </Col>
          </Row>

          <Row>
            <Col span={24}>
              <Divider />
              <Typography.Title level={4}>Conditions</Typography.Title>
            </Col>
          </Row>

          <Row>
            <Col span={24}>
              <Table
                size="small"
                bordered
                scroll={{ x: 800 }}
                columns={[
                  {
                    title: 'Sr. No.',
                    dataIndex: 'order'
                  },
                  {
                    title: 'Percentage',
                    render: (_, record) =>
                      !record.edit ? (
                        `${record.percentage}%`
                      ) : (
                        <InputNumber
                          value={record.percentage}
                          onChange={per =>
                            setConditions(prev =>
                              prev.map(p =>
                                p.order === record.order
                                  ? { ...p, percentage: per || 0 }
                                  : p
                              )
                            )
                          }
                        />
                      )
                  },
                  {
                    title: 'Condition Description',
                    render: (_, record) =>
                      !record.edit ? (
                        record.description
                      ) : (
                        <Input
                          value={record.description || undefined}
                          onChange={e =>
                            setConditions(prev =>
                              prev.map(p =>
                                p.order === record.order
                                  ? { ...p, description: e.target.value }
                                  : p
                              )
                            )
                          }
                        />
                      )
                  },
                  {
                    title: 'Days',
                    render: (_, record) =>
                      !record.edit ? (
                        record.days
                      ) : (
                        <InputNumber
                          value={record.days}
                          onChange={d =>
                            setConditions(prev =>
                              prev.map(p =>
                                p.order === record.order
                                  ? { ...p, days: d || 0 }
                                  : p
                              )
                            )
                          }
                        />
                      )
                  },
                  ...(id === 'new'
                    ? [
                        {
                          title: 'Actions',
                          render: (_: any, record: any) => (
                            <Space>
                              <Button
                                type="primary"
                                icon={
                                  !record.edit ? (
                                    <EditOutlined />
                                  ) : (
                                    <SaveOutlined />
                                  )
                                }
                                onClick={() =>
                                  setConditions(prev =>
                                    prev.map(p =>
                                      p.order === record.order
                                        ? { ...p, edit: !p.edit }
                                        : p
                                    )
                                  )
                                }
                              />
                              <Button
                                type="primary"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() =>
                                  setConditions(prev =>
                                    prev
                                      .filter(p => p.order !== record.order)
                                      .map((p, i) => ({ ...p, order: i + 1 }))
                                  )
                                }
                              />
                            </Space>
                          )
                        }
                      ]
                    : [])
                ]}
                loading={id !== 'new' && isLoading}
                dataSource={conditions}
                rowKey="order"
                caption={
                  id === 'new' ? (
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setConditions(prev => [
                          ...prev,
                          { order: prev.length + 1, percentage: 0, edit: true }
                        ])
                      }}
                    >
                      New
                    </Button>
                  ) : undefined
                }
              />
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
      </Card>
    </Layout>
  )
}

export default PaymentTermPage
