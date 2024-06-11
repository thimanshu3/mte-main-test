import {
  CalendarOutlined,
  DownOutlined,
  PlusOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Upload
} from 'antd'
import dayjs from 'dayjs'
import debounce from 'lodash/debounce'
import type { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
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
      : session.user.role === 'SUPPLIER'
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const InquiriesPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined,
    customerId: undefined as string | undefined,
    siteId: undefined as string | null | undefined,
    frontPersonRepresentativeId: undefined as string | undefined,
    supplierId: undefined as string | null | undefined,
    statusId: undefined as string | null | undefined,
    resultId: undefined as string | null | undefined,
    cancelReasonId: undefined as string | null | undefined,
    dateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined,
    inquiryToSupplierDateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined,
    supplierOfferDateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined,
    offerSubmissionDateRange: undefined as
      | {
          startDate: Date
          endDate: Date
        }
      | undefined,
    prNumberAndName: undefined as string | null | undefined,
    sortBy: undefined as 'date' | 'createdAt' | 'updatedAt' | undefined,
    sortOrder: undefined as 'asc' | 'desc' | undefined
  })
  const [customerSearch, setCustomerSearch] = useState<string | undefined>(
    undefined
  )
  const [siteSearch, setSiteSearch] = useState<string | undefined>(undefined)
  const [frontPersonRepresentativeSearch, setFrontPersonRepresentativeSearch] =
    useState<string | undefined>(undefined)
  const [supplierSearch, setSupplierSearch] = useState<string | undefined>(
    undefined
  )
  const [statusSearch, setStatusSearch] = useState<string | undefined>(
    undefined
  )
  const [resultSearch, setResultSearch] = useState<string | undefined>(
    undefined
  )
  const [cancelReasonSearch, setCancelReasonSearch] = useState<
    string | undefined
  >(undefined)
  const [prNumberSearch, setPrNumberSearch] = useState<string | undefined>(
    undefined
  )
  const [showImportModal, setShowImportModal] = useState(0)
  const [importFile, setImportFile] = useState<{
    uid: string
    name: string
    filename: string
    url: string
  } | null>(null)

  // ? useQuery
  const { data: customers, isLoading: customersLoading } =
    api.customers.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: customerSearch
      },
      { enabled: !!session }
    )
  const { data: sites, isLoading: sitesLoading } =
    api.sites.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: siteSearch,
        customerId: variables.customerId
      },
      { enabled: !!session }
    )
  const { data: users, isLoading: usersLoading } =
    api.users.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: frontPersonRepresentativeSearch
      },
      { enabled: !!session }
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
  const { data: statuses, isLoading: statusesLoading } =
    api.inquiryStatuses.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: statusSearch
      },
      { enabled: !!session }
    )
  const { data: results, isLoading: resultsLoading } =
    api.inquiryResults.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: resultSearch
      },
      { enabled: !!session }
    )
  const { data: cancelReasons, isLoading: cancelReasonsLoading } =
    api.inquiryCancelReasons.getAllMini.useQuery(
      {
        page: 1,
        limit: 50,
        search: cancelReasonSearch
      },
      { enabled: !!session }
    )
  const { data, isLoading, refetch } = api.inquiries.getAll.useQuery(
    variables,
    {
      enabled: !!session
    }
  )
  const { data: prNumbers, isLoading: prNumbersLoading } =
    api.inquiries.getPrNumber.useQuery(
      {
        search: prNumberSearch,
        customerId: variables.customerId,
        siteId: variables.siteId,
        frontPersonRepresentativeId: variables.frontPersonRepresentativeId,
        supplierId: variables.supplierId,
        statusId: variables.statusId,
        resultId: variables.resultId,
        cancelReasonId: variables.cancelReasonId,
        dateRange: variables.dateRange,
        inquiryToSupplierDateRange: variables.inquiryToSupplierDateRange,
        supplierOfferDateRange: variables.supplierOfferDateRange,
        offerSubmissionDateRange: variables.offerSubmissionDateRange
      },
      {
        enabled: !!session
      }
    )

  // ? useMutation
  const { mutateAsync: exportInquiries, isLoading: exportInquiriesLoading } =
    api.inquiries.export.useMutation()
  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()
  const { mutateAsync: importInquiries, isLoading: importing } =
    api.inquiries.import.useMutation()
  const {
    mutateAsync: importFromSupplierInquiries,
    isLoading: importingFromSupplierInquiries
  } = api.inquiries.importFromSupplier.useMutation()
  const {
    mutateAsync: importFromUserInquiries,
    isLoading: importingFromUserInquiries
  } = api.inquiries.importFromUser.useMutation()

  // ? useMemo
  const debouncedCustomerSearch = useMemo(
    () =>
      debounce((search: string) => {
        setCustomerSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedSiteSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSiteSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedFrontPersonRepresentativeSearch = useMemo(
    () =>
      debounce((search: string) => {
        setFrontPersonRepresentativeSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedSupplierSearch = useMemo(
    () =>
      debounce((search: string) => {
        setSupplierSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedStatusSearch = useMemo(
    () =>
      debounce((search: string) => {
        setStatusSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedResultSearch = useMemo(
    () =>
      debounce((search: string) => {
        setResultSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedCancelReasonSearch = useMemo(
    () =>
      debounce((search: string) => {
        setCancelReasonSearch(search || undefined)
      }, 500),
    []
  )
  const debouncedPrNumberSearch = useMemo(
    () =>
      debounce((search: string) => {
        setPrNumberSearch(search || undefined)
      }, 500),
    []
  )

  // ? useNotificationApi
  const notificationApi = useNotificationApi()

  return (
    <Layout
      breadcrumbs={[{ label: 'Home', link: '/' }, { label: 'Inquiries' }]}
      title="Inquiries"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <Input.Search
          className="w-96"
          placeholder="Type inquiry id. to search..."
          onSearch={text =>
            setVariables(prev => ({
              ...prev,
              search: text || undefined,
              page: 1
            }))
          }
        />
        {!['ADMINVIEWER', 'USERVIEWER'].includes(session?.user.role || '') ? (
          <Link href="/inquiries/new">
            <Button type="primary" icon={<PlusOutlined />}>
              New
            </Button>
          </Link>
        ) : null}
      </div>
      <Table
        loading={isLoading}
        size="small"
        bordered
        scroll={{ x: 800 }}
        columns={[
          {
            title: 'Sr. No.',
            dataIndex: 'id',
            render: (id, _2, i) => (
              <Link href={`/inquiries/${id}`}>
                {(variables.page - 1) * variables.limit + i + 1}
              </Link>
            )
          },
          {
            title: 'Inquiry Item Id',
            render: (_, record) => (
              <Link href={`/inquiries/${record.id}`}>{record.id2}</Link>
            )
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
                  className="w-40"
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
              ) : null,
            filterDropdown: () => (
              <div className="p-2">
                <Select
                  allowClear
                  placeholder="Select Site"
                  className="w-40"
                  showSearch
                  filterOption={false}
                  onSearch={search => {
                    debouncedSiteSearch(search)
                  }}
                  notFoundContent={
                    sitesLoading ? (
                      <span className="flex items-center justify-center">
                        <Spin size="small" />
                      </span>
                    ) : null
                  }
                  options={
                    sites?.sites.length
                      ? [
                          {
                            label: 'No site',
                            value: 'NULL'
                          },
                          ...sites.sites.map(item => ({
                            label: item.name,
                            value: item.id
                          }))
                        ]
                      : undefined
                  }
                  onChange={value =>
                    setVariables(prev => ({
                      ...prev,
                      siteId: value === 'NULL' ? null : value || undefined,
                      page: 1
                    }))
                  }
                />
              </div>
            ),
            filtered: !!variables.siteId
          },
          {
            title: 'PR Number and Name',
            dataIndex: 'prNumberAndName',
            filterDropdown: () => (
              <div className="p-2">
                <Select
                  allowClear
                  placeholder="Select PR Number and Name"
                  className="w-64"
                  showSearch
                  filterOption={false}
                  onSearch={search => {
                    debouncedPrNumberSearch(search)
                  }}
                  notFoundContent={
                    prNumbersLoading ? (
                      <span className="flex items-center justify-center">
                        <Spin size="small" />
                      </span>
                    ) : null
                  }
                  options={
                    prNumbers?.length
                      ? [
                          {
                            label: 'No pr number and name',
                            value: 'NULL'
                          },
                          ...prNumbers.map(item => ({
                            label: item.prNumberAndName,
                            value: item.prNumberAndName
                          }))
                        ]
                      : undefined
                  }
                  onChange={value =>
                    setVariables(prev => ({
                      ...prev,
                      prNumberAndName:
                        value === 'NULL' ? null : value || undefined,
                      page: 1
                    }))
                  }
                />
              </div>
            ),
            filtered: !!variables.prNumberAndName
          },
          {
            title: 'Front Person Representative',
            dataIndex: 'frontPersonRepresentative',
            render: user => (
              <Link href={`/users/${user?.id}`}>{user?.name}</Link>
            ),
            filterDropdown: () =>
              ['ADMIN', 'ADMINVIEWER'].includes(session?.user.role || '') ? (
                <div className="p-2">
                  <Select
                    allowClear
                    placeholder="Select Front Person Representative"
                    className="w-40"
                    showSearch
                    filterOption={false}
                    onSearch={search => {
                      debouncedFrontPersonRepresentativeSearch(search)
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
                    onChange={value =>
                      setVariables(prev => ({
                        ...prev,
                        frontPersonRepresentativeId: value || undefined,
                        page: 1
                      }))
                    }
                  />
                </div>
              ) : null,
            filtered: !!variables.frontPersonRepresentativeId
          },
          {
            title: 'Supplier',
            dataIndex: 'supplier',
            render: supplier => (
              <Link href={`/suppliers/${supplier?.id}`}>{supplier?.name}</Link>
            ),
            filterDropdown: () => (
              <div className="p-2">
                <Select
                  allowClear
                  placeholder="Select Supplier"
                  className="w-40"
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
                  options={
                    suppliers?.suppliers.length
                      ? [
                          {
                            label: 'No supplier',
                            value: 'NULL'
                          },
                          ...suppliers.suppliers.map(item => ({
                            label: item.name,
                            value: item.id
                          }))
                        ]
                      : undefined
                  }
                  onChange={value =>
                    setVariables(prev => ({
                      ...prev,
                      supplierId: value === 'NULL' ? null : value || undefined,
                      page: 1
                    }))
                  }
                />
              </div>
            ),
            filtered: !!variables.supplierId
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: status => (
              <Link href={`/inquiry-statuses/${status?.id}`}>
                {status?.name}
              </Link>
            ),
            filterDropdown: () => (
              <div className="p-2">
                <Select
                  allowClear
                  placeholder="Select Status"
                  className="w-40"
                  showSearch
                  filterOption={false}
                  onSearch={search => {
                    debouncedStatusSearch(search)
                  }}
                  notFoundContent={
                    statusesLoading ? (
                      <span className="flex items-center justify-center">
                        <Spin size="small" />
                      </span>
                    ) : null
                  }
                  options={
                    statuses?.inquiryStatuses.length
                      ? [
                          {
                            label: 'No status',
                            value: 'NULL'
                          },
                          ...statuses.inquiryStatuses.map(item => ({
                            label: item.name,
                            value: item.id
                          }))
                        ]
                      : undefined
                  }
                  onChange={value =>
                    setVariables(prev => ({
                      ...prev,
                      statusId: value === 'NULL' ? null : value || undefined,
                      page: 1
                    }))
                  }
                />
              </div>
            ),
            filtered: !!variables.statusId
          },
          {
            title: 'Result',
            dataIndex: 'result',
            render: result => (
              <Link href={`/inquiry-results/${result?.id}`}>
                {result?.name}
              </Link>
            ),
            filterDropdown: () => (
              <div className="p-2">
                <Select
                  allowClear
                  placeholder="Select Result"
                  className="w-40"
                  showSearch
                  filterOption={false}
                  onSearch={search => {
                    debouncedResultSearch(search)
                  }}
                  notFoundContent={
                    resultsLoading ? (
                      <span className="flex items-center justify-center">
                        <Spin size="small" />
                      </span>
                    ) : null
                  }
                  options={
                    results?.inquiryResults.length
                      ? [
                          {
                            label: 'No result',
                            value: 'NULL'
                          },
                          ...results?.inquiryResults.map(item => ({
                            label: item.name,
                            value: item.id
                          }))
                        ]
                      : undefined
                  }
                  onChange={value =>
                    setVariables(prev => ({
                      ...prev,
                      resultId: value === 'NULL' ? null : value || undefined,
                      page: 1
                    }))
                  }
                />
              </div>
            ),
            filtered: !!variables.resultId
          },
          {
            title: 'Cancel Reason',
            dataIndex: 'cancelReason',
            render: cancelReason => (
              <Link href={`/inquiry-cancel-reasons/${cancelReason?.id}`}>
                {cancelReason?.name}
              </Link>
            ),
            filterDropdown: () => (
              <div className="p-2">
                <Select
                  allowClear
                  placeholder="Select Cancel Reason"
                  className="w-40"
                  showSearch
                  filterOption={false}
                  onSearch={search => {
                    debouncedCancelReasonSearch(search)
                  }}
                  notFoundContent={
                    cancelReasonsLoading ? (
                      <span className="flex items-center justify-center">
                        <Spin size="small" />
                      </span>
                    ) : null
                  }
                  options={
                    cancelReasons?.inquiryCancelReasons.length
                      ? [
                          {
                            label: 'No cancel reason',
                            value: 'NULL'
                          },
                          ...cancelReasons.inquiryCancelReasons.map(item => ({
                            label: item.name,
                            value: item.id
                          }))
                        ]
                      : undefined
                  }
                  onChange={value =>
                    setVariables(prev => ({
                      ...prev,
                      cancelReasonId:
                        value === 'NULL' ? null : value || undefined,
                      page: 1
                    }))
                  }
                />
              </div>
            ),
            filtered: !!variables.cancelReasonId
          },
          {
            title: 'Date',
            dataIndex: 'date',
            render: date => date?.toLocaleDateString(),
            sorter: true,
            filterIcon: <CalendarOutlined />,
            filterDropdown: () => (
              <div className="p-2">
                <DatePicker.RangePicker
                  className="w-64"
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
            title: 'Inquiry To Supplier Date',
            dataIndex: 'inquiryToSupplierDate',
            render: date => date?.toLocaleDateString(),
            filterIcon: <CalendarOutlined />,
            filterDropdown: () => (
              <div className="p-2">
                <DatePicker.RangePicker
                  className="w-64"
                  value={
                    variables.inquiryToSupplierDateRange
                      ? [
                          dayjs(variables.inquiryToSupplierDateRange.startDate),
                          dayjs(variables.inquiryToSupplierDateRange.endDate)
                        ]
                      : undefined
                  }
                  onChange={dates =>
                    setVariables(prev => ({
                      ...prev,
                      page: 1,
                      inquiryToSupplierDateRange:
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
            filtered: !!variables.inquiryToSupplierDateRange
          },
          {
            title: 'Supplier Offer Date',
            dataIndex: 'supplierOfferDate',
            render: date => date?.toLocaleDateString(),
            filterIcon: <CalendarOutlined />,
            filterDropdown: () => (
              <div className="p-2">
                <DatePicker.RangePicker
                  className="w-64"
                  value={
                    variables.supplierOfferDateRange
                      ? [
                          dayjs(variables.supplierOfferDateRange.startDate),
                          dayjs(variables.supplierOfferDateRange.endDate)
                        ]
                      : undefined
                  }
                  onChange={dates =>
                    setVariables(prev => ({
                      ...prev,
                      page: 1,
                      supplierOfferDateRange:
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
            filtered: !!variables.supplierOfferDateRange
          },
          {
            title: 'Offer Submission Date',
            dataIndex: 'offerSubmissionDate',
            render: date => date?.toLocaleDateString(),
            filterIcon: <CalendarOutlined />,
            filterDropdown: () => (
              <div className="p-2">
                <DatePicker.RangePicker
                  className="w-64"
                  value={
                    variables.offerSubmissionDateRange
                      ? [
                          dayjs(variables.offerSubmissionDateRange.startDate),
                          dayjs(variables.offerSubmissionDateRange.endDate)
                        ]
                      : undefined
                  }
                  onChange={dates =>
                    setVariables(prev => ({
                      ...prev,
                      page: 1,
                      offerSubmissionDateRange:
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
            filtered: !!variables.offerSubmissionDateRange
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
        dataSource={data?.inquiries}
        rowKey="id"
        pagination={{
          current: variables.page,
          pageSize: variables.limit,
          total: data?.total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50]
        }}
        onChange={(tablePagination, _filters, sorter: any) => {
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
          <Space>
            <Dropdown.Button
              type="primary"
              loading={exportInquiriesLoading}
              icon={<DownOutlined />}
              onClick={async () => {
                const result = await exportInquiries({
                  search: variables.search,
                  customerId: variables.customerId,
                  siteId: variables.siteId,
                  dateRange: variables.dateRange,
                  inquiryToSupplierDateRange:
                    variables.inquiryToSupplierDateRange,
                  supplierOfferDateRange: variables.supplierOfferDateRange,
                  offerSubmissionDateRange: variables.offerSubmissionDateRange,
                  resultId: variables.resultId,
                  cancelReasonId: variables.cancelReasonId,
                  statusId: variables.statusId,
                  frontPersonRepresentativeId:
                    variables.frontPersonRepresentativeId,
                  supplierId: variables.supplierId,
                  prNumberAndName: variables.prNumberAndName,
                  sortBy: variables.sortBy,
                  sortOrder: variables.sortOrder,
                  timezoneOffset: new Date().getTimezoneOffset()
                })

                window.open(result.url)
              }}
              menu={{
                items: [
                  {
                    key: '1',
                    label: 'Export for Suppliers',
                    disabled: exportInquiriesLoading
                  },
                  {
                    key: '2',
                    label: 'Export for Customers',
                    disabled: exportInquiriesLoading
                  }
                ],
                onClick: async ({ key }) => {
                  if (!key) return
                  const result = await exportInquiries({
                    search: variables.search,
                    customerId: variables.customerId,
                    siteId: variables.siteId,
                    dateRange: variables.dateRange,
                    inquiryToSupplierDateRange:
                      variables.inquiryToSupplierDateRange,
                    supplierOfferDateRange: variables.supplierOfferDateRange,
                    offerSubmissionDateRange:
                      variables.offerSubmissionDateRange,
                    resultId: variables.resultId,
                    cancelReasonId: variables.cancelReasonId,
                    statusId:
                      variables.statusId ||
                      statuses?.inquiryStatuses.find(
                        s =>
                          s.name.toLowerCase() ===
                          (key === '1' ? 'open' : 'submitted')
                      )?.id,
                    frontPersonRepresentativeId:
                      variables.frontPersonRepresentativeId,
                    supplierId: variables.supplierId,
                    prNumberAndName: variables.prNumberAndName,
                    sortBy: variables.sortBy,
                    sortOrder: variables.sortOrder,
                    timezoneOffset: new Date().getTimezoneOffset(),
                    view: key === '1' ? 'supplier' : 'customer'
                  })

                  window.open(result.url)
                }
              }}
            >
              Export
            </Dropdown.Button>
            <Dropdown.Button
              className={`${
                ['ADMINVIEWER', 'USERVIEWER'].includes(session?.user.role || '')
                  ? 'hidden'
                  : ''
              }`}
              type="primary"
              loading={
                importing ||
                importingFromSupplierInquiries ||
                importingFromUserInquiries
              }
              icon={<DownOutlined />}
              onClick={() => setShowImportModal(1)}
              menu={{
                items: [
                  {
                    key: '2',
                    label: 'Import from Supplier',
                    disabled:
                      importing ||
                      importingFromSupplierInquiries ||
                      importingFromUserInquiries
                  },
                  {
                    key: '3',
                    label: 'Import from User (Offer Price / Margin)',
                    disabled:
                      importing ||
                      importingFromSupplierInquiries ||
                      importingFromUserInquiries
                  }
                ],
                onClick: ({ key }) => setShowImportModal(parseInt(key))
              }}
            >
              Import
            </Dropdown.Button>
          </Space>
        }
      />
      <Modal
        destroyOnClose
        open={showImportModal !== 0}
        title="Import Inquiries"
        onCancel={() => {
          setShowImportModal(0)
          if (importFile) deleteAttachment({ id: importFile.uid })
          setImportFile(null)
        }}
        onOk={async () => {
          if (!importFile)
            return notificationApi.error({
              message: 'Please select a file'
            })
          const result = await (showImportModal === 1
            ? importInquiries
            : showImportModal === 2
            ? importFromSupplierInquiries
            : importFromUserInquiries)({
            attachmentId: importFile.uid,
            timezoneOffset: new Date().getTimezoneOffset()
          })
          if ((result as any).errorFile) {
            window.open((result as any).errorFile)
            notificationApi.error({
              message: result.message
            })
          } else {
            notificationApi.success({
              message: result.message
            })
            refetch()
          }
          setShowImportModal(0)
          setImportFile(null)
        }}
        confirmLoading={
          importing ||
          importingFromSupplierInquiries ||
          importingFromUserInquiries
        }
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

export default InquiriesPage
