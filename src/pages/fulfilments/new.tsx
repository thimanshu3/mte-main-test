import {
  ArrowRightOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
  Table,
  Typography,
  Upload
} from 'antd'
import csvtojson from 'csvtojson'
import dayjs from 'dayjs'
import { Parser } from 'json2csv'
import debounce from 'lodash/debounce'
import groupBy from 'lodash/groupBy'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { Layout } from '~/components/Layout'
import { OrderStageTag } from '~/components/OrderStageTag'
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
      : !['ADMIN', 'USER', 'FULFILMENT'].includes(session.user.role)
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

type InventoryItem = {
  purchaseOrderId2: string
  purchaseOrderId: string
  poi: string
  itemId: string
  price: number
  unitId: string
  description: string
  size?: string | null
  quantity: number
  orderQuantity: number
  maxQuantity: number
  hsnCode?: string | null
  gstRateId?: string | null
}

type FulfilmentExpense = {
  key: string
  description: string
  price: number
  gstRateId?: string | null
}

const NewFulfilmentPage: NextPage = () => {
  // ? useRouter
  const router = useRouter()

  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [supplierSearch, setSupplierSearch] = useState<string | undefined>(
    undefined
  )
  const [supplierId, setSupplierId] = useState<string | undefined>(undefined)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [lastStep, setLastStep] = useState<string[] | null>(null)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [expenses, setExpenses] = useState<FulfilmentExpense[]>([])
  const [creatingInventoryItems, setCreatingInventoryItems] = useState(false)

  // ? useQuery
  const { data: suppliers, isLoading: suppliersLoading } =
    api.suppliers.getAllMini.useQuery(
      {
        page: 1,
        limit: 100,
        search: supplierSearch
      },
      {
        enabled: !!session
      }
    )
  const { data: orders, isLoading: ordersLoading } =
    api.orders.purchase.getUnfulfilledPurchaseOrders.useQuery(
      {
        supplierId: supplierId!
      },
      {
        enabled: !!session && !!supplierId
      }
    )
  const { data: lineItems, isLoading: lineItemsLoading } =
    api.orders.purchase.getUnfulfilledPurchaseOrderLineItems.useQuery(
      lastStep!,
      {
        enabled: !!session && !!lastStep
      }
    )
  const { data: units } = api.units.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
  )
  const { data: gstRates } = api.gstRates.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
  )
  const { data: expensesGlobal } = api.expenses.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    {
      enabled: !!session
    }
  )

  // ? useMutation
  const { mutateAsync: createInventoryItemsBulkPO } =
    api.orders.inventory.createInventoryItemsBulkPO.useMutation()

  // ? useEffect
  useEffect(() => {
    if (lineItems)
      setItems(
        lineItems.map(li => ({
          purchaseOrderId: li.purchaseOrder.id,
          purchaseOrderId2: li.purchaseOrder.id2,
          poi: li.id,
          itemId: li.itemId,
          description: li.description,
          size: li.size,
          quantity: 0,
          orderQuantity: li.quantity,
          maxQuantity: Number(
            (li.quantity - (li.inventoryItem?.quantity || 0)).toFixed(3)
          ),
          price: li.price,
          unitId: li.unitId,
          hsnCode: li.hsnCode,
          gstRateId: li.gstRateId
        }))
      )
  }, [lineItems])

  // ? useMemo
  const debouncedSupplierSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSupplierSearch(search || undefined)
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

  // ? useNofificationApi
  const notificationApi = useNotificationApi()

  // ? variables
  const fulfilmentItemsTotal = parseFloat(
    items
      .reduce((total, item) => total + item.quantity * item.price, 0)
      .toFixed(2) || '0'
  )
  const fulfilmentItemsTax = parseFloat(
    items
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
    expenses.reduce((total, expense) => total + expense.price, 0).toFixed(2) ||
      '0'
  )
  const fulfilmentExpensesTax = parseFloat(
    expenses
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
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Fulfilments',
          link: '/fulfilments'
        },
        {
          label: 'new'
        }
      ]}
      title="Fulfilment - new"
    >
      <Form
        layout="vertical"
        initialValues={{
          location: 'Unloading area',
          gateEntryDate: dayjs()
        }}
        onFinish={async formData => {
          setCreatingInventoryItems(true)
          try {
            const filteredExpenses = expenses.filter(
              ex => ex.description && ex.price
            )
            const groupedItems = groupBy(items, item => item.purchaseOrderId)

            let totalPurchaseOrderFulfilmentValue = 0
            const poFulfilmentToGenerate: {
              id: string
              items: InventoryItem[]
              itemsValue: number
            }[] = []

            for (const purchaseOrderId in groupedItems) {
              const items = groupedItems[purchaseOrderId]?.filter(
                item => item.quantity
              )
              if (!items?.length) continue
              let itemsValue = 0
              for (const it of items) {
                if (it.quantity > it.maxQuantity) {
                  notificationApi.error({
                    message: `Quantity for ${it.description} cannot be greater than ${it.maxQuantity}`
                  })
                  setCreatingInventoryItems(false)
                  return
                }
                itemsValue = parseFloat(
                  (
                    itemsValue + parseFloat((it.price * it.quantity).toFixed(2))
                  ).toFixed(2)
                )
              }
              poFulfilmentToGenerate.push({
                id: purchaseOrderId,
                items,
                itemsValue
              })
              totalPurchaseOrderFulfilmentValue = parseFloat(
                (totalPurchaseOrderFulfilmentValue + itemsValue).toFixed(2)
              )
            }

            if (!poFulfilmentToGenerate.length) {
              setCreatingInventoryItems(false)
              notificationApi.error({
                message: 'No purchase order fulfilment to create'
              })
              return
            }

            const finalData: {
              purchaseOrderId: string
              items: {
                purchaseOrderItemId: string
                quantity: number
                hsnCode?: string | null
              }[]
              expenses: {
                description: string
                price: number
                gstRateId?: string | null
              }[]
            }[] = []
            for (const pofg of poFulfilmentToGenerate) {
              const ratio = pofg.itemsValue / totalPurchaseOrderFulfilmentValue
              finalData.push({
                purchaseOrderId: pofg.id,
                items: pofg.items.map(item => ({
                  purchaseOrderItemId: item.poi,
                  quantity: item.quantity,
                  hsnCode: item.hsnCode,
                  gstRateId: item.gstRateId
                })),
                expenses: filteredExpenses.map(ex => ({
                  description: ex.description,
                  price: parseFloat((ratio * ex.price).toFixed(2)),
                  gstRateId: ex.gstRateId
                }))
              })
            }

            const createdId = await createInventoryItemsBulkPO({
              gateEntryNumber: formData.gateEntryNumber,
              gateEntryDate: formData.gateEntryDate.toDate(),
              invoiceId: formData.invoiceId,
              supplierId: supplierId!,
              invoiceDate: formData.invoiceDate.toDate(),
              location: formData.location,
              remarks: formData.remarks,
              arr: finalData
            })

            setLastStep(null)
            notificationApi.success({
              message: 'Created Fulfilment!'
            })
            router.push('/fulfilments/' + createdId)
          } catch (err) {
            notificationApi.error({
              message: 'Failed to create fulfilment!'
            })
          }
        }}
      >
        {lastStep ? (
          <div className="my-2">
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              loading={creatingInventoryItems}
              htmlType="submit"
            >
              Save
            </Button>
          </div>
        ) : null}
        <Card className="my-2">
          <div className="grid gap-4 sm:grid-cols-2">
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
        </Card>
        <div className="mb-3">
          <Select
            className="w-full max-w-[400px]"
            showSearch
            filterOption={false}
            onSearch={search => {
              debouncedSupplierSearch(search)
            }}
            disabled={!!lastStep}
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
            value={supplierId}
            onChange={value => setSupplierId(value)}
            placeholder="Select Supplier first to show purchase orders"
          />
        </div>
        {supplierId && !lastStep ? (
          <div className="mt-5">
            <Table
              loading={ordersLoading}
              size="middle"
              bordered
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Order ID',
                  dataIndex: 'id2',
                  render: (id2, row) => (
                    <Link href={`/orders/purchase/${row.id}`}>{id2}</Link>
                  )
                },
                {
                  title: 'Date',
                  dataIndex: 'date',
                  render: date => date.toLocaleDateString()
                },
                {
                  title: 'Reference ID',
                  dataIndex: 'referenceId'
                },
                {
                  title: 'No. of line items',
                  render: (_, record) => record._count.items
                },
                {
                  title: 'Total Amount',
                  dataIndex: 'totalAmount',
                  render: totalAmount => totalAmount.toLocaleString()
                },
                {
                  title: 'Stage',
                  dataIndex: 'stage',
                  render: stage => <OrderStageTag stage={stage} />
                },
                {
                  title: 'Approved',
                  dataIndex: 'approved',
                  render: approved => (approved ? 'Yes' : 'No')
                },
                {
                  title: 'Created At',
                  dataIndex: 'createdAt',
                  render: date => date.toLocaleString()
                },
                {
                  title: 'Updated At',
                  dataIndex: 'updatedAt',
                  render: date => date.toLocaleString()
                }
              ]}
              dataSource={orders}
              rowKey="id"
              pagination={false}
              rowSelection={{
                selectedRowKeys: selectedOrders,
                onChange: selectedRowKeys =>
                  setSelectedOrders(selectedRowKeys.map(key => key.toString()))
              }}
              caption={
                <Button
                  className="mx-2"
                  type="primary"
                  size="large"
                  icon={<ArrowRightOutlined />}
                  onClick={() => setLastStep(selectedOrders)}
                >
                  Next
                </Button>
              }
            />
          </div>
        ) : null}
        {lastStep ? (
          <div>
            <div>
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
            </div>
            <div className="my-5">
              <Typography.Title level={4}>Line Items</Typography.Title>
              <Table
                loading={lineItemsLoading}
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
                    title: 'Purchase Order ID',
                    render: (_, record) => (
                      <Link href={`/orders/purchase/${record.purchaseOrderId}`}>
                        {record.purchaseOrderId2}
                      </Link>
                    )
                  },
                  {
                    title: 'Description',
                    dataIndex: 'description'
                  },
                  {
                    title: 'Size',
                    dataIndex: 'size'
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
                          setItems(prev =>
                            prev.map(item =>
                              item.poi === record.poi
                                ? { ...item, gstRateId: value }
                                : item
                            )
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
                          setItems(prev =>
                            prev.map(item =>
                              item.poi === record.poi
                                ? { ...item, quantity: value || 0 }
                                : item
                            )
                          )
                        }
                      />
                    )
                  },
                  {
                    title: 'HSN Code',
                    render: (_, record) => (
                      <Input
                        value={record.hsnCode || ''}
                        onChange={e =>
                          setItems(prev =>
                            prev.map(item =>
                              item.poi === record.poi
                                ? { ...item, hsnCode: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    )
                  }
                ]}
                dataSource={items.map((li, i) => ({
                  ...li,
                  sr: i + 1
                }))}
                rowKey="poi"
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
            </div>

            <div>
              <Typography.Title level={4}>Expenses</Typography.Title>
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
                          setExpenses(prev =>
                            prev.map(ex =>
                              ex.key === record.key
                                ? { ...ex, description: value }
                                : ex
                            )
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
                          setExpenses(prev =>
                            prev.map(ex =>
                              ex.key === record.key
                                ? { ...ex, gstRateId: value }
                                : ex
                            )
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
                          setExpenses(prev =>
                            prev.map(ex =>
                              ex.key === record.key
                                ? { ...ex, price: value || 0 }
                                : ex
                            )
                          )
                        }
                      />
                    )
                  },
                  {
                    title: 'Actions',
                    render: (_, record) => (
                      <Button
                        type="primary"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() =>
                          setExpenses(prev =>
                            prev.filter(ex => ex.key !== record.key)
                          )
                        }
                      />
                    )
                  }
                ]}
                dataSource={expenses}
                rowKey="key"
                pagination={false}
                caption={
                  <div className="mx-2 flex flex-col font-semibold">
                    <Button
                      className="mb-2 max-w-fit"
                      onClick={() =>
                        setExpenses(prev => [
                          ...prev,
                          {
                            key: Math.random().toString(),
                            description: '',
                            price: 0,
                            gstRateId: undefined
                          }
                        ])
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
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                size="large"
                type="primary"
                htmlType="button"
                icon={<DownloadOutlined />}
                onClick={async () => {
                  let sr = 1
                  const finalData: any[] = []
                  items.forEach(it => {
                    finalData.push({
                      Id: it.poi,
                      'Sr. No.': sr++,
                      Type: 'Item',
                      'Purchase Order ID': it.purchaseOrderId2,
                      'Item ID': it.itemId,
                      Description: it.description,
                      Size: it.size,
                      Price: it.price,
                      Unit: unitsObj[it.unitId]?.name,
                      GST: gstRatesObj[it.gstRateId || '']?.rate,
                      'Order Quantity': it.orderQuantity,
                      'Max Quantity': it.maxQuantity,
                      Quantity: it.quantity,
                      'HSN Code': it.hsnCode
                    })
                  })
                  expenses.forEach(ex => {
                    if (!ex.description || !ex.price) return
                    finalData.push({
                      Id: '',
                      'Sr. No.': sr++,
                      Type: 'Expense',
                      'Purchase Order ID': '',
                      'Item ID': '',
                      Description: ex.description,
                      Price: ex.price,
                      Unit: '',
                      GST: gstRatesObj[ex.gstRateId || '']?.rate,
                      'Order Quantity': '',
                      'Max Quantity': '',
                      Quantity: '',
                      'HSN Code': ''
                    })
                  })

                  const parser = new Parser()
                  const csv = parser.parse(finalData)

                  const element = document.createElement('a')
                  element.setAttribute(
                    'href',
                    'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
                  )
                  element.setAttribute(
                    'download',
                    `New-Fulfilment-${Date.now()}.csv`
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
                  const i = items.map(it => ({ ...it }))
                  const e: FulfilmentExpense[] = []
                  for (const jd of json) {
                    if (jd.Type === 'Item') {
                      const foundItem = i.find(
                        i => i.poi === jd.Id || i.itemId === jd['Item ID']
                      )
                      if (!foundItem) continue
                      const q = parseFloat(jd.Quantity)
                      if (isNaN(q)) continue
                      if (q > foundItem.maxQuantity) continue
                      foundItem.quantity = q
                      foundItem.hsnCode = jd['HSN Code']
                      foundItem.gstRateId = gstRates?.gstRates.find(
                        gst => gst.rate.toString() === jd.GST
                      )?.id
                    } else if (jd.Type === 'Expense') {
                      e.push({
                        key: Math.random().toString(),
                        description: jd.Description,
                        price: jd.Price,
                        gstRateId: gstRates?.gstRates.find(
                          gst => gst.rate.toString() === jd.GST
                        )?.id
                      })
                    }
                  }
                  setItems(i)
                  setExpenses(e)
                  return false
                }}
              >
                <Button
                  size="large"
                  htmlType="button"
                  icon={<UploadOutlined />}
                >
                  Upload
                </Button>
              </Upload>
            </div>
          </div>
        ) : null}
      </Form>
    </Layout>
  )
}

export default NewFulfilmentPage
