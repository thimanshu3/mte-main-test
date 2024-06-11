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
  Form,
  Input,
  Row,
  Select,
  Spin
} from 'antd'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
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
      : !['ADMIN', 'ADMINVIEWER'].includes(session.user.role)
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const UserPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [supplierSearch, setSupplierSearch] = useState<string | undefined>(
    undefined
  )
  const [enableSupplierSelect, setEnableSupplierSelect] = useState(false)

  // ? useQuery
  const { data, isLoading, refetch } = api.users.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )
  const { data: suppliers, isLoading: suppliersLoading } =
    api.suppliers.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: supplierSearch
      },
      { enabled: !!session }
    )

  // ? useMutation
  const { mutateAsync, isLoading: isSaving } =
    api.users.createOrUpdateOne.useMutation()
  const { mutateAsync: deactivateUser, isLoading: isDeactivating } =
    api.users.deactivateOne.useMutation()

  // ? useForm
  const [form] = Form.useForm()

  // ? useEffect
  useEffect(() => {
    if (form) form.resetFields()
  }, [id, form])

  useEffect(() => {
    if (id === 'new') {
      setSupplierSearch(undefined)
      setEnableSupplierSelect(false)
      return
    }
    if (!data) return

    if (data.role === 'SUPPLIER') {
      setEnableSupplierSelect(true)
      if (data.supplierId) setSupplierSearch(data.supplierId)
    }
  }, [id, data])

  // ? useNotification
  const notificationApi = useNotificationApi()

  // ? useMemo
  const debouncedSupplierSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSupplierSearch(search || undefined)
      }, 500),
    []
  )

  return (
    <Layout
      loading={id !== 'new' && isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Users', link: '/users' },
        {
          label: id === 'new' ? 'New' : data?.name || 'Loading'
        }
      ]}
      title={`User - ${data?.name || id}`}
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
              if (id === 'new') {
                router.push(`/users/${res.id}`)
                notificationApi.success({
                  message: 'User created'
                })
              } else {
                refetch()
                notificationApi.success({
                  message: 'User updated'
                })
              }
            } catch (err) {
              notificationApi.error({
                message: 'Error saving User'
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
              <Link href="/users/new">
                <Button icon={<PlusOutlined />} disabled={isSaving}>
                  New
                </Button>
              </Link>
            ) : null}
            {id !== 'new' && session?.user.role !== 'ADMINVIEWER' ? (
              <Button
                icon={!data?.active ? <RestOutlined /> : <DeleteOutlined />}
                onClick={async () => {
                  if (!id) return
                  const r = await deactivateUser({
                    id: id.toString(),
                    activate: data?.active ? false : true
                  })
                  if (r) {
                    notificationApi.success({
                      message: `User ${
                        data?.active ? 'deactivated' : 'activated'
                      }`
                    })
                    refetch()
                  }
                }}
                loading={isDeactivating}
                danger
              >
                {!data?.active ? 'Activate' : 'Deactivate'}
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
                name="email"
                label="Email"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="mobile"
                label="Mobile"
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
              <Form.Item name="whatsapp" label="Whatsapp">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <Select
                  showSearch
                  options={[
                    {
                      value: 'ADMIN'
                    },
                    {
                      value: 'ADMINVIEWER'
                    },
                    {
                      value: 'USER'
                    },
                    {
                      value: 'USERVIEWER'
                    },
                    {
                      value: 'FULFILMENT'
                    },
                    {
                      value: 'SUPPLIER'
                    }
                  ]}
                  onChange={val => {
                    form.setFieldValue('supplierId', null)
                    if (val === 'SUPPLIER') setEnableSupplierSelect(true)
                    else setEnableSupplierSelect(false)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label="Password"
                rules={
                  id === 'new'
                    ? [
                        {
                          required: true
                        }
                      ]
                    : undefined
                }
              >
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={12}>
              {enableSupplierSelect ? (
                <Form.Item
                  name="supplierId"
                  label="Supplier"
                  rules={[
                    {
                      required: true
                    }
                  ]}
                >
                  <Select
                    allowClear
                    showSearch
                    filterOption={false}
                    onSearch={search => {
                      debouncedSupplierSearch(search)
                    }}
                    notFoundContent={
                      suppliersLoading ? (
                        <span className="flex items-center justify-center">
                          <Spin size="small" />
                        </span>
                      ) : null
                    }
                    options={suppliers?.suppliers.map(item => ({
                      label: item.name,
                      value: item.id
                    }))}
                    onClear={() => setSupplierSearch(undefined)}
                  />
                </Form.Item>
              ) : null}
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
          </Descriptions>
        ) : null}
      </Card>
    </Layout>
  )
}

export default UserPage
