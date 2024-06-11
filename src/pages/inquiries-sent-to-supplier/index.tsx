import { CalendarOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, DatePicker, Select, Spin, Table, Tag } from 'antd'
import dayjs from 'dayjs'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
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

const InquiriesSentToSupplierPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    supplierId: undefined as string | undefined,
    createdById: undefined as string | undefined,
    dateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined,
    showFulfilled: false
  })
  const [supplierSearch, setSupplierSearch] = useState<string | undefined>(
    undefined
  )
  const [userSearch, setUserSearch] = useState<string | undefined>(undefined)

  // ? useQuery
  const { data, isLoading } = api.inquiriesSentToSupplier.getAll.useQuery(
    variables,
    {
      enabled: !!session
    }
  )
  const { data: suppliers, isLoading: suppliersLoading } =
    api.suppliers.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: supplierSearch
      },
      { enabled: !!session }
    )
  const { data: users, isLoading: usersLoading } =
    api.users.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: userSearch
      },
      { enabled: !!session }
    )

  // ? useMemo
  const debouncedSupplierSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSupplierSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedUserSearch = useMemo(
    () =>
      debounce((search: string) => {
        setUserSearch(search || undefined)
      }, 500),
    []
  )

  return (
    <Layout
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Inquiries Sent to Supplier' }
      ]}
      title="Inquiries Sent to Supplier"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <div />
        {!['ADMINVIEWER', 'USERVIEWER', 'SUPPLIER'].includes(
          session?.user.role || ''
        ) ? (
          <Link href="/inquiries-sent-to-supplier/new">
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
            render: (_1, row, i) => (
              <Link href={`/inquiries-sent-to-supplier/${row.id}`}>
                {(variables.page - 1) * variables.limit + i + 1}
              </Link>
            ),
            filterDropdown:
              session?.user.role === 'SUPPLIER'
                ? undefined
                : () => (
                    <div className="p-2">
                      <Select
                        className="w-32"
                        showSearch
                        options={[
                          {
                            label: 'Hide Fulfilled',
                            value: false
                          },
                          {
                            label: 'Show Fulfilled',
                            value: true
                          }
                        ]}
                        value={variables.showFulfilled}
                        onChange={value =>
                          setVariables(prev => ({
                            ...prev,
                            page: 1,
                            showFulfilled: value
                          }))
                        }
                      />
                    </div>
                  ),
            filtered: true
          },
          {
            title: 'Date',
            dataIndex: 'createdAt',
            render: (date, row) => (
              <Link href={`/inquiries-sent-to-supplier/${row.id}`}>
                {date.toLocaleString()}
              </Link>
            ),
            filterIcon: () => <CalendarOutlined />,
            filterDropdown: () => (
              <div className="p-2">
                <DatePicker.RangePicker
                  className="w-full"
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
              </div>
            ),
            filtered: !!variables.dateRange
          },
          {
            title: 'Supplier',
            dataIndex: 'supplier',
            render: supplier => (
              <Link href={`/suppliers/${supplier?.id}`}>{supplier?.name}</Link>
            ),
            filterDropdown:
              session?.user.role === 'SUPPLIER'
                ? undefined
                : () => (
                    <div className="p-2">
                      <Select
                        allowClear
                        placeholder="Select Supplier"
                        className="w-36"
                        showSearch
                        filterOption={false}
                        onSearch={search => {
                          debouncedSupplierSearch(search)
                        }}
                        notFoundContent={
                          suppliersLoading ? (
                            <span className="flex items-center justify-center">
                              <Spin size="small" />
                            </span>
                          ) : null
                        }
                        options={suppliers?.suppliers.map(item => ({
                          label: item.name,
                          value: item.id
                        }))}
                        value={variables.supplierId}
                        onChange={value =>
                          setVariables(prev => ({
                            ...prev,
                            supplierId: value || undefined,
                            page: 1
                          }))
                        }
                      />
                    </div>
                  ),
            filtered: !!variables.supplierId
          },
          {
            title: 'Total items',
            render: (_, row) => row._count.inquiries
          },
          ...(session?.user.role !== 'SUPPLIER'
            ? [
                {
                  title: 'Email Sent?',
                  dataIndex: 'emailSent',
                  render: (emailSent: boolean) => (
                    <Tag color={emailSent ? 'green' : 'red'}>
                      {emailSent ? 'Yes' : 'No'}
                    </Tag>
                  )
                },
                {
                  title: 'WhatsApp Sent?',
                  dataIndex: 'whatsappSent',
                  render: (whatsappSent: boolean) => (
                    <Tag color={whatsappSent ? 'green' : 'red'}>
                      {whatsappSent ? 'Yes' : 'No'}
                    </Tag>
                  )
                },
                {
                  title: 'Last Resend At',
                  dataIndex: 'lastResendAt',
                  render: (lastResendAt: any) =>
                    lastResendAt ? lastResendAt.toLocaleString() : null
                },
                {
                  title: 'Resend count',
                  render: (_: any, record: any) => record._count?.resendHistory
                },
                {
                  title: 'Created By',
                  dataIndex: 'createdBy',
                  render: (createdBy: any) => (
                    <Link href={`/users/${createdBy?.id}`}>
                      {createdBy?.name}
                    </Link>
                  ),
                  filterDropdown: () => (
                    <div className="p-2">
                      <Select
                        allowClear
                        placeholder="Select User"
                        className="w-36"
                        showSearch
                        filterOption={false}
                        onSearch={search => {
                          debouncedUserSearch(search)
                        }}
                        notFoundContent={
                          usersLoading ? (
                            <span className="flex items-center justify-center">
                              <Spin size="small" />
                            </span>
                          ) : null
                        }
                        options={users?.users.map(item => ({
                          label: item.name,
                          value: item.id
                        }))}
                        value={variables.createdById}
                        onChange={value =>
                          setVariables(prev => ({
                            ...prev,
                            createdById: value || undefined,
                            page: 1
                          }))
                        }
                      />
                    </div>
                  ),
                  filtered: !!variables.createdById
                }
              ]
            : [])
        ]}
        dataSource={data?.inquiriesSentToSupplier}
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
      />
    </Layout>
  )
}

export default InquiriesSentToSupplierPage
