import { DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Drawer, Form, Input, Table, Tag } from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'
import { Layout } from '~/components/Layout'
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
      : undefined,
    props: {}
  }
}

const PaymentRequestsPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    status: undefined as 'Pending' | 'Approved' | 'Paid' | undefined,
    search: undefined as string | undefined
  })
  const [createDrawer, setCreateDrawer] = useState(false)

  // ? useQuery
  const { data, isLoading, refetch } = api.paymentRequests.getAll.useQuery(
    variables,
    {
      enabled: !!session
    }
  )

  // ? useMutation
  const { mutateAsync: createPaymentRequest, isLoading: creating } =
    api.paymentRequests.create.useMutation()
  const { mutateAsync: updatePaymentRequestStatus, isLoading: updatingStatus } =
    api.paymentRequests.updateStatus.useMutation()
  const { mutateAsync: exportData, isLoading: exporting } =
    api.paymentRequests.exportCSV.useMutation()

  const notificationApi = useNotificationApi()

  return (
    <Layout
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Payment Requests' }
      ]}
      title="Payment Requests"
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
        {session?.user.role !== 'ADMINVIEWER' ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateDrawer(true)}
          >
            New
          </Button>
        ) : null}
      </div>
      <Table
        loading={isLoading}
        size="middle"
        bordered
        scroll={{ x: 800 }}
        columns={[
          {
            title: 'Id',
            dataIndex: 'id2'
          },
          {
            title: 'Purchase Order',
            render: (_, record) => (
              <Link href={`/orders/purchase/${record.purchaseOrder.id}`}>
                {record.purchaseOrder.id2}
              </Link>
            )
          },
          {
            title: 'Supplier',
            render: (_, record) => record.purchaseOrder.supplier.name
          },
          {
            title: 'Amount',
            dataIndex: 'amount'
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: status => (
              <Tag
                color={
                  status === 'Pending'
                    ? 'gold'
                    : status === 'Approved'
                    ? 'green'
                    : 'blue'
                }
              >
                {status}
              </Tag>
            ),
            filters: [
              {
                text: 'Pending',
                value: 'Pending'
              },
              {
                text: 'Approved',
                value: 'Approved'
              },
              {
                text: 'Paid',
                value: 'Paid'
              }
            ],
            filterMultiple: false
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
            title: 'Updated By',
            dataIndex: 'updatedBy',
            render: updatedBy => (
              <Link href={`/users/${updatedBy?.id}`}>{updatedBy?.name}</Link>
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
            title: 'Actions',
            render: (_, record) => (
              <Button
                size="small"
                disabled={record.status === 'Paid' || updatingStatus}
                onClick={async () => {
                  await updatePaymentRequestStatus({
                    id: record.id,
                    status: record.status === 'Pending' ? 'Approved' : 'Paid'
                  })
                  refetch()
                }}
              >
                Mark as {record.status === 'Pending' ? 'Approved' : 'Paid'}
              </Button>
            )
          }
        ]}
        dataSource={data?.paymentRequests}
        rowKey="id"
        pagination={{
          current: variables.page,
          pageSize: variables.limit,
          total: data?.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50]
        }}
        onChange={(tablePagination, filters: any) => {
          const newVariables = {
            ...variables,
            page: tablePagination.current || 1,
            limit: tablePagination.pageSize || 10
          }
          newVariables.status = filters.status ? filters.status[0] : undefined
          setVariables(newVariables)
        }}
        caption={
          <Button
            className="m-1"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={async () => {
              const url = await exportData()
              window.open(url)
            }}
          >
            Export
          </Button>
        }
      />

      <Drawer
        destroyOnClose
        footer={null}
        title="Create Payment Request"
        open={createDrawer}
        onClose={() => setCreateDrawer(false)}
      >
        <Form
          layout="vertical"
          onFinish={async formData => {
            try {
              await createPaymentRequest({
                amount: Number(formData.amount),
                purchaseOrderId: formData.id2,
                remarks: formData.remarks
              })
              notificationApi.success({
                message: 'Created Payment Request'
              })
              refetch()
              setCreateDrawer(false)
            } catch (err) {
              notificationApi.error({
                message: 'Failed to create payment request'
              })
            }
          }}
        >
          <Form.Item
            name="id2"
            label="Purchase Order no"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creating}>
              Save
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </Layout>
  )
}

export default PaymentRequestsPage
