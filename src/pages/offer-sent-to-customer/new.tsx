import {
  DownloadOutlined,
  FilePdfOutlined,
  SendOutlined
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  Radio,
  Result,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Typography
} from 'antd'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
      : !['ADMIN', 'USER'].includes(session.user.role)
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const NewOfferSentToCustomerPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [step, setStep] = useState(0)
  const [newState, setNewState] = useState<{
    customerId?: string
    siteId?: string
    prNumberAndName?: string
    selectedInquiries?: string[]
    medium: {
      email: boolean
      whatsapp: boolean
      customEmail: string
      customerEmails: string[]
      customWhatsapp: string
      customerWhatsappNumbers: string[]
      remarks?: string
    }
  }>({
    medium: {
      email: true,
      whatsapp: true,
      customEmail: '',
      customerEmails: [],
      customWhatsapp: '',
      customerWhatsappNumbers: []
    }
  })
  const [customerSearch, setCustomerSearch] = useState<string | undefined>(
    undefined
  )
  const [dataSent, setDataSent] = useState({
    id: '',
    url: '',
    url2: '',
    emailSent: false,
    whatsappSent: false
  })

  // ? useQuery
  const { data: customers, isLoading: customersLoading } =
    api.customers.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: customerSearch
      },
      { enabled: !!session }
    )
  const { data: sites } = api.offerSentToCustomer.getSites.useQuery(
    {
      customerId: newState.customerId || ''
    },
    { enabled: !!session && !!newState.customerId }
  )
  const { data: prNumberAndNames } =
    api.offerSentToCustomer.getPrNumber.useQuery(
      {
        customerId: newState.customerId || '',
        siteId: newState.siteId
      },
      {
        enabled: !!session && !!newState.customerId
      }
    )
  const { data: inquiries, isLoading: inquiriesLoading } =
    api.offerSentToCustomer.getInquiries.useQuery(
      {
        customerId: newState.customerId || '',
        siteId: newState.siteId,
        prNumberAndName: newState.prNumberAndName
      },
      { enabled: !!session && !!newState.customerId && step === 1 }
    )
  const { data: customer } = api.offerSentToCustomer.getCustomer.useQuery(
    newState.customerId || '',
    {
      enabled: !!session && !!newState.customerId && step === 2
    }
  )
  const { data: readyCustomers, isLoading: readyCustomersLoading } =
    api.offerSentToCustomer.getReadyCustomers.useQuery(undefined, {
      enabled: !!session
    })

  // ? useMutation
  const { mutateAsync, isLoading } =
    api.offerSentToCustomer.previewOrCreate.useMutation()

  // ? useEffect
  useEffect(() => {
    if (inquiries?.inquiries) {
      setNewState(prev => ({
        ...prev,
        selectedInquiries: inquiries.inquiries.map(i => i.id)
      }))
    }
  }, [inquiries?.inquiries])

  // ? useMemo
  const debouncedCustomerSearch = useMemo(
    () =>
      debounce((search: string) => {
        setCustomerSearch(search || undefined)
      }, 500),
    []
  )

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

  const lossInquiriesCount = inquiries?.inquiries.reduce((total, inq) => {
    if ((inq.customerPrice || 0) < (inq.supplierPrice || 0)) return total + 1
    return total
  }, 0)

  const uniqueRemarks = new Set<string>()
  if (step === 3 && (newState.medium.email || newState.medium.whatsapp))
    inquiries?.inquiries.forEach(inquiry => {
      if (
        newState.selectedInquiries?.includes(inquiry.id) &&
        inquiry.emailForCustomerRemarks
      )
        uniqueRemarks.add(inquiry.emailForCustomerRemarks)
    })

  return (
    <Layout
      breadcrumbs={[
        { label: 'Home', link: '/' },
        {
          label: 'Offer Sent to Customer',
          link: '/offer-sent-to-customer'
        },
        {
          label: 'New'
        }
      ]}
      title="Offer Sent to Customer - new"
    >
      <Card>
        <Steps
          current={step}
          items={[
            {
              title: 'Customer'
            },
            {
              title: 'Inquiries'
            },
            {
              title: 'Medium of Communication'
            },
            {
              title: 'Preview and Send'
            },
            {
              title: 'Finish'
            }
          ]}
        />
        <div className="mb-12" />
        {step === 0 ? (
          <div>
            <Space direction="vertical">
              <Select
                className="w-72"
                placeholder="Select Customer"
                showSearch
                filterOption={false}
                onSearch={search => {
                  debouncedCustomerSearch(search)
                }}
                notFoundContent={
                  customersLoading ? (
                    <span className="flex items-center justify-center">
                      <Spin size="small" />
                    </span>
                  ) : null
                }
                options={customers?.customers.map(item => ({
                  label: item.name,
                  value: item.id
                }))}
                value={newState.customerId}
                onChange={val =>
                  setNewState({
                    customerId: val || undefined,
                    siteId: undefined,
                    prNumberAndName: undefined,
                    medium: {
                      email: true,
                      whatsapp: true,
                      customEmail: '',
                      customWhatsapp: '',
                      customerEmails: [],
                      customerWhatsappNumbers: []
                    }
                  })
                }
              />
              <Select
                disabled={!newState.customerId}
                allowClear
                placeholder="Select Site"
                className="w-36"
                showSearch
                options={sites?.map(item => ({
                  label: item.name,
                  value: item.id
                }))}
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                value={newState.siteId}
                onChange={value =>
                  setNewState(prev => ({
                    customerId: prev.customerId,
                    siteId: value || undefined,
                    prNumberAndName: undefined,
                    medium: {
                      email: true,
                      whatsapp: true,
                      customEmail: '',
                      customWhatsapp: '',
                      customerEmails: [],
                      customerWhatsappNumbers: []
                    }
                  }))
                }
              />
              <Select
                disabled={!newState.customerId}
                allowClear
                placeholder="Select PR Number and Name"
                className="w-36"
                showSearch
                options={prNumberAndNames?.map(item => ({
                  label: item,
                  value: item
                }))}
                value={newState.prNumberAndName}
                onChange={value =>
                  setNewState(prev => ({
                    customerId: prev.customerId,
                    siteId: prev.siteId,
                    prNumberAndName: value || undefined,
                    medium: {
                      email: true,
                      whatsapp: true,
                      customEmail: '',
                      customWhatsapp: '',
                      customerEmails: [],
                      customerWhatsappNumbers: []
                    }
                  }))
                }
              />
              <Button
                className="mt-4 w-fit"
                disabled={
                  !(
                    newState.customerId &&
                    (newState.siteId || newState.prNumberAndName)
                  )
                }
                type="primary"
                onClick={() => {
                  setStep(1)
                }}
              >
                Next
              </Button>
            </Space>
            <Divider />
            <Typography.Title level={5}>
              Ready Customers ({readyCustomers?.length})
            </Typography.Title>
            <Table
              size="small"
              bordered
              scroll={{ x: 800 }}
              loading={readyCustomersLoading}
              columns={[
                {
                  title: 'Customer',
                  dataIndex: 'name'
                },
                {
                  title: 'No. of inquiries',
                  dataIndex: 'count'
                }
              ]}
              dataSource={readyCustomers}
              rowKey="id"
            />
          </div>
        ) : null}
        {step === 1 ? (
          <>
            {(inquiries?.totalAvailable || 0) -
            (inquiries?.inquiries.length || 0) ? (
              <Alert
                type="warning"
                message={`Some inquiries (${
                  (inquiries?.totalAvailable || 0) -
                  (inquiries?.inquiries.length || 0)
                }) isn't shown below as they are not ready to be sent to customer`}
                className="my-2"
              />
            ) : null}
            {lossInquiriesCount ? (
              <Alert
                type="warning"
                message={`Some inquiries (${lossInquiriesCount}) are in loss`}
                className="my-2"
              />
            ) : null}
            <Typography.Title level={5}>
              {newState.selectedInquiries?.length} Inquiries Selected
            </Typography.Title>
            <Table
              loading={inquiriesLoading}
              size="middle"
              bordered
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'date',
                  render: date => date.toLocaleDateString()
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
                  title: 'Supplier',
                  dataIndex: 'supplier',
                  render: supplier => supplier?.name
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
                  title: 'FPR',
                  dataIndex: 'frontPersonRepresentative',
                  render: fpr => fpr?.name
                }
              ]}
              dataSource={inquiries?.inquiries}
              rowKey="id"
              pagination={{
                showSizeChanger: true
              }}
              rowSelection={{
                selectedRowKeys: newState.selectedInquiries,
                onChange: selectedRowKeys =>
                  setNewState(prev => ({
                    ...prev,
                    selectedInquiries: selectedRowKeys.map(key =>
                      key.toString()
                    )
                  }))
              }}
            />
            <Space>
              <Button onClick={() => setStep(0)}>Previous</Button>
              <Button
                type="primary"
                onClick={() => {
                  setStep(2)
                }}
                disabled={!newState.selectedInquiries?.length}
              >
                Next
              </Button>
            </Space>
          </>
        ) : null}
        {step === 2 ? (
          <div className="flex flex-col gap-2">
            <Checkbox
              checked={newState.medium.email}
              onChange={e =>
                setNewState(prev => ({
                  ...prev,
                  medium: {
                    ...prev.medium,
                    email: e.target.checked
                  }
                }))
              }
            >
              Email
            </Checkbox>
            <Checkbox
              checked={newState.medium.whatsapp}
              onChange={e =>
                setNewState(prev => ({
                  ...prev,
                  medium: {
                    ...prev.medium,
                    whatsapp: e.target.checked
                  }
                }))
              }
            >
              WhatsApp
            </Checkbox>
            {newState.medium.email ? (
              <Space direction="vertical" className="mt-3">
                <Select
                  className="w-72"
                  placeholder="Select customer emails"
                  mode="multiple"
                  options={Array.from(customerEmails).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={newState.medium.customerEmails}
                  onChange={customerEmails =>
                    setNewState(prev => ({
                      ...prev,
                      medium: {
                        ...prev.medium,
                        customerEmails
                      }
                    }))
                  }
                />
                <Input
                  className="w-72"
                  type="email"
                  placeholder="or enter custom email"
                  value={newState.medium.customEmail}
                  onChange={e =>
                    setNewState(prev => ({
                      ...prev,
                      medium: {
                        ...prev.medium,
                        customEmail: e.target.value
                      }
                    }))
                  }
                />
              </Space>
            ) : null}
            {newState.medium.whatsapp ? (
              <Space direction="vertical" className="mt-3">
                <Select
                  className="w-72"
                  placeholder="Select customer whatsapp numbers"
                  mode="multiple"
                  options={Array.from(customerWhatsappNumbers).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={newState.medium.customerWhatsappNumbers}
                  onChange={customerWhatsappNumbers =>
                    setNewState(prev => ({
                      ...prev,
                      medium: {
                        ...prev.medium,
                        customerWhatsappNumbers
                      }
                    }))
                  }
                />
                <Input
                  className="w-72"
                  placeholder="or enter custom whatsapp number"
                  value={newState.medium.customWhatsapp}
                  onChange={e =>
                    setNewState(prev => ({
                      ...prev,
                      medium: {
                        ...prev.medium,
                        customWhatsapp: e.target.value
                      }
                    }))
                  }
                />
              </Space>
            ) : null}
            <Space className="mt-4">
              <Button onClick={() => setStep(1)}>Previous</Button>
              <Button
                type="primary"
                onClick={() => {
                  if (
                    newState.medium.email &&
                    !newState.medium.customerEmails.length &&
                    !newState.medium.customEmail
                  )
                    return messageApi.error(
                      'Select or enter atleast one customer email'
                    )
                  if (
                    newState.medium.whatsapp &&
                    !newState.medium.customerWhatsappNumbers.length &&
                    !newState.medium.customWhatsapp
                  )
                    return messageApi.error(
                      'Select or enter atleast one customer whatsapp number'
                    )
                  setStep(3)
                  return
                }}
              >
                Next
              </Button>
            </Space>
          </div>
        ) : null}
        {step === 3 ? (
          <div className="flex flex-col items-start gap-4">
            <Button onClick={() => setStep(2)} disabled={isLoading}>
              Go back
            </Button>
            {uniqueRemarks.size ? (
              <div className="mb-2 mt-4">
                <Typography.Title level={5}>
                  Select Remarks to send to Customer
                </Typography.Title>
                <div className="mb-2 block w-full">
                  <Button
                    size="small"
                    onClick={() =>
                      setNewState(prev => ({
                        ...prev,
                        medium: {
                          ...prev.medium,
                          remarks: undefined
                        }
                      }))
                    }
                  >
                    Clear
                  </Button>
                </div>
                <Radio.Group
                  options={[...uniqueRemarks]}
                  value={newState.medium.remarks}
                  onChange={e =>
                    setNewState(prev => ({
                      ...prev,
                      medium: {
                        ...prev.medium,
                        remarks: e.target.value
                      }
                    }))
                  }
                />
              </div>
            ) : null}
            <Button
              onClick={async () => {
                if (!newState.selectedInquiries?.length || !newState.customerId)
                  return
                const customerEmails = new Set(newState.medium.customerEmails)
                if (newState.medium.customEmail)
                  customerEmails.add(newState.medium.customEmail)
                const customerWhatsappNumbers = new Set(
                  newState.medium.customerWhatsappNumbers
                )
                if (newState.medium.customWhatsapp)
                  customerWhatsappNumbers.add(newState.medium.customWhatsapp)
                const res = await mutateAsync({
                  preview: true,
                  customerId: newState.customerId,
                  siteId: newState.siteId,
                  prNumberAndName: newState.prNumberAndName,
                  inquiryIds: newState.selectedInquiries,
                  email: newState.medium.email,
                  whatsapp: newState.medium.whatsapp,
                  customerEmails: [...customerEmails],
                  customerWhatsappNumbers: [...customerWhatsappNumbers],
                  remarks: newState.medium.remarks,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                if (res.success && res.url && res.url2) {
                  window.open(res.url)
                  window.open(res.url2)
                } else
                  notificationApi.error({
                    message: res.message || 'Something went wrong'
                  })
              }}
              icon={<DownloadOutlined />}
              disabled={isLoading}
            >
              Download Preview
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                if (!newState.selectedInquiries?.length || !newState.customerId)
                  return
                const customerEmails = new Set(newState.medium.customerEmails)
                if (newState.medium.customEmail)
                  customerEmails.add(newState.medium.customEmail)
                const customerWhatsappNumbers = new Set(
                  newState.medium.customerWhatsappNumbers
                )
                if (newState.medium.customWhatsapp)
                  customerWhatsappNumbers.add(newState.medium.customWhatsapp)
                const res = await mutateAsync({
                  preview: false,
                  customerId: newState.customerId,
                  siteId: newState.siteId,
                  prNumberAndName: newState.prNumberAndName,
                  inquiryIds: newState.selectedInquiries,
                  email: newState.medium.email,
                  whatsapp: newState.medium.whatsapp,
                  customerEmails: [...customerEmails],
                  customerWhatsappNumbers: [...customerWhatsappNumbers],
                  remarks: newState.medium.remarks,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                if (res.success && res.url && res.url2 && res.id) {
                  notificationApi.success({
                    message: 'Offer sent to customer'
                  })
                  setDataSent({
                    id: res.id,
                    url: res.url,
                    url2: res.url2,
                    emailSent: res.emailSent,
                    whatsappSent: res.whatsappSent
                  })
                  setStep(4)
                } else
                  notificationApi.error({
                    message: res.message || 'Something went wrong'
                  })
              }}
              icon={<SendOutlined />}
              disabled={isLoading}
            >
              Send
            </Button>
          </div>
        ) : null}
        {step === 4 ? (
          <Space direction="vertical">
            <Space>
              <Result
                status={dataSent.emailSent ? 'success' : 'error'}
                title="Email"
              />
              <Result
                status={dataSent.whatsappSent ? 'success' : 'error'}
                title="WhatsApp"
              />
            </Space>
            <Space>
              <Button
                onClick={() => window.open(dataSent.url)}
                icon={<DownloadOutlined />}
              >
                Download Excel
              </Button>
              <Button
                onClick={() => window.open(dataSent.url2)}
                icon={<FilePdfOutlined />}
              >
                Download PDF
              </Button>
              <Link href={`/offer-sent-to-customer/${dataSent.id}`}>
                <Button type="primary" icon={<SendOutlined />}>
                  Go to Inquiry
                </Button>
              </Link>
            </Space>
          </Space>
        ) : null}
      </Card>
    </Layout>
  )
}

export default NewOfferSentToCustomerPage
