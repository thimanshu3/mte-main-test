import { DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, Space, Table } from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'
import { Layout } from '~/components/Layout'
import { OrderStageTag } from '~/components/OrderStageTag'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerAuthSession(ctx)
  return {
    redirect: !session
      ? {
          destination: '/auth'
        }
      : !['ADMIN', 'ADMINVIEWER', 'USER', 'USERVIEWER', 'FULFILMENT'].includes(
          session.user.role
        )
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const SalesOrdersPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    stage: undefined as 'Pending' | 'Open' | 'Invoice' | undefined,
    currencyId: undefined as string | undefined,
    approved: undefined as boolean | undefined,
    search: undefined as string | undefined,
    sortBy: undefined as 'date' | 'createdAt' | 'updatedAt' | undefined,
    sortOrder: undefined as 'asc' | 'desc' | undefined
  })

  // ? useQuery
  const { data, isLoading } = api.orders.sales.getAll.useQuery(variables, {
    enabled: !!session
  })

  // ? useMutation
  const { mutateAsync: exportOrders, isLoading: exporting } =
    api.orders.sales.export.useMutation()
  const { mutateAsync: exportOrders2, isLoading: exporting2 } =
    api.orders.sales.export2.useMutation()
  const { mutateAsync: exportOrders3, isLoading: exporting3 } =
    api.orders.sales.export3.useMutation()

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
          label: 'Sales'
        }
      ]}
      title="Sales Orders"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <Input.Search
          className="w-96"
          placeholder="Type anything to search..."
          onSearch={text =>
            setVariables(prev => ({
              ...prev,
              search: text || undefined,
              page: 1
            }))
          }
        />
        {!['ADMINVIEWER', 'USERVIEWER'].includes(session?.user.role || '') ? (
          <Link href="/orders/sales/new">
            <Button type="primary" icon={<PlusOutlined />}>
              New
            </Button>
          </Link>
        ) : null}
      </div>
      <Table
        loading={isLoading}
        size="middle"
        bordered
        scroll={{ x: 800 }}
        columns={[
          {
            title: 'Sr. No.',
            render: (_, row, i) => (
              <Link href={`/orders/sales/${row.id}`}>
                {(variables.page - 1) * variables.limit + i + 1}
              </Link>
            )
          },
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
            render: date => date.toLocaleDateString(),
            sorter: true
          },
          {
            title: 'Reference ID',
            dataIndex: 'referenceId'
          },
          {
            title: 'Currency',
            dataIndex: 'currency',
            render: currency => currency?.name
          },
          {
            title: 'Customer',
            dataIndex: 'customer',
            render: customer => (
              <Link href={`/customers/${customer.id}`}>{customer.name}</Link>
            )
          },
          {
            title: 'Site',
            dataIndex: 'site',
            render: (site, record) =>
              site ? (
                <Link
                  href={`/customers/${record.customer.id}/sites/${site.id}`}
                >
                  {site.name}
                </Link>
              ) : null
          },
          {
            title: 'PR Number and Name',
            dataIndex: 'prNumberAndName'
          },
          {
            title: 'Representative User',
            dataIndex: 'representativeUser',
            render: representativeUser => (
              <Link href={`/users/${representativeUser.id}`}>
                {representativeUser.name}
              </Link>
            )
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
            render: stage => <OrderStageTag stage={stage} />,
            filters: [
              {
                text: 'Pending',
                value: 'Pending'
              },
              {
                text: 'Open',
                value: 'Open'
              },
              {
                text: 'Invoice',
                value: 'Invoice'
              },
              {
                text: 'Closed',
                value: 'Closed'
              },
              {
                text: 'Cancelled',
                value: 'Cancelled'
              }
            ],
            filterMultiple: false
          },
          {
            title: 'Approved',
            dataIndex: 'approved',
            render: approved => (approved ? 'Yes' : 'No'),
            filters: [
              {
                text: 'Yes',
                value: 'Yes'
              },
              {
                text: 'No',
                value: 'No'
              }
            ],
            filterMultiple: false
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
            render: date => date.toLocaleString(),
            sorter: true
          },
          {
            title: 'Updated At',
            dataIndex: 'updatedAt',
            render: date => date.toLocaleString(),
            sorter: true
          }
        ]}
        dataSource={data?.salesOrders}
        rowKey="id"
        pagination={{
          current: variables.page,
          pageSize: variables.limit,
          total: data?.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50]
        }}
        onChange={(tablePagination, filters: any, sorter: any) => {
          const newVariables = {
            ...variables,
            page: tablePagination.current || 1,
            limit: tablePagination.pageSize || 10
          }

          if (sorter.column?.dataIndex && sorter.order) {
            newVariables.sortBy = sorter.column.dataIndex
            newVariables.sortOrder = sorter.order === 'descend' ? 'desc' : 'asc'
          } else {
            newVariables.sortBy = undefined
            newVariables.sortOrder = undefined
          }

          newVariables.stage = filters.stage ? filters.stage[0] : undefined

          const isApproved = filters.approved?.[0]
          if (isApproved === 'Yes') {
            newVariables.approved = true
          } else if (isApproved === 'No') {
            newVariables.approved = false
          } else {
            newVariables.approved = undefined
          }

          setVariables(newVariables)
        }}
        caption={
          <Space className="mx-1">
            <Button
              icon={<DownloadOutlined />}
              onClick={async () => {
                const result = await exportOrders({
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                window.open(result.url)
              }}
              loading={exporting}
            >
              Export
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={async () => {
                const result = await exportOrders2({
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                window.open(result.url)
              }}
              loading={exporting2}
            >
              Export with PO
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={async () => {
                const result = await exportOrders3({
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                window.open(result.url)
              }}
              loading={exporting3}
            >
              Export with PO Items
            </Button>
          </Space>
        }
      />
    </Layout>
  )
}

export default SalesOrdersPage
