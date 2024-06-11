import { Button, Drawer, Input, Table } from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'
import { Layout } from '~/components/Layout'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerAuthSession(ctx)

  const search = ctx.query.search as string | undefined

  return {
    redirect: !session
      ? {
          destination: '/auth'
        }
      : undefined,
    props: search ? { search } : {}
  }
}

const InventoryPage: NextPage = (props: any) => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: props.search as string | undefined,
    sortBy: undefined as
      | 'quantity'
      | 'quantityGone'
      | 'createdAt'
      | 'updatedAt'
      | undefined,
    sortOrder: undefined as 'asc' | 'desc' | undefined
  })
  const [fulfilmentLogs, setFulfilmentLogs] = useState<any[]>([])

  // ? useQuery
  const { data, isLoading } = api.orders.inventory.getAll.useQuery(variables, {
    enabled: !!session
  })

  return (
    <Layout
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Inventory'
        }
      ]}
      title="Inventory"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <Input.Search
          className="w-96"
          placeholder="Type anything to search..."
          defaultValue={variables.search}
          onSearch={text =>
            setVariables(prev => ({
              ...prev,
              search: text || undefined,
              page: 1
            }))
          }
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
            title: 'Description',
            render: (_, row) => (
              <Link
                href={`/orders/purchase/${row.purchaseOrderItem.purchaseOrderId}`}
              >
                {row.purchaseOrderItem.description}
              </Link>
            )
          },
          {
            title: 'Unit',
            render: (_, row) => row.purchaseOrderItem.unit.name
          },
          {
            title: 'Price',
            render: (_, row) => row.purchaseOrderItem.price.toLocaleString()
          },
          {
            title: 'Quantity',
            dataIndex: 'quantity',
            sorter: true
          },
          {
            title: 'Quantity Gone',
            dataIndex: 'quantityGone',
            sorter: true
          },
          {
            title: 'Fulfilment',
            render: (_, row) => (
              <Button
                type="primary"
                onClick={() => setFulfilmentLogs(row.fulfilmentLogItems)}
              >
                View
              </Button>
            )
          },
          {
            title: 'Date',
            dataIndex: 'createdAt',
            render: date => date.toLocaleString(),
            sorter: true
          }
        ]}
        dataSource={data?.inventory}
        rowKey="id"
        pagination={{
          current: variables.page,
          pageSize: variables.limit,
          total: data?.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50]
        }}
        onChange={(tablePagination, _filters: any, sorter: any) => {
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

          setVariables(newVariables)
        }}
      />
      <Drawer
        title="Fulfilment Logs"
        open={!!fulfilmentLogs.length}
        onClose={() => setFulfilmentLogs([])}
        footer={null}
        destroyOnClose
        width="75%"
      >
        <Table
          size="middle"
          bordered
          dataSource={fulfilmentLogs}
          rowKey="id"
          columns={[
            {
              title: 'Sr. No.',
              render: (_1, _2, i) => i + 1
            },
            {
              title: 'Quantity',
              dataIndex: 'quantity'
            },
            {
              title: 'Location',
              render: (_, row) => row.fulfilmentLog.location
            },
            {
              title: 'Invoice Id',
              render: (_, row) => row.fulfilmentLog.invoiceId
            },
            {
              title: 'Invoice Date',
              render: (_, row) =>
                row.fulfilmentLog.invoiceDate.toLocaleDateString()
            },
            {
              title: 'Gate Entry no.',
              render: (_, row) => row.fulfilmentLog.gateEntryNumber
            },
            {
              title: 'Gate Entry Date',
              render: (_, row) =>
                row.fulfilmentLog.gateEntryDate.toLocaleString()
            },
            {
              title: 'Created At',
              render: (_, row) => row.fulfilmentLog.createdAt.toLocaleString()
            }
          ]}
          pagination={false}
        />
      </Drawer>
    </Layout>
  )
}

export default InventoryPage
