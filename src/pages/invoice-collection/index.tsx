import { DownloadOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Button,
  Input,
  Modal,
  Space,
  Table,
  Typography,
  Upload,
  notification
} from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'
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

const InvoiceCollections: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined
  })

  const [showImportModal, setShowImportModal] = useState(0)
  const [importFile, setImportFile] = useState<{
    uid: string
    name: string
    filename: string
    url: string
  } | null>(null)

  // ? useQuery
  const { data, isLoading, refetch } = api.invoiceCollection.getAll.useQuery(
    variables,
    {
      enabled: !!session
    }
  )

  // ? useMutation
  const {
    mutateAsync: exportInvoiceCollection,
    isLoading: exportInvoiceCollectionLoading
  } = api.invoiceCollection.export.useMutation()

  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()

  const {
    mutateAsync: importInvoiceCollection,
    isLoading: importInvoiceCollectionLoading
  } = api.invoiceCollection.import.useMutation()

  return (
    <Layout
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Inovice Collections' }
      ]}
      title="Invoice Collections"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <Input.Search
          className="w-96"
          placeholder="Type anything to search..."
          onSearch={searchStr => {
            setVariables(prev => ({
              ...prev,
              page: 1,
              search: searchStr ? searchStr : undefined
            }))
          }}
        />
      </div>
      <Table
        loading={isLoading}
        size="middle"
        bordered
        scroll={{ x: 800 }}
        columns={[
          {
            title: 'Sr. No.',
            render: (_1, _2, i) =>
              (variables.page - 1) * variables.limit + i + 1
          },
          {
            title: 'Invoice No.',
            dataIndex: 'invoiceNumber'
          },
          {
            title: 'Invoice Date',
            dataIndex: 'invoiceDate',
            render: invoiceDate => invoiceDate?.toLocaleString()
          },
          {
            title: 'Customer Name',
            dataIndex: 'customerName'
          },
          {
            title: 'Inspection Applied Date',
            dataIndex: 'inspectionAppliedDate',
            render: inspectionAppliedDate =>
              inspectionAppliedDate?.toLocaleString()
          },
          {
            title: 'Mode Of Transport',
            dataIndex: 'modeOfTransPort'
          },
          {
            title: 'From',
            dataIndex: 'from'
          },
          {
            title: 'Date Of Loading',
            dataIndex: 'dateOfLoading',
            render: dateOfLoading => dateOfLoading?.toLocaleString()
          },
          {
            title: 'ON Board Date',
            dataIndex: 'onBoardDate',
            render: onBoardDate => onBoardDate?.toLocaleString()
          },
          {
            title: 'CNTR No.',
            dataIndex: 'cntrNumber'
          },
          {
            title: 'Shipping Bill No.',
            dataIndex: 'shippingBillNumber'
          },
          {
            title: 'Shipping Bill Date',
            dataIndex: 'shippingBillDate',
            render: shippingBillDate => shippingBillDate?.toLocaleString()
          },
          {
            title: 'Seaway Bill No.',
            dataIndex: 'seaWayBlNumber'
          },
          {
            title: 'Seaway Bill Date',
            dataIndex: 'seaWayBlIssueDate',
            render: seaWayBlIssueDate => seaWayBlIssueDate?.toLocaleString()
          },
          {
            title: 'DOCS Submission Date',
            dataIndex: 'docsSubmissionDate',
            render: docsSubmissionDate => docsSubmissionDate?.toLocaleString()
          },
          {
            title: 'FERI No.',
            dataIndex: 'feriNumber'
          },
          {
            title: 'FERI Date',
            dataIndex: 'feriDate',
            render: feriDate => feriDate?.toLocaleString()
          },
          {
            title: 'CRF Apply Date',
            dataIndex: 'crfApplyDate',
            render: crfApplyDate => crfApplyDate?.toLocaleString()
          },
          {
            title: 'CRF Issue Date',
            dataIndex: 'crfIssueDate',
            render: crfIssueDate => crfIssueDate?.toLocaleString()
          },
          {
            title: 'ETA Of Shipping',
            dataIndex: 'etaOfShippment'
          },
          {
            title: 'Port Of Loading',
            dataIndex: 'portOfLoading'
          },
          {
            title: 'Port Of Discharge',
            dataIndex: 'portOfDischarge'
          },
          {
            title: 'Policy No.',
            dataIndex: 'policyNumber'
          },
          {
            title: 'ROTDP Amount',
            dataIndex: 'rotdpAmount'
          },
          {
            title: 'DBK',
            dataIndex: 'dbk'
          },
          {
            title: 'DBK Scroll No.',
            dataIndex: 'dbkScrollNumber'
          },
          {
            title: 'DBK Scroll Date',
            dataIndex: 'dbkScrollDate',
            render: dbkScrollDate => dbkScrollDate?.toLocaleString()
          },
          {
            title: 'DBK Credit Date',
            dataIndex: 'dbkCreditDate',
            render: dbkCreditDate => dbkCreditDate?.toLocaleString()
          },
          {
            title: 'RODTEP Remarks Script Date',
            dataIndex: 'rodtepRemarksScriptDate',
            render: rodtepRemarksScriptDate =>
              rodtepRemarksScriptDate?.toLocaleString()
          },
          {
            title: 'RODTEP Remarks Script Date',
            dataIndex: 'rodtepRemarksScriptDate',
            render: rodtepRemarksScriptDate =>
              rodtepRemarksScriptDate?.toLocaleString()
          },
          {
            title: 'BRC Submission Date',
            dataIndex: 'brcSubmissionDate',
            render: brcSubmissionDate => brcSubmissionDate?.toLocaleString()
          },
          {
            title: 'BRC No.',
            dataIndex: 'brcNumber'
          },
          {
            title: 'BRC Date',
            dataIndex: 'brcDate',
            render: brcDate => brcDate?.toLocaleString()
          },
          {
            title: 'Bill Id No.',
            dataIndex: 'billIdNumber'
          },
          {
            title: 'Realisation Date',
            dataIndex: 'realisationDate',
            render: realisationDate => realisationDate?.toLocaleString()
          },
          {
            title: 'Amount Settled',
            dataIndex: 'ammountSettled'
          },
          {
            title: 'Bill Amount (USD)',
            dataIndex: 'billAmountUsd'
          },
          {
            title: 'Freight (USD)',
            dataIndex: 'freightUsd'
          },
          {
            title: 'Insurance (USD)',
            dataIndex: 'insuranceUsd'
          },
          {
            title: 'FOB Net (USD)',
            dataIndex: 'fobNetUsd'
          },
          {
            title: 'Taxable Value (INR)',
            dataIndex: 'taxableValueInr'
          },
          {
            title: 'IGST (INR)',
            dataIndex: 'igstInr'
          },
          {
            title: 'Amount Received Per Tally',
            dataIndex: 'amountReceivedPerTally'
          },
          {
            title: 'FOB Value (INR)',
            dataIndex: 'fobValueInr'
          },
          {
            title: 'Freight (INR)',
            dataIndex: 'freightInr'
          },
          {
            title: 'Insurance (INR)',
            dataIndex: 'insuranceInr'
          },
          {
            title: 'Exchange Rate (INR)',
            dataIndex: 'exchangeRateInr'
          },
          {
            title: 'Remarks',
            dataIndex: 'remarks'
          },
          {
            title: 'Created By',
            dataIndex: 'createdBy',
            render: createdBy => (
              <Link href={`/users/${createdBy?.id}`}>{createdBy?.name}</Link>
            )
          },
          {
            title: 'Created At',
            dataIndex: 'createdAt',
            render: date => date?.toLocaleString()
          }
        ]}
        dataSource={data?.invoiceCollection}
        rowKey="id"
        pagination={{
          current: variables.page,
          pageSize: variables.limit,
          total: data?.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          onChange: (page, limit) => {
            setVariables(prev => ({
              ...prev,
              page,
              limit
            }))
          }
        }}
        caption={
          <Space>
            <Button
              type="primary"
              loading={exportInvoiceCollectionLoading}
              icon={<DownloadOutlined />}
              onClick={async () => {
                const result = await exportInvoiceCollection({
                  search: variables.search
                })
                window.open(result.url)
              }}
            >
              Export
            </Button>
            <Button
              className={`${
                session?.user.role === 'ADMINVIEWER' ? 'hidden' : ''
              }`}
              type="primary"
              loading={importInvoiceCollectionLoading}
              icon={<DownloadOutlined />}
              onClick={() => setShowImportModal(1)}
            >
              Import
            </Button>
          </Space>
        }
      />

      <Modal
        destroyOnClose
        open={showImportModal !== 0}
        title="Import InvoiceCollection"
        onCancel={() => {
          setShowImportModal(0)
          if (importFile) deleteAttachment({ id: importFile.uid })
          setImportFile(null)
        }}
        onOk={async () => {
          if (!importFile)
            return notification.error({
              message: 'Please select a file'
            })
          const result = await importInvoiceCollection({
            attachmentId: importFile.uid
          })
          if ((result as any).errorFile) {
            window.open((result as any).errorFile)
            notification.error({
              message: result.message
            })
          } else {
            notification.success({
              message: result.message
            })
            refetch()
          }
          setShowImportModal(0)
          setImportFile(null)
        }}
        confirmLoading={importInvoiceCollectionLoading}
      >
        <div className="py-5">
          <Typography.Title level={3}>Invoice Collections</Typography.Title>
          <Link href="/templates/Invoice Collection.xlsx">
            <Button className="mr-2" icon={<DownloadOutlined />}>
              Download Template
            </Button>
          </Link>
          <Upload
            multiple={false}
            fileList={importFile ? [importFile] : []}
            accept=".xlsx"
            beforeUpload={async file => {
              const formData = new FormData()
              formData.append('file', file)

              const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
              })
              const json = await res.json()
              if (json?.attachments && json.attachments[0])
                setImportFile(prev => {
                  if (prev)
                    deleteAttachment({
                      id: prev.uid
                    })
                  return {
                    uid: json.attachments[0].id,
                    name: json.attachments[0].originalFilename,
                    filename: json.attachments[0].newFilename,
                    url: json.attachments[0].url
                  }
                })

              return false
            }}
            onRemove={file => {
              deleteAttachment({
                id: file.uid
              })
              setImportFile(null)
            }}
          >
            <Button icon={<UploadOutlined />}>Click to select file</Button>
          </Upload>
        </div>
      </Modal>
    </Layout>
  )
}

export default InvoiceCollections
