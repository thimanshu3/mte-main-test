import {
  ArrowRightOutlined,
  DownloadOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
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
      : !['ADMIN', 'USER'].includes(session.user.role)
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

type Item = {
  salesOrderId: string
  salesOrderId2: string
  soi: string
  itemId: string
  description: string
  size?: string | null
  quantity: number
  orderQuantity: number
  maxQuantity: number
  inventoryQuantity: number
  price: number
  poPrice?: number
  unitId: string
  countryOfOriginId?: string
  numberOfPack?: string
  packNumber?: string
  packingNumberAsPerSimpolo?: string
  weightDetails?: string
  weight?: string
  weightOne?: string
  weightSecond?: string
}

const NewInvoicePage: NextPage = () => {
  // ? useRouter
  const router = useRouter()

  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [customerSearch, setCustomerSearch] = useState<string | undefined>(
    undefined
  )
  const [customerId, setCustomerId] = useState<string | undefined>(undefined)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [lastStep, setLastStep] = useState<string[] | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [creatingInvoice, setCreatingInvoice] = useState(false)
  const [search, setSearch] = useState('')
  const [conversionRate, setConversionRate] = useState<any>([])
  const [conversionName, setConversionName] = useState<any>([])
  const [invoiceType, setInvoiceType] = useState<any>([])
  const [userSearch, setUserSearch] = useState<string | undefined>(undefined)

  const totalPrice = items
    .reduce(
      (total, curr) =>
        total +
        parseFloat(
          (
            curr.quantity *
            (Math.round((curr.price * 100) / conversionRate.value) / 100)
          ).toFixed(2)
        ),
      0
    )
    .toLocaleString()

  const totalPackages = items.reduce(
    (total, curr) => total + parseFloat(curr.numberOfPack || '0'),
    0
  )

  const debouncedUserSearch = useMemo(
    () =>
      debounce((search: string) => {
        setUserSearch(search || undefined)
      }, 500),
    []
  )

  // ? useQuery
  const { data: users, isLoading: usersLoading } =
    api.users.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: userSearch
      },
      { enabled: !!session }
    )
  const { data: customers, isLoading: customersLoading } =
    api.customers.getAllMini.useQuery(
      {
        page: 1,
        limit: 100,
        search: customerSearch
      },
      {
        enabled: !!session
      }
    )
  const { data: orders, isLoading: ordersLoading } =
    api.orders.sales.getUninvoicedSalesOrders.useQuery(
      {
        customerId: customerId!
      },
      {
        enabled: !!session && !!customerId
      }
    )

  const { data: lineItems, isLoading: lineItemsLoading } =
    api.orders.sales.getUninvoicedSalesOrderLineItems.useQuery(lastStep!, {
      enabled: !!session && !!lastStep
    })
  const { data: units } = api.units.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
  )
  const { data: ports, isLoading: portsLoading } =
    api.ports.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: Lut, isLoading: lutLoading } = api.Lut.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
  )
  const { data: IecCode, isLoading: IecCodeLoading } =
    api.IecCode.getAllMini.useQuery(
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
  const { data: countryOfOrigins, isLoading: countryOfOriginsLoading } =
    api.countryOfOrigin.getAllMini.useQuery(
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
  const { mutateAsync: createInvoice } =
    api.orders.invoices.createMany.useMutation()

  // ? useEffect
  useEffect(() => {
    if (lineItems)
      setItems(
        lineItems.map(li => ({
          salesOrderId: li.salesOrder.id,
          salesOrderId2: li.salesOrder.id2,
          soi: li.id,
          itemId: li.itemId,
          description: li.description,
          size: li.size,
          poPrice: li.purchaseOrderItems[0]?.price,
          numberOfPack: '',
          packNumber: '',
          packingNumberAsPerSimpolo: '',
          weightDetails: '',
          weight: '',
          weightOne: '',
          weightSecond: '',
          quantity: 0,
          orderQuantity: li.quantity,
          maxQuantity:
            li.quantity -
            (li.invoiceItems.reduce(
              (total, curr) => total + curr.quantity,
              0
            ) || 0),
          inventoryQuantity: li.purchaseOrderItems.reduce(
            (total, curr) =>
              total +
              parseFloat(
                (
                  (curr.inventoryItem?.quantity || 0) -
                  (curr.inventoryItem?.quantityGone || 0)
                ).toFixed(3)
              ),
            0
          ),
          price: li.price,
          unitId: li.unitId
        }))
      )
  }, [lineItems])

  // ? useMemo
  const debouncedCustomerSearch = useMemo(
    () =>
      debounce((search: string) => {
        setCustomerSearch(search || undefined)
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

  // ? useNofificationApi
  const notificationApi = useNotificationApi()

  return (
    <Layout
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Invoices',
          link: '/invoices'
        },
        {
          label: 'new'
        }
      ]}
      title="Invoice - new"
    >
      <Form
        layout="vertical"
        onFinish={async formData => {
          setCreatingInvoice(true)
          try {
            const groupedItems = groupBy(items, item => item.salesOrderId)

            const soInvoiceToGenerate: {
              id: string
              items: Item[]
              itemsValue: number
            }[] = []

            const isCountryOfOriginMissing = items.some(
              item => !item.countryOfOriginId && item.quantity > 0
            )
            if (isCountryOfOriginMissing) {
              setCreatingInvoice(false)
              return notificationApi.error({
                message:
                  'Some items are missing country of origin. Please update them manually.'
              })
            }

            let loss = false
            for (const salesOrderId in groupedItems) {
              const items = groupedItems[salesOrderId]?.filter(
                item => item.quantity
              )
              if (!items?.length) continue
              let itemsValue = 0
              for (const it of items) {
                if (it.quantity > it.maxQuantity) {
                  notificationApi.error({
                    message: `Quantity for ${it.description} cannot be greater than ${it.maxQuantity}`
                  })
                  setCreatingInvoice(false)
                  return
                }
                itemsValue = parseFloat(
                  (
                    itemsValue + parseFloat((it.price * it.quantity).toFixed(2))
                  ).toFixed(2)
                )
                if (it.poPrice && it.price > it.poPrice!) {
                  loss = true
                }
              }

              soInvoiceToGenerate.push({
                id: salesOrderId,
                items,
                itemsValue
              })
            }
            if (loss) {
              const cc = confirm(
                'Some items are being sold at a loss. Are you sure you want to continue?'
              )
              if (!cc) {
                setCreatingInvoice(false)
                return
              }
            }

            if (!soInvoiceToGenerate.length) {
              setCreatingInvoice(false)
              notificationApi.error({
                message: 'No sales order invoice to create'
              })
              return
            }

            const finalData: {
              salesOrderId: string
              items: {
                salesOrderItemId: string
                description: string
                size?: string | null
                quantity: number
                numberOfPack?: string
                packNumber?: string
                packingNumberAsPerSimpolo?: string
                weightDetails?: string
                weight?: string
                weightOne?: string
                weightSecond?: string
              }[]
            }[] = []
            for (const soig of soInvoiceToGenerate) {
              finalData.push({
                salesOrderId: soig.id,
                items: soig.items.map(item => ({
                  salesOrderItemId: item.soi,
                  description: item.description,
                  size: item.size,
                  quantity: item.quantity,
                  countryOfOriginId: item.countryOfOriginId,
                  numberOfPack: item.numberOfPack,
                  packNumber: item.packNumber,
                  packingNumberAsPerSimpolo: item.packingNumberAsPerSimpolo,
                  weightDetails: item.weightDetails,
                  weight: item.weight,
                  weightOne: item.weightOne,
                  weightSecond: item.weightSecond
                }))
              })
            }

            const createdId = await createInvoice({
              date: formData.date.toDate(),
              id3: formData.id3,
              customDate: formData.customInvoiceDate?.toDate(),
              customerId: customerId!,
              remarks: formData.remarks,
              amountInWords: formData.amountInWords,
              totalPackages: formData.totalPackages,
              totalNetWeight: formData.totalNetWeight,
              totalGrossWeight: formData.totalGrossWeight,
              totalCbm: formData.totalCbm,
              cntrNumber: formData.cntrNumber,
              truckNumber: formData.truckNumber,
              lineSealNumber: formData.lineSealNumber,
              rfidSealNumber: formData.rfidSealNumber,
              cntrSize: formData.cntrSize,
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
              isInvoice2: formData.isInvoice2 || true,
              representativeUserId: formData.representativeUserId,
              arr: finalData
            })

            setLastStep(null)
            notificationApi.success({
              message: 'Created Invoice!'
            })
            router.push('/invoices/' + createdId)
          } catch (err) {
            notificationApi.error({
              message: 'Failed to create invoice!'
            })
          }
          setCreatingInvoice(false)
        }}
        initialValues={{
          date: dayjs().startOf('day'),
          isInvoice2: true
        }}
      >
        {lastStep ? (
          <div className="my-2">
            <Button
              type="primary"
              size="large"
              loading={creatingInvoice}
              icon={<SaveOutlined />}
              htmlType="submit"
            >
              Save
            </Button>
          </div>
        ) : null}
        <Card className="my-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Form.Item
              name="date"
              label="Date"
              rules={[
                {
                  required: true
                }
              ]}
            >
              <DatePicker className="w-full" />
            </Form.Item>
            {session?.user.role === 'ADMIN' ? (
              <Form.Item
                valuePropName="checked"
                name="isInvoice2"
                label="is Draft"
              >
                <Checkbox />
              </Form.Item>
            ) : null}
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
                onChange={value => {
                  setInvoiceType(value)
                }}
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
            <Form.Item
              label="Representative User"
              name="representativeUserId"
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
            <Form.Item name="id3" label="Custom Invoice ID">
              <Input />
            </Form.Item>
            <Form.Item name="customInvoiceDate" label="Custom Invoice Date">
              <DatePicker className="w-full" />
            </Form.Item>
            <Form.Item
              name="LutId"
              label="LUT No."
              rules={[{ required: true }]}
            >
              <Select
                showSearch
                loading={lutLoading}
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                options={Lut?.LUT.map(item => ({
                  label: item.name,
                  value: item.id
                }))}
              />
            </Form.Item>
            <Form.Item
              name="IecId"
              label="IEC Code"
              rules={[{ required: true }]}
            >
              <Select
                showSearch
                loading={IecCodeLoading}
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
                onChange={value => {
                  const currencys = currency?.currencies.find(
                    c => c.id === value
                  )
                  if (currencys)
                    setConversionName({
                      name: currencys.name
                    })
                }}
              />
            </Form.Item>
            <Form.Item
              name="conversionRate"
              label="Conversion Rate"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={1}
                className="w-full"
                onChange={value =>
                  setConversionRate({
                    value: value || 1
                  })
                }
              />
            </Form.Item>
            <Form.Item name="remarks" label="Remarks">
              <Input.TextArea />
            </Form.Item>
            <Form.Item name="amountInWords" label="Amount In Words">
              <Input.TextArea />
            </Form.Item>
            <Form.Item name="totalPackages" label="Total Packages">
              <Input />
            </Form.Item>
            <Form.Item name="totalNetWeight" label="Total Net Weight">
              <Input />
            </Form.Item>
            <Form.Item name="totalGrossWeight" label="Total Gross Weight">
              <Input />
            </Form.Item>
            <Form.Item name="totalCbm" label="Total CBM">
              <Input />
            </Form.Item>
            <Form.Item name="cntrNumber" label="CNTR Number">
              <Input />
            </Form.Item>
            <Form.Item name="truckNumber" label="Truck Number">
              <Input />
            </Form.Item>
            <Form.Item name="lineSealNumber" label="Line Seal No.">
              <Input />
            </Form.Item>
            <Form.Item name="rfidSealNumber" label="RFID Seal No.">
              <Input />
            </Form.Item>
            <Form.Item name="cntrSize" label="CNTR Size">
              <Input />
            </Form.Item>
          </div>
        </Card>
        <div className="mb-3">
          <Select
            className="w-full max-w-[400px]"
            showSearch
            filterOption={false}
            onSearch={search => {
              debouncedCustomerSearch(search)
            }}
            disabled={!!lastStep}
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
            value={customerId}
            onChange={value => setCustomerId(value)}
            placeholder="Select customer first to show sales orders"
          />
        </div>
        {customerId && !lastStep ? (
          <div className="mt-5">
            <Input.Search
              className="mb-2 w-80"
              placeholder="search..."
              onSearch={s => setSearch(s)}
            />
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
                    <Link href={`/orders/sales/${row.id}`}>{id2}</Link>
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
              dataSource={orders?.filter(
                o =>
                  o.referenceId?.toLowerCase().includes(search.toLowerCase()) ||
                  o.id2.toLowerCase().includes(search.toLowerCase()) ||
                  ''
              )}
              rowKey="id"
              rowSelection={{
                selectedRowKeys: selectedOrders,
                hideSelectAll: true,
                onSelect: r => {
                  setSelectedOrders(prev =>
                    prev.includes(r.id)
                      ? prev.filter(p => p !== r.id)
                      : [...prev, r.id]
                  )
                }
              }}
              caption={
                <>
                  <Button
                    className="mx-2"
                    type="primary"
                    size="large"
                    icon={<ArrowRightOutlined />}
                    onClick={() => setLastStep(selectedOrders)}
                  >
                    Next
                  </Button>

                  <Button
                    icon={<DownloadOutlined />}
                    htmlType="button"
                    onClick={async () => {
                      let sr = 1
                      const finalData: any[] = []

                      orders?.forEach(order => {
                        finalData.push({
                          'Sr. No.': sr,
                          'Order ID': order?.id2,
                          'Order Date': order.date.toLocaleDateString(),
                          'Reference ID': order.referenceId,
                          'No. of line items': order._count.items,
                          'Total Amount': order.totalAmount.toLocaleString(),
                          Stage: order.stage,
                          Approved: order.approved ? 'Yes' : 'No',
                          'Created At': order.createdAt.toLocaleString(),
                          'Updated At': order.updatedAt.toLocaleString()
                        })
                        sr++
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
                        `New-Invoice-new-${Date.now()}.csv`
                      )

                      element.style.display = 'none'
                      document.body.appendChild(element)

                      element.click()

                      document.body.removeChild(element)
                    }}
                  >
                    Export
                  </Button>

                  <Upload
                    multiple={false}
                    accept=".csv"
                    fileList={[]}
                    beforeUpload={async file => {
                      const text = await file.text()
                      const json = await csvtojson().fromString(text)
                      const newOrders = [...(orders ?? [])]

                      for (const j of json) {
                        const found = newOrders.find(
                          o => o.id2 === j['Order ID']
                        )

                        if (!found) continue
                        setSelectedOrders(prev =>
                          Array.from(new Set([...prev, found.id]))
                        )
                      }

                      return false
                    }}
                  >
                    <Button htmlType="button" icon={<UploadOutlined />}>
                      Upload
                    </Button>
                  </Upload>
                </>
              }
            />
          </div>
        ) : null}
        {lastStep ? (
          <div>
            <div className="my-5">
              <Typography.Title level={4}>Line Items</Typography.Title>
              <div className="my-2 flex gap-2">
                <Button
                  icon={<DownloadOutlined />}
                  htmlType="button"
                  onClick={async () => {
                    let sr = 1
                    const finalData: any[] = []

                    if (invoiceType === 'gst') {
                      for (const item of items) {
                        finalData.push({
                          'Sr. No.': sr,
                          id: item.soi,
                          'Item Id': item.itemId,
                          'Sales Order Id': item.salesOrderId2,
                          Description: item.description,
                          Size: item.size,
                          Price: item.price,
                          Unit: unitsObj[item.unitId]?.name,
                          'Order Quantity': item.orderQuantity,
                          'Max Quantity': item.maxQuantity,
                          'Quantity in Inventory': item.inventoryQuantity,
                          Quantity: item.quantity,
                          'Pack Number': item.packNumber,
                          'Number Of Pack': item.numberOfPack,
                          'Weight One': item.weightOne,
                          'Weight Second': item.weightSecond,
                          'Weight Details': item.weightDetails,
                          Weight: item.weight,
                          'Country Of Origin': item.countryOfOriginId
                            ? countryOfOrigins?.countryOfOrigins.find(
                                c => c.id === item.countryOfOriginId
                              )?.name
                            : '',
                          'Reference Id':
                            orders?.find(o => o.id === item.salesOrderId)
                              ?.referenceId ?? ''
                        })
                        sr++
                      }
                    } else {
                      for (const item of items) {
                        finalData.push({
                          'Sr. No.': sr,
                          id: item.soi,
                          'Item Id': item.itemId,
                          'Sales Order Id': item.salesOrderId2,
                          Description: item.description,
                          Size: item.size,
                          Price: item.price,
                          Unit: unitsObj[item.unitId]?.name,
                          'Order Quantity': item.orderQuantity,
                          'Max Quantity': item.maxQuantity,
                          'Quantity in Inventory': item.inventoryQuantity,
                          Quantity: item.quantity,
                          'Pack Number': item.packNumber,
                          'Packing Number As Per Simpolo':
                            item.packingNumberAsPerSimpolo,
                          'Number Of Pack': item.numberOfPack,
                          'Weight One': item.weightOne,
                          'Weight Second': item.weightSecond,
                          'Weight Details': item.weightDetails,
                          Weight: item.weight,
                          'Country Of Origin': item.countryOfOriginId
                            ? countryOfOrigins?.countryOfOrigins.find(
                                c => c.id === item.countryOfOriginId
                              )?.name
                            : '',
                          'Reference Id':
                            orders?.find(o => o.id === item.salesOrderId)
                              ?.referenceId ?? ''
                        })
                        sr++
                      }
                    }

                    const parser = new Parser()
                    const csv = parser.parse(finalData)

                    const element = document.createElement('a')
                    element.setAttribute(
                      'href',
                      'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
                    )
                    element.setAttribute(
                      'download',
                      `New-Invoice-${Date.now()}.csv`
                    )

                    element.style.display = 'none'
                    document.body.appendChild(element)

                    element.click()

                    document.body.removeChild(element)
                  }}
                >
                  Export
                </Button>
                <Upload
                  multiple={false}
                  accept=".csv"
                  fileList={[]}
                  beforeUpload={async file => {
                    const text = await file.text()
                    const json = await csvtojson().fromString(text)

                    const newItems = [...items]

                    if (invoiceType === 'gst') {
                      for (const j of json) {
                        const found = newItems.find(i => i.soi === j.id)
                        if (!found) continue
                        found.description = j.Description
                        found.size = j.Size || null
                        found.quantity = parseFloat(j.Quantity)
                        found.packNumber = j['Pack Number']
                        found.numberOfPack = j['Number Of Pack']
                        found.weightOne = j['Weight One']
                        found.weightSecond = j['Weight Second']
                        found.weightDetails = j['Weight Details']
                        found.weight = j['Weight']
                        const countryOfOrigin =
                          countryOfOrigins?.countryOfOrigins.find(
                            c => c.name === j['Country Of Origin']
                          )
                        if (countryOfOrigin)
                          found.countryOfOriginId = countryOfOrigin.id
                      }
                    } else {
                      for (const j of json) {
                        const found = newItems.find(i => i.soi === j.id)
                        if (!found) continue
                        found.description = j.Description
                        found.size = j.Size || null
                        found.quantity = parseFloat(j.Quantity)
                        const countryOfOrigin =
                          countryOfOrigins?.countryOfOrigins.find(
                            c => c.name === j['Country Of Origin']
                          )
                        if (countryOfOrigin)
                          found.countryOfOriginId = countryOfOrigin.id
                        found.packNumber = j['Pack Number']
                        found.packingNumberAsPerSimpolo =
                          j['Packing Number As Per Simpolo']
                        found.numberOfPack = j['Number Of Pack']
                        found.weightOne = j['Weight One']
                        found.weightSecond = j['Weight Second']
                        found.weightDetails = j['Weight Details']
                        found.weight = j['Weight']
                      }
                    }

                    newItems.sort((a, b) => b.quantity - a.quantity)
                    setItems(newItems)

                    return false
                  }}
                >
                  <Button htmlType="button" icon={<UploadOutlined />}>
                    Upload
                  </Button>
                </Upload>
              </div>
              <Descriptions bordered className="my-2 w-72">
                <Descriptions.Item
                  label={`Total Price (${conversionName.name})`}
                >
                  {totalPrice}
                </Descriptions.Item>
              </Descriptions>
              <Descriptions bordered className="my-2 w-72">
                <Descriptions.Item label={`Total Packages`}>
                  {totalPackages}
                </Descriptions.Item>
              </Descriptions>
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
                    title: 'Sales Order ID',
                    render: (_, record) => (
                      <Link href={`/orders/sales/${record.salesOrderId}`}>
                        {record.salesOrderId2}
                      </Link>
                    )
                  },
                  {
                    title: 'Description',
                    render: (_, record) => (
                      <Input
                        value={record.description}
                        onChange={e =>
                          setItems(prev =>
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
                    title: 'Size',
                    render: (_, record) => (
                      <Input
                        value={record.size || ''}
                        onChange={e =>
                          setItems(prev =>
                            prev.map(item =>
                              item.soi === record.soi
                                ? { ...item, size: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    )
                  },
                  ...(invoiceType === 'gst'
                    ? [
                        {
                          title: 'Pack Number',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.packNumber}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          packNumber: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Number of Pack',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.numberOfPack}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          numberOfPack: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight One',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightOne}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weightOne: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight Second',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightSecond}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weightSecond: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight Details',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightDetails}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weightDetails: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightOne * record.weightSecond}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weight: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        }
                      ]
                    : [
                        {
                          title: 'Pack Number',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.packNumber}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          packNumber: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Packing Number As Per Simpolo',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.packingNumberAsPerSimpolo}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          packingNumberAsPerSimpolo:
                                            e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Number of Pack / Pallet',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.numberOfPack}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          numberOfPack: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight One',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightOne}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weightOne: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight Second',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightSecond}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weightSecond: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight Details',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightDetails}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weightDetails: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        },
                        {
                          title: 'Weight',
                          render: (_: any, record: any) => (
                            <Input
                              value={record.weightOne * record.weightSecond}
                              onChange={e =>
                                setItems(prev =>
                                  prev.map(item =>
                                    item.soi === record.soi
                                      ? {
                                          ...item,
                                          weight: e.target.value
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          )
                        }
                      ]),
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
                    title: 'Order Quantity',
                    dataIndex: 'orderQuantity',
                    sorter: (a, b) => a.orderQuantity - b.orderQuantity
                  },
                  {
                    title: 'Max Quantity',
                    dataIndex: 'maxQuantity'
                  },
                  {
                    title: 'Quantity in Inventory',
                    dataIndex: 'inventoryQuantity'
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
                              item.soi === record.soi
                                ? { ...item, quantity: value || 0 }
                                : item
                            )
                          )
                        }
                      />
                    )
                  },
                  {
                    title: 'Country Of Origin',
                    dataIndex: 'countryOfOriginId',
                    render: (countryOfOriginId, record) => (
                      <Select
                        allowClear
                        className="w-32"
                        showSearch
                        loading={countryOfOriginsLoading}
                        value={countryOfOriginId}
                        options={countryOfOrigins?.countryOfOrigins.map(u => ({
                          label: u.name,
                          value: u.id
                        }))}
                        filterOption={(input, option) =>
                          (option?.label ?? '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                        onChange={value => {
                          setItems(prev =>
                            prev.map(p =>
                              p.soi === record.soi
                                ? {
                                    ...p,
                                    countryOfOriginId: value
                                  }
                                : p
                            )
                          )
                        }}
                      />
                    )
                  }
                ]}
                dataSource={items.map((li, i) => ({
                  ...li,
                  sr: i + 1
                }))}
                rowKey="soi"
                pagination={{
                  pageSize: 20
                }}
              />
            </div>
          </div>
        ) : null}
      </Form>
    </Layout>
  )
}

export default NewInvoicePage
