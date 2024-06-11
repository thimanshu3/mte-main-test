import { PlusOutlined } from '@ant-design/icons'
import { Button, Input, Table } from 'antd'
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

const FulfilmentsPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined,
    sortBy: undefined as 'createdAt' | 'updatedAt' | undefined,
    sortOrder: undefined as 'asc' | 'desc' | undefined
  })

  // ? useQuery
  const { data, isLoading } =
    api.orders.inventory.getAllFulfilmentLogs.useQuery(variables, {
      enabled: !!session
    })

  // ? useMutation
  const { mutateAsync, isLoading: exporting } =
    api.orders.inventory.exportAllFulfilmentLogs.useMutation()

  return (
    <Layout
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Fulfilments'
        }
      ]}
      title="Fulfilments"
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
        <Link href="/fulfilments/new">
          <Button type="primary" icon={<PlusOutlined />}>
            New
          </Button>
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
            render: (_1, record, i) => (
              <Link href={`/fulfilments/${record.id}`}>
                {(variables.page - 1) * variables.limit + i + 1}
              </Link>
            )
          },
          {
            title: 'No. of items',
            render: (_, row) => (
              <Link href={`/inventory?search=${row.id}`}>
                {row._count.items}
              </Link>
            )
          },
          {
            title: 'Supplier',
            render: (_, row) => (
              <Link href={`/suppliers/${row.supplierId}`}>
                {row.supplier.name}
              </Link>
            )
          },
          {
            title: 'Invoice Id',
            dataIndex: 'invoiceId'
          },
          {
            title: 'Gate Entry no.',
            dataIndex: 'gateEntryNumber'
          },
          {
            title: 'Location',
            dataIndex: 'location'
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
            render: date => date.toLocaleString(),
            sorter: true
          }
        ]}
        dataSource={data?.fulfilmentLogs}
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
        caption={
          <Button
            onClick={async () => {
              const csv = await mutateAsync({
                search: variables.search,
                sortBy: variables.sortBy,
                sortOrder: variables.sortOrder,
                timezoneOffset: new Date().getTimezoneOffset()
              })

              const element = document.createElement('a')
              element.setAttribute(
                'href',
                'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
              )
              element.setAttribute('download', `Fulfilments-${Date.now()}.csv`)

              element.style.display = 'none'
              document.body.appendChild(element)

              element.click()

              document.body.removeChild(element)
            }}
            loading={exporting}
          >
            Export
          </Button>
        }
      />
    </Layout>
  )
}

export default FulfilmentsPage
