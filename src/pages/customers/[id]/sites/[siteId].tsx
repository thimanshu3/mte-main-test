import { PlusOutlined, SaveOutlined } from '@ant-design/icons'
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

const SitePage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id, siteId } = router.query

  // ? useQuery
  const { data: customer, isLoading: customerIsLoading } =
    api.customers.getOneMini.useQuery(
      {
        id: id?.toString() || ''
      },
      {
        enabled: !!session && !!id
      }
    )
  const { data, isLoading, refetch } = api.sites.getOne.useQuery(
    {
      id: siteId?.toString() || ''
    },
    {
      enabled: !!session && !!siteId && siteId !== 'new'
    }
  )

  // ? useMutation
  const { mutateAsync, isLoading: isSaving } =
    api.sites.createOrUpdateOne.useMutation()

  // ? useForm
  const [form] = Form.useForm()

  // ? useEffect
  useEffect(() => {
    if (form) form.resetFields()
  }, [siteId, form])

  // ? useNotification
  const notificationApi = useNotificationApi()

  return (
    <Layout
      loading={(siteId !== 'new' && isLoading) || customerIsLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Customers', link: '/customers' },
        {
          label: customer?.name || 'Loading',
          link: `/customers/${id}`
        },
        {
          label: 'Sites',
          link: `/customers/${id}`
        },
        {
          label: siteId === 'new' ? 'New' : data?.name || 'Loading'
        }
      ]}
      title={`Site - ${data?.name || siteId}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            if (!id) return
            try {
              const res = await mutateAsync({
                id: siteId && siteId !== 'new' ? siteId.toString() : undefined,
                customerId: id.toString(),
                name: formData.name
              })
              if (siteId === 'new') {
                router.push(`/customers/${id}/sites/${res.id}`)
                notificationApi.success({
                  message: 'Site created'
                })
              } else {
                refetch()
                notificationApi.success({
                  message: 'Site updated'
                })
              }
            } catch (err: any) {
              notificationApi.error({
                message: 'Error saving Site'
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
            {siteId !== 'new' && session?.user.role !== 'ADMINVIEWER' ? (
              <Link href={`/customers/${id}/sites/new`}>
                <Button icon={<PlusOutlined />} disabled={isSaving}>
                  New
                </Button>
              </Link>
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
            <Descriptions.Item label="Created At">
              {data.createdAt.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {data.updatedAt.toLocaleString()}
            </Descriptions.Item>
            {data.customer ? (
              <Descriptions.Item label="Customer">
                <Link href={`/customers/${data.customer.id}`}>
                  {data.customer.name}
                </Link>
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        ) : null}
      </Card>
    </Layout>
  )
}

export default SitePage
