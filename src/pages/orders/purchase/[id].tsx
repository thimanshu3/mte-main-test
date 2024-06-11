import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  MailOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload
} from 'antd'
import csvtojson from 'csvtojson'
import dayjs from 'dayjs'
import { Parser } from 'json2csv'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { ActionRibbon } from '~/components/ActionsRibbon'
import { Layout } from '~/components/Layout'
import { OrderStageTag } from '~/components/OrderStageTag'
import { useNotificationApi } from '~/context/notifcationApi'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'

type LineItem = {
  id: string
  itemId: string
  sapCode?: string | null
  inquiryId?: string | null
  description: string
  size?: string | null
  unitId: string
  price: number
  quantity: number
  gstRateId?: string | null
  hsnCode?: string | null
  estimatedDeliveryDate?: Date | null
  edit: boolean
  inventoryItem?: {
    id: string
    quantity: number
    quantityGone: number
  }
  soQuantity: number
}

type InventoryItem = {
  poi: string
  itemId: string
  price: number
  unitId: string
  description: string
  quantity: number
  orderQuantity: number
  maxQuantity: number
  hsnCode?: string | null
  gstRateId?: string | null
}

type Expense = {
  key: string
  id?: string | null
  description: string
  price: number
  gstRateId?: string | null
  showFulfilment?: boolean
  fulfilmentLogId?: string | null
  edit: boolean
  customId?: string | null
}

type FulfilmentExpense = {
  id: string
  description: string
  price: number
  gstRateId?: string | null
  isNew: boolean
}

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerAuthSession(ctx)
  return {
    redirect: !session
      ? {
          destination: '/auth'
        }
      : !['ADMIN', 'ADMINVIEWER', 'USER', 'USERVIEWER', 'FULFILMENT'].includes(
          session.user.role
        )
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const OrderPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [userSearch, setUserSearch] = useState<string | undefined>(undefined)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [createFulfilmentDrawer, setCreateFulfilmentDrawer] = useState<{
    items: InventoryItem[]
    expenses: FulfilmentExpense[]
    comments?: string | null
  } | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])

  // ? useQuery
  const { data, isLoading, refetch } = api.orders.purchase.getOne.useQuery(
    id?.toString() || '',
    {
      enabled: !!session && !!id
    }
  )
  const { data: users, isLoading: usersLoading } =
    api.users.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: userSearch
      },
      { enabled: !!session }
    )
  const { data: units } = api.units.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
  )
  const { data: paymentTerms, isLoading: paymentTermsLoading } =
    api.paymentTerms.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      {
        enabled: !!session && !!id
      }
    )
  const { data: gstRates, isLoading: gstRatesLoading } =
    api.gstRates.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: addresses, isLoading: addressesLoading } =
    api.address.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: expensesGlobal, isLoading: expensesLoading } =
    api.expenses.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )

  // ? useMutation
  const { mutateAsync, isLoading: isUpdating } =
    api.orders.purchase.updateOne.useMutation()
  const { mutateAsync: generatePdf, isLoading: generatePDFLoading } =
    api.orders.purchase.generatePdf.useMutation()
  const { mutateAsync: generateChinaPdf, isLoading: generateChinaPDFLoading } =
    api.orders.purchase.generateChinaPdf.useMutation()
  const {
    mutateAsync: createInventoryItems,
    isLoading: createInventoryItemsLoading
  } = api.orders.inventory.createInventoryItems.useMutation()
  const { mutateAsync: approveOrder, isLoading: isApproving } =
    api.orders.purchase.approve.useMutation()
  const { mutateAsync: sendPdfEmail, isLoading: sendingPdfEmail } =
    api.orders.purchase.sendPdf.useMutation()
  const { mutateAsync: changeStatus } =
    api.orders.purchase.changeStatus.useMutation()

  // ? useEffect
  useEffect(() => {
    if (data) {
      setUserSearch(data.po.representativeUserId)
      setLineItems(
        data.po.items.map(item => ({
          id: item.id,
          itemId: item.itemId,
          sapCode: item.sapCode,
          inquiryId: item.inquiryId,
          description: item.description,
          size: item.size,
          unitId: item.unitId,
          price: item.price,
          quantity: item.quantity,
          gstRateId: item.gstRateId,
          hsnCode: item.hsnCode,
          estimatedDeliveryDate: item.estimatedDeliveryDate,
          edit: false,
          inventoryItem: item.inventoryItem
            ? {
                id: item.inventoryItem.id,
                quantity: item.inventoryItem.quantity,
                quantityGone: item.inventoryItem.quantityGone
              }
            : undefined,
          soQuantity: item.salesOrderItem?.quantity || 0
        }))
      )
      setExpenses(
        data.po.expenses.map(e => ({
          key: e.id,
          id: e.id,
          description: e.description,
          price: e.price,
          gstRateId: e.gstRateId,
          showFulfilment: e.showInFulfilment,
          fulfilmentLogId: e.fulfilmentLogId,
          edit: false,
          customId: e.customId
        }))
      )
    } else {
      setUserSearch(undefined)
    }
  }, [id, data])

  // ? useMemo
  const debouncedUserSearch = useMemo(
    () =>
      debounce((search: string) => {
        setUserSearch(search || undefined)
      }, 500),
    []
  )
  const unitsObj = useMemo(() => {
    const obj: any = {}
    units?.units.forEach(u => {
      obj[u.id] = u
    })
    return obj
  }, [units])
  const gstRatesObj = useMemo(() => {
    const obj: any = {}
    gstRates?.gstRates.forEach(u => {
      obj[u.id] = u
    })
    return obj
  }, [gstRates])

  // ? useNotification
  const notificationApi = useNotificationApi()

  const fulfilmentItemsTotal = parseFloat(
    createFulfilmentDrawer?.items
      .reduce((total, item) => total + item.quantity * item.price, 0)
      .toFixed(2) || '0'
  )
  const fulfilmentItemsTax = parseFloat(
    createFulfilmentDrawer?.items
      .reduce(
        (total, item) =>
          total +
          item.quantity *
            ((item.price * (gstRatesObj[item.gstRateId || '']?.rate || 0)) /
              100),
        0
      )
      .toFixed(2) || '0'
  )
  const fulfilmentExpensesTotal = parseFloat(
    createFulfilmentDrawer?.expenses
      .reduce((total, expense) => total + expense.price, 0)
      .toFixed(2) || '0'
  )
  const fulfilmentExpensesTax = parseFloat(
    createFulfilmentDrawer?.expenses
      .reduce(
        (total, expense) =>
          total +
          (expense.price * (gstRatesObj[expense.gstRateId || '']?.rate || 0)) /
            100,
        0
      )
      .toFixed(2) || '0'
  )

  return (
    <Layout
      loading={isLoading}
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Orders'
        },
        {
          label: 'Purchase',
          link: '/orders/purchase'
        },
        {
          label: data?.po.id2 || 'Loading'
        }
      ]}
      title={`Purchase Order - ${data?.po.id2 || id}`}
    >
      <Card>
        <Form
          onFinish={async formData => {
            try {
              await mutateAsync({
                id: id?.toString() || '',
                date: formData.date.toDate(),
                representativeUserId: formData.representativeUserId,
                referenceId: formData.referenceId,
                paymentTermId: formData.paymentTermId,
                shippingAddressId: formData.shippingAddressId,
                comments: formData.comments,
                lineItems: lineItems.map(li => ({
                  id: li.id,
                  sapCode: li.sapCode,
                  description: li.description,
                  size: li.size,
                  unitId: li.unitId,
                  price: li.price,
                  quantity: li.quantity,
                  gstRateId: li.gstRateId!,
                  hsnCode: li.hsnCode,
                  estimatedDeliveryDate: li.estimatedDeliveryDate
                })),
                expenses: expenses.map(e => ({
                  id: e.id,
                  description: e.description,
                  price: e.price,
                  gstRateId: e.gstRateId,
                  showInFulfilment: e.showFulfilment
                }))
              })
              refetch()
              notificationApi.success({
                message: 'Purchase Order updated'
              })
            } catch (err) {
              notificationApi.success({
                message: 'Error saving Purchase Order'
              })
            }
          }}
          layout="vertical"
          initialValues={{
            representativeUserId: data?.po.representativeUserId,
            referenceId: data?.po.referenceId,
            date: dayjs(data?.po.date),
            paymentTermId: data?.po.paymentTermId,
            shippingAddressId: data?.po.shippingAddressId,
            comments: data?.po.comments,
            currency: data?.po.currency?.name
          }}
        >
          <ActionRibbon>
            {!['ADMINVIEWER', 'USERVIEWER'].includes(
              session?.user.role || ''
            ) ? (
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={isUpdating}
                htmlType="submit"
              >
                Save
              </Button>
            ) : null}
            {!['ADMINVIEWER', 'USERVIEWER'].includes(
              session?.user.role || ''
            ) ? (
              <Link href="/orders/purchase/new">
                <Button icon={<PlusOutlined />} disabled={isUpdating}>
                  New
                </Button>
              </Link>
            ) : null}
            {!['ADMINVIEWER', 'USERVIEWER'].includes(
              session?.user.role || ''
            ) &&
            id !== 'new' &&
            !data?.po.approved ? (
              <Button
                loading={isApproving}
                onClick={async () => {
                  if (!data) return
                  await approveOrder({
                    id: data.po.id
                  })
                  refetch()
                  notificationApi.success({
                    message: 'Order approved'
                  })
                }}
              >
                Approve
              </Button>
            ) : null}
            {id !== 'new' ? (
              <Button
                loading={generatePDFLoading}
                onClick={async () => {
                  const { url } = await generatePdf({
                    id: id?.toString() || ''
                  })
                  window.open(url)
                }}
                icon={<FilePdfOutlined />}
              >
                Generate PDF
              </Button>
            ) : null}
            {id !== 'new' ? (
              <Button
                loading={generateChinaPDFLoading}
                onClick={async () => {
                  const { url } = await generateChinaPdf({
                    id: id?.toString() || ''
                  })
                  window.open(url)
                }}
                icon={<FilePdfOutlined />}
              >
                Generate China PDF
              </Button>
            ) : null}
            {id !== 'new' ? (
              <Button
                icon={<MailOutlined />}
                loading={generatePDFLoading || sendingPdfEmail}
                onClick={async () => {
                  if (!data?.po.shippingAddressId)
                    return notificationApi.error({
                      message: 'Shipping Address is needed to generate pdf'
                    })
                  let confirmed = true
                  if (data.po.isEmailSent) {
                    confirmed = confirm(
                      'Are you sure you want to send email again?'
                    )
                  }
                  if (!confirmed) return
                  try {
                    const { attachmentId, purchaseOrder } = await generatePdf({
                      id: id?.toString() || ''
                    })
                    await sendPdfEmail({
                      attachmentId,
                      jsonData: JSON.stringify(purchaseOrder)
                    })
                    notificationApi.success({
                      message: 'Email sent'
                    })
                  } catch (err) {
                    notificationApi.error({
                      message: 'Error sending email'
                    })
                  }
                }}
              >
                Send PDF via Email
              </Button>
            ) : null}
            {id !== 'new' &&
            !['ADMINVIEWER', 'USERVIEWER'].includes(session?.user.role || '') &&
            (data?.po.stage === 'Open' || data?.po.stage === 'Fulfilment') ? (
              <Button
                onClick={() =>
                  setCreateFulfilmentDrawer({
                    comments: data.po.comments,
                    items: data.po.items
                      .filter(item => {
                        if (!item.inventoryItem) return true
                        if (item.inventoryItem.quantity < item.quantity)
                          return true
                        return false
                      })
                      .map(item => ({
                        poi: item.id,
                        itemId: item.itemId,
                        description: item.description,
                        quantity: 0,
                        orderQuantity: item.quantity,
                        maxQuantity:
                          item.quantity - (item.inventoryItem?.quantity || 0),
                        price: item.price,
                        unitId: item.unitId,
                        hsnCode: item.hsnCode,
                        gstRateId: item.gstRateId
                      })),
                    expenses: expenses
                      .filter(
                        ex => ex.showFulfilment && !ex.fulfilmentLogId && ex.id
                      )
                      .map(ex => ({
                        id: ex.id!,
                        description: ex.description,
                        price: ex.price,
                        gstRateId: ex.gstRateId,
                        isNew: false
                      }))
                  })
                }
              >
                Create Fulfilment
              </Button>
            ) : null}
            {data?.po.stage && <OrderStageTag stage={data.po.stage} />}
            {data?.po.approved && <Tag color="green">Approved</Tag>}
            <Select
              size="small"
              value={data?.po.stage}
              options={[
                {
                  label: 'Open',
                  value: 'Open'
                },
                {
                  label: 'Fulfilment',
                  value: 'Fulfilment'
                },
                {
                  label: 'Closed',
                  value: 'Closed'
                },
                {
                  label: 'Cancelled',
                  value: 'Cancelled'
                }
              ]}
              onChange={async val => {
                await changeStatus({
                  id: data!.po.id!,
                  stage: val as any
                })
                refetch()
              }}
            />
          </ActionRibbon>

          <Row gutter={16}>
            <Col span={24}>
              <Typography.Title level={4}>Primary Information</Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item label="Date" name="date">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="representativeUserId"
                label="Representative User"
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
                    debouncedUserSearch(search)
                  }}
                  notFoundContent={
                    usersLoading ? (
                      <span className="flex items-center justify-center">
                        <Spin size="small" />
                      </span>
                    ) : undefined
                  }
                  options={users?.users.map(item => ({
                    label: (item.name || '') + ' (' + item.email + ')',
                    value: item.id
                  }))}
                  onClear={() => setUserSearch(undefined)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="referenceId" label="Reference ID">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Supplier">
                <Input value={data?.po.supplier.name} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="paymentTermId" label="Payment Terms">
                <Select
                  showSearch
                  loading={paymentTermsLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={paymentTerms?.paymentTerms.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="shippingAddressId" label="Shipping Address">
                <Select
                  showSearch
                  loading={addressesLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={addresses?.addresses.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="comments" label="Special Comments">
                <Input.TextArea />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="currency" label="Currency">
                <Input readOnly />
              </Form.Item>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Line Items</Typography.Title>
            </Col>
            <Col span={24}>
              <Table
                size="small"
                bordered
                scroll={{ x: 800 }}
                columns={[
                  {
                    title: 'Sr. No.',
                    dataIndex: 'sr'
                  },
                  {
                    title: 'Item ID',
                    render: (_, record) =>
                      record.inquiryId ? (
                        <Link href={`/inquiries/${record.inquiryId}`}>
                          {record.itemId}
                        </Link>
                      ) : (
                        record.itemId
                      )
                  },
                  {
                    title: 'Sap Code',
                    render: (_, record) =>
                      record.edit ? (
                        <Input
                          value={record.sapCode || undefined}
                          onChange={e =>
                            setLineItems(prev =>
                              prev.map(li =>
                                li.id === record.id
                                  ? { ...li, sapCode: e.target.value }
                                  : li
                              )
                            )
                          }
                        />
                      ) : (
                        record.sapCode
                      )
                  },
                  {
                    title: 'Description',
                    render: (_, record) =>
                      record.edit ? (
                        <Input
                          value={record.description || undefined}
                          onChange={e =>
                            setLineItems(prev =>
                              prev.map(li =>
                                li.id === record.id
                                  ? { ...li, description: e.target.value }
                                  : li
                              )
                            )
                          }
                        />
                      ) : (
                        record.description
                      )
                  },
                  {
                    title: 'Size',
                    render: (_, record) =>
                      record.edit ? (
                        <Input
                          value={record.size || undefined}
                          onChange={e =>
                            setLineItems(prev =>
                              prev.map(li =>
                                li.id === record.id
                                  ? { ...li, size: e.target.value }
                                  : li
                              )
                            )
                          }
                        />
                      ) : (
                        record.size
                      )
                  },
                  {
                    title: 'Unit',
                    render: (_, record) =>
                      record.edit ? (
                        <Select
                          className="w-32"
                          showSearch
                          value={record.unitId}
                          options={units?.units.map(u => ({
                            label: u.name,
                            value: u.id
                          }))}
                          filterOption={(input, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          onChange={value =>
                            setLineItems(prev =>
                              prev.map(li =>
                                li.id === record.id
                                  ? { ...li, unitId: value }
                                  : li
                              )
                            )
                          }
                        />
                      ) : (
                        unitsObj[record.unitId || '']?.name
                      )
                  },
                  {
                    title: 'Price',
                    render: (_, record) =>
                      record.edit ? (
                        <InputNumber
                          readOnly={
                            record.inventoryItem?.quantity ? true : undefined
                          }
                          min={0}
                          value={record.price}
                          onChange={value =>
                            setLineItems(prev =>
                              prev.map(item =>
                                item.id === record.id
                                  ? { ...item, price: value || 0 }
                                  : item
                              )
                            )
                          }
                        />
                      ) : (
                        record.price
                      ),
                    sorter: (a, b) => a.price - b.price
                  },
                  {
                    title: 'Quantity',
                    render: (_, record) =>
                      record.edit ? (
                        <InputNumber
                          min={record.inventoryItem?.quantity}
                          max={record.soQuantity}
                          value={record.quantity}
                          onChange={value =>
                            setLineItems(prev =>
                              prev.map(item =>
                                item.id === record.id
                                  ? { ...item, quantity: value || 0 }
                                  : item
                              )
                            )
                          }
                        />
                      ) : (
                        record.quantity
                      ),
                    sorter: (a, b) => a.quantity - b.quantity
                  },
                  ...(lineItems.find(li => li.inventoryItem)
                    ? [
                        {
                          title: 'Quantity in inventory',
                          render: (_: any, record: any) =>
                            record.inventoryItem?.quantity
                        }
                      ]
                    : []),
                  ...(lineItems.find(li => li.inventoryItem?.quantityGone)
                    ? [
                        {
                          title: 'Quantity gone from inventory',
                          render: (_: any, record: any) =>
                            record.inventoryItem?.quantityGone
                        }
                      ]
                    : []),
                  {
                    title: 'GST Rate',
                    render: (_, record) =>
                      record.edit ? (
                        <Select
                          className="w-16"
                          showSearch
                          loading={gstRatesLoading}
                          value={record.gstRateId}
                          options={gstRates?.gstRates.map(g => ({
                            label: g.rate.toString(),
                            value: g.id
                          }))}
                          filterOption={(input, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          onChange={value =>
                            setLineItems(prev =>
                              prev.map(li =>
                                li.id === record.id
                                  ? { ...li, gstRateId: value }
                                  : li
                              )
                            )
                          }
                        />
                      ) : (
                        gstRatesObj[record.gstRateId || '']?.rate?.toString()
                      )
                  },
                  {
                    title: 'HSN Code',
                    render: (_, record) =>
                      record.edit ? (
                        <Input
                          className="w-24"
                          value={record.hsnCode || undefined}
                          onChange={e =>
                            setLineItems(prev =>
                              prev.map(li =>
                                li.id === record.id
                                  ? { ...li, hsnCode: e.target.value }
                                  : li
                              )
                            )
                          }
                        />
                      ) : (
                        record.hsnCode
                      )
                  },
                  {
                    title: 'Estimated Delivery Date',
                    render: (_, record) =>
                      record.edit ? (
                        <DatePicker
                          allowClear
                          showTime
                          value={
                            record.estimatedDeliveryDate
                              ? dayjs(record.estimatedDeliveryDate)
                              : undefined
                          }
                          onChange={e => {
                            setLineItems(prev =>
                              prev.map(li =>
                                li.id === record.id
                                  ? {
                                      ...li,
                                      estimatedDeliveryDate:
                                        e?.toDate() || undefined
                                    }
                                  : li
                              )
                            )
                          }}
                        />
                      ) : (
                        record.estimatedDeliveryDate?.toLocaleString()
                      )
                  },
                  {
                    title: 'Actions',
                    render: (_: any, record: any) => (
                      <Button
                        type="primary"
                        icon={record.edit ? <SaveOutlined /> : <EditOutlined />}
                        onClick={() =>
                          setLineItems(prev =>
                            prev.map(item =>
                              item.id === record.id
                                ? { ...item, edit: !item.edit }
                                : item
                            )
                          )
                        }
                      />
                    )
                  }
                ]}
                dataSource={lineItems.map((li, i) => ({
                  ...li,
                  sr: i + 1
                }))}
                rowKey="id"
                caption={
                  <div className="mx-2 flex flex-col font-semibold">
                    <Typography.Text>
                      Taxable Amount:{' '}
                      {parseFloat(
                        lineItems
                          .reduce(
                            (total, curr) => total + curr.price * curr.quantity,
                            0
                          )
                          .toFixed(2)
                      ).toLocaleString()}
                    </Typography.Text>
                    <Typography.Text>
                      Tax:{' '}
                      {parseFloat(
                        lineItems
                          .reduce(
                            (total, curr) =>
                              total +
                              ((curr.price *
                                gstRatesObj[curr.gstRateId || '']?.rate) /
                                100) *
                                curr.quantity,
                            0
                          )
                          .toFixed(2)
                      ).toLocaleString()}
                    </Typography.Text>
                    <div className="mt-1 flex gap-2">
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={async () => {
                          let sr = 1
                          const finalData = lineItems.map(li => ({
                            Id: li.id,
                            'Sr. No.': sr++,
                            'Order ID': data?.po.id2,
                            'Item ID': li.itemId,
                            Description: li.description,
                            Size: li.size,
                            Unit: unitsObj[li.unitId]?.name,
                            Price: li.price,
                            Quantity: li.quantity,
                            GST: gstRatesObj[li.gstRateId || '']?.rate,
                            'HSN Code': li.hsnCode
                          }))
                          const parser = new Parser()
                          const csv = parser.parse(finalData)

                          const element = document.createElement('a')
                          element.setAttribute(
                            'href',
                            'data:text/csv;charset=utf-8,' +
                              encodeURIComponent(csv)
                          )
                          element.setAttribute(
                            'download',
                            `Purchase-Order-${data?.po.id2}.csv`
                          )

                          element.style.display = 'none'
                          document.body.appendChild(element)

                          element.click()

                          document.body.removeChild(element)
                        }}
                      >
                        Download
                      </Button>
                      <Upload
                        multiple={false}
                        accept=".csv"
                        fileList={[]}
                        beforeUpload={async file => {
                          const text = await file.text()
                          const json = await csvtojson().fromString(text)
                          const newLineItems = [...lineItems]
                          for (const jd of json) {
                            const foundItem = newLineItems.find(
                              pli =>
                                pli.id === jd.Id || pli.itemId === jd['Item ID']
                            )
                            if (!foundItem) continue
                            const q = parseFloat(jd.Quantity)
                            if (isNaN(q)) continue
                            const p = parseFloat(jd.Price)
                            if (isNaN(p)) continue
                            const u = units?.units.find(u => u.name === jd.Unit)
                              ?.id
                            if (!u) continue
                            foundItem.description = jd.Description
                            foundItem.size = jd.Size || null
                            foundItem.price = p
                            foundItem.quantity = q
                            foundItem.unitId = u
                            foundItem.gstRateId = gstRates?.gstRates.find(
                              gst => gst.rate.toString() === jd.GST
                            )?.id
                            foundItem.hsnCode = jd['HSN Code']
                          }
                          setLineItems(newLineItems)
                          return false
                        }}
                      >
                        <Button icon={<UploadOutlined />}>Upload</Button>
                      </Upload>
                    </div>
                  </div>
                }
              />
            </Col>

            <Col span={24}>
              <Typography.Title level={4}>Expenses</Typography.Title>
            </Col>
            <Col span={24}>
              <Table
                size="small"
                bordered
                scroll={{ x: 800 }}
                columns={[
                  {
                    title: 'Sr. No.',
                    render: (_, __, i) => i + 1
                  },
                  {
                    title: 'Description',
                    render: (_, record) =>
                      record.edit ? (
                        <Select
                          className="w-full"
                          showSearch
                          loading={expensesLoading}
                          value={record.description}
                          options={expensesGlobal?.expenses.map(ex => ({
                            label: ex.name,
                            value: ex.name
                          }))}
                          filterOption={(input, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          onChange={e =>
                            setExpenses(prev =>
                              prev.map(ex =>
                                ex.key === record.key
                                  ? { ...ex, description: e }
                                  : ex
                              )
                            )
                          }
                        />
                      ) : (
                        record.description
                      )
                  },
                  {
                    title: 'Custome ID',
                    render: (_, record) =>
                      record.edit ? (
                        <Input
                          value={record.customId || undefined}
                          onChange={e =>
                            setExpenses(prev =>
                              prev.map(ex =>
                                ex.key === record.key
                                  ? { ...ex, customId: e.target.value }
                                  : ex
                              )
                            )
                          }
                        />
                      ) : (
                        record.customId
                      )
                  },
                  {
                    title: 'Price',
                    render: (_, record) =>
                      record.edit ? (
                        <InputNumber
                          min={0}
                          value={record.price}
                          onChange={value =>
                            setExpenses(prev =>
                              prev.map(ex =>
                                ex.key === record.key
                                  ? { ...ex, price: value || 0 }
                                  : ex
                              )
                            )
                          }
                        />
                      ) : (
                        record.price
                      ),
                    sorter: (a, b) => a.price - b.price
                  },
                  {
                    title: 'GST',
                    render: (_, record) =>
                      record.edit ? (
                        <Select
                          className="w-16"
                          showSearch
                          loading={gstRatesLoading}
                          value={record.gstRateId}
                          options={gstRates?.gstRates.map(g => ({
                            label: g.rate.toString(),
                            value: g.id
                          }))}
                          allowClear
                          filterOption={(input, option) =>
                            (option?.label ?? '')
                              .toLowerCase()
                              .includes(input.toLowerCase())
                          }
                          onChange={value =>
                            setExpenses(prev =>
                              prev.map(ex =>
                                ex.key === record.key
                                  ? { ...ex, gstRateId: value }
                                  : ex
                              )
                            )
                          }
                        />
                      ) : (
                        gstRatesObj[record.gstRateId || '']?.rate?.toString()
                      )
                  },
                  {
                    title: 'Show in Fulfilment',
                    dataIndex: 'showInFulfilment',
                    render: (_, record) =>
                      record.edit ? (
                        <Checkbox
                          checked={record.showFulfilment}
                          onChange={e =>
                            setExpenses(prev =>
                              prev.map(ex =>
                                ex.key === record.key
                                  ? { ...ex, showFulfilment: e.target.checked }
                                  : ex
                              )
                            )
                          }
                        />
                      ) : record.showFulfilment ? (
                        <Tag color="green">Yes</Tag>
                      ) : (
                        <Tag color="red">No</Tag>
                      )
                  },
                  ...(data?.po.stage === 'Pending' ||
                  data?.po.stage === 'Open' ||
                  data?.po.stage === 'Fulfilment'
                    ? [
                        {
                          title: 'Actions',
                          render: (_: any, record: any) => (
                            <Space>
                              <Button
                                type="primary"
                                icon={
                                  record.edit ? (
                                    <SaveOutlined />
                                  ) : (
                                    <EditOutlined />
                                  )
                                }
                                onClick={() =>
                                  setExpenses(prev =>
                                    prev.map(ex =>
                                      ex.key === record.key
                                        ? { ...ex, edit: !ex.edit }
                                        : ex
                                    )
                                  )
                                }
                              />
                              <Button
                                type="primary"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() =>
                                  setExpenses(prev =>
                                    prev.filter(p => p.key !== record.key)
                                  )
                                }
                              />
                            </Space>
                          )
                        }
                      ]
                    : [])
                ]}
                dataSource={expenses}
                rowKey="key"
                caption={
                  <div className="mx-2 flex flex-col gap-2">
                    <div className="flex flex-col font-semibold">
                      <Typography.Text>
                        Taxable Amount:{' '}
                        {parseFloat(
                          expenses
                            .reduce((total, curr) => total + curr.price, 0)
                            .toFixed(2)
                        ).toLocaleString()}
                      </Typography.Text>
                      <Typography.Text>
                        Tax:{' '}
                        {parseFloat(
                          expenses
                            .reduce(
                              (total, curr) =>
                                total +
                                (curr.price *
                                  (gstRatesObj[curr.gstRateId || '']?.rate ||
                                    0)) /
                                  100,
                              0
                            )
                            .toFixed(2)
                        ).toLocaleString()}
                      </Typography.Text>
                    </div>
                    <Button
                      className="max-w-fit"
                      onClick={() =>
                        setExpenses(prev => [
                          ...prev,
                          {
                            key: Math.random().toString(),
                            description: '',
                            price: 0,
                            showFulfilment: true,
                            edit: true
                          }
                        ])
                      }
                      icon={<PlusOutlined />}
                    >
                      Add new
                    </Button>
                  </div>
                }
                pagination={false}
              />
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Fulfilment Logs</Typography.Title>
            </Col>
            <Col span={24}>
              <Table
                size="small"
                bordered
                scroll={{ x: 800 }}
                columns={[
                  {
                    title: 'Sr. No.',
                    render: (_, record, i) => (
                      <Link href={`/fulfilments/${record.id}`}>{i + 1}</Link>
                    )
                  },
                  {
                    title: 'Gate Entry no.',
                    dataIndex: 'gateEntryNumber'
                  },
                  {
                    title: 'Gate Entry Date',
                    render: (_, record) => record.gateEntryDate.toLocaleString()
                  },
                  {
                    title: 'Invoice Id',
                    dataIndex: 'invoiceId'
                  },
                  {
                    title: 'Invoice Date',
                    render: (_, record) =>
                      record.invoiceDate.toLocaleDateString()
                  },
                  {
                    title: 'No. of line items',
                    render: (_, record) => record._count.items
                  },
                  {
                    title: 'Created At',
                    render: (_, record) => record.createdAt.toLocaleString()
                  },
                  {
                    title: 'Created By',
                    render: (_, record) => (
                      <Link href={`/users/${record.createdBy.id}`}>
                        {record.createdBy.name}
                      </Link>
                    )
                  }
                ]}
                dataSource={data?.fulfilments}
                pagination={false}
              />
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Email Sents</Typography.Title>
            </Col>
            <Col span={24}>
              <Table
                size="small"
                bordered
                scroll={{ x: 800 }}
                columns={[
                  {
                    title: 'Sr. No.',
                    render: (_, __, i) => i + 1
                  },
                  {
                    title: 'Sent At',
                    render: (_, record) => record.createdAt.toLocaleString()
                  },
                  {
                    title: 'Sent By',
                    render: (_, record) => (
                      <Link href={`/users/${record.createdBy.id}`}>
                        {record.createdBy.name}
                      </Link>
                    )
                  }
                ]}
                dataSource={data?.po.emailHistory}
                pagination={false}
              />
            </Col>
          </Row>
        </Form>
        {data ? (
          <Descriptions bordered className="mt-12">
            <Descriptions.Item label="ID">{data.po.id}</Descriptions.Item>
            <Descriptions.Item label="Purchase Order ID">
              {data.po.id2}
            </Descriptions.Item>
            {data.po.salesOrder ? (
              <Descriptions.Item label="Related Sales Order">
                <Link href={`/orders/sales/${data.po.salesOrder.id}`}>
                  {data.po.salesOrder.id2}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.po.createdBy ? (
              <Descriptions.Item label="Created By">
                <Link href={`/users/${data.po.createdById}`}>
                  {data.po.createdBy.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.po.updatedBy ? (
              <Descriptions.Item label="Updated By">
                <Link href={`/users/${data.po.updatedById}`}>
                  {data.po.updatedBy?.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Created At">
              {data.po.createdAt.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {data.po.updatedAt.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Pdf sent over email">
              {data.po.isEmailSent ? (
                <Tag color="green">Yes</Tag>
              ) : (
                <Tag color="red">No</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="No. of times pdf email sent">
              {data.po.emailHistory.length}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
        <Drawer
          destroyOnClose
          open={!!createFulfilmentDrawer}
          onClose={() => setCreateFulfilmentDrawer(null)}
          width="80%"
          maskClosable={false}
        >
          {createFulfilmentDrawer ? (
            <>
              <Form
                onFinish={async formData => {
                  try {
                    for (const item of createFulfilmentDrawer.items) {
                      if (item.quantity) {
                        if (item.quantity > item.maxQuantity) {
                          return notificationApi.error({
                            message: `Quantity for ${item.description} cannot be greater than ${item.maxQuantity}`
                          })
                        }
                      }
                    }
                    const createdId = await createInventoryItems({
                      gateEntryNumber: formData.gateEntryNumber,
                      gateEntryDate: formData.gateEntryDate.toDate(),
                      invoiceId: formData.invoiceId,
                      supplierId: data!.po.supplierId,
                      invoiceDate: formData.invoiceDate.toDate(),
                      location: formData.location,
                      remarks: formData.remarks,
                      purchaseOrderId: data?.po.id || '',
                      items: createFulfilmentDrawer.items
                        .filter(item => item.quantity)
                        .map(item => ({
                          purchaseOrderItemId: item.poi,
                          quantity: item.quantity,
                          hsnCode: item.hsnCode,
                          gstRateId: item.gstRateId
                        })),
                      expenses: createFulfilmentDrawer.expenses.map(ex => ({
                        id: ex.id,
                        price: ex.price,
                        gstRateId: ex.gstRateId,
                        isNew: ex.isNew,
                        description: ex.description
                      }))
                    })
                    notificationApi.success({
                      message: 'Created Fulfilment'
                    })
                    if (createdId) router.push(`/fulfilments/${createdId}`)
                  } catch (err) {
                    notificationApi.error({
                      message: 'Failed to create fulfilment'
                    })
                  }
                }}
                layout="vertical"
                initialValues={{
                  comments: createFulfilmentDrawer.comments,
                  location: 'Unloading area',
                  gateEntryDate: dayjs()
                }}
              >
                <Button
                  className="mb-2"
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={createInventoryItemsLoading}
                >
                  Save
                </Button>
                <Typography.Title level={5}>
                  Taxable Amount:{' '}
                  {parseFloat(
                    (fulfilmentItemsTotal + fulfilmentExpensesTotal).toFixed(2)
                  ).toLocaleString()}
                </Typography.Title>
                <Typography.Title level={5}>
                  Total Tax:{' '}
                  {parseFloat(
                    (fulfilmentItemsTax + fulfilmentExpensesTax).toFixed(2)
                  ).toLocaleString()}
                </Typography.Title>
                <Typography.Title level={5}>
                  Total:{' '}
                  {parseFloat(
                    (
                      fulfilmentItemsTotal +
                      fulfilmentExpensesTotal +
                      fulfilmentItemsTax +
                      fulfilmentExpensesTax
                    ).toFixed(2)
                  ).toLocaleString()}
                </Typography.Title>
                <div className="mb-2 mt-4 grid gap-4 md:grid-cols-2">
                  <Form.Item name="comments" label="Special Comments">
                    <Input.TextArea readOnly />
                  </Form.Item>
                  <Form.Item
                    name="gateEntryNumber"
                    label="Gate Entry no."
                    rules={[
                      {
                        required: true
                      }
                    ]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="gateEntryDate"
                    label="Gate Entry Date & Time"
                    rules={[
                      {
                        required: true
                      }
                    ]}
                  >
                    <DatePicker className="w-full" showTime />
                  </Form.Item>
                  <Form.Item
                    name="invoiceId"
                    label="Invoice Id"
                    rules={[
                      {
                        required: true
                      }
                    ]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="invoiceDate"
                    label="Invoice Date"
                    rules={[
                      {
                        required: true
                      }
                    ]}
                  >
                    <DatePicker className="w-full" />
                  </Form.Item>
                  <Form.Item
                    name="location"
                    label="Location"
                    rules={[
                      {
                        required: true
                      }
                    ]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item name="remarks" label="Remarks">
                    <Input.TextArea />
                  </Form.Item>
                </div>
              </Form>
              <Table
                size="small"
                bordered
                scroll={{ x: 800 }}
                columns={[
                  {
                    title: 'Sr. No.',
                    dataIndex: 'sr'
                  },
                  {
                    title: 'Item ID',
                    dataIndex: 'itemId'
                  },
                  {
                    title: 'Description',
                    dataIndex: 'description'
                  },
                  {
                    title: 'Price',
                    dataIndex: 'price',
                    sorter: (a, b) => a.price - b.price
                  },
                  {
                    title: 'Unit',
                    dataIndex: 'unitId',
                    render: unitId => unitsObj[unitId]?.name
                  },
                  {
                    title: 'GST',
                    render: (_, record) => (
                      <Select
                        className="w-16"
                        showSearch
                        value={record.gstRateId}
                        options={gstRates?.gstRates.map(g => ({
                          label: g.rate.toString(),
                          value: g.id
                        }))}
                        filterOption={(input, option) =>
                          (option?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        onChange={value =>
                          setCreateFulfilmentDrawer(prev =>
                            !prev
                              ? prev
                              : {
                                  ...prev,
                                  items: prev.items.map(item =>
                                    item.poi === record.poi
                                      ? {
                                          ...item,
                                          gstRateId: value
                                        }
                                      : item
                                  )
                                }
                          )
                        }
                      />
                    )
                  },
                  {
                    title: 'Order Quantity',
                    dataIndex: 'orderQuantity',
                    sorter: (a, b) => a.orderQuantity - b.orderQuantity
                  },
                  {
                    title: 'Max Quantity',
                    dataIndex: 'maxQuantity'
                  },
                  {
                    title: 'Quantity',
                    render: (_, record) => (
                      <InputNumber
                        min={0}
                        value={record.quantity}
                        onChange={value =>
                          setCreateFulfilmentDrawer(prev =>
                            !prev
                              ? prev
                              : {
                                  ...prev,
                                  items: prev!.items.map(item =>
                                    item.poi === record.poi
                                      ? { ...item, quantity: value || 0 }
                                      : item
                                  )
                                }
                          )
                        }
                      />
                    ),
                    sorter: (a, b) => a.quantity - b.quantity
                  },
                  {
                    title: 'HSN Code',
                    render: (_, record) => (
                      <Input
                        value={record.hsnCode || ''}
                        onChange={e =>
                          setCreateFulfilmentDrawer(prev =>
                            !prev
                              ? prev
                              : {
                                  ...prev,
                                  items: prev.items.map(item =>
                                    item.poi === record.poi
                                      ? { ...item, hsnCode: e.target.value }
                                      : item
                                  )
                                }
                          )
                        }
                      />
                    )
                  }
                ]}
                dataSource={createFulfilmentDrawer.items.map((li, i) => ({
                  ...li,
                  sr: i + 1
                }))}
                rowKey="itemId"
                caption={
                  <div className="mx-2 flex flex-col font-semibold">
                    <Typography>
                      Taxable Amount: {fulfilmentItemsTotal.toLocaleString()}
                    </Typography>
                    <Typography>
                      Tax: {fulfilmentItemsTax.toLocaleString()}
                    </Typography>
                    <Typography>
                      Total:{' '}
                      {parseFloat(
                        (fulfilmentItemsTotal + fulfilmentItemsTax).toFixed(2)
                      ).toLocaleString()}
                    </Typography>
                  </div>
                }
              />

              <Typography.Title level={5}>Expenses</Typography.Title>
              <Table
                size="small"
                bordered
                scroll={{ x: 800 }}
                columns={[
                  {
                    title: 'Sr. No.',
                    render: (_, __, i) => i + 1
                  },
                  {
                    title: 'Description',
                    render: (_, record) => (
                      <Select
                        className="w-full"
                        showSearch
                        loading={expensesLoading}
                        value={record.description}
                        options={expensesGlobal?.expenses.map(ex => ({
                          label: ex.name,
                          value: ex.name
                        }))}
                        filterOption={(input, option) =>
                          (option?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        onChange={value =>
                          setCreateFulfilmentDrawer(prev =>
                            !prev
                              ? prev
                              : {
                                  ...prev,
                                  expenses: prev.expenses.map(ex =>
                                    ex.id === record.id
                                      ? { ...ex, description: value }
                                      : ex
                                  )
                                }
                          )
                        }
                      />
                    )
                  },
                  {
                    title: 'GST',
                    render: (_, record) => (
                      <Select
                        className="w-16"
                        showSearch
                        loading={gstRatesLoading}
                        value={record.gstRateId}
                        options={gstRates?.gstRates.map(g => ({
                          label: g.rate.toString(),
                          value: g.id
                        }))}
                        filterOption={(input, option) =>
                          (option?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        onChange={value =>
                          setCreateFulfilmentDrawer(prev =>
                            !prev
                              ? prev
                              : {
                                  ...prev,
                                  expenses: prev.expenses.map(ex =>
                                    ex.id === record.id
                                      ? { ...ex, gstRateId: value }
                                      : ex
                                  )
                                }
                          )
                        }
                      />
                    )
                  },
                  {
                    title: 'Price',
                    render: (_, record) => (
                      <InputNumber
                        min={0}
                        value={record.price}
                        onChange={value =>
                          setCreateFulfilmentDrawer(prev =>
                            !prev
                              ? prev
                              : {
                                  ...prev,
                                  expenses: prev.expenses.map(ex =>
                                    ex.id === record.id
                                      ? { ...ex, price: value || 0 }
                                      : ex
                                  )
                                }
                          )
                        }
                      />
                    )
                  },
                  {
                    title: 'Actions',
                    render: (_, record) =>
                      record.isNew ? (
                        <Button
                          type="primary"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() =>
                            setCreateFulfilmentDrawer(prev =>
                              !prev
                                ? prev
                                : {
                                    ...prev,
                                    expenses: prev.expenses.filter(
                                      ex => ex.id !== record.id
                                    )
                                  }
                            )
                          }
                        />
                      ) : null
                  }
                ]}
                dataSource={createFulfilmentDrawer.expenses}
                rowKey="key"
                pagination={false}
                caption={
                  <div className="mx-2 flex flex-col font-semibold">
                    <Button
                      className="mb-2 max-w-fit"
                      onClick={() =>
                        setCreateFulfilmentDrawer(prev =>
                          !prev
                            ? prev
                            : {
                                ...prev,
                                expenses: [
                                  ...prev.expenses,
                                  {
                                    id: Math.random().toString(),
                                    description: '',
                                    price: 0,
                                    gstRateId: undefined,
                                    isNew: true
                                  }
                                ]
                              }
                        )
                      }
                      icon={<PlusOutlined />}
                    >
                      Add new
                    </Button>
                    <Typography.Text>
                      Taxable Amount: {fulfilmentExpensesTotal.toLocaleString()}
                    </Typography.Text>
                    <Typography.Text>
                      Tax: {fulfilmentExpensesTax.toLocaleString()}
                    </Typography.Text>
                    <Typography.Text>
                      Total:{' '}
                      {parseFloat(
                        (
                          fulfilmentExpensesTotal + fulfilmentExpensesTax
                        ).toFixed(2)
                      ).toLocaleString()}
                    </Typography.Text>
                  </div>
                }
              />
            </>
          ) : null}
        </Drawer>
      </Card>
    </Layout>
  )
}

export default OrderPage
