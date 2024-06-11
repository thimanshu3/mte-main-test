import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  OrderedListOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
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
import type { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { ActionRibbon } from '~/components/ActionsRibbon'
import { Layout } from '~/components/Layout'
import { OrderStageTag } from '~/components/OrderStageTag'
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

type LineItem = {
  id: string
  itemId: string
  inquiryId?: string | null
  inquiry?: any
  description?: string | null
  size?: string | null
  unitId?: string | null
  price?: number | null
  quantity?: number | null
  edit: boolean
  po: boolean
  invoiceQuantity: number
}

type Expense = {
  key: string
  id?: string | null
  description: string
  price: number
  edit: boolean
  customId?: string | null
}

type POLineItem = {
  id: string
  itemId: string
  sapCode?: string | null
  inquiryId?: string | null
  inquiry?: any
  description?: string | null
  size?: string | null
  unitId?: string | null
  price?: number | null
  soPrice: number
  quantity?: number | null
  gstRateId?: string | null
  hsnCode?: string | null
  estimatedDeliveryDate?: Date | null
  supplierId?: string | null
  edit: boolean
}

type InvoiceLineItem = {
  soi: string
  description: string
  quantity: number
  maxQuantity: number
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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [createPurchaseOrderModal, setCreatePurchaseOrderModal] = useState<
    POLineItem[] | false
  >()
  const [createInvoiceDrawer, setCreateInvoiceDrawer] = useState<
    InvoiceLineItem[]
  >([])

  // ? useQuery
  const { data, isLoading, refetch } = api.orders.sales.getOne.useQuery(
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
  const { data: suppliers, isLoading: suppliersLoading } =
    api.suppliers.getAllMini.useQuery(
      {
        page: 1,
        limit: 1000
      },
      {
        enabled: !!session && !!createPurchaseOrderModal
      }
    )
  const { data: gstRates, isLoading: gstRatesLoading } =
    api.gstRates.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session && !!createPurchaseOrderModal }
    )
  const { data: ports, isLoading: portsLoading } =
    api.ports.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: lut, isLoading: lutLoading } = api.Lut.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
  )
  const { data: IecCode, isLoading: IecLoading } =
    api.IecCode.getAllMini.useQuery(
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
  const { data: exporterDetails, isLoading: exporterDetailsLoading } =
    api.exporterDetails.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: notifyParty, isLoading: notifyPartyLoading } =
    api.notifyParty.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: currency, isLoading: currencyLoading } =
    api.currency.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )

  // ? useMutation
  const { mutateAsync, isLoading: isUpdating } =
    api.orders.sales.updateOne.useMutation()
  const { mutateAsync: createPO, isLoading: isCreatingPO } =
    api.orders.purchase.createOneFromSalesOrder.useMutation()
  const { mutateAsync: generatePdf, isLoading: generatePDFLoading } =
    api.orders.sales.generatePdf.useMutation()
  const { mutateAsync: createInvoice, isLoading: creatingInvoice } =
    api.orders.invoices.createOne.useMutation()
  const { mutateAsync: approveOrder, isLoading: isApproving } =
    api.orders.sales.approve.useMutation()
  const { mutateAsync: changeStatus } =
    api.orders.sales.changeStatus.useMutation()

  // ? useEffect
  useEffect(() => {
    if (data) {
      setUserSearch(data.so.representativeUserId)
      setLineItems(
        data.so.items.map(item => ({
          id: item.id,
          itemId: item.itemId,
          inquiryId: item.inquiryId,
          inquiry: item.inquiry,
          description: item.description,
          size: item.size,
          unitId: item.unitId,
          price: item.price,
          quantity: item.quantity,
          edit: false,
          po: item.purchaseOrderItems.length > 0,
          invoiceQuantity: item.invoiceItems.reduce(
            (acc, curr) => acc + curr.quantity,
            0
          )
        }))
      )
      setExpenses(
        data.so.expenses.map(e => ({
          key: e.id,
          id: e.id,
          description: e.description,
          price: e.price,
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
  const suppliersObj = useMemo(() => {
    const obj: any = {}
    suppliers?.suppliers.forEach(u => {
      obj[u.id] = u
    })
    return obj
  }, [suppliers])
  const gstRatesObj = useMemo(() => {
    const obj: any = {}
    gstRates?.gstRates.forEach(u => {
      obj[u.id] = u
    })
    return obj
  }, [gstRates])

  // ? useNotification
  const notificationApi = useNotificationApi()

  // ? useMessage
  const messageApi = useMessageApi()

  const canGenerateInvoice = useMemo(() => {
    let flag = false
    if (data) {
      if (data.so.stage === 'Closed' || data.so.stage === 'Cancelled')
        return false
      for (const i of data.so.items) {
        const q = i.quantity
        const invoicedQuantity = parseFloat(
          i.invoiceItems
            .reduce((total, curr) => total + curr.quantity, 0)
            .toFixed(2)
        )
        if (q > invoicedQuantity) {
          flag = true
          break
        }
      }
    }
    return flag
  }, [data])

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
          label: 'Sales',
          link: '/orders/sales'
        },
        {
          label: data?.so.id2 || 'Loading'
        }
      ]}
      title={`Sales Order - ${data?.so.id2 || id}`}
    >
      <Card>
        <Form
          onFinish={async formData => {
            try {
              await mutateAsync({
                id: data?.so.id || '',
                date: formData.date.toDate(),
                representativeUserId: formData.representativeUserId,
                referenceId: formData.referenceId,
                lineItems: lineItems.map(li => ({
                  id: li.id,
                  description: li.description,
                  size: li.size,
                  unitId: li.unitId,
                  price: li.price,
                  quantity: li.quantity
                })) as any[],
                expenses: expenses.map(e => ({
                  id: e.id,
                  description: e.description,
                  price: e.price
                }))
              })
              refetch()
              notificationApi.success({
                message: 'Sales Order updated'
              })
            } catch (err) {
              notificationApi.success({
                message: 'Error saving Sales Order'
              })
            }
          }}
          layout="vertical"
          initialValues={{
            representativeUserId: data?.so.representativeUserId,
            referenceId: data?.so.referenceId,
            date: dayjs(data?.so.date),
            currency: data?.so.currency?.name
          }}
        >
          <ActionRibbon>
            {!['ADMINVIEWER', 'USERVIEWER'].includes(
              session?.user.role || ''
            ) &&
            data?.so.items.find(item => !item.purchaseOrderItems.length) ? (
              <Button
                type="primary"
                className="m-2"
                disabled={isUpdating}
                onClick={() =>
                  setCreatePurchaseOrderModal(
                    data.so.items
                      .filter(item => !item.purchaseOrderItems.length)
                      .map(item => ({
                        id: item.id,
                        itemId: item.itemId,
                        inquiryId: item.inquiryId,
                        inquiry: item.inquiry,
                        description:
                          item.inquiry?.purchaseDescription || item.description,
                        size: item.size,
                        unitId: item.inquiry?.purchaseUnitId || item.unitId,
                        price: item.inquiry?.supplierPrice || undefined,
                        soPrice: item.price,
                        quantity: item.quantity,
                        supplierId: item.inquiry?.supplierId,
                        gstRateId: item.inquiry?.gstRateId,
                        hsnCode: item.inquiry?.hsnCode,
                        estimatedDeliveryDate: item.inquiry
                          ?.estimatedDeliveryDays
                          ? dayjs()
                              .endOf('day')
                              .add(item.inquiry.estimatedDeliveryDays, 'day')
                              .toDate()
                          : undefined,
                        edit: false
                      }))
                  )
                }
              >
                Create Purchase Order
              </Button>
            ) : null}
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
              <Link href="/orders/sales/new">
                <Button icon={<PlusOutlined />} disabled={isUpdating}>
                  New
                </Button>
              </Link>
            ) : null}
            {!['ADMINVIEWER', 'USERVIEWER'].includes(
              session?.user.role || ''
            ) &&
            id !== 'new' &&
            !data?.so.approved ? (
              <Button
                loading={isApproving}
                onClick={async () => {
                  if (!data) return
                  await approveOrder({
                    id: data.so.id
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
            {id !== 'new' &&
            !['ADMINVIEWER', 'USERVIEWER'].includes(session?.user.role || '') &&
            canGenerateInvoice ? (
              <Button
                icon={<OrderedListOutlined />}
                disabled={isUpdating}
                onClick={() =>
                  setCreateInvoiceDrawer(
                    data?.so.items
                      .filter(item => {
                        const invoicedQuantity = parseFloat(
                          item.invoiceItems
                            .reduce((total, curr) => total + curr.quantity, 0)
                            .toFixed(2)
                        )
                        if (invoicedQuantity >= item.quantity) return false
                        return true
                      })
                      .map(item => ({
                        soi: item.id,
                        description: item.description,
                        quantity: 0,
                        maxQuantity: parseFloat(
                          item.purchaseOrderItems
                            .reduce((total, curr) => {
                              return (
                                total +
                                (curr.inventoryItem
                                  ? curr.inventoryItem.quantity -
                                    curr.inventoryItem.quantityGone
                                  : 0)
                              )
                            }, 0)
                            .toFixed(2)
                        )
                      }))
                      .filter(i => i.maxQuantity) || []
                  )
                }
              >
                Create Invoice
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
            {data?.so.stage && <OrderStageTag stage={data.so.stage} />}
            {data?.so.approved && <Tag color="green">Approved</Tag>}
            <Select
              value={data?.so.stage}
              size="small"
              options={[
                {
                  label: 'Pending',
                  value: 'Pending'
                },
                {
                  label: 'Open',
                  value: 'Open'
                },
                {
                  label: 'Invoice',
                  value: 'Invoice'
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
                  id: data!.so.id!,
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
              <Form.Item label="Customer">
                <Input value={data?.so.customer.name} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Site">
                <Input value={data?.so.site?.name} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="PR Number and Name">
                <Input value={data?.so.prNumberAndName || undefined} />
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
                                  ? { ...li, unitId: value || undefined }
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
                          min={record.invoiceQuantity}
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
                    sorter: (a, b) => (a.price || 0) - (b.price || 0)
                  },
                  {
                    title: 'Quantity',
                    render: (_, record) =>
                      record.edit ? (
                        <InputNumber
                          min={0}
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
                    sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0)
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
                  <Typography.Title level={5} className="ml-4">
                    Total:
                    <span className="ml-2">
                      {parseFloat(
                        lineItems
                          .reduce(
                            (total, curr) =>
                              total + (curr.price || 0) * (curr.quantity || 0),
                            0
                          )
                          .toFixed(2)
                      ).toFixed(2)}
                    </span>
                    <div className="mt-1 flex gap-2">
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={async () => {
                          let sr = 1
                          const finalData = lineItems.map(li => ({
                            Id: li.id,
                            'Sr. No.': sr++,
                            'Order ID': data?.so.id2,
                            'Item ID': li.itemId,
                            Description: li.description,
                            Size: li.size,
                            Unit: unitsObj[li.unitId || '']?.name,
                            Price: li.price,
                            Quantity: li.quantity
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
                            `Sales-Order-${data?.so.id2}.csv`
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
                          }
                          setLineItems(newLineItems)
                          return false
                        }}
                      >
                        <Button icon={<UploadOutlined />}>Upload</Button>
                      </Upload>
                    </div>
                  </Typography.Title>
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
                    title: 'Custom ID',
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
                  ...(data?.so.stage === 'Pending' ||
                  data?.so.stage === 'Open' ||
                  data?.so.stage === 'Invoice'
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
                        Total:{' '}
                        {parseFloat(
                          expenses
                            .reduce((total, curr) => total + curr.price, 0)
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
              <Typography.Title level={4}>Purchase Orders</Typography.Title>
            </Col>
            <Col span={24}>
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
                    title: 'Order ID',
                    render: (_, record) => (
                      <Link href={`/orders/purchase/${record.id}`}>
                        {record.id2}
                      </Link>
                    )
                  },
                  {
                    title: 'Date',
                    render: (_, record) => record.date.toLocaleDateString()
                  },
                  {
                    title: 'Supplier',
                    render: (_, record) => record.supplier.name
                  },
                  {
                    title: 'Total Amount',
                    render: (_, record) => record.totalAmount.toLocaleString()
                  },
                  {
                    title: 'No. of line items',
                    render: (_, record) => record._count.items
                  }
                ]}
                dataSource={data?.so.purchaseOrders}
                rowKey="id"
              />
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Invoices</Typography.Title>
            </Col>
            <Col span={24}>
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
                    title: 'Invoice ID',
                    render: (_, record: any) => (
                      <Link href={`/invoices/${record.id}`}>
                        {record.id2 || record.id}
                      </Link>
                    )
                  },
                  {
                    title: 'Type',
                    render: (_, record: any) => (record.id2 ? 'Final' : 'Draft')
                  },
                  {
                    title: 'Date',
                    render: (_, record) => record.date.toLocaleDateString()
                  },
                  {
                    title: 'No. of line items',
                    render: (_, record) => record._count.items
                  },
                  {
                    title: 'Total Amount',
                    render: (_, record) => record.total.toLocaleString()
                  },
                  {
                    title: 'Created By',
                    dataIndex: 'createdBy',
                    render: createdBy => (
                      <Link href={`/users/${createdBy?.id}`}>
                        {createdBy?.name}
                      </Link>
                    )
                  },
                  {
                    title: 'Created At',
                    dataIndex: 'createdAt',
                    render: date => date.toLocaleString(),
                    sorter: true
                  }
                ]}
                dataSource={
                  data ? [...data.invoices, ...data.draftInvoices] : undefined
                }
                rowKey="id"
              />
            </Col>
          </Row>
        </Form>
        <Divider />
        {data ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{data.so.id}</Descriptions.Item>
            <Descriptions.Item label="Sales Order ID">
              {data.so.id2}
            </Descriptions.Item>
            {data.so.createdBy ? (
              <Descriptions.Item label="Created By">
                <Link href={`/users/${data.so.createdById}`}>
                  {data.so.createdBy.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.so.updatedBy ? (
              <Descriptions.Item label="Updated By">
                <Link href={`/users/${data.so.updatedById}`}>
                  {data.so.updatedBy?.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Created At">
              {data.so.createdAt.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {data.so.updatedAt.toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Card>

      <Drawer
        open={!!createPurchaseOrderModal}
        destroyOnClose
        footer={null}
        onClose={() => setCreatePurchaseOrderModal(false)}
        maskClosable={false}
        title="Create Purchase Order"
        width="100%"
      >
        <Form
          layout="vertical"
          onFinish={async formData => {
            if (!Array.isArray(createPurchaseOrderModal)) return

            const obj: Record<string, POLineItem[]> = {}

            for (let i = 0; i < createPurchaseOrderModal.length; i++) {
              const item = createPurchaseOrderModal[i]
              if (!item?.description)
                return messageApi.error(
                  'Description is required in line ' + (i + 1)
                )

              if (!item?.supplierId)
                return messageApi.error(
                  'Supplier is required in line ' + (i + 1)
                )

              if (!item?.unitId)
                return messageApi.error('Unit is required in line ' + (i + 1))

              if (!item?.price)
                return messageApi.error('Price is required in line ' + (i + 1))

              if (item.price > item.soPrice) {
                const confirmation = confirm(
                  `Sales price for "${item.description}" is ${item.soPrice} but you are entering ${item.price}. Are you sure you want to continue?`
                )
                if (!confirmation) return
              }

              if (!item?.quantity)
                return messageApi.error(
                  'Quantity is required in line ' + (i + 1)
                )

              if (
                item?.hsnCode &&
                !(
                  item.hsnCode.length === 4 ||
                  item.hsnCode.length === 6 ||
                  item.hsnCode.length === 8
                )
              )
                return messageApi.error(
                  'HSN Code must be 4, 6, 8 digits in line ' + (i + 1)
                )

              if (!item?.gstRateId)
                return messageApi.error(
                  'GST Rate is required in line ' + (i + 1)
                )

              if (!obj[item.supplierId]) obj[item.supplierId] = []
              obj[item.supplierId!]!.push(item)
            }

            try {
              await createPO(
                Object.entries(obj).map(([key, items]) => ({
                  date: formData.date.toDate(),
                  representativeUserId: data?.so.representativeUserId!,
                  salesOrderId: data?.so.id!,
                  supplierId: key,
                  referenceId: formData.referenceId || null,
                  currencyId: formData.currencyId,
                  lineItems: items.map(item => ({
                    sapCode: item.sapCode,
                    description: item.description!,
                    size: item.size,
                    unitId: item.unitId!,
                    price: item.price!,
                    quantity: item.quantity!,
                    gstRateId: item.gstRateId!,
                    hsnCode: item.hsnCode!,
                    estimatedDeliveryDate: item.estimatedDeliveryDate,
                    salesOrderItemId: item.id,
                    inquiryId: item.inquiryId,
                    itemId: item.itemId
                  }))
                }))
              )
              setCreatePurchaseOrderModal(false)
              notificationApi.success({
                message: 'Purchase Order(s) created'
              })
              refetch()
              return
            } catch (err) {
              notificationApi.error({
                message: 'Error creating purchase order'
              })
              return
            }
          }}
          initialValues={{
            date: dayjs().startOf('day'),
            referenceId: data?.so.referenceId
          }}
        >
          <Button
            className="mb-3"
            type="primary"
            htmlType="submit"
            size="large"
            icon={<SaveOutlined />}
            loading={isCreatingPO}
            disabled={
              !(
                Array.isArray(createPurchaseOrderModal) &&
                createPurchaseOrderModal.length
              )
            }
          >
            Save
          </Button>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Reference ID" name="referenceId">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Date" name="date">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currencyId"
                label="Currency"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  options={currency?.currencies.map(c => ({
                    label: c.name + ' (' + c.symbol + ')',
                    value: c.id
                  }))}
                  loading={currencyLoading}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              {Array.isArray(createPurchaseOrderModal) ? (
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
                      title: 'Item ID',
                      dataIndex: 'itemId',
                      render: (itemId, record) =>
                        record.inquiry ? (
                          <Link href={`/inquiries/${record.inquiry.id}`}>
                            {itemId}
                          </Link>
                        ) : null
                    },
                    {
                      title: 'Sap Code',
                      render: (_, record) =>
                        record.edit ? (
                          <Input
                            value={record.sapCode || undefined}
                            onChange={e =>
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? { ...li, sapCode: e.target.value }
                                        : li
                                    )
                                  : false
                              )
                            }
                          />
                        ) : (
                          record.description
                        )
                    },
                    {
                      title: 'Description',
                      render: (_, record) =>
                        record.edit ? (
                          <Input
                            value={record.description || undefined}
                            onChange={e =>
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? { ...li, description: e.target.value }
                                        : li
                                    )
                                  : false
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
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? { ...li, size: e.target.value }
                                        : li
                                    )
                                  : false
                              )
                            }
                          />
                        ) : (
                          record.size
                        )
                    },
                    {
                      title: 'Supplier',
                      render: (_, record) =>
                        record.edit ? (
                          <Select
                            className="w-40"
                            showSearch
                            loading={suppliersLoading}
                            value={record.supplierId}
                            options={suppliers?.suppliers.map(u => ({
                              label: u.name,
                              value: u.id
                            }))}
                            filterOption={(input, option) =>
                              (option?.label ?? '')
                                .toLowerCase()
                                .includes(input.toLowerCase())
                            }
                            onChange={value =>
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? {
                                            ...li,
                                            supplierId: value || undefined
                                          }
                                        : li
                                    )
                                  : false
                              )
                            }
                          />
                        ) : (
                          suppliersObj[record.supplierId || '']?.name
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
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? { ...li, unitId: value || undefined }
                                        : li
                                    )
                                  : false
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
                            min={0}
                            value={record.price}
                            onChange={value =>
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(item =>
                                      item.id === record.id
                                        ? { ...item, price: value || 0 }
                                        : item
                                    )
                                  : false
                              )
                            }
                          />
                        ) : (
                          record.price
                        ),
                      sorter: (a, b) => (a.price || 0) - (b.price || 0)
                    },
                    {
                      title: 'Quantity',
                      render: (_, record) => record.quantity,
                      sorter: (a, b) => (a.quantity || 0) - (b.quantity || 0)
                    },
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
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? {
                                            ...li,
                                            gstRateId: value || undefined
                                          }
                                        : li
                                    )
                                  : false
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
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? { ...li, hsnCode: e.target.value }
                                        : li
                                    )
                                  : false
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
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(li =>
                                      li.id === record.id
                                        ? {
                                            ...li,
                                            estimatedDeliveryDate:
                                              e?.toDate() || undefined
                                          }
                                        : li
                                    )
                                  : false
                              )
                            }}
                          />
                        ) : (
                          record.estimatedDeliveryDate?.toLocaleString()
                        )
                    },
                    {
                      title: 'Actions',
                      render: (_, record) => (
                        <Space>
                          <Button
                            type="primary"
                            icon={
                              record.edit ? <SaveOutlined /> : <EditOutlined />
                            }
                            onClick={() =>
                              setCreatePurchaseOrderModal(prev =>
                                Array.isArray(prev)
                                  ? prev.map(item =>
                                      item.id === record.id
                                        ? { ...item, edit: !item.edit }
                                        : item
                                    )
                                  : false
                              )
                            }
                          />
                          <Button
                            type="primary"
                            icon={<DeleteOutlined />}
                            danger
                            onClick={() =>
                              setCreatePurchaseOrderModal(prev => {
                                if (!Array.isArray(prev)) return false
                                const filtered = prev.filter(
                                  p => p.id !== record.id
                                )
                                if (!filtered.length) return false
                                return filtered
                              })
                            }
                          />
                        </Space>
                      )
                    }
                  ]}
                  dataSource={createPurchaseOrderModal}
                  rowKey="id"
                  caption={
                    <Space className="mx-1">
                      <Button
                        icon={<DownloadOutlined />}
                        onClick={async () => {
                          const finalData: any[] = []
                          createPurchaseOrderModal.forEach((item, i) => {
                            finalData.push({
                              'Sr. No.': i + 1,
                              Id: item.id,
                              'Item ID': item.itemId,
                              Description: item.description,
                              Size: item.size,
                              Supplier: item.supplierId
                                ? suppliersObj[item.supplierId]?.name
                                : '',
                              Unit: item.unitId
                                ? unitsObj[item.unitId]?.name
                                : '',
                              Price: item.price || '',
                              Quantity: item.quantity || '',
                              GST: item.gstRateId
                                ? gstRatesObj[item.gstRateId]
                                : '',
                              'HSN Code': item.hsnCode || ''
                            })
                          })

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
                            `New Purchase Order-${Date.now()}.csv`
                          )

                          element.style.display = 'none'
                          document.body.appendChild(element)

                          element.click()

                          document.body.removeChild(element)
                        }}
                      >
                        Export All
                      </Button>
                      <Upload
                        multiple={false}
                        accept=".csv"
                        fileList={[]}
                        beforeUpload={async file => {
                          const text = await file.text()
                          const json = await csvtojson().fromString(text)
                          const i = createPurchaseOrderModal.map(it => ({
                            ...it
                          }))
                          for (const jd of json) {
                            const foundItem = i.find(
                              i => i.id === jd.Id || i.itemId === jd['Item ID']
                            )
                            if (!foundItem) continue

                            foundItem.description = jd.Description
                            foundItem.size = jd.Size || null
                            foundItem.supplierId = suppliers?.suppliers.find(
                              s => s.name === jd.Supplier
                            )?.id
                            foundItem.unitId = units?.units.find(
                              u => u.name === jd.Unit
                            )?.id
                            if (jd.Price) {
                              const p = parseFloat(jd.Price)
                              if (!isNaN(p)) foundItem.price = p
                            }
                            foundItem.gstRateId = gstRates?.gstRates.find(
                              gst => gst.rate.toString() === jd.GST
                            )?.id
                            foundItem.hsnCode = jd['HSN Code']
                          }
                          setCreatePurchaseOrderModal(i)
                          return false
                        }}
                      >
                        <Button icon={<UploadOutlined />}>Upload</Button>
                      </Upload>
                    </Space>
                  }
                />
              ) : null}
            </Col>
          </Row>
        </Form>
      </Drawer>

      <Drawer
        destroyOnClose
        open={!!createInvoiceDrawer.length}
        onClose={() => setCreateInvoiceDrawer([])}
        width="67%"
        maskClosable={false}
      >
        <Form
          layout="vertical"
          initialValues={{
            date: dayjs().startOf('day'),
            currencyCode: 'USD',
            currencySymbol: '$'
          }}
          onFinish={async formData => {
            for (const item of createInvoiceDrawer) {
              if (item.quantity) {
                if (item.quantity > item.maxQuantity) {
                  return notificationApi.error({
                    message: `Quantity for ${item.description} cannot be greater than ${item.maxQuantity}`
                  })
                }
              }
            }
            const createdId = await createInvoice({
              salesOrderId: data?.so.id || '',
              customerId: data?.so.customerId || '',
              date: formData.date.toDate(),
              id3: formData.id3,
              customDate: formData.customInvoiceDate?.toDate() || null,
              loadingPortId: formData.loadingPortId,
              dischargePortId: formData.dischargePortId,
              exporterDetailsId: formData.exporterDetailsId,
              notifyPartyId: formData.notifyPartyId,
              notifyPartyId2: formData.notifyPartyId2,
              type: formData.type,
              currencyId: formData.currencyId,
              IecId: formData.IecId,
              LutId: formData.LutId,
              conversionRate: formData.conversionRate,
              remarks: formData.remarks,
              items: createInvoiceDrawer
                .filter(item => item.quantity)
                .map(item => ({
                  salesOrderItemId: item.soi,
                  description: item.description,
                  quantity: item.quantity
                }))
            })
            notificationApi.success({
              message: 'Created Invoice'
            })
            setCreateInvoiceDrawer([])
            router.push(`/invoices/${createdId}`)
          }}
        >
          <Button
            className="mb-3"
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={creatingInvoice}
          >
            Save
          </Button>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="date" label="Date">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Type"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <Select
                  options={[
                    {
                      label: 'LUT',
                      value: 'lut'
                    },
                    {
                      label: 'GST',
                      value: 'gst'
                    }
                  ]}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="id3" label="Custom Invoice ID">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customInvoiceDate" label="Custom Invoice Date">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="LutId" label="LUT" rules={[{ required: true }]}>
                <Select
                  showSearch
                  loading={lutLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={lut?.LUT.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="IecId"
                label="IEC Code"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  loading={IecLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={IecCode?.iecCode.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="loadingPortId"
                label="Loading Port"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  loading={portsLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={ports?.ports.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dischargePortId"
                label="Discharge Port"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  loading={portsLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={ports?.ports.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="exporterDetailsId"
                label="Exporter Details"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  loading={exporterDetailsLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={exporterDetails?.exporterDetails.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="notifyPartyId"
                label="Notify Party"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  loading={notifyPartyLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={notifyParty?.notifyParties.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notifyPartyId2" label="Notify Party 2">
                <Select
                  showSearch
                  loading={notifyPartyLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={notifyParty?.notifyParties.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currencyId"
                label="Currency"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  loading={currencyLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={currency?.currencies.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="conversionRate"
                label="Conversion Rate"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea />
              </Form.Item>
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
                    title: 'Description',
                    render: (_, record) => (
                      <Input
                        value={record.description}
                        onChange={e =>
                          setCreateInvoiceDrawer(prev =>
                            prev.map(item =>
                              item.soi === record.soi
                                ? { ...item, description: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    )
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
                          setCreateInvoiceDrawer(prev =>
                            prev.map(item =>
                              item.soi === record.soi
                                ? { ...item, quantity: value || 0 }
                                : item
                            )
                          )
                        }
                      />
                    )
                  }
                ]}
                dataSource={createInvoiceDrawer.map((li, i) => ({
                  ...li,
                  sr: i + 1
                }))}
                rowKey="id"
              />
            </Col>
          </Row>
        </Form>
      </Drawer>
    </Layout>
  )
}

export default OrderPage
