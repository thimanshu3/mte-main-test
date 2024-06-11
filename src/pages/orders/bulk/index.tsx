import {
  DownloadOutlined,
  ImportOutlined,
  UploadOutlined
} from '@ant-design/icons'
import { Button, Space, Typography, Upload } from 'antd'
import { NextPage } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { Layout } from '~/components/Layout'
import { useNotificationApi } from '~/context/notifcationApi'
import { api } from '~/utils/api'

const BulkOrderPage: NextPage = () => {
  // ? useRouter
  const router = useRouter()

  // ? useState
  const [importFile, setImportFile] = useState<{
    uid: string
    name: string
    filename: string
    url: string
  } | null>(null)

  // ? useMutation
  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()
  const { mutateAsync, isLoading } = api.orders.bulk.create.useMutation()

  // ? useNotification
  const notificationApi = useNotificationApi()

  return (
    <Layout
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Orders'
        },
        {
          label: 'Bulk Create'
        }
      ]}
      title="Bulk Create"
    >
      <Space direction="vertical">
        <Typography.Title level={3}>Create Bulk Orders</Typography.Title>
        <Typography.Text>
          Download template and upload data accordingly to bulk create orders.
          <br />
          Fields in red are required.
        </Typography.Text>
        <Link href="/templates/Bulk Order.xlsx">
          <Button icon={<DownloadOutlined />}>Download Template</Button>
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
          <Button className="mt-2" size="large" icon={<UploadOutlined />}>
            Click to select file
          </Button>
        </Upload>
        <Button
          type="primary"
          icon={<ImportOutlined />}
          loading={isLoading}
          onClick={async () => {
            if (!importFile) {
              notificationApi.error({
                message: 'No file selected'
              })
              return
            }

            try {
              const result = await mutateAsync({
                attachmentId: importFile.uid,
                timezoneOffset: new Date().getTimezoneOffset()
              })
              if ((result as any).errorFile) {
                window.open((result as any).errorFile)
                notificationApi.error({
                  message: 'Error creating bulk orders'
                })
              } else {
                notificationApi.success({
                  message: 'Bulk orders created'
                })
                router.push('/orders/sales')
              }
            } catch (err) {
              notificationApi.error({
                message: 'Something went wrong'
              })
            }
          }}
        >
          Import
        </Button>
      </Space>
    </Layout>
  )
}

export default BulkOrderPage
