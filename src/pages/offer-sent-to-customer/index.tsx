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
      : !['ADMIN', 'ADMINVIEWER', 'USER', 'USERVIEWER'].includes(
          session.user.role
        )
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const OffersSentToCustomerPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    customerId: undefined as string | undefined,
    createdById: undefined as string | undefined,
    dateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined
  })
  const [customerSearch, setCustomerSearch] = useState<string | undefined>(
    undefined
  )
  const [userSearch, setUserSearch] = useState<string | undefined>(undefined)

  // ? useQuery
  const { data, isLoading } = api.offerSentToCustomer.getAll.useQuery(
    variables,
    {
      enabled: !!session
    }
  )
  const { data: customers, isLoading: customersLoading } =
    api.customers.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: customerSearch
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
  const debouncedCustomerSearch = useMemo(
    () =>
      debounce((search: string) => {
        setCustomerSearch(search || undefined)
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
        { label: 'Offer Sent to Customer' }
      ]}
      title="Offer Sent to Customer"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <div />
        {!['ADMINVIEWER', 'USERVIEWER'].includes(session?.user.role || '') ? (
          <Link href="/offer-sent-to-customer/new">
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
              <Link href={`/offer-sent-to-customer/${row.id}`}>
                {(variables.page - 1) * variables.limit + i + 1}
              </Link>
            )
          },
          {
            title: 'Date',
            dataIndex: 'createdAt',
            render: (date, row) => (
              <Link href={`/offer-sent-to-customer/${row.id}`}>
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
            title: 'Customer',
            dataIndex: 'customer',
            render: customer => (
              <Link href={`/customers/${customer?.id}`}>{customer?.name}</Link>
            ),
            filterDropdown: () => (
              <div className="p-2">
                <Select
                  allowClear
                  placeholder="Select Customer"
                  className="w-36"
                  showSearch
                  filterOption={false}
                  onSearch={search => {
                    debouncedCustomerSearch(search)
                  }}
                  notFoundContent={
                    customersLoading ? (
                      <span className="flex items-center justify-center">
                        <Spin size="small" />
                      </span>
                    ) : null
                  }
                  options={customers?.customers.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  value={variables.customerId}
                  onChange={value =>
                    setVariables(prev => ({
                      ...prev,
                      customerId: value || undefined,
                      page: 1
                    }))
                  }
                />
              </div>
            ),
            filtered: !!variables.customerId
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
            title: 'Total items',
            render: (_, row) => row._count.inquiries
          },
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
            render: lastResendAt =>
              lastResendAt ? lastResendAt.toLocaleString() : null
          },
          {
            title: 'Resend count',
            render: (_, record) => record._count.resendHistory
          },
          {
            title: 'Created By',
            dataIndex: 'createdBy',
            render: (createdBy: any) => (
              <Link href={`/users/${createdBy?.id}`}>{createdBy?.name}</Link>
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
        ]}
        dataSource={data?.offerSentToCustomer}
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

export default OffersSentToCustomerPage
