import {
  DownloadOutlined,
  MailOutlined,
  PhoneOutlined,
  SaveOutlined,
  SendOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popover,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd'
import { FormInstance } from 'antd/es/form'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

const EditableContext = createContext<FormInstance<any> | null>(null)

interface Inquiry {
  id: string
  salesDescription: string | null
  salesUnitId: string | null
  quantity: number | null
  size: string | null
  purchaseDescription: string | null
  purchaseUnitId: string | null
  supplierPrice: number | null
  estimatedDeliveryDays: number | null
  gstRateId: string | null
  hsnCode: string | null
  frontPersonRepresentative: {
    id: string
    name: string | null
    email: string | null
    mobile: string | null
    whatsapp: string | null
  }
  supplierOfferDate: Date | null
  updatedAt: Date
  updatedBy: {
    id: string
    name: string | null
  } | null
}

interface EditableRowProps {
  index: number
}

const EditableRow: React.FC<EditableRowProps> = ({ index, ...props }) => {
  const [form] = Form.useForm()
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  )
}

interface EditableCellProps {
  title: React.ReactNode
  editable: boolean
  children: React.ReactNode
  dataIndex: keyof Inquiry
  record: Inquiry
  type: 'text' | 'number' | 'select'
  selectOptions?: {
    value: string
    label: string
  }[]
  handleSave: (record: Inquiry) => void
}

const EditableCell: React.FC<EditableCellProps> = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  type,
  selectOptions,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<any>(null)
  const form = useContext(EditableContext)!

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const toggleEdit = () => {
    setEditing(!editing)
    form.setFieldsValue({ [dataIndex]: record[dataIndex] })
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      toggleEdit()
      handleSave({ ...record, ...values })
    } catch (errInfo) {
      console.error('Save failed:', errInfo)
    }
  }

  let childNode = children

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{ margin: 0 }}
        name={dataIndex}
        rules={
          dataIndex === 'hsnCode'
            ? [
                {
                  validator: async (_, value) => {
                    if (
                      value === null ||
                      value === undefined ||
                      value?.length === 0 ||
                      value?.length === 8
                    ) {
                      return Promise.resolve()
                    }
                    return Promise.reject(
                      new Error('HSN Code should be 8 digits')
                    )
                  }
                }
              ]
            : undefined
        }
      >
        {type === 'select' ? (
          <Select
            ref={inputRef}
            allowClear
            showSearch
            options={selectOptions}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            onBlur={save}
          />
        ) : 'text' ? (
          <Input ref={inputRef} onPressEnter={save} onBlur={save} />
        ) : (
          <InputNumber
            ref={inputRef}
            onPressEnter={save}
            onBlur={save}
            controls={false}
          />
        )}
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap min-h-[24px]"
        onClick={toggleEdit}
      >
        {children}
      </div>
    )
  }

  return <td {...restProps}>{childNode}</td>
}

type EditableTableProps = Parameters<typeof Table>[0]

type ColumnTypes = Exclude<EditableTableProps['columns'], undefined>

const InquiriesSentToSupplierPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [showSave, setShowSave] = useState(false)
  const [resendModal, setResendModal] = useState<null | {
    done: boolean
    url?: string
    url2?: string
    medium: {
      email: boolean
      customEmail: string
      whatsapp: boolean
      customWhatsapp: string
      supplierEmails: string[]
      supplierWhatsappNumbers: string[]
    }
  }>(null)

  // ? useQuery
  const { data, isLoading, refetch } =
    api.inquiriesSentToSupplier.getOne.useQuery(
      {
        id: id?.toString() || ''
      },
      {
        enabled: !!session && !!id
      }
    )
  const { data: units, isLoading: unitsLoading } =
    api.units.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: gstRates, isLoading: gstRatesLoading } =
    api.gstRates.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: supplier, isLoading: supplierLoading } =
    api.inquiriesSentToSupplier.getSupplier.useQuery(data?.supplier.id || '', {
      enabled:
        !!session &&
        ['ADMIN', 'USER'].includes(session.user.role) &&
        !!resendModal &&
        !!data?.supplier.id
    })

  // ? useMutation
  const { mutateAsync: save, isLoading: saving } =
    api.inquiriesSentToSupplier.updateOne.useMutation()
  const { mutateAsync: resend, isLoading: resending } =
    api.inquiriesSentToSupplier.resend.useMutation()

  // ? useEffect
  useEffect(() => {
    if (!data) return
    setInquiries(data.inquiries.map(i => i.inquiry))
  }, [data])

  // ? useNotification
  const notificationApi = useNotificationApi()

  // ? useMessage
  const messageApi = useMessageApi()

  const editable = !['ADMINVIEWER', 'USERVIEWER'].includes(
    session?.user.role || ''
  )

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

  const defaultColumns: (ColumnTypes[number] & {
    editable?: boolean
    type?: 'text' | 'number' | 'select'
    selectOptions?: {
      value: string
      label: string
    }[]
    dataIndex: string
  })[] = [
    {
      title: 'Sr. No.',
      dataIndex: 'id',
      render: (id, _, index) => (
        <Link href={`/inquiries/${id}`}>{index + 1}</Link>
      )
    },
    {
      title: 'Sales Description',
      dataIndex: 'salesDescription'
    },
    {
      title: 'Sales Unit',
      dataIndex: 'salesUnitId',
      render: salesUnitId => units?.units.find(u => u.id === salesUnitId)?.name
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity'
    },
    {
      title: 'Size',
      dataIndex: 'size'
    },
    {
      title: 'Purchase Description',
      dataIndex: 'purchaseDescription',
      editable,
      type: 'text'
    },
    {
      title: 'Purchase Unit',
      dataIndex: 'purchaseUnitId',
      render: purchaseUnitId =>
        units?.units.find(u => u.id === purchaseUnitId)?.name,
      editable,
      type: 'select',
      selectOptions: units?.units.map(u => ({ value: u.id, label: u.name }))
    },
    {
      title: 'Supplier Price',
      dataIndex: 'supplierPrice',
      editable,
      type: 'number'
    },
    {
      title: 'Estimated Delivery Days',
      dataIndex: 'estimatedDeliveryDays',
      editable,
      type: 'number'
    },
    {
      title: 'GST Rate',
      dataIndex: 'gstRateId',
      render: gstRateId =>
        gstRates?.gstRates.find(u => u.id === gstRateId)?.rate.toString(),
      editable,
      type: 'select',
      selectOptions: gstRates?.gstRates.map(r => ({
        value: r.id,
        label: r.rate.toString()
      }))
    },
    {
      title: 'HSN Code',
      dataIndex: 'hsnCode',
      editable,
      type: 'text'
    },
    ...(session?.user.role !== 'SUPPLIER'
      ? [
          {
            title: 'Offer Date',
            dataIndex: 'supplierOfferDate',
            render: (date?: Date | null) => date?.toLocaleString()
          },
          {
            title: 'Updated At',
            dataIndex: 'updatedAt',
            render: (updatedAt: Date) => updatedAt.toLocaleString()
          },
          {
            title: 'Updated By',
            dataIndex: 'updatedBy',
            render: (updatedBy: any) => (
              <Link href={`/users/${updatedBy?.id}`}>{updatedBy?.name}</Link>
            )
          }
        ]
      : []),
    {
      title: 'FPR',
      dataIndex: 'frontPersonRepresentative',
      render: frontPersonRepresentative => (
        <Popover
          content={
            <Space direction="vertical">
              {frontPersonRepresentative.email ? (
                <Space>
                  <Link href={`mailto:${frontPersonRepresentative.email}`}>
                    <Button size="small" icon={<MailOutlined />} />
                  </Link>
                  <Typography.Text>
                    {frontPersonRepresentative.email}
                  </Typography.Text>
                </Space>
              ) : null}
              {frontPersonRepresentative.mobile ? (
                <Space>
                  <Link href={`tel:${frontPersonRepresentative.mobile}`}>
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
  ]

  return (
    <Layout
      loading={unitsLoading || gstRatesLoading || isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        {
          label: 'Inquiries Sent to Supplier',
          link: '/inquiries-sent-to-supplier'
        },
        {
          label: id?.toString() || 'Loading'
        }
      ]}
      title={`Inquiries Sent to Supplier - ${id?.toString()}`}
    >
      <Card className="my-2">
        {data &&
        ['ADMIN', 'USER'].includes(session?.user.role || '') &&
        data.inquiries.filter(i => !i.inquiry.supplierOfferDate).length ? (
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
                  supplierEmails: [],
                  supplierWhatsappNumbers: []
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
            <Descriptions.Item label="Supplier">
              <Link href={`/suppliers/${data.supplier.id}`}>
                {data.supplier.name}
              </Link>
            </Descriptions.Item>
            {session?.user.role !== 'SUPPLIER' ? (
              <>
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
              </>
            ) : null}
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
            {data.resendHistory?.length ? (
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
          rowClassName={() => 'editable-row'}
          components={{
            body: {
              row: EditableRow,
              cell: EditableCell
            }
          }}
          columns={
            defaultColumns.map(col => {
              if (!col.editable) return col
              return {
                ...col,
                onCell: (record: Inquiry) => ({
                  record,
                  editable: col.editable,
                  dataIndex: col.dataIndex,
                  title: col.title,
                  type: col.type,
                  selectOptions: col.selectOptions,
                  handleSave: (rowData: Inquiry) => {
                    setInquiries(prev =>
                      prev.map(p => (p.id === rowData.id ? rowData : p))
                    )
                    setShowSave(true)
                  }
                })
              }
            }) as ColumnTypes
          }
          dataSource={inquiries}
          rowKey="id"
          pagination={false}
          caption={
            <Button
              className={showSave ? '' : 'hidden'}
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={async () => {
                if (!id) return
                await save({
                  id: id.toString() || '',
                  inquiries: inquiries.map(i => ({
                    id: i.id,
                    purchaseDescription: i.purchaseDescription,
                    purchaseUnitId: i.purchaseUnitId,
                    supplierPrice: i.supplierPrice
                      ? parseFloat(i.supplierPrice.toString())
                      : null,
                    estimatedDeliveryDays: i.estimatedDeliveryDays
                      ? parseInt(i.estimatedDeliveryDays.toString())
                      : null,
                    gstRateId: i.gstRateId,
                    hsnCode: i.hsnCode
                  }))
                })
                refetch()
                setShowSave(false)
              }}
            >
              Save
            </Button>
          }
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
            {resendModal?.url2 ? (
              <Button
                type="primary"
                onClick={() => window.open(resendModal.url2)}
                icon={<DownloadOutlined />}
              >
                Download PDF
              </Button>
            ) : null}
          </Space>
        ) : supplierLoading ? (
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
                    supplierEmails: prev?.medium.supplierEmails || [],
                    whatsapp: prev?.medium.whatsapp ?? true,
                    customWhatsapp: prev?.medium.customWhatsapp || '',
                    supplierWhatsappNumbers:
                      prev?.medium.supplierWhatsappNumbers || []
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
                    supplierEmails: prev?.medium.supplierEmails || [],
                    whatsapp: e.target.checked,
                    customWhatsapp: prev?.medium.customWhatsapp || '',
                    supplierWhatsappNumbers:
                      prev?.medium.supplierWhatsappNumbers || []
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
                  placeholder="Select supplier emails"
                  mode="multiple"
                  options={Array.from(supplierEmails).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={resendModal?.medium.supplierEmails}
                  onChange={supplierEmails =>
                    setResendModal(prev => ({
                      done: false,
                      medium: {
                        email: prev?.medium.email ?? true,
                        customEmail: prev?.medium.customEmail || '',
                        supplierEmails,
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: prev?.medium.customWhatsapp || '',
                        supplierWhatsappNumbers:
                          prev?.medium.supplierWhatsappNumbers || []
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
                        supplierEmails: prev?.medium.supplierEmails || [],
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: prev?.medium.customWhatsapp || '',
                        supplierWhatsappNumbers:
                          prev?.medium.supplierWhatsappNumbers || []
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
                  placeholder="Select supplier whatsapp numbers"
                  mode="multiple"
                  options={Array.from(supplierWhatsappNumbers).map(se => ({
                    label: se,
                    value: se
                  }))}
                  value={resendModal?.medium.supplierWhatsappNumbers}
                  onChange={supplierWhatsappNumbers =>
                    setResendModal(prev => ({
                      done: false,
                      medium: {
                        email: prev?.medium.email ?? true,
                        customEmail: prev?.medium.customEmail || '',
                        supplierEmails: prev?.medium.supplierEmails || [],
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: prev?.medium.customWhatsapp || '',
                        supplierWhatsappNumbers
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
                        supplierEmails: prev?.medium.supplierEmails || [],
                        whatsapp: prev?.medium.whatsapp ?? true,
                        customWhatsapp: e.target.value,
                        supplierWhatsappNumbers:
                          prev?.medium.supplierWhatsappNumbers || []
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
                  !resendModal.medium.supplierEmails.length &&
                  !resendModal.medium.customEmail
                )
                  return messageApi.error(
                    'Select or enter atleast one supplier email'
                  )
                if (
                  resendModal.medium.whatsapp &&
                  !resendModal.medium.supplierWhatsappNumbers.length &&
                  !resendModal.medium.customWhatsapp
                )
                  return messageApi.error(
                    'Select or enter atleast one supplier whatsapp number'
                  )

                const supplierEmails = new Set(
                  resendModal.medium.supplierEmails
                )
                if (resendModal.medium.customEmail)
                  supplierEmails.add(resendModal.medium.customEmail)
                const supplierWhatsappNumbers = new Set(
                  resendModal.medium.supplierWhatsappNumbers
                )
                if (resendModal.medium.customWhatsapp)
                  supplierWhatsappNumbers.add(resendModal.medium.customWhatsapp)

                const res = await resend({
                  id: id.toString(),
                  timezoneOffset: new Date().getTimezoneOffset(),
                  email: resendModal.medium.email,
                  supplierEmails: [...supplierEmails],
                  whatsapp: resendModal.medium.whatsapp,
                  supplierWhatsappNumbers: [...supplierWhatsappNumbers]
                })

                if (res.success && res.url) {
                  notificationApi.success({
                    message: 'Inquiries resent to supplier'
                  })
                  setResendModal({
                    done: true,
                    url: res.url,
                    url2: res.url2,
                    medium: {
                      email: res.emailSent,
                      customEmail: '',
                      supplierEmails: [],
                      whatsapp: res.whatsappSent,
                      customWhatsapp: '',
                      supplierWhatsappNumbers: []
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

export default InquiriesSentToSupplierPage
