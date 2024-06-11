import { DownloadOutlined, SendOutlined } from '@ant-design/icons'
import {
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

const NewInquiriesSentToSupplierPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [step, setStep] = useState(0)
  const [newState, setNewState] = useState<{
    supplierId?: string
    selectedInquiries?: string[]
    medium: {
      email: boolean
      whatsapp: boolean
      customEmail: string
      supplierEmails: string[]
      customWhatsapp: string
      supplierWhatsappNumbers: string[]
      remarks?: string
    }
  }>({
    medium: {
      email: true,
      whatsapp: true,
      customEmail: '',
      supplierEmails: [],
      customWhatsapp: '',
      supplierWhatsappNumbers: []
    }
  })
  const [supplierSearch, setSupplierSearch] = useState<string | undefined>(
    undefined
  )
  const [dataSent, setDataSent] = useState({
    id: '',
    url: '',
    emailSent: false,
    whatsappSent: false
  })

  // ? useQuery
  const { data: suppliers, isLoading: suppliersLoading } =
    api.suppliers.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: supplierSearch
      },
      { enabled: !!session }
    )
  const { data: inquiries, isLoading: inquiriesLoading } =
    api.inquiriesSentToSupplier.getInquiries.useQuery(
      {
        supplierId: newState.supplierId || ''
      },
      { enabled: !!session && !!newState.supplierId && step === 1 }
    )
  const { data: supplier } = api.inquiriesSentToSupplier.getSupplier.useQuery(
    newState.supplierId || '',
    {
      enabled: !!session && !!newState.supplierId && step === 2
    }
  )
  const { data: readySuppliers, isLoading: readySuppliersLoading } =
    api.inquiriesSentToSupplier.getReadySuppliers.useQuery(undefined, {
      enabled: !!session
    })

  // ? useMutation
  const { mutateAsync, isLoading } =
    api.inquiriesSentToSupplier.previewOrCreate.useMutation()

  // ? useEffect
  useEffect(() => {
    if (inquiries) {
      setNewState(prev => ({
        ...prev,
        selectedInquiries: inquiries.map(item => item.id)
      }))
    }
  }, [inquiries])

  // ? useMemo
  const debouncedSupplierSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSupplierSearch(search || undefined)
      }, 500),
    []
  )

  // ? useNotification
  const notificationApi = useNotificationApi()

  // ? useMessage
  const messageApi = useMessageApi()

  const supplierEmails = new Set<string>()
  if (supplier?.email) supplierEmails.add(supplier.email)
  if (supplier?.email2) supplierEmails.add(supplier.email2)
  if (supplier?.email3) supplierEmails.add(supplier.email3)

  const supplierWhatsappNumbers = new Set<string>()
  if (supplier?.whatsapp) supplierWhatsappNumbers.add(supplier.whatsapp)
  if (supplier?.mobile) supplierWhatsappNumbers.add(supplier.mobile)
  if (supplier?.alternateMobile)
    supplierWhatsappNumbers.add(supplier.alternateMobile)
  if (supplier?.accountsContactMobile)
    supplierWhatsappNumbers.add(supplier.accountsContactMobile)
  if (supplier?.logisticContactMobile)
    supplierWhatsappNumbers.add(supplier.logisticContactMobile)
  if (supplier?.purchaseContactMobile)
    supplierWhatsappNumbers.add(supplier.purchaseContactMobile)

  const uniqueRemarks = new Set<string>()
  if (step === 3 && (newState.medium.email || newState.medium.whatsapp))
    inquiries?.forEach(inquiry => {
      if (
        newState.selectedInquiries?.includes(inquiry.id) &&
        inquiry.emailForSupplierRemarks
      )
        uniqueRemarks.add(inquiry.emailForSupplierRemarks)
    })

  return (
    <Layout
      breadcrumbs={[
        { label: 'Home', link: '/' },
        {
          label: 'Inquiries Sent to Supplier',
          link: '/inquiries-sent-to-supplier'
        },
        {
          label: 'New'
        }
      ]}
      title="Inquiries Sent to Supplier - new"
    >
      <Card>
        <Steps
          current={step}
          items={[
            {
              title: 'Supplier'
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
          <div className="flex w-full flex-col">
            <Select
              className="w-72"
              placeholder="Select Supplier"
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
              value={newState.supplierId}
              onChange={val =>
                setNewState({
                  supplierId: val || undefined,
                  medium: {
                    email: true,
                    whatsapp: true,
                    customEmail: '',
                    customWhatsapp: '',
                    supplierEmails: [],
                    supplierWhatsappNumbers: []
                  }
                })
              }
            />
            <Button
              className="mt-4 w-fit"
              disabled={!newState.supplierId}
              type="primary"
              onClick={() => {
                setStep(1)
              }}
            >
              Next
            </Button>
            <Divider />
            <Typography.Title level={5}>
              Ready Suppliers ({readySuppliers?.length})
            </Typography.Title>
            <Table
              size="small"
              bordered
              scroll={{ x: 800 }}
              loading={readySuppliersLoading}
              columns={[
                {
                  title: 'Supplier',
                  dataIndex: 'name'
                },
                {
                  title: 'No. of inquiries',
                  dataIndex: 'count'
                }
              ]}
              dataSource={readySuppliers}
              rowKey="id"
            />
          </div>
        ) : null}
        {step === 1 ? (
          <>
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
                  title: 'Customer',
                  dataIndex: 'customer',
                  render: customer => customer?.name
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
                  title: 'FPR',
                  dataIndex: 'frontPersonRepresentative',
                  render: fpr => fpr?.name
                }
              ]}
              dataSource={inquiries}
              rowKey="id"
              pagination={{
                showSizeChanger: true
              }}
              rowSelection={{
                selectedRowKeys: newState.selectedInquiries,
                onChange: selectedRowKeys =>
                  setNewState({
                    ...newState,
                    selectedInquiries: selectedRowKeys.map(key =>
                      key.toString()
                    )
                  })
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
                  placeholder="Select supplier emails"
                  mode="multiple"
                  options={Array.from(supplierEmails).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={newState.medium.supplierEmails}
                  onChange={supplierEmails =>
                    setNewState(prev => ({
                      ...prev,
                      medium: {
                        ...prev.medium,
                        supplierEmails
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
                  placeholder="Select supplier whatsapp numbers"
                  mode="multiple"
                  options={Array.from(supplierWhatsappNumbers).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={newState.medium.supplierWhatsappNumbers}
                  onChange={supplierWhatsappNumbers =>
                    setNewState(prev => ({
                      ...prev,
                      medium: {
                        ...prev.medium,
                        supplierWhatsappNumbers
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
                    !newState.medium.supplierEmails.length &&
                    !newState.medium.customEmail
                  )
                    return messageApi.error(
                      'Select or enter atleast one supplier email'
                    )
                  if (
                    newState.medium.whatsapp &&
                    !newState.medium.supplierWhatsappNumbers.length &&
                    !newState.medium.customWhatsapp
                  )
                    return messageApi.error(
                      'Select or enter atleast one supplier whatsapp number'
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
                  Select Remarks to send to Supplier
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
                if (!newState.selectedInquiries?.length || !newState.supplierId)
                  return
                const supplierEmails = new Set(newState.medium.supplierEmails)
                if (newState.medium.customEmail)
                  supplierEmails.add(newState.medium.customEmail)
                const supplierWhatsappNumbers = new Set(
                  newState.medium.supplierWhatsappNumbers
                )
                if (newState.medium.customWhatsapp)
                  supplierWhatsappNumbers.add(newState.medium.customWhatsapp)
                const res = await mutateAsync({
                  preview: true,
                  supplierId: newState.supplierId,
                  inquiryIds: newState.selectedInquiries,
                  email: newState.medium.email,
                  whatsapp: newState.medium.whatsapp,
                  supplierEmails: [...supplierEmails],
                  supplierWhatsappNumbers: [...supplierWhatsappNumbers],
                  remarks: newState.medium.remarks,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                if (res.success && res.url) window.open(res.url)
                else
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
              onClick={async () => {
                if (!newState.selectedInquiries?.length || !newState.supplierId)
                  return
                const supplierEmails = new Set(newState.medium.supplierEmails)
                if (newState.medium.customEmail)
                  supplierEmails.add(newState.medium.customEmail)
                const supplierWhatsappNumbers = new Set(
                  newState.medium.supplierWhatsappNumbers
                )
                if (newState.medium.customWhatsapp)
                  supplierWhatsappNumbers.add(newState.medium.customWhatsapp)
                const res = await mutateAsync({
                  preview: true,
                  supplierId: newState.supplierId,
                  inquiryIds: newState.selectedInquiries,
                  email: newState.medium.email,
                  whatsapp: newState.medium.whatsapp,
                  supplierEmails: [...supplierEmails],
                  supplierWhatsappNumbers: [...supplierWhatsappNumbers],
                  remarks: newState.medium.remarks,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                if (res.success && res.url2) window.open(res.url2)
                else
                  notificationApi.error({
                    message: res.message || 'Something went wrong'
                  })
              }}
              icon={<DownloadOutlined />}
              disabled={isLoading}
            >
              Download pdf
            </Button>
            <Button
              type="primary"
              onClick={async () => {
                if (!newState.selectedInquiries?.length || !newState.supplierId)
                  return
                const supplierEmails = new Set(newState.medium.supplierEmails)
                if (newState.medium.customEmail)
                  supplierEmails.add(newState.medium.customEmail)
                const supplierWhatsappNumbers = new Set(
                  newState.medium.supplierWhatsappNumbers
                )
                if (newState.medium.customWhatsapp)
                  supplierWhatsappNumbers.add(newState.medium.customWhatsapp)
                const res = await mutateAsync({
                  preview: false,
                  supplierId: newState.supplierId,
                  inquiryIds: newState.selectedInquiries,
                  email: newState.medium.email,
                  whatsapp: newState.medium.whatsapp,
                  supplierEmails: [...supplierEmails],
                  supplierWhatsappNumbers: [...supplierWhatsappNumbers],
                  remarks: newState.medium.remarks,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                if (res.success && res.url && res.id) {
                  notificationApi.success({
                    message: 'Inquiries sent to supplier'
                  })
                  setDataSent({
                    id: res.id,
                    url: res.url,
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
              <Link href={`/inquiries-sent-to-supplier/${dataSent.id}`}>
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

export default NewInquiriesSentToSupplierPage
