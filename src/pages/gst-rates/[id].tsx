import {
  DeleteOutlined,
  PlusOutlined,
  RestOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { Button, Card, Col, Descriptions, Form, InputNumber, Row } from 'antd'
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

const GstRatePage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useQuery
  const { data, isLoading, refetch } = api.gstRates.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )

  // ? useMutation
  const { mutateAsync, isLoading: isSaving } =
    api.gstRates.createOne.useMutation()
  const { mutateAsync: deleteAsync, isLoading: isDeleting } =
    api.gstRates.deleteOne.useMutation()

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
        { label: 'GST Rates', link: '/gst-rates' },
        {
          label: id === 'new' ? 'New' : data?.rate.toString() || 'Loading'
        }
      ]}
      title={`GST Rate - ${data?.rate.toString() || id}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            if (id !== 'new') return
            try {
              const res = await mutateAsync({
                rate: formData.rate
              })
              router.push(`/gst-rates/${res.id}`)
              notificationApi.success({
                message: 'GST Rate created'
              })
            } catch (err) {
              notificationApi.error({
                message: 'Error creating GST Rate'
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
              <Link href="/gst-rates/new">
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
                    message: `GST Rate ${
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
                name="rate"
                label="Rate"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <InputNumber className="w-full" readOnly={id !== 'new'} />
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

export default GstRatePage
