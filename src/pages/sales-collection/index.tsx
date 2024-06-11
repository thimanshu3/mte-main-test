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

const SalesCollections: NextPage = () => {
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
  const { data, isLoading, refetch } = api.salesCollection.getAll.useQuery(
    variables,
    {
      enabled: !!session
    }
  )

  // ? useMutation
  const {
    mutateAsync: exportSalesCollection,
    isLoading: exportSalesCollectionLoading
  } = api.salesCollection.export.useMutation()

  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()

  const {
    mutateAsync: importSalesCollection,
    isLoading: importSalesCollectionLoading
  } = api.salesCollection.import.useMutation()

  return (
    <Layout
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Sales Collections' }
      ]}
      title="Sales Collections"
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
            title: 'SALES ORDER NO',
            dataIndex: 'salesOrderNumber'
          },
          {
            title: 'Type',
            dataIndex: 'type'
          },
          {
            title: 'PORT OF DISCHARGE',
            dataIndex: 'portOfDischarge'
          },
          {
            title: 'PINV NO',
            dataIndex: 'pinvNumber'
          },
          {
            title: 'BV REF',
            dataIndex: 'bvRef'
          },
          {
            title: 'FILE NO',
            dataIndex: 'fileNumber'
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
        dataSource={data?.salesCollection}
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
              loading={exportSalesCollectionLoading}
              icon={<DownloadOutlined />}
              onClick={async () => {
                const result = await exportSalesCollection({
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
              loading={importSalesCollectionLoading}
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
        title="Import SalesCollection"
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
          const result = await importSalesCollection({
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
        confirmLoading={importSalesCollectionLoading}
      >
        <div className="py-5">
          <Typography.Title level={3}>Sales Collections</Typography.Title>
          <Link href="/templates/Sales Collection.xlsx">
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

export default SalesCollections
