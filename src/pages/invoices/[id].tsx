import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import { Button, Descriptions, Table } from 'antd'
import { Parser } from 'json2csv'
import { groupBy } from 'lodash'
import type { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { Layout } from '~/components/Layout'
import { useNotificationApi } from '~/context/notifcationApi'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'

type Item = {
  salesOrderId: string
  salesOrderId2: string
  soi: string
  itemId: string
  description: string
  quantity: number
  price: number
  unitId: string
  countryOfOriginId?: string | null
  numberOfPack?: string | null
  packNumber?: string | null
  packingNumberAsPerSimpolo?: string | null
  weightDetails?: string | null
  weight?: string | null
  weightOne?: string | null
  weightSecond?: string | null
}

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

const InvoicePage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query
  const notificationApi = useNotificationApi()

  // ? useQuery
  const { data, isLoading } = api.orders.invoices.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id
    }
  )
  const { data: units } = api.units.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
  )
  const { mutateAsync: createInvoice, isLoading: createInvoiceLoading } =
    api.orders.invoices.createMany.useMutation()

  // ? useMemo
  const unitsObj = useMemo(() => {
    const obj: any = {}
    units?.units.forEach(u => {
      obj[u.id] = u
    })
    return obj
  }, [units])

  const { mutateAsync: generatePdf, isLoading: generating } =
    api.orders.invoices.generatePdf.useMutation()

  const {
    mutateAsync: generatePdfInvoice,
    isLoading: generatePdfInvoiceLoading
  } = api.orders.invoices.generatePdfInvoice.useMutation()

  const {
    mutateAsync: generatePdfPackingList,
    isLoading: generatePdfPackingListLoading
  } = api.orders.invoices.generatePdfPackingList.useMutation()
  const {
    mutateAsync: deleteDraftInvoice,
    isLoading: deleteDraftInvoiceLoading
  } = api.orders.invoices.deleteDraftInvoice.useMutation()

  return (
    <Layout
      loading={isLoading}
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
          label: data?.id2 || data?.id || 'Loading'
        }
      ]}
      title={`Invoice - ${data?.id2 || data?.id || id}`}
    >
      <div className="mb-2 flex w-full gap-2">
        {!data?.id2 && session?.user?.role === 'ADMIN' ? (
          <>
            <Button
              icon={<DeleteOutlined />}
              danger
              loading={deleteDraftInvoiceLoading}
              onClick={async () => {
                if (!data?.id) return
                await deleteDraftInvoice({
                  id: data?.id
                })
                router.push('/invoices')
              }}
            >
              Delete
            </Button>
            <Button
              loading={createInvoiceLoading}
              onClick={async () => {
                try {
                  if (!data?.id) return
                  const groupedItems = groupBy(
                    data.items,
                    item => item.salesOrderItem.salesOrderId
                  )

                  const soInvoiceToGenerate: {
                    id: string
                    items: Item[]
                    itemsValue: number
                  }[] = []

                  for (const salesOrderId in groupedItems) {
                    const items = groupedItems[salesOrderId]
                    const itemsValue =
                      items?.reduce(
                        (acc, item) =>
                          acc + item.quantity * item.salesOrderItem.price,
                        0
                      ) || 0
                    soInvoiceToGenerate.push({
                      id: salesOrderId,
                      items:
                        items?.map(item => ({
                          salesOrderId: item.salesOrderItem.salesOrderId,
                          salesOrderId2: item.salesOrderItem.salesOrder.id2,
                          soi: item.salesOrderItem.id,
                          itemId: item.salesOrderItem.itemId,
                          description: item.description,
                          quantity: item.quantity,
                          price: item.salesOrderItem.price,
                          unitId: item.salesOrderItem.unitId,
                          countryOfOriginId: item.countryOfOriginId,
                          numberOfPack: item.numberOfPack,
                          packNumber: item.packNumber,
                          packingNumberAsPerSimpolo:
                            item.packingNumberAsPerSimpolo,
                          weightDetails: item.weightDetails,
                          weight: item.weight,
                          weightOne: item.weightOne,
                          weightSecond: item.weightSecond
                        })) || [],
                      itemsValue
                    })
                  }

                  const finalData: {
                    salesOrderId: string
                    items: {
                      salesOrderItemId: string
                      description: string
                      quantity: number
                      numberOfPack?: string | null
                      packNumber?: string | null
                      packingNumberAsPerSimpolo?: string | null
                      weightDetails?: string | null
                      weight?: string | null
                      weightOne?: string | null
                      weightSecond?: string | null
                    }[]
                  }[] = []

                  for (const soig of soInvoiceToGenerate) {
                    finalData.push({
                      salesOrderId: soig.id,
                      items: soig.items.map(item => ({
                        salesOrderItemId: item.soi,
                        description: item.description,
                        quantity: item.quantity,
                        countryOfOriginId: item.countryOfOriginId,
                        numberOfPack: item.numberOfPack,
                        packNumber: item.packNumber,
                        packingNumberAsPerSimpolo:
                          item.packingNumberAsPerSimpolo,
                        weightDetails: item.weightDetails,
                        weight: item.weight,
                        weightOne: item.weightOne,
                        weightSecond: item.weightSecond
                      }))
                    })
                  }

                  const finalID = await createInvoice({
                    date: data?.date,
                    id3: data.id3,
                    customDate: data.customDate,
                    customerId: data.customerId,
                    remarks: data.remarks,
                    amountInWords: data.amountInWords,
                    totalPackages: data.totalPackages,
                    totalNetWeight: data.totalNetWeight,
                    totalGrossWeight: data.totalGrossWeight,
                    totalCbm: data.totalCbm,
                    cntrNumber: data.cntrNumber,
                    truckNumber: data.truckNumber,
                    lineSealNumber: data.lineSealNumber,
                    rfidSealNumber: data.rfidSealNumber,
                    cntrSize: data.cntrSize,
                    loadingPortId: data.loadingPortId,
                    dischargePortId: data.dischargePortId,
                    exporterDetailsId: data.exporterDetailsId,
                    notifyPartyId: data.notifyPartyId,
                    notifyPartyId2: data.notifyPartyId2,
                    type: data.type,
                    currencyId: data.currencyId,
                    IecId: data.iecCodeId,
                    LutId: data.lutId,
                    representativeUserId: data.representativeUser?.id,
                    conversionRate: data.conversionRate,
                    isInvoice2: false,
                    arr: finalData
                  })
                  await deleteDraftInvoice({
                    id: data?.id
                  })

                  notificationApi.success({
                    message: 'Convert To Final'
                  })
                  router.push('/invoices/' + finalID)
                } catch (error: any) {
                  notificationApi.error({
                    message: 'Error',
                    description: error.message
                  })
                }
              }}
            >
              Convert To Final
            </Button>
          </>
        ) : null}

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={async () => {
            if (!data?.id) return
            const url = await generatePdf({
              id: data?.id,
              timezoneOffset: new Date().getTimezoneOffset()
            })
            window.open(url)
          }}
          loading={generating}
        >
          Download PDF (E-Invoice)
        </Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={async () => {
            if (!data?.id) return
            const url = await generatePdfInvoice({
              id: data?.id,
              timezoneOffset: new Date().getTimezoneOffset()
            })
            if (!url) return
            window.open(url)
          }}
          loading={generatePdfInvoiceLoading}
        >
          Download PDF (Invoice)
        </Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={async () => {
            if (!data?.id) return
            const url = await generatePdfPackingList({
              id: data?.id,
              timezoneOffset: new Date().getTimezoneOffset()
            })
            if (!url) return
            window.open(url)
          }}
          loading={generatePdfPackingListLoading}
        >
          Download PackingList
        </Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={async () => {
            if (!data) return
            let sr = 1
            const finalData: any[] = []

            let USDTotal = 0
            let totalCIF = 0
            let INRTotal = 0
            let totalINR = 0

            if (data?.type === 'lut') {
              for (const item of data?.items || []) {
                const currency = data?.currency.name
                let price = 0
                const INRPrice = item.salesOrderItem.price
                price = Number((INRPrice / data.conversionRate).toFixed(2))
                USDTotal += parseFloat((price * item.quantity).toFixed(2))
                totalCIF += parseFloat((price * item.quantity).toFixed(2))
                INRTotal += parseFloat(
                  (price * item.quantity * data.conversionRate).toFixed(2)
                )
                totalINR += parseFloat(
                  (price * item.quantity * data.conversionRate).toFixed(2)
                )

                for (const poi of item?.salesOrderItem?.purchaseOrderItems ||
                  []) {
                  finalData.push({
                    'Sr. No.': sr,
                    'Invoice No': data?.id3 || data?.id2 || data?.id,
                    'Description Of Goods': item.description,
                    Quantity: item.quantity,
                    UOM: item.salesOrderItem.unit.name,
                    [`Unit Price ${currency}`]: price.toLocaleString('en-IN', {
                      currency: data?.currency?.name,
                      maximumFractionDigits: 2
                    }),
                    [`Total ${currency}`]: Number(
                      price * item.quantity
                    ).toFixed(2),
                    'HSN Code': poi.hsnCode,
                    'Total INR': Number(
                      price * item.quantity * data?.conversionRate
                    ).toLocaleString('en-IN', {
                      currency: 'INR',
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2
                    }),
                    'SUPP INV NO':
                      poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                        ?.invoiceId || '',
                    'GSTN NO': poi.purchaseOrder.supplier.gst || '',
                    DATE:
                      poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog.invoiceDate?.toLocaleDateString() ||
                      '',
                    'Country Of Origin': item.countryOfOrigin?.name || '',
                    'PO Ref': poi.purchaseOrder.referenceId,
                    'Item Id': item.salesOrderItem.itemId,
                    'Conversion Rate': data?.conversionRate,
                    'Purchase Order Price': poi?.price,
                    'Custom Invoice Date':
                      data?.customDate?.toLocaleDateString()
                  })
                  sr++
                }
              }
            } else {
              for (const item of data?.items || []) {
                let USDTotal = 0
                let totalCIF = 0
                let INRTotal = 0
                let totalINR = 0

                for (const poi of item?.salesOrderItem?.purchaseOrderItems ||
                  []) {
                  const currency = data?.currency.name
                  let price = 0

                  const INRPrice = item.salesOrderItem.price
                  price = Number((INRPrice / data.conversionRate).toFixed(2))
                  USDTotal += parseFloat((price * item.quantity).toFixed(2))
                  totalCIF += parseFloat((price * item.quantity).toFixed(2))
                  INRTotal += parseFloat(
                    (price * item.quantity * data.conversionRate).toFixed(2)
                  )
                  totalINR += parseFloat(
                    (price * item.quantity * data.conversionRate).toFixed(2)
                  )

                  finalData.push({
                    'Sr. No.': sr,
                    'Invoice No': data?.id3 || data?.id2 || data?.id,
                    'Description Of Goods': item.description,
                    Quantity: item.quantity,
                    UOM: item.salesOrderItem.unit.name,
                    [`Unit Price ${currency}`]: price.toLocaleString('en-IN', {
                      currency: data?.currency?.name,
                      maximumFractionDigits: 2
                    }),
                    [`Total ${currency}`]: Number(
                      price * item.quantity
                    ).toFixed(2),
                    'HSN Code': poi.hsnCode,
                    'Total INR': Number(
                      price * item.quantity * data?.conversionRate
                    ).toLocaleString('en-IN', {
                      currency: 'INR',
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2
                    }),
                    'GST Rate': poi.gstRate?.rate + '%' || 0,
                    'Total GST': (
                      (price *
                        item.quantity *
                        data?.conversionRate *
                        (item.salesOrderItem.purchaseOrderItems[0]?.gstRate
                          ?.rate || 0)) /
                      100
                    ).toLocaleString('en-IN', {
                      currency: 'INR'
                    }),
                    'Country Of Origin': item.countryOfOrigin?.name || '',
                    'PO Ref': poi.purchaseOrder.referenceId,
                    'Item Id': item.salesOrderItem.itemId,
                    'Conversion Rate': data?.conversionRate,
                    'Purchase Order Price': poi?.price,
                    'Custom Invoice Date':
                      data?.customDate?.toLocaleDateString()
                  })
                  sr++
                }
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
              `Invoice-excell-${data?.id2 || data?.id}.csv`
            )
            element.style.display = 'none'
            document.body.appendChild(element)
            element.click()
            document.body.removeChild(element)
          }}
        >
          Download Excel (Invoice)
        </Button>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={async () => {
            if (!data) return

            let sr = 1
            const finalData: any[] = []

            for (const item of data.items) {
              finalData.push({
                'Sr. No.': sr,
                'Item Id': item.salesOrderItem.itemId,
                'Sales Order Id': item.salesOrderItem.salesOrder?.id2,
                Description: item.description,
                Price: item.salesOrderItem.price,
                Unit: unitsObj[item.salesOrderItem.unitId]?.name,
                Quantity: item.quantity
              })
              sr++
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
              `Invoice-${data.id2 || data.id}.csv`
            )

            element.style.display = 'none'
            document.body.appendChild(element)

            element.click()

            document.body.removeChild(element)
          }}
        >
          Export
        </Button>
      </div>
      {data ? (
        <Descriptions bordered>
          <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
          {data.id2 ? (
            <Descriptions.Item label="Invoice ID">{data.id2}</Descriptions.Item>
          ) : null}
          {data.type ? (
            <Descriptions.Item label="Invoice Type">
              {data.type.toUpperCase()}
            </Descriptions.Item>
          ) : null}
          {data.id3 ? (
            <Descriptions.Item label="Custom Invoice ID">
              {data.id3}
            </Descriptions.Item>
          ) : null}
          {data?.customDate ? (
            <Descriptions.Item label="Custom Invoice Date">
              {data.customDate.toLocaleDateString()}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Customer">
            <Link href={`/customers/${data.customer.id}`}>
              {data.customer.name?.toLocaleString()}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Date">
            {data.date.toLocaleDateString()}
          </Descriptions.Item>
          <Descriptions.Item label="Loading Port">
            <Link href={`/ports/${data.loadingPortId}`}>
              {data.loadingPort.name}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Discharge Port">
            <Link href={`/ports/${data.dischargePortId}`}>
              {data.dischagePort.name}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Exporter Details">
            <Link href={`/exporter-details/${data.exporterDetailsId}`}>
              {data.exporterDetails.name}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Notify Party 1">
            <Link href={`/notify-parties/${data.notifyPartyId}`}>
              {data.notifyParty.name}
            </Link>
          </Descriptions.Item>
          {data.notifyPartyId2 && data.notifyParty2 ? (
            <Descriptions.Item label="Notify Party 1">
              <Link href={`/notify-parties/${data.notifyPartyId2}`}>
                {data.notifyParty2.name}
              </Link>
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Currency Code">
            {data.currency.name}
          </Descriptions.Item>
          <Descriptions.Item label="LUT No.">{data.lut.name}</Descriptions.Item>
          <Descriptions.Item label="IEC Code">
            {data.iecCode.name}
          </Descriptions.Item>
          <Descriptions.Item label="Currency Symbol">
            {data.currency.symbol}
          </Descriptions.Item>
          <Descriptions.Item label="Conversion Rate">
            {data.conversionRate}
          </Descriptions.Item>
          {data.createdBy ? (
            <Descriptions.Item label="Created By">
              <Link href={`/users/${data.createdById}`}>
                {data.createdBy.name?.toLocaleString()}
              </Link>
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Created At">
            {data.createdAt.toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Representative User">
            {data.representativeUser?.name}
          </Descriptions.Item>
        </Descriptions>
      ) : null}
      <Table
        className="mt-8"
        size="middle"
        bordered
        scroll={{ x: 800 }}
        columns={[
          {
            title: 'Sr. No.',
            render: (_1, _2, i) => i + 1
          },
          {
            title: 'Item Id',
            render: (_, record) => (
              <Link
                href={`/orders/sales/${record.salesOrderItem.salesOrderId}`}
              >
                {record.salesOrderItem.itemId}
              </Link>
            )
          },
          {
            title: 'Item Description',
            render: (_, record) => record.description
          },
          {
            title: 'Size',
            render: (_, record) => record.size
          },
          {
            title: 'Unit',
            render: (_, record) => unitsObj[record.salesOrderItem.unitId]?.name
          },
          {
            title: 'Quantity',
            render: (_, item) => item.quantity
          },
          {
            title: 'Price',
            render: (_, item) => item.salesOrderItem.price
          },
          {
            title: 'Country Of Origin',
            render: (_, item) => item.countryOfOrigin?.name
          }
        ]}
        dataSource={data?.items}
        rowKey="id"
        pagination={false}
      />
    </Layout>
  )
}

export default InvoicePage
