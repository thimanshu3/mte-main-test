import { SaveOutlined } from '@ant-design/icons'
import { Button, DatePicker, Form, Input, InputNumber, Select } from 'antd'
import { Parser } from 'json2csv'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import { useMemo, useState } from 'react'
import { Layout } from '~/components/Layout'
import { useMessageApi } from '~/context/messageApi'
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

type S = {
  type: 'purchase' | 'sales'
  id: string
  id2?: string | null
  ref?: string | null
  date: Date
  party: string
}

const NewCreateExpensePage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<S | undefined>(undefined)

  const { data: gstRates, isLoading: gstRatesLoading } =
    api.gstRates.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      {
        enabled: !!session
      }
    )
  const { data: expensesGlobal, isLoading: expensesLoading } =
    api.expenses.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )

  const { data: po, isLoading: loading1 } = api.orders.purchase.getAll.useQuery(
    {
      page: 1,
      limit: 10,
      search: searchTerm
    },
    {
      enabled: !!session && !!searchTerm
    }
  )

  const { data: so, isLoading: loading2 } = api.orders.sales.getAll.useQuery(
    {
      page: 1,
      limit: 10,
      search: searchTerm
    },
    {
      enabled: !!session && !!searchTerm
    }
  )

  const mergedOrders = useMemo(() => {
    const arr: S[] = []
    if (po) {
      po.purchaseOrders.forEach(p => {
        arr.push({
          type: 'purchase',
          id: p.id,
          id2: p.id2,
          ref: p.referenceId,
          date: p.date,
          party: p.supplier.name
        })
      })
    }
    if (so) {
      so.salesOrders.forEach(s => {
        arr.push({
          type: 'sales',
          id: s.id,
          id2: s.id2,
          ref: s.referenceId,
          date: s.date,
          party: s.customer.name
        })
      })
    }
    return arr
  }, [po, so])

  const { mutateAsync: createPurchaseExpense, isLoading: loading3 } =
    api.expenses.createPurchaseExpense.useMutation()
  const { mutateAsync: createSalesExpense, isLoading: loading4 } =
    api.expenses.createSalesExpense.useMutation()

  const messageApi = useMessageApi()
  const [form] = Form.useForm()

  return (
    <Layout
      breadcrumbs={[{ label: 'Home', link: '/' }, { label: 'Expenses' }]}
      title="Create Expenses"
    >
      <Input
        className="my-3 w-64"
        placeholder="Search Order"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
      />
      <Form
        layout="vertical"
        onFinish={async formData => {
          if (!selectedOrder) return
          if (selectedOrder.type === 'purchase') {
            await createPurchaseExpense({
              purchaseOrderId: selectedOrder.id,
              gstRateId: formData.gstRateId,
              description: formData.description,
              price: formData.price,
              customId: formData.customId,
              remarks: formData.remarks,
              exportInvoiceDate: formData.exportInvoiceDate,
              supplierInvoiceNumber: formData.supplierInvoiceNumber,
              exportInvoiceNumber: formData.exportInvoiceNumber,
              poInvoiceDate: formData.poInvoiceDate,
              voucherDate: formData.voucherDate
            })
          } else {
            await createSalesExpense({
              salesOrderId: selectedOrder.id,
              description: formData.description,
              price: formData.price,
              customId: formData.customId,
              remarks: formData.remarks,
              exportInvoiceDate: formData.exportInvoiceDate,
              supplierInvoiceNumber: formData.supplierInvoiceNumber,
              exportInvoiceNumber: formData.exportInvoiceNumber,
              poInvoiceDate: formData.poInvoiceDate,
              voucherDate: formData.voucherDate
            })
          }
          messageApi.success('Expense created successfully')
          form.resetFields()
        }}
        form={form}
      >
        <Button
          className="mb-4"
          size="large"
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          loading={loading3 || loading4}
        >
          Save
        </Button>
        <Button
          className="mb-4 ml-2"
          size="large"
          type="primary"
          onClick={async () => {
            if (!selectedOrder) return
            const finalData = []
            if (selectedOrder.type === 'purchase') {
              finalData.push({
                'PO ID': selectedOrder.id,
                'Voucher Date': form.getFieldValue('voucherDate'),
                'GST Rate ID': form.getFieldValue('gstRateId'),
                Expense: form.getFieldValue('description'),
                Price: form.getFieldValue('price'),
                'Custom ID': form.getFieldValue('customId'),
                'Supplier Invoice Number': form.getFieldValue(
                  'supplierInvoiceNumber'
                ),
                'Export Invoice Number': form.getFieldValue(
                  'exportInvoiceNumber'
                ),
                'Invoice Date': form.getFieldValue('poInvoiceDate'),
                Remarks: form.getFieldValue('remarks'),
                'Custom Date': form.getFieldValue('exportInvoiceDate')
              })
            } else {
              finalData.push({
                'SO ID': selectedOrder.id,
                Expense: form.getFieldValue('description'),
                'Voucher Date': form.getFieldValue('voucherDate'),
                Price: form.getFieldValue('price'),
                'Custom ID': form.getFieldValue('customId'),
                'Supplier Invoice Number': form.getFieldValue(
                  'supplierInvoiceNumber'
                ),
                'Export Invoice Number': form.getFieldValue(
                  'exportInvoiceNumber'
                ),
                'Invoice Date': form.getFieldValue('poInvoiceDate'),
                Remarks: form.getFieldValue('remarks'),
                'Custom Date': form.getFieldValue('exportInvoiceDate')
              })
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
              `Invoice-excell-${
                selectedOrder.type === 'purchase' ? 'purchase' : 'sales'
              }-${
                selectedOrder.id || selectedOrder.id2 || selectedOrder.id
              }.csv`
            )
            element.style.display = 'none'
            document.body.appendChild(element)
            element.click()
            document.body.removeChild(element)
          }}
        >
          Download Excel
        </Button>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item label="Order">
            <Select
              loading={loading1 || loading2}
              options={mergedOrders.map(o => ({
                label: `${o.type === 'purchase' ? 'PO' : 'SO'} - ${
                  o.id2 || o.id
                } | ${o.party} ${o.ref || ''} | ${o.date.toLocaleDateString()}`,
                value: o.id
              }))}
              onChange={v => {
                const order = mergedOrders.find(o => o.id === v)
                if (order) setSelectedOrder(order)
                else setSelectedOrder(undefined)
              }}
            />
          </Form.Item>
          <Form.Item name="description" label="Expense">
            <Select
              className="w-full"
              showSearch
              loading={expensesLoading}
              options={expensesGlobal?.expenses.map(ex => ({
                label: ex.name,
                value: ex.name
              }))}
              filterOption={(input, option) =>
                (option?.label ?? '')
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="voucherDate" label="Voucher Date">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="price" label="Price">
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="customId" label="Custom ID">
            <Input className="w-full" />
          </Form.Item>
          <Form.Item name="supplierInvoiceNumber" label="Supplier Invoice No.">
            <Input className="w-full" />
          </Form.Item>
          <Form.Item name="exportInvoiceNumber" label="Export Invoice No.">
            <Input className="w-full" />
          </Form.Item>
          <Form.Item name="poInvoiceDate" label="PO Invoice Date">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea className="w-full" />
          </Form.Item>
          <Form.Item name="exportInvoiceDate" label="Export Invoice Date">
            <DatePicker className="w-full" />
          </Form.Item>
          {selectedOrder?.type === 'purchase' ? (
            <Form.Item
              name="gstRateId"
              label="GST Rate"
              rules={[
                {
                  required: true
                }
              ]}
            >
              <Select
                className="w-full"
                showSearch
                loading={gstRatesLoading}
                options={gstRates?.gstRates.map(g => ({
                  label: g.rate.toString(),
                  value: g.id
                }))}
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              />
            </Form.Item>
          ) : null}
        </div>
      </Form>
    </Layout>
  )
}

export default NewCreateExpensePage
