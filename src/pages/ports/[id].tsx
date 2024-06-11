import {
  DeleteOutlined,
  PlusOutlined,
  RestOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Form, Input, Row } from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { ActionRibbon } from '~/components/ActionsRibbon'
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
      : undefined,
    props: {}
  }
}

const PortPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useQuery
  const { data, isLoading, refetch } = api.ports.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )

  // ? useMutation
  const { mutateAsync, isLoading: isSaving } =
    api.ports.createOrUpdateOne.useMutation()
  const { mutateAsync: deleteAsync, isLoading: isDeleting } =
    api.ports.deleteOne.useMutation()

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
        { label: 'Ports', link: '/ports' },
        {
          label: id === 'new' ? 'New' : data?.name || 'Loading'
        }
      ]}
      title={`Port - ${data?.name || id}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            try {
              const res = await mutateAsync({
                id: id && id !== 'new' ? id.toString() : undefined,
                name: formData.name,
                line1: formData.line1,
                line2: formData.line2
              })
              if (id === 'new') {
                router.push(`/ports/${res.id}`)
                notificationApi.success({
                  message: 'Port created'
                })
              } else {
                refetch()
                notificationApi.success({
                  message: 'Port updated'
                })
              }
            } catch (err) {
              notificationApi.error({
                message: 'Error saving Port'
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
              <Link href="/ports/new">
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
                    message: `Port ${data?.deletedAt ? 'restored' : 'deleted'}`
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
              <Form.Item name="line1" label="Line 1">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="line2" label="Line 2">
                <Input.TextArea />
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
      </Card>
    </Layout>
  )
}

export default PortPage
