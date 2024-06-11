import {
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  RestOutlined
} from '@ant-design/icons'
import { Button, Card, DatePicker, Input, Table } from 'antd'
import dayjs from 'dayjs'
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

const CreateExpensesPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()
  const notificationApi = useNotificationApi()

  // ? useState
  const [soVariables, setSoVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined,
    sortBy: undefined as 'createdAt' | 'updatedAt' | undefined,
    sortOrder: undefined as 'asc' | 'desc' | undefined
  })

  const [poVariables, setPoVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined,
    sortBy: undefined as 'createdAt' | 'updatedAt' | undefined,
    sortOrder: undefined as 'asc' | 'desc' | undefined
  })

  const [poDateRange, setPoDateRange] = useState({
    dateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined
  })

  const [soDateRange, setSoDateRange] = useState({
    dateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined
  })

  // ? useQuery
  const {
    data: getExpensesPo,
    isLoading: isLoading1,
    refetch: getExpensesPoRefetch
  } = api.expenses.getAllExpensePo.useQuery(
    {
      ...poVariables,
      dateRange: poDateRange.dateRange
        ? {
            startDate: poDateRange.dateRange.startDate.toISOString(),
            endDate: poDateRange.dateRange.endDate.toISOString()
          }
        : undefined
    },
    {
      enabled: !!session
    }
  )

  const {
    data: getExpensesSo,
    isLoading: isLoading2,
    refetch: getExpensesSoRefetch
  } = api.expenses.getAllExpenseSo.useQuery(
    {
      ...soVariables,
      dateRange: soDateRange.dateRange
        ? {
            startDate: soDateRange.dateRange.startDate.toISOString(),
            endDate: soDateRange.dateRange.endDate.toISOString()
          }
        : undefined
    },
    {
      enabled: !!session
    }
  )

  const {
    mutateAsync: deletePurchaseOrderExpense,
    isLoading: deletePurchaseOrderExpenseLoading
  } = api.expenses.inActivePurchaseOrderExpense.useMutation()

  const {
    mutateAsync: deleteSalesOrderExpense,
    isLoading: deleteSalesOrderExpenseLoading
  } = api.expenses.inActiveSalesOrderExpense.useMutation()

  const {
    mutateAsync: exportPurchaseOrderExpenses,
    isLoading: exportPurchaseOrderExpensesLoading
  } = api.expenses.exportPurchseOrderExpense.useMutation()

  const {
    mutateAsync: exportSalesOrderExpenses,
    isLoading: exportSalesOrderExpensesLoading
  } = api.expenses.exportSalesOrderExpense.useMutation()

  return (
    <Layout
      breadcrumbs={[
        {
          label: 'Home',
          link: '/'
        },
        {
          label: 'Create Expense'
        }
      ]}
      title="Create Expenses"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <div>
          <Input.Search
            className="w-96"
            placeholder="Type anything to search..."
            onSearch={text =>
              setPoVariables(prev => ({
                ...prev,
                search: text || undefined,
                page: 1
              }))
            }
          />
        </div>
        <Link href="/create-expense/new">
          <Button type="primary" icon={<PlusOutlined />}>
            New
          </Button>
        </Link>
      </div>
      <Card title="Purchase Order Table">
        <DatePicker.RangePicker
          className="mb-4"
          value={
            poDateRange.dateRange
              ? [
                  dayjs(poDateRange.dateRange.startDate),
                  dayjs(poDateRange.dateRange.endDate)
                ]
              : undefined
          }
          onChange={dates => {
            setPoDateRange(prev => ({
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
          }}
        />
        <Button
          className="ml-4"
          icon={<DownloadOutlined />}
          type="primary"
          loading={exportPurchaseOrderExpensesLoading}
          onClick={async () => {
            const result = await exportPurchaseOrderExpenses({
              dateRange: poDateRange.dateRange,
              timezoneOffset: new Date().getTimezoneOffset()
            })
            window.open(result.url)
          }}
        >
          Export
        </Button>
        <Table
          loading={isLoading1}
          size="middle"
          bordered
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Sr. No.',
              render: (_1, record, i) => (
                <Link href={`/create-expense/${record.id}`}>
                  {(poVariables.page - 1) * poVariables.limit + i + 1}
                </Link>
              )
            },
            {
              title: 'Order No.',
              render: (_, row) => row.purchaseOrder?.id2
            },
            {
              title: 'Custom ID',
              render: (_, row) => row.customId
            },
            {
              title: 'Voucher Date',
              render: (_, row) => row?.voucherDate?.toLocaleString()
            },
            {
              title: 'Expense',
              render: (_, row) => row.description
            },
            {
              title: 'Price',
              render: (_, row) => row.price
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
            },
            {
              title: 'Action',
              render: (_, row) => (
                <Button
                  loading={deletePurchaseOrderExpenseLoading}
                  danger
                  icon={
                    getExpensesPo?.expenses?.find(
                      (expense: any) => expense.id === row.id
                    )?.deletedAt ? (
                      <RestOutlined />
                    ) : (
                      <DeleteOutlined />
                    )
                  }
                  type={
                    getExpensesPo?.expenses?.find(
                      (expense: any) => expense.id === row.id
                    )?.deletedAt
                      ? 'default'
                      : 'primary'
                  }
                  onClick={async () => {
                    try {
                      await deletePurchaseOrderExpense({
                        id: row.id,
                        activate: getExpensesPo?.expenses?.find(
                          expense => expense.id === row.id
                        )?.deletedAt
                          ? true
                          : false
                      })

                      await getExpensesPoRefetch()

                      notificationApi.success({
                        message: 'Expense deleted Successfully!'
                      })
                      setPoVariables(prev => ({ ...prev }))
                    } catch (err) {
                      notificationApi.error({
                        message: "Something went wrong! Couldn't delete."
                      })
                    }
                  }}
                >
                  {getExpensesPo?.expenses?.find(
                    (expense: any) => expense.id === row.id
                  )?.deletedAt
                    ? 'Restore'
                    : 'Delete'}
                </Button>
              )
            }
          ]}
          dataSource={getExpensesPo?.expenses}
          rowKey="id"
          pagination={{
            current: poVariables.page,
            pageSize: poVariables.limit,
            total: getExpensesPo?.total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50]
          }}
          onChange={(tablePagination, _filters: any, sorter: any) => {
            const newVariables = {
              ...poVariables,
              page: tablePagination.current || 1,
              limit: tablePagination.pageSize || 10
            }

            if (sorter.column?.dataIndex && sorter.order) {
              newVariables.sortBy = sorter.column.dataIndex
              newVariables.sortOrder =
                sorter.order === 'descend' ? 'desc' : 'asc'
            } else {
              newVariables.sortBy = undefined
              newVariables.sortOrder = undefined
            }

            setPoVariables(newVariables)
          }}
        />
      </Card>

      {getExpensesSo ? (
        <>
          <div>
            <Input.Search
              className="mt-10 w-96"
              placeholder="Type anything to search..."
              onSearch={text =>
                setPoVariables(prev => ({
                  ...prev,
                  search: text || undefined,
                  page: 1
                }))
              }
            />
          </div>
          <Card title="Sales Order Table" className="mt-8">
            <DatePicker.RangePicker
              className="mb-4"
              value={
                soDateRange.dateRange
                  ? [
                      dayjs(soDateRange.dateRange.startDate),
                      dayjs(soDateRange.dateRange.endDate)
                    ]
                  : undefined
              }
              onChange={dates =>
                setSoDateRange(prev => ({
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
            <Button
              className="ml-4"
              icon={<DownloadOutlined />}
              type="primary"
              loading={exportSalesOrderExpensesLoading}
              onClick={async () => {
                const result = await exportSalesOrderExpenses({
                  dateRange: soDateRange.dateRange,
                  timezoneOffset: new Date().getTimezoneOffset()
                })
                window.open(result.url)
              }}
            >
              Export
            </Button>
            <Table
              loading={isLoading2}
              size="middle"
              bordered
              scroll={{ x: 800 }}
              columns={[
                {
                  title: 'Sr. No.',
                  render: (_1, record, i) => (
                    <Link href={`/create-expense/${record.id}`}>
                      {(soVariables.page - 1) * soVariables.limit + i + 1}
                    </Link>
                  )
                },
                {
                  title: 'Order No.',
                  render: (_, row) => row.salesOrder?.id2
                },
                {
                  title: 'Custom ID',
                  render: (_, row) => row.customId
                },
                {
                  title: 'Voucher Date',
                  render: (_, row) => row?.voucherDate?.toLocaleString()
                },
                {
                  title: 'Expense',
                  render: (_, row) => row.description
                },
                {
                  title: 'Price',
                  render: (_, row) => row.price
                },
                {
                  title: 'Created By',
                  dataIndex: 'createdBy',
                  render: createdBy => (
                    <Link href={`/users/${createdBy?.id}`}>
                      {createdBy?.name}
                    </Link>
                  )
                },
                {
                  title: 'Created At',
                  dataIndex: 'createdAt',
                  render: date => date.toLocaleString(),
                  sorter: true
                },
                {
                  title: 'Action',
                  render: (_, row) => (
                    <Button
                      loading={deleteSalesOrderExpenseLoading}
                      danger
                      icon={
                        getExpensesSo?.expenses?.find(
                          (expense: any) => expense.id === row.id
                        )?.deletedAt ? (
                          <RestOutlined />
                        ) : (
                          <DeleteOutlined />
                        )
                      }
                      onClick={async () => {
                        try {
                          await deleteSalesOrderExpense({
                            id: row.id,
                            activate: getExpensesSo?.expenses?.find(
                              expense => expense.id === row.id
                            )?.deletedAt
                              ? true
                              : false
                          })

                          await getExpensesSoRefetch()

                          notificationApi.success({
                            message: 'Expense deleted Successfully!'
                          })
                          setSoVariables(prev => ({ ...prev }))
                        } catch (err) {
                          notificationApi.error({
                            message: "Something went wrong! Couldn't delete."
                          })
                        }
                      }}
                      type={
                        getExpensesSo?.expenses?.find(
                          (expense: any) => expense.id === row.id
                        )?.deletedAt
                          ? 'default'
                          : 'primary'
                      }
                    >
                      {getExpensesSo?.expenses?.find(
                        (expense: any) => expense.id === row.id
                      )?.deletedAt
                        ? 'Restore'
                        : 'Delete'}
                    </Button>
                  )
                }
              ]}
              dataSource={getExpensesSo?.expenses}
              rowKey="id"
              pagination={{
                current: soVariables.page,
                pageSize: soVariables.limit,
                total: getExpensesSo?.total,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50]
              }}
              onChange={(tablePagination, _filters: any, sorter: any) => {
                const newVariables = {
                  ...soVariables,
                  page: tablePagination.current || 1,
                  limit: tablePagination.pageSize || 10
                }

                if (sorter.column?.dataIndex && sorter.order) {
                  newVariables.sortBy = sorter.column.dataIndex
                  newVariables.sortOrder =
                    sorter.order === 'descend' ? 'desc' : 'asc'
                } else {
                  newVariables.sortBy = undefined
                  newVariables.sortOrder = undefined
                }

                setSoVariables(newVariables)
              }}
            />
          </Card>
        </>
      ) : null}
    </Layout>
  )
}

export default CreateExpensesPage
