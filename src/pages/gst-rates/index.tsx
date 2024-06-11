import {
  DownloadOutlined,
  PlusOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { Button, Input, Modal, Space, Table, Upload, notification } from 'antd'
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

const GstRatesPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined
  })

  // ? useQuery
  const { data, isLoading, refetch } = api.gstRates.getAll.useQuery(variables, {
    enabled: !!session
  })
  const [showImportModal, setShowImportModal] = useState(0)
  const [importFile, setImportFile] = useState<{
    uid: string
    name: string
    filename: string
    url: string
  } | null>(null)

  // ? useMutation
  const { mutateAsync: exportGstRates, isLoading: exportGstRatesLoading } =
    api.gstRates.export.useMutation()
  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()
  const { mutateAsync: importGstRates, isLoading: importGstRatesLoading } =
    api.gstRates.import.useMutation()
  return (
    <Layout
      breadcrumbs={[{ label: 'Home', link: '/' }, { label: 'GST Rates' }]}
      title="GST Rates"
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
        <Link href="/gst-rates/new">
          {session?.user.role !== 'ADMINVIEWER' ? (
            <Button type="primary" icon={<PlusOutlined />}>
              New
            </Button>
          ) : null}
        </Link>
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
            title: 'Rate',
            dataIndex: 'rate',
            render: (rate, record) => (
              <Link href={`/gst-rates/${record.id}`}>
                <Button type="link">{rate}</Button>
              </Link>
            )
          },
          {
            title: 'Created By',
            dataIndex: 'createdBy',
            render: createdBy => (
              <Link href={`/users/${createdBy?.id}`}>{createdBy?.name}</Link>
            )
          },
          {
            title: 'Updated By',
            dataIndex: 'updatedBy',
            render: updatedBy => (
              <Link href={`/users/${updatedBy?.id}`}>{updatedBy?.name}</Link>
            )
          },
          {
            title: 'Deleted By',
            dataIndex: 'deletedBy',
            render: deletedBy => (
              <Link href={`/users/${deletedBy?.id}`}>{deletedBy?.name}</Link>
            )
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
          },
          {
            title: 'Deleted At',
            dataIndex: 'deletedAt',
            render: date => date?.toLocaleString()
          }
        ]}
        dataSource={data?.gstRates}
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
              loading={exportGstRatesLoading}
              icon={<DownloadOutlined />}
              onClick={async () => {
                const result = await exportGstRates({
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
              loading={importGstRatesLoading}
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
        title="Import GST Rates"
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
          const result = await importGstRates({
            attachmentId: importFile.uid,
            timezoneOffset: new Date().getTimezoneOffset()
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
        confirmLoading={importGstRatesLoading}
      >
        <div className="py-5">
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

export default GstRatesPage
