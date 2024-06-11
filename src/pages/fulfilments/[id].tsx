import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FilePdfOutlined,
  PlusOutlined,
  SaveOutlined
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
  Descriptions,
  Divider,
  InputNumber,
  Modal,
  Table,
  Typography
} from 'antd'
import { Parser } from 'json2csv'
import type { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { Layout } from '~/components/Layout'
import { useNotificationApi } from '~/context/notifcationApi'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'

type FulfilmentStickerItem = {
  id: string
  itemId: string
  description: string
  unit?: string | null
  hsnCode?: string | null
  gstRate: number
  quantity: number
  price: number
  stickers: {
    distributeEvenly: boolean
    spq: number
    customDistribution: number[]
  }
  poId1: string
  poId2: string
  poId3?: string | null
  poSupplier: string
  taxCalcType: any
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

const FulfilmentPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useQuery
  const { data, isLoading, refetch } =
    api.orders.inventory.getOneFulfilmentLog.useQuery(
      {
        id: id?.toString() || ''
      },
      {
        enabled: !!session && !!id
      }
    )

  // ? useMutation
  const { mutateAsync: generatePdf, isLoading: stickerPdfLoading } =
    api.orders.inventory.generateStickerPdf.useMutation()
  const { mutateAsync: deleteOneItem, isLoading: deleteOneItemLoading } =
    api.orders.inventory.deleteOneItem.useMutation()
  const { mutateAsync: deleteOne, isLoading: deleting } =
    api.orders.inventory.deleteOne.useMutation()

  // ? useState
  const [items, setItems] = useState<FulfilmentStickerItem[]>([])
  const [customDistribution, setCustomDistribution] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  // ? useEffect
  useEffect(() => {
    if (!data) return setItems([])
    setItems(
      data.items.map(d => ({
        id: d.id,
        itemId: d.inventoryItem.purchaseOrderItem.itemId,
        description: d.inventoryItem.purchaseOrderItem.description,
        unit: d.inventoryItem.purchaseOrderItem.unit?.name,
        hsnCode: d.inventoryItem.purchaseOrderItem.hsnCode,
        gstRate: d.inventoryItem.purchaseOrderItem.gstRate?.rate || 0,
        quantity: d.quantity,
        price: d.inventoryItem.purchaseOrderItem.price,
        stickers: {
          distributeEvenly: true,
          spq: d.quantity,
          customDistribution: [d.quantity, 0]
        },
        poId1: d.inventoryItem.purchaseOrderItem.purchaseOrder.id,
        poId2: d.inventoryItem.purchaseOrderItem.purchaseOrder.id2,
        poId3: d.inventoryItem.purchaseOrderItem.purchaseOrder.referenceId,
        poSupplier: data?.supplier.name,
        taxCalcType: data?.supplier.taxCalcType
      }))
    )
  }, [data])

  // ? useMemo
  const modalCustomDistributions = useMemo(
    () =>
      items.find(item => item.id === customDistribution)?.stickers
        .customDistribution || [],
    [items, customDistribution]
  )

  const notificationApi = useNotificationApi()

  return (
    <Layout
      loading={isLoading}
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
          label: id?.toString() || ''
        }
      ]}
      title={`Fulfilment - ${id?.toString() || ''}`}
    >
      <Button
        className="my-2"
        size="large"
        type="primary"
        icon={<DownloadOutlined />}
        onClick={async () => {
          const finalData: any[] = []

          let sr = 1
          for (const item of items) {
            const arr: number[] = []
            const stickers = item.stickers
            if (stickers.distributeEvenly) {
              if (!stickers.spq)
                return alert('SPQ cannot be 0 for item ' + item.itemId)
              let initial = item.quantity
              const decrement = stickers.spq
              while (initial > 0) {
                if (initial - decrement >= 0) {
                  arr.push(decrement)
                  initial -= decrement
                } else {
                  arr.push(initial)
                  initial = 0
                }
              }
            } else {
              let total = 0
              for (const d of stickers.customDistribution) {
                if (!d) continue
                arr.push(d)
                total += d
              }
              if (item.quantity !== total)
                return alert(
                  'Total quantity does not match for item ' + item.itemId
                )
            }

            const gst = item.gstRate || 0
            let SGST = 0
            let CGST = 0
            let IGST = 0
            if (gst && item.taxCalcType) {
              if (gst === 0.1) {
                IGST = gst
              } else if (item.taxCalcType === 'IntraState') {
                IGST = gst
              } else {
                const half = parseFloat((gst / 2).toFixed(2))
                SGST = half
                CGST = half
              }
            }

            let sr2 = 1
            for (const q of arr) {
              finalData.push({
                'Sr. No.': sr++,
                Type: 'Item',
                'Item ID': item.itemId,
                '# of': sr2++,
                'Out of': arr.length,
                'Invoice Date': data?.invoiceDate.toLocaleDateString(),
                'Store Register Entry Date':
                  data?.gateEntryDate.toLocaleDateString(),
                'Store No': data?.gateEntryNumber,
                'Supplier Name': item.poSupplier,
                'Invoice No': data?.invoiceId,
                'Item Description': item.description,
                'HSN Code': item.hsnCode,
                Quantity: q,
                UOM: item.unit,
                Rate: item.price,
                'Taxable Value': (item.price * item.quantity).toFixed(2),
                'GST Rate': gst,
                SGST,
                CGST,
                IGST,
                'Purchase Order Reference ID': item.poId3,
                'Purchase Order ID': item.poId2,
                Remarks: data?.remarks
              })
            }
          }

          for (const ex of data?.expenses || []) {
            const gst = ex.gstRate?.rate || 0
            let SGST = 0
            let CGST = 0
            let IGST = 0
            if (gst && ex.purchaseOrder.supplier.taxCalcType) {
              if (gst === 0.1) {
                IGST = gst
              } else if (
                ex.purchaseOrder.supplier.taxCalcType === 'IntraState'
              ) {
                IGST = gst
              } else {
                const half = parseFloat((gst / 2).toFixed(2))
                SGST = half
                CGST = half
              }
            }

            finalData.push({
              'Sr. No.': sr++,
              Type: 'Expense',
              'Item ID': '',
              '# of': '',
              'Out of': '',
              'Invoice Date': data?.invoiceDate.toLocaleDateString(),
              'Store Register Entry Date':
                data?.gateEntryDate.toLocaleDateString(),
              'Store No': data?.gateEntryNumber,
              'Supplier Name': ex.purchaseOrder.supplier.name,
              'Invoice No': data?.invoiceId,
              'Item Description': ex.description,
              'HSN Code': '',
              Quantity: '',
              UOM: '',
              Rate: ex.price,
              'Taxable Value': ex.price,
              'GST Rate': gst,
              SGST,
              CGST,
              IGST,
              'Purchase Order Reference ID': ex.purchaseOrder.referenceId,
              'Purchase Order ID': ex.purchaseOrder.id2,
              Remarks: data?.remarks
            })
          }

          const parser = new Parser()
          const csv = parser.parse(finalData)

          const element = document.createElement('a')
          element.setAttribute(
            'href',
            'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
          )
          element.setAttribute('download', `Fulfilment-${id?.toString()}.csv`)

          element.style.display = 'none'
          document.body.appendChild(element)

          element.click()

          document.body.removeChild(element)
        }}
      >
        Download
      </Button>
      <Button
        className="ml-2"
        type="primary"
        size="large"
        icon={<FilePdfOutlined />}
        loading={stickerPdfLoading}
        onClick={async () => {
          const { url } = await generatePdf({
            arr: items
              .filter(item =>
                selected.length ? selected.includes(item.id) : true
              )
              .map(item => ({
                id: item.itemId || '',
                description: item.description.slice(0, 50),
                quantity: item.quantity || 0,
                uom: item.unit || '',
                storeNo: data?.gateEntryNumber || '',
                poRef: item.poId3 || '',
                stickers: item.stickers,
                poId: item.poId1
              })),
            qr: false
          })
          window.open(url)
        }}
      >
        Generate Sticker PDF
      </Button>
      <Button
        className="ml-2"
        type="primary"
        size="large"
        icon={<FilePdfOutlined />}
        loading={stickerPdfLoading}
        onClick={async () => {
          const { url } = await generatePdf({
            arr: items
              .filter(item =>
                selected.length ? selected.includes(item.id) : true
              )
              .map(item => ({
                id: item.itemId || '',
                description: item.description.slice(0, 50),
                quantity: item.quantity || 0,
                uom: item.unit || '',
                storeNo: data?.gateEntryNumber || '',
                poRef: item.poId3 || '',
                stickers: item.stickers,
                poId: item.poId1
              })),
            qr: true
          })
          window.open(url)
        }}
      >
        Generate Sticker PDF with QR
      </Button>
      {session?.user.role === 'ADMIN' && !data?.items.length ? (
        <Button
          size="large"
          icon={<DeleteOutlined />}
          className="ml-2"
          danger
          onClick={async () => {
            try {
              await deleteOne(id?.toString() || '')
              notificationApi.success({
                message: 'Success',
                description: 'Deleted'
              })
              router.replace('/fulfilments')
            } catch (err) {
              notificationApi.error({
                message: 'Error',
                description: 'Failed to delete'
              })
            }
          }}
          loading={deleting}
        >
          Delete
        </Button>
      ) : null}
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
          <Descriptions.Item label="Created At">
            {data.createdAt.toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Supplier">
            <Link href={`/suppliers/${data.supplier.id}`}>
              {data.supplier.name?.toLocaleString()}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Gate Entry No.">
            {data.gateEntryNumber}
          </Descriptions.Item>
          <Descriptions.Item label="Gate Entry Date">
            {data.gateEntryDate.toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Invoice ID">
            {data.invoiceId}
          </Descriptions.Item>
          <Descriptions.Item label="Invoice Date">
            {data.invoiceDate.toLocaleDateString()}
          </Descriptions.Item>
          <Descriptions.Item label="Location">
            {data.location}
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
              <Link href={`/orders/purchase/${record.poId1}`}>
                {record.itemId}
              </Link>
            )
          },
          {
            title: 'Item Description',
            render: (_, record) => record.description
          },
          {
            title: 'Unit',
            render: (_, record) => record.unit
          },
          {
            title: 'HSN Code',
            render: (_, record) => record.hsnCode
          },
          {
            title: 'GST Rate',
            render: (_, record) => record.gstRate
          },
          {
            title: 'Fulfilment Quantity',
            render: (_, item) => item.quantity
          },
          {
            title: 'SPQ',
            render: (_, item) => (
              <InputNumber
                disabled={!item.stickers.distributeEvenly}
                value={item.stickers.spq}
                onChange={num =>
                  setItems(prev =>
                    prev.map(p =>
                      p.id === item.id
                        ? {
                            ...p,
                            stickers: {
                              ...p.stickers,
                              spq: num || 0
                            }
                          }
                        : p
                    )
                  )
                }
              />
            )
          },
          {
            title: 'Stickers',
            children: [
              {
                title: 'Distribute Evenly',
                render: (_, item) => (
                  <Checkbox
                    checked={item.stickers.distributeEvenly}
                    onChange={e =>
                      setItems(prev =>
                        prev.map(p =>
                          p.id === item.id
                            ? {
                                ...p,
                                stickers: {
                                  ...p.stickers,
                                  distributeEvenly: e.target.checked,
                                  customDistribution: Array.from(
                                    {
                                      length: Math.ceil(
                                        p.quantity / p.stickers.spq
                                      )
                                    },
                                    () => p.stickers.spq
                                  )
                                }
                              }
                            : p
                        )
                      )
                    }
                  />
                )
              },
              {
                title: 'Custom Distribution',
                render: (_, item) => (
                  <Button
                    size="small"
                    disabled={item.stickers.distributeEvenly}
                    onClick={() => setCustomDistribution(item.id)}
                    icon={<EditOutlined />}
                  >
                    Customize
                  </Button>
                )
              },
              ...(session?.user.role === 'ADMIN'
                ? [
                    {
                      title: 'Actions',
                      render: (_: any, item: any) => (
                        <Button
                          size="small"
                          danger
                          onClick={async () => {
                            try {
                              await deleteOneItem(item.id)
                              notificationApi.success({
                                message: 'Success',
                                description: 'Deleted'
                              })
                              refetch()
                            } catch (err) {
                              notificationApi.error({
                                message: 'Error',
                                description: 'Failed to delete'
                              })
                            }
                          }}
                          disabled={deleteOneItemLoading}
                        >
                          Delete
                        </Button>
                      )
                    }
                  ]
                : [])
            ]
          }
        ]}
        dataSource={items}
        rowKey="id"
        pagination={false}
        rowSelection={{
          selectedRowKeys: selected,
          onSelect: (record, selected) => {
            if (selected) {
              setSelected(prev => [...prev, record.id])
            } else {
              setSelected(prev => prev.filter(p => p !== record.id))
            }
          }
        }}
      />

      <Divider />
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
            dataIndex: 'description'
          },
          {
            title: 'GST',
            render: (_, record) => record.gstRate?.rate || 0
          },
          {
            title: 'Price',
            dataIndex: 'price'
          }
        ]}
        dataSource={data?.expenses}
        rowKey="key"
        pagination={false}
      />

      <Modal
        title="Custom Distribution"
        open={!!customDistribution}
        onCancel={() => setCustomDistribution('')}
        footer={null}
        destroyOnClose
      >
        <Button
          icon={<PlusOutlined />}
          onClick={() =>
            setItems(prev =>
              prev.map(p =>
                p.id === customDistribution
                  ? {
                      ...p,
                      stickers: {
                        ...p.stickers,
                        customDistribution: [
                          ...p.stickers.customDistribution,
                          0
                        ]
                      }
                    }
                  : p
              )
            )
          }
        >
          Add
        </Button>
        <Typography.Title level={4} className="my-1">
          Total:
          {modalCustomDistributions.reduce((total, curr) => total + curr, 0)}
        </Typography.Title>
        <div className="mb-4 mt-2 flex flex-col gap-2">
          {modalCustomDistributions.map((d, index) => (
            <div key={index}>
              <span className="mr-2">{index + 1}</span>
              <InputNumber
                value={d}
                onChange={num =>
                  setItems(prev =>
                    prev.map(p =>
                      p.id === customDistribution
                        ? {
                            ...p,
                            stickers: {
                              ...p.stickers,
                              customDistribution:
                                p.stickers.customDistribution.map(
                                  (cd, index2) =>
                                    index === index2 ? num || 0 : cd
                                )
                            }
                          }
                        : p
                    )
                  )
                }
              />
            </div>
          ))}
        </div>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={() => setCustomDistribution('')}
        >
          Done
        </Button>
      </Modal>
    </Layout>
  )
}

export default FulfilmentPage
