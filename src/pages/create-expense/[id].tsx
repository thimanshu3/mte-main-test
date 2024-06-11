import { DownloadOutlined } from '@ant-design/icons'
import { Button, Descriptions } from 'antd'
import { Parser } from 'json2csv'
import type { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { Layout } from '~/components/Layout'
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
const CreateExpensePage: NextPage = () => {
  const { data: session } = useSession()

  const router = useRouter()
  const { id } = router.query

  const { data: getPoData, isLoading: isLoading1 } =
    api.expenses.getOnePo.useQuery(
      {
        id: id?.toString() || ''
      },
      {
        enabled: !!session && !!id
      }
    )

  const { data: getSoData } = api.expenses.getOneSo.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id
    }
  )

  const { mutateAsync: generateExpensePoPdf, isLoading: expensesPdfLoading } =
    api.expenses.generateExpensePoPdf.useMutation()

  const { mutateAsync: generateExpenseSoPdf, isLoading: expensesPdfLoading2 } =
    api.expenses.generateExpenseSoPdf.useMutation()

  return (
    <Layout
      loading={isLoading1}
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Create Expense'
        }
      ]}
    >
      <div className="mb-2 flex w-full gap-2">
        {getPoData ? (
          <>
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              onClick={async () => {
                if (!getPoData.id) return
                const url = await generateExpensePoPdf({
                  id: getPoData.id,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                if (!url) return
                window.open(url)
              }}
              loading={expensesPdfLoading}
            >
              Download PDF (PO-Expenses)
            </Button>

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={async () => {
                if (!getPoData) return

                const finalData = []
                finalData.push({
                  Order: getPoData?.purchaseOrder?.id2,
                  Expenses: getPoData?.description,
                  Price: getPoData?.price,
                  CustomId: getPoData?.customId,
                  'Supplier Invoice Number': getPoData?.supplierInvoiceNumber,
                  'Export Invoice Number': getPoData?.exportInvoiceNumber,
                  'PO Invoice Date':
                    getPoData?.poInvoiceDate?.toLocaleDateString(),
                  Remarks: getPoData?.remarks,
                  'Export Invoice Date':
                    getPoData?.exportInvoiceDate?.toLocaleDateString()
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
                  `Expenses-excell-${getPoData?.id}.csv`
                )
                element.style.display = 'none'
                document.body.appendChild(element)
                element.click()
                document.body.removeChild(element)
              }}
            >
              Download PO-Excel
            </Button>
          </>
        ) : null}
        {getSoData ? (
          <>
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              onClick={async () => {
                if (!getSoData.id) return
                const url = await generateExpenseSoPdf({
                  id: getSoData.id,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                if (!url) return
                window.open(url)
              }}
              loading={expensesPdfLoading2}
            >
              Download PDF (SO-Expenses)
            </Button>

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={async () => {
                if (!getSoData) return

                const finalData = []
                finalData.push({
                  Order: getSoData?.salesOrder?.id2,
                  Expenses: getSoData?.description,
                  Price: getSoData?.price,
                  CustomId: getSoData?.customId,
                  'Supplier Invoice Number': getSoData?.supplierInvoiceNumber,
                  'Export Invoice Number': getSoData?.exportInvoiceNumber,
                  'PO Invoice Date':
                    getSoData?.poInvoiceDate?.toLocaleDateString(),
                  Remarks: getSoData?.remarks,
                  'Export Invoice Date':
                    getSoData?.exportInvoiceDate?.toLocaleDateString()
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
                  `Expenses-excell-${getSoData?.id}.csv`
                )
                element.style.display = 'none'
                document.body.appendChild(element)
                element.click()
                document.body.removeChild(element)
              }}
            >
              Download SO-Excel
            </Button>
          </>
        ) : null}
      </div>
      <div>
        {getPoData ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{getPoData.id}</Descriptions.Item>
            {getPoData.customId ? (
              <Descriptions.Item label="Custom ID">
                {getPoData.customId}
              </Descriptions.Item>
            ) : null}
            {getPoData.voucherDate ? (
              <Descriptions.Item label="Voucher Date">
                {getPoData.voucherDate.toLocaleDateString()}
              </Descriptions.Item>
            ) : null}
            {getPoData.description ? (
              <Descriptions.Item label="Description">
                {getPoData.description}
              </Descriptions.Item>
            ) : null}
            {getPoData.createdBy ? (
              <Descriptions.Item label="Created By">
                {getPoData.createdBy.name}
              </Descriptions.Item>
            ) : null}
            {getPoData.exportInvoiceDate ? (
              <Descriptions.Item label="Export Invoice Date">
                {getPoData.exportInvoiceDate.toLocaleDateString()}
              </Descriptions.Item>
            ) : null}
            {getPoData.price ? (
              <Descriptions.Item label="Price">
                {getPoData.price}
              </Descriptions.Item>
            ) : null}
            {getPoData.supplierInvoiceNumber ? (
              <Descriptions.Item label="Supplier Invoice Number">
                {getPoData.supplierInvoiceNumber}
              </Descriptions.Item>
            ) : null}
            {getPoData.exportInvoiceNumber ? (
              <Descriptions.Item label="Export Invoice Number">
                {getPoData.exportInvoiceNumber}
              </Descriptions.Item>
            ) : null}
            {getPoData.poInvoiceDate ? (
              <Descriptions.Item label="PO Invoice Date">
                {getPoData.poInvoiceDate.toLocaleDateString()}
              </Descriptions.Item>
            ) : null}
            {getPoData.remarks ? (
              <Descriptions.Item label="Remarks">
                {getPoData.remarks}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        ) : null}

        {getSoData ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{getSoData.id}</Descriptions.Item>
            {getSoData.customId ? (
              <Descriptions.Item label="Custom ID">
                {getSoData.customId}
              </Descriptions.Item>
            ) : null}
            {getSoData.voucherDate ? (
              <Descriptions.Item label="Voucher Date">
                {getSoData.voucherDate.toLocaleDateString()}
              </Descriptions.Item>
            ) : null}
            {getSoData.description ? (
              <Descriptions.Item label="Description">
                {getSoData.description}
              </Descriptions.Item>
            ) : null}
            {getSoData.createdBy ? (
              <Descriptions.Item label="Created By">
                {getSoData.createdBy.name}
              </Descriptions.Item>
            ) : null}
            {getSoData.exportInvoiceDate ? (
              <Descriptions.Item label="Export Invoice Date">
                {getSoData.exportInvoiceDate.toLocaleDateString()}
              </Descriptions.Item>
            ) : null}
            {getSoData.price ? (
              <Descriptions.Item label="Price">
                {getSoData.price}
              </Descriptions.Item>
            ) : null}
            {getSoData.supplierInvoiceNumber ? (
              <Descriptions.Item label="Supplier Invoice Number">
                {getSoData.supplierInvoiceNumber}
              </Descriptions.Item>
            ) : null}
            {getSoData.exportInvoiceNumber ? (
              <Descriptions.Item label="Export Invoice Number">
                {getSoData.exportInvoiceNumber}
              </Descriptions.Item>
            ) : null}
            {getSoData.poInvoiceDate ? (
              <Descriptions.Item label="PO Invoice Date">
                {getSoData.poInvoiceDate.toLocaleDateString()}
              </Descriptions.Item>
            ) : null}
            {getSoData.remarks ? (
              <Descriptions.Item label="Remarks">
                {getSoData.remarks}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        ) : null}
      </div>
    </Layout>
  )
}
export default CreateExpensePage
