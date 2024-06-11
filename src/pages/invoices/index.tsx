import { DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, Select, Table } from 'antd'
import dayjs from 'dayjs'
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

const InvoicesPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  //? Mutations
  const { mutateAsync: exportInvoice, isLoading: exporting } =
    api.orders.invoices.exportInvoice.useMutation()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    type: 'Final',
    search: undefined as string | undefined,
    sortBy: undefined as 'createdAt' | 'updatedAt' | undefined,
    sortOrder: undefined as 'asc' | 'desc' | undefined,
    dateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined
  })

  // ? useQuery
  const { data, isLoading } = api.orders.invoices.getAll.useQuery(variables, {
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
          label: 'Invoices'
        }
      ]}
      title="Invoices"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <div>
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
          <Select
            className="ml-1"
            value={variables.type}
            onChange={type =>
              setVariables(prev => ({
                ...prev,
                type: type,
                page: 1
              }))
            }
            options={[
              {
                label: 'Final',
                value: 'Final'
              },
              {
                label: 'Draft',
                value: 'Draft'
              }
            ]}
          />
        </div>
        <Button
          icon={<DownloadOutlined />}
          loading={exporting}
          onClick={async () => {
            const result = await exportInvoice({
              timezoneOffset: new Date().getTimezoneOffset(),
              dateRange: variables.dateRange,
              type: variables.type
            })
            window.open(result.url)
          }}
        >
          Export Invoice
        </Button>
        <DatePicker.RangePicker
          value={
            variables.dateRange
              ? [
                  dayjs(variables.dateRange.startDate),
                  dayjs(variables.dateRange.endDate)
                ]
              : undefined
          }
          onChange={dates =>
            setVariables(prev => ({
              ...prev,
              page: 1,
              dateRange:
                dates && dates[0] && dates[1]
                  ? {
                      startDate: dates[0].startOf('day').toDate(),
                      endDate: dates[1].endOf('day').toDate()
                    }
                  : undefined
            }))
          }
        />

        <Link href="/invoices/new">
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
              <Link href={`/invoices/${record.id}`}>
                {(variables.page - 1) * variables.limit + i + 1}
              </Link>
            )
          },
          ...(variables.type === 'Draft'
            ? []
            : [
                {
                  title: 'Invoice ID',
                  dataIndex: 'id2',
                  render: (id2: string, record: any) => (
                    <Link href={`/invoices/${record.id}`}>{id2}</Link>
                  )
                }
              ]),
          {
            title: 'Date',
            render: (_, row) => row.date.toLocaleDateString()
          },
          {
            title: 'Custom ID',
            render: (record: any) => record?.id3 || ''
          },
          {
            title: 'No. of items',
            render: (_, row) => row._count.items
          },
          {
            title: 'Representative User',
            render: (_, row) => (
              <Link href={`/users/${row?.representativeUserId}`}>
                {row?.representativeUser?.name}
              </Link>
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
            title: 'Customer',
            render: (_, row) => (
              <Link href={`/customers/${row.customerId}`}>
                {row.customer.name}
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
            title: 'Created At',
            dataIndex: 'createdAt',
            render: date => date.toLocaleString(),
            sorter: true
          }
        ]}
        dataSource={
          variables.type === 'Draft' ? data?.draftInvoices : data?.invoices
        }
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
    </Layout>
  )
}

export default InvoicesPage
