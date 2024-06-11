import {
  DownloadOutlined,
  MailOutlined,
  PhoneOutlined,
  SendOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Input,
  Modal,
  Popover,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
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

const OfferSentToCustomerPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [resendModal, setResendModal] = useState<null | {
    done: boolean
    url?: string
    url2?: string
    medium: {
      email: boolean
      customEmail: string
      whatsapp: boolean
      customWhatsapp: string
      customerEmails: string[]
      customerWhatsappNumbers: string[]
    }
  }>(null)

  // ? useQuery
  const { data, isLoading, refetch } = api.offerSentToCustomer.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id
    }
  )
  const { data: customer, isLoading: customerLoading } =
    api.offerSentToCustomer.getCustomer.useQuery(data?.customer.id || '', {
      enabled:
        !!session &&
        ['ADMIN', 'USER'].includes(session.user.role) &&
        !!resendModal &&
        !!data?.customer.id
    })

  // ? useMutation
  const { mutateAsync: resend, isLoading: resending } =
    api.offerSentToCustomer.resend.useMutation()

  // ? useNotification
  const notificationApi = useNotificationApi()

  // ? useMessage
  const messageApi = useMessageApi()

  const customerEmails = new Set<string>()
  if (customer?.contactEmail) customerEmails.add(customer.contactEmail)
  if (customer?.contactEmail2) customerEmails.add(customer.contactEmail2)
  if (customer?.contactEmail3) customerEmails.add(customer.contactEmail3)

  const customerWhatsappNumbers = new Set<string>()
  if (customer?.contactMobile)
    customerWhatsappNumbers.add(customer.contactMobile)

  return (
    <Layout
      loading={isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        {
          label: 'Offer Sent to Customer',
          link: '/offer-sent-to-customer'
        },
        {
          label: id?.toString() || 'Loading'
        }
      ]}
      title={`Offer Sent to Customer - ${id?.toString()}`}
    >
      <Card className="my-2">
        {data && ['ADMIN', 'USER'].includes(session?.user.role || '') ? (
          <Button
            className="my-2"
            type="primary"
            onClick={() =>
              setResendModal({
                done: false,
                medium: {
                  email: true,
                  customEmail: '',
                  whatsapp: true,
                  customWhatsapp: '',
                  customerEmails: [],
                  customerWhatsappNumbers: []
                }
              })
            }
          >
            Resend
          </Button>
        ) : null}
        {data ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
            <Descriptions.Item label="Customer">
              <Link href={`/customers/${data.customer.id}`}>
                {data.customer.name}
              </Link>
            </Descriptions.Item>
            {data.site ? (
              <Descriptions.Item label="Site">
                <Link
                  href={`/customers/${data.customer.id}/sites/${data.site.id}`}
                >
                  {data.site.name}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.prNumberAndName ? (
              <Descriptions.Item label="PR Number and Name">
                {data.prNumberAndName}
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Email Sent?">
              <Tag color={data.emailSent ? 'green' : 'red'}>
                {data.emailSent ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="WhatsApp Sent?">
              <Tag color={data.whatsappSent ? 'green' : 'red'}>
                {data.whatsappSent ? 'Yes' : 'No'}
              </Tag>
            </Descriptions.Item>
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
            {data.lastResendAt ? (
              <Descriptions.Item label="Last Resend At">
                {data.lastResendAt.toLocaleString()}
              </Descriptions.Item>
            ) : null}
            {data.resendHistory.length ? (
              <Descriptions.Item label="Resend Count">
                {data.resendHistory.length}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        ) : null}
        <Divider />
        <Typography.Title level={3}>Inquiry Items</Typography.Title>
        <Table
          size="small"
          bordered
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Sr. No.',
              render: (_1, row, index) => (
                <Link href={`/inquiries/${row.id}`}>{index + 1}</Link>
              )
            },
            {
              title: 'Date',
              dataIndex: 'date',
              render: date => date.toLocaleString()
            },
            {
              title: 'Site',
              dataIndex: 'site',
              render: site => site?.name
            },
            {
              title: 'PR Number and Name',
              dataIndex: 'prNumberAndName'
            },
            {
              title: 'Sales Description',
              dataIndex: 'salesDescription'
            },
            {
              title: 'Sales Unit',
              dataIndex: 'salesUnit',
              render: salesUnit => salesUnit?.name
            },
            {
              title: 'Quantity',
              dataIndex: 'quantity'
            },
            {
              title: 'Size/Specification',
              dataIndex: 'size'
            },
            {
              title: 'Customer Price',
              dataIndex: 'customerPrice'
            },
            {
              title: 'Purchase Description',
              dataIndex: 'purchaseDescription'
            },
            {
              title: 'Purchase Unit',
              dataIndex: 'purchaseUnit',
              render: purchaseUnit => purchaseUnit?.name
            },
            {
              title: 'Supplier Price',
              dataIndex: 'supplierPrice'
            },
            {
              title: 'Margin %',
              dataIndex: 'margin'
            },
            {
              title: 'Estimated Delivery Days',
              dataIndex: 'estimatedDeliveryDays'
            },
            {
              title: 'Result',
              dataIndex: 'result',
              render: result => result?.name
            },
            {
              title: 'FPR',
              dataIndex: 'frontPersonRepresentative',
              render: frontPersonRepresentative => (
                <Popover
                  content={
                    <Space direction="vertical">
                      {frontPersonRepresentative.email ? (
                        <Space>
                          <Link
                            href={`mailto:${frontPersonRepresentative.email}`}
                          >
                            <Button size="small" icon={<MailOutlined />} />
                          </Link>
                          <Typography.Text>
                            {frontPersonRepresentative.email}
                          </Typography.Text>
                        </Space>
                      ) : null}
                      {frontPersonRepresentative.mobile ? (
                        <Space>
                          <Link
                            href={`tel:${frontPersonRepresentative.mobile}`}
                          >
                            <Button size="small" icon={<PhoneOutlined />} />
                          </Link>
                          <Typography.Text>
                            {frontPersonRepresentative.mobile}
                          </Typography.Text>
                        </Space>
                      ) : null}
                      {frontPersonRepresentative.whatsapp ? (
                        <Space>
                          <Typography.Text>WhatsApp: </Typography.Text>
                          <Typography.Text>
                            {frontPersonRepresentative.whatsapp}
                          </Typography.Text>
                        </Space>
                      ) : null}
                    </Space>
                  }
                >
                  <Link href={`/users/${frontPersonRepresentative?.id}`}>
                    {frontPersonRepresentative?.name}
                  </Link>
                </Popover>
              )
            }
          ]}
          dataSource={data?.inquiries.map(i => i.inquiry)}
          rowKey="id"
          pagination={false}
        />
        {data?.resendHistory?.length ? (
          <div>
            <Divider />
            <Typography.Title level={3}>
              Resend History ({data.resendHistory.length})
            </Typography.Title>
            <Table
              size="small"
              bordered
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Sr. No.',
                  render: (_1, _2, index) => index + 1
                },
                {
                  title: 'Date',
                  dataIndex: 'createdAt',
                  render: date => date.toLocaleString()
                },
                {
                  title: 'Created By',
                  dataIndex: 'createdBy',
                  render: createdBy => (
                    <Link href={`/users/${createdBy?.id}`}>
                      {createdBy?.name}
                    </Link>
                  )
                }
              ]}
              dataSource={data.resendHistory}
              rowKey="id"
            />
          </div>
        ) : null}
      </Card>
      <Modal
        open={!!resendModal}
        onCancel={() => setResendModal(null)}
        destroyOnClose
        footer={null}
      >
        {resendModal?.done ? (
          <Space direction="vertical">
            <Space>
              <Result
                status={resendModal.medium.email ? 'success' : 'error'}
                title="Email"
              />
              <Result
                status={resendModal.medium.whatsapp ? 'success' : 'error'}
                title="WhatsApp"
              />
            </Space>
            {resendModal.url ? (
              <Button
                type="primary"
                onClick={() => window.open(resendModal.url)}
                icon={<DownloadOutlined />}
              >
                Download Excel
              </Button>
            ) : null}
            {resendModal.url2 ? (
              <Button
                type="primary"
                onClick={() => window.open(resendModal.url2)}
                icon={<DownloadOutlined />}
              >
                Download PDF
              </Button>
            ) : null}
          </Space>
        ) : customerLoading ? (
          <Typography.Text>Loading...</Typography.Text>
        ) : (
          <Space direction="vertical">
            <Checkbox
              checked={resendModal?.medium.email}
              onChange={e =>
                setResendModal(prev => ({
                  done: false,
                  medium: {
                    email: e.target.checked,
                    customEmail: prev?.medium.customEmail || '',
                    customerEmails: prev?.medium.customerEmails || [],
                    whatsapp: prev?.medium.whatsapp ?? true,
                    customWhatsapp: prev?.medium.customWhatsapp || '',
                    customerWhatsappNumbers:
                      prev?.medium.customerWhatsappNumbers || []
                  }
                }))
              }
            >
              Email
            </Checkbox>
            <Checkbox
              checked={resendModal?.medium.whatsapp}
              onChange={e =>
                setResendModal(prev => ({
                  done: false,
                  medium: {
                    email: prev?.medium.email ?? true,
                    customEmail: prev?.medium.customEmail || '',
                    customerEmails: prev?.medium.customerEmails || [],
                    whatsapp: e.target.checked,
                    customWhatsapp: prev?.medium.customWhatsapp || '',
                    customerWhatsappNumbers:
                      prev?.medium.customerWhatsappNumbers || []
                  }
                }))
              }
            >
              WhatsApp
            </Checkbox>
            {resendModal?.medium.email ? (
              <Space direction="vertical" className="mt-3">
                <Select
                  className="w-72"
                  placeholder="Select customer emails"
                  mode="multiple"
                  options={Array.from(customerEmails).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={resendModal?.medium.customerEmails}
                  onChange={customerEmails =>
                    setResendModal(prev => ({
                      done: false,
                      medium: {
                        email: prev?.medium.email ?? true,
                        customEmail: prev?.medium.customEmail || '',
                        customerEmails,
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: prev?.medium.customWhatsapp || '',
                        customerWhatsappNumbers:
                          prev?.medium.customerWhatsappNumbers || []
                      }
                    }))
                  }
                />
                <Input
                  className="w-72"
                  type="email"
                  placeholder="or enter custom email"
                  value={resendModal.medium.customEmail}
                  onChange={e =>
                    setResendModal(prev => ({
                      done: false,
                      medium: {
                        email: prev?.medium.email ?? true,
                        customEmail: e.target.value,
                        customerEmails: prev?.medium.customerEmails || [],
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: prev?.medium.customWhatsapp || '',
                        customerWhatsappNumbers:
                          prev?.medium.customerWhatsappNumbers || []
                      }
                    }))
                  }
                />
              </Space>
            ) : null}
            {resendModal?.medium.whatsapp ? (
              <Space direction="vertical" className="mt-3">
                <Select
                  className="w-72"
                  placeholder="Select customer whatsapp numbers"
                  mode="multiple"
                  options={Array.from(customerWhatsappNumbers).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={resendModal?.medium.customerWhatsappNumbers}
                  onChange={customerWhatsappNumbers =>
                    setResendModal(prev => ({
                      done: false,
                      medium: {
                        email: prev?.medium.email ?? true,
                        customEmail: prev?.medium.customEmail || '',
                        customerEmails: prev?.medium.customerEmails || [],
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: prev?.medium.customWhatsapp || '',
                        customerWhatsappNumbers
                      }
                    }))
                  }
                />
                <Input
                  className="w-72"
                  placeholder="or enter custom whatsapp number"
                  value={resendModal.medium.customWhatsapp}
                  onChange={e =>
                    setResendModal(prev => ({
                      done: false,
                      medium: {
                        email: prev?.medium.email ?? true,
                        customEmail: prev?.medium.customEmail || '',
                        customerEmails: prev?.medium.customerEmails || [],
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: e.target.value,
                        customerWhatsappNumbers:
                          prev?.medium.customerWhatsappNumbers || []
                      }
                    }))
                  }
                />
              </Space>
            ) : null}
            <Button
              className="mt-2"
              type="primary"
              icon={<SendOutlined />}
              loading={resending}
              onClick={async () => {
                if (!id || !resendModal) return

                if (
                  resendModal.medium.email &&
                  !resendModal.medium.customerEmails.length &&
                  !resendModal.medium.customEmail
                )
                  return messageApi.error(
                    'Select or enter atleast one customer email'
                  )
                if (
                  resendModal.medium.whatsapp &&
                  !resendModal.medium.customerWhatsappNumbers.length &&
                  !resendModal.medium.customWhatsapp
                )
                  return messageApi.error(
                    'Select or enter atleast one customer whatsapp number'
                  )

                const customerEmails = new Set(
                  resendModal.medium.customerEmails
                )
                if (resendModal.medium.customEmail)
                  customerEmails.add(resendModal.medium.customEmail)
                const customerWhatsappNumbers = new Set(
                  resendModal.medium.customerWhatsappNumbers
                )
                if (resendModal.medium.customWhatsapp)
                  customerEmails.add(resendModal.medium.customWhatsapp)

                const res = await resend({
                  id: id.toString(),
                  timezoneOffset: new Date().getTimezoneOffset(),
                  email: resendModal.medium.email,
                  customerEmails: [...customerEmails],
                  whatsapp: resendModal.medium.whatsapp,
                  customerWhatsappNumbers: [...customerWhatsappNumbers]
                })

                if (res.success && res.url) {
                  notificationApi.success({
                    message: 'Inquiries resent to customer'
                  })
                  setResendModal({
                    done: true,
                    url: res.url,
                    url2: res.url2,
                    medium: {
                      email: res.emailSent,
                      customEmail: '',
                      customerEmails: [],
                      whatsapp: res.whatsappSent,
                      customWhatsapp: '',
                      customerWhatsappNumbers: []
                    }
                  })
                  refetch()
                } else
                  notificationApi.error({
                    message: res.message || 'Something went wrong'
                  })

                return
              }}
            >
              Send
            </Button>
          </Space>
        )}
      </Modal>
    </Layout>
  )
}

export default OfferSentToCustomerPage
