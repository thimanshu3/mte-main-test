import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
  UnorderedListOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  Upload
} from 'antd'
import dayjs from 'dayjs'
import { Workbook, Worksheet } from 'exceljs'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { ActionRibbon } from '~/components/ActionsRibbon'
import { Layout } from '~/components/Layout'
import { useMessageApi } from '~/context/messageApi'
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

interface LineItem {
  key: number
  inquiryId?: string
  itemId?: string
  description?: string
  size?: string
  unitId?: string
  price?: number
  quantity?: number
  originalPrice?: number
  originalQuantity?: number
  inquiry?: any
  edit: boolean
}

const SalesOrderPage: NextPage = () => {
  // ? useSession
  const session = useSession()

  // ? useRouter
  const router = useRouter()

  // ? useForm
  const [form] = Form.useForm()

  // ? useState
  const [customerSearch, setCustomerSearch] = useState<string | undefined>(
    undefined
  )
  const [newState, setNewState] = useState<{
    customerId?: string
    siteId?: string
    prNumberAndName?: string
    selectedInquiries: string[]
    lineItems: LineItem[]
  }>({
    selectedInquiries: [],
    lineItems: []
  })
  const [userSearch, setUserSearch] = useState<string | undefined>(undefined)
  const [chooseInquiriesModal, setChooseInquiriesModal] = useState(false)

  // ? useQuery
  const { data: units } = api.units.getAllMini.useQuery(
    {
      page: 1,
      limit: 100
    },
    { enabled: !!session }
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
  const { data: sites } = api.orders.sales.getSites.useQuery(
    {
      customerId: newState.customerId || ''
    },
    { enabled: !!session && !!newState.customerId }
  )
  const { data: prNumberAndNames } = api.orders.sales.getPrNumber.useQuery(
    {
      customerId: newState.customerId || '',
      siteId: newState.siteId
    },
    {
      enabled: !!session && !!newState.customerId
    }
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
  const { data: inquiries, isLoading: inquiriesLoading } =
    api.orders.sales.getInquiries.useQuery(
      {
        customerId: newState.customerId || '',
        siteId: newState.siteId,
        prNumberAndName: newState.prNumberAndName
      },
      {
        enabled:
          !!session &&
          !!newState.customerId &&
          !!(newState.siteId || newState.prNumberAndName)
      }
    )
  const { data: currencies, isLoading: currencyLoading } =
    api.currency.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )

  // ? useMutation
  const { mutateAsync, isLoading } = api.orders.sales.createOne.useMutation()

  // ? useEffect
  useEffect(() => {
    form.setFieldValue('date', dayjs().startOf('day'))
    form.setFieldValue('representativeUserId', session.data?.user.id)
  }, [form, session.data?.user.id])

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
  const unitsObj = useMemo(() => {
    const obj: any = {}
    units?.units.forEach(u => {
      obj[u.id] = u
    })
    return obj
  }, [units])

  // ? useNotification
  const notificationApi = useNotificationApi()

  // ? useMessage
  const messageApi = useMessageApi()

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
          label: 'Sales',
          link: '/orders/sales'
        },
        {
          label: 'New'
        }
      ]}
      title="Sales Orders - new"
      loading={!session}
    >
      <Card>
        <Form
          layout="vertical"
          onFinish={async formData => {
            if (!newState.customerId) {
              notificationApi.error({
                message: 'Please select customer'
              })
              return
            }
            if (!newState.lineItems.length) {
              notificationApi.error({
                message: 'Please enter atleast one line item'
              })
              return
            }
            try {
              const res = await mutateAsync({
                date: formData.date.toDate(),
                representativeUserId: formData.representativeUserId,
                referenceId: formData.referenceId,
                currencyId: formData.currencyId,
                customerId: newState.customerId,
                siteId: newState.siteId,
                prNumberAndName: newState.prNumberAndName,
                lineItems: newState.lineItems as any[],
                expenses: []
              })
              router.push(`/orders/sales/${res.id}`)
              notificationApi.success({
                message: 'Sales Order created'
              })
            } catch (err) {
              notificationApi.error({
                message: 'Error creating Sales Order'
              })
            }
          }}
          form={form}
        >
          <ActionRibbon>
            <Form.Item>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={isLoading}
                htmlType="submit"
              >
                Save
              </Button>
            </Form.Item>
          </ActionRibbon>

          <Row gutter={16}>
            <Col span={24}>
              <Typography.Title level={4}>Primary Information</Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item
                name="date"
                label="Date"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Representative User"
                name="representativeUserId"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <Select
                  allowClear
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
                    ) : undefined
                  }
                  options={users?.users.map(item => ({
                    label: (item.name || '') + ' (' + item.email + ')',
                    value: item.id
                  }))}
                  onClear={() => setUserSearch(undefined)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerOrderReferenceId"
                label="Customer Order Reference ID"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="customerId"
                label="Customer"
                rules={[
                  {
                    required: true
                  }
                ]}
              >
                <Select
                  allowClear
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
                  onChange={value => {
                    setNewState({
                      customerId: value || undefined,
                      selectedInquiries: [],
                      lineItems: []
                    })
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="siteId" label="Site">
                <Select
                  disabled={!newState.customerId}
                  allowClear
                  showSearch
                  options={sites?.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  value={newState.siteId}
                  onChange={value =>
                    setNewState(prev => ({
                      customerId: prev.customerId,
                      siteId: value || undefined,
                      selectedInquiries: [],
                      lineItems: []
                    }))
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prNumberAndName" label="PR Number and Name">
                <Select
                  disabled={!newState.customerId}
                  allowClear
                  showSearch
                  options={prNumberAndNames?.map(item => ({
                    label: item,
                    value: item
                  }))}
                  value={newState.prNumberAndName}
                  onChange={value =>
                    setNewState(prev => ({
                      customerId: prev.customerId,
                      siteId: prev.siteId,
                      prNumberAndName: value || undefined,
                      selectedInquiries: [],
                      lineItems: []
                    }))
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currencyId"
                label="Currency"
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  options={currencies?.currencies.map(c => ({
                    label: c.name + ' (' + c.symbol + ')',
                    value: c.id
                  }))}
                  loading={currencyLoading}
                />
              </Form.Item>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Line Items</Typography.Title>
            </Col>

            <Col span={24}>
              {!!session &&
              !!newState.customerId &&
              !!(newState.siteId || newState.prNumberAndName) ? (
                <>
                  <Space className="my-2 flex-col md:flex-row">
                    <Button
                      icon={<UnorderedListOutlined />}
                      onClick={() => setChooseInquiriesModal(true)}
                    >
                      Choose inquiries to add as line items
                    </Button>
                    <Upload
                      multiple={false}
                      fileList={[]}
                      beforeUpload={async file => {
                        const book = new Workbook()
                        await book.xlsx.load(await file.arrayBuffer())

                        let sheet: Worksheet | undefined

                        for (const s of book.worksheets) {
                          if (s.state.toString() === 'hidden') continue
                          sheet = s
                          break
                        }

                        if (!sheet)
                          return messageApi.error('No sheet in excel file')

                        const headerMapping: any = {
                          'INQUIRY ID': 'id',
                          'INQUIRY ITEM ID': 'id2',
                          PRICE: 'price',
                          QUANTITY: 'quantity'
                        }
                        const jsonData: any[] = []

                        let error = false
                        sheet.eachRow((row, rowNumber) => {
                          if (rowNumber === 1) return
                          const rowData: any = {}
                          let flag = false

                          row.eachCell((cell, colNumber) => {
                            const headerCell = sheet!.getCell(1, colNumber)
                            const headerValue = headerCell.value

                            if (
                              headerValue &&
                              headerMapping[headerValue.toString()]
                            ) {
                              flag = true
                              rowData[headerMapping[headerValue.toString()]] =
                                cell.value
                            }
                          })

                          if (!flag) return

                          if (rowData.id) rowData.id = rowData.id.toString()
                          if (rowData.id2) rowData.id2 = rowData.id2.toString()
                          if (rowData.price)
                            rowData.price = parseFloat(rowData.price)
                          if (rowData.quantity)
                            rowData.quantity = parseFloat(rowData.quantity)

                          if (!rowData.id && !rowData.id2) {
                            error = true
                            return messageApi.error(
                              'INQUIRY ID or INQUIRY ITEM ID is required in row ' +
                                rowNumber
                            )
                          }

                          if (!rowData.price) {
                            error = true
                            return messageApi.error(
                              'No PRICE in row ' + rowNumber
                            )
                          }

                          if (!rowData.quantity) {
                            error = true
                            return messageApi.error(
                              'No QUANTITY in row ' + rowNumber
                            )
                          }

                          jsonData.push(rowData)

                          return
                        })

                        if (error) return

                        let noMatches = 0

                        const lineItems: LineItem[] = []

                        inquiries?.forEach(inq => {
                          const found = jsonData.find(
                            jd => jd.id === inq.id || jd.id2 === inq.id2
                          )
                          if (!found) {
                            noMatches++
                            return
                          }

                          lineItems.push({
                            key: Math.random(),
                            inquiryId: inq.id,
                            inquiry: inq,
                            itemId: inq.id2 || undefined,
                            description: inq.salesDescription || undefined,
                            size: inq.size || undefined,
                            price: found.price,
                            quantity: found.quantity,
                            unitId: inq.salesUnit?.id,
                            originalPrice: inq.customerPrice || undefined,
                            originalQuantity: inq.quantity || undefined,
                            edit: false
                          })
                        })

                        if (noMatches)
                          messageApi.error(
                            `No matches found for ${noMatches} rows`
                          )

                        setNewState(prev => ({
                          ...prev,
                          lineItems
                        }))

                        return
                      }}
                    >
                      <Button icon={<UploadOutlined />}>
                        Upload file with inquiries
                      </Button>
                    </Upload>
                  </Space>

                  <Table
                    size="small"
                    bordered
                    scroll={{ x: 800 }}
                    columns={[
                      {
                        title: 'Sr. No.',
                        dataIndex: 'sr'
                      },
                      {
                        title: 'Item ID',
                        render: (_, record) => record.itemId
                      },
                      {
                        title: 'Description',
                        render: (_, record) =>
                          record.edit ? (
                            <Input
                              value={record.description}
                              onChange={e =>
                                setNewState(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li =>
                                    li.key === record.key
                                      ? { ...li, description: e.target.value }
                                      : li
                                  )
                                }))
                              }
                            />
                          ) : (
                            record.description
                          )
                      },
                      {
                        title: 'Size',
                        render: (_, record) =>
                          record.edit ? (
                            <Input
                              value={record.size}
                              onChange={e =>
                                setNewState(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li =>
                                    li.key === record.key
                                      ? { ...li, size: e.target.value }
                                      : li
                                  )
                                }))
                              }
                            />
                          ) : (
                            record.size
                          )
                      },
                      {
                        title: 'Unit',
                        render: (_, record) =>
                          record.edit ? (
                            <Select
                              className="w-32"
                              showSearch
                              value={record.unitId}
                              options={units?.units.map(u => ({
                                label: u.name,
                                value: u.id
                              }))}
                              filterOption={(input, option) =>
                                (option?.label ?? '')
                                  .toLowerCase()
                                  .includes(input.toLowerCase())
                              }
                              onChange={value =>
                                setNewState(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(li =>
                                    li.key === record.key
                                      ? { ...li, unitId: value || undefined }
                                      : li
                                  )
                                }))
                              }
                            />
                          ) : (
                            unitsObj[record.unitId || '']?.name
                          )
                      },
                      ...(newState.lineItems.find(
                        li =>
                          (li.originalPrice || li.originalQuantity) &&
                          (li.originalPrice !== li.price ||
                            li.originalQuantity !== li.quantity)
                      )
                        ? [
                            {
                              title: 'Supplier Name',
                              render: (_: any, record: any) =>
                                record.inquiry?.supplier?.name
                            },
                            {
                              title: 'Supplier Price',
                              render: (_: any, record: any) =>
                                record.inquiry?.supplierPrice
                            },
                            {
                              title: 'Original Price',
                              render: (_: any, record: any) => ({
                                props:
                                  record.inquiry &&
                                  record.originalPrice !== record.price
                                    ? {
                                        style: {
                                          background: '#d63031'
                                        }
                                      }
                                    : {},
                                children: record.originalPrice
                              })
                            },
                            {
                              title: 'Original Quantity',
                              render: (_: any, record: any) => ({
                                props:
                                  record.inquiry &&
                                  record.originalQuantity !== record.quantity
                                    ? {
                                        style: {
                                          background: '#d63031'
                                        }
                                      }
                                    : {},
                                children: record.originalQuantity
                              })
                            }
                          ]
                        : []),
                      {
                        title: 'Price',
                        render: (_, record) =>
                          record.edit ? (
                            <InputNumber
                              min={0}
                              value={record.price}
                              onChange={value => {
                                setNewState(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(item =>
                                    item.key === record.key
                                      ? { ...item, price: value || 0 }
                                      : item
                                  )
                                }))
                              }}
                            />
                          ) : (
                            record.price
                          )
                      },
                      {
                        title: 'Quantity',
                        render: (_, record) =>
                          record.edit ? (
                            <InputNumber
                              min={0}
                              value={record.quantity}
                              onChange={value => {
                                setNewState(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(item =>
                                    item.key === record.key
                                      ? { ...item, quantity: value || 0 }
                                      : item
                                  )
                                }))
                              }}
                            />
                          ) : (
                            record.quantity
                          )
                      },
                      {
                        title: 'Actions',
                        render: (_, record) => (
                          <Space>
                            <Button
                              type="primary"
                              icon={
                                record.edit ? (
                                  <SaveOutlined />
                                ) : (
                                  <EditOutlined />
                                )
                              }
                              onClick={() =>
                                setNewState(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.map(item =>
                                    item.key === record.key
                                      ? { ...item, edit: !item.edit }
                                      : item
                                  )
                                }))
                              }
                            />
                            <Popconfirm
                              title="Are you sure?"
                              onConfirm={() =>
                                setNewState(prev => ({
                                  ...prev,
                                  lineItems: prev.lineItems.filter(
                                    item => item.key !== record.key
                                  )
                                }))
                              }
                            >
                              <Button
                                type="primary"
                                icon={<DeleteOutlined />}
                                danger
                              />
                            </Popconfirm>
                          </Space>
                        )
                      }
                    ]}
                    dataSource={newState.lineItems.map((li, i) => ({
                      ...li,
                      sr: i + 1
                    }))}
                    rowKey="key"
                    pagination={{
                      showSizeChanger: true
                    }}
                    caption={
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() =>
                          setNewState(prev => ({
                            ...prev,
                            lineItems: [
                              ...prev.lineItems,
                              {
                                key: Math.random(),
                                edit: true
                              }
                            ]
                          }))
                        }
                      >
                        New Line
                      </Button>
                    }
                  />
                  <Typography.Title level={5}>
                    Total Price:{' '}
                    {parseFloat(
                      newState.lineItems
                        .reduce(
                          (total, curr) =>
                            total + (curr.price || 0) * (curr.quantity || 0),
                          0
                        )
                        .toFixed(2)
                    ).toLocaleString()}
                  </Typography.Title>
                </>
              ) : (
                <Alert
                  type="info"
                  message="Select Customer and Site / PR Number and Name to select line items"
                />
              )}
            </Col>
          </Row>
        </Form>
      </Card>
      <Drawer
        title="Choose Inquiries"
        width="90%"
        destroyOnClose
        footer={null}
        open={chooseInquiriesModal}
        onClose={() => setChooseInquiriesModal(false)}
      >
        <Button
          onClick={() => {
            setNewState(prev => ({
              ...prev,
              selectedInquiries: inquiries?.map(inq => inq.id) || []
            }))
          }}
        >
          Select All
        </Button>
        <Table
          loading={inquiriesLoading}
          size="middle"
          bordered
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Inquiry Item ID',
              dataIndex: 'id2',
              render: (id2, record) => (
                <Link href={`/inquiries/${record.id}`}>{id2}</Link>
              )
            },
            {
              title: 'Date',
              dataIndex: 'date',
              render: date => date.toLocaleDateString()
            },
            {
              title: 'Site',
              dataIndex: 'site',
              render: site => site?.name
            },
            {
              title: 'PR Number and Name',
              dataIndex: 'prNumberAndName'
            },
            {
              title: 'Sales Description',
              dataIndex: 'salesDescription'
            },
            {
              title: 'Sales Unit',
              dataIndex: 'salesUnit',
              render: salesUnit => salesUnit?.name
            },
            {
              title: 'Quantity',
              dataIndex: 'quantity'
            },
            {
              title: 'Size/Specification',
              dataIndex: 'size'
            },
            {
              title: 'Customer Price',
              dataIndex: 'customerPrice'
            },
            {
              title: 'Supplier',
              dataIndex: 'supplier',
              render: supplier => supplier?.name
            },
            {
              title: 'Purchase Description',
              dataIndex: 'purchaseDescription'
            },
            {
              title: 'Purchase Unit',
              dataIndex: 'purchaseUnit',
              render: purchaseUnit => purchaseUnit?.name
            },
            {
              title: 'Supplier Price',
              dataIndex: 'supplierPrice'
            },
            {
              title: 'Margin %',
              dataIndex: 'margin'
            },
            {
              title: 'FPR',
              dataIndex: 'frontPersonRepresentative',
              render: fpr => fpr?.name
            }
          ]}
          dataSource={inquiries}
          rowKey="id"
          pagination={{
            showSizeChanger: true
          }}
          rowSelection={{
            selectedRowKeys: newState.selectedInquiries,
            onChange: selectedRowKeys =>
              setNewState(prev => ({
                ...prev,
                selectedInquiries: selectedRowKeys.map(key => key.toString())
              })),
            hideSelectAll: true
          }}
          caption={
            <Button
              type="primary"
              onClick={() => {
                if (!newState.selectedInquiries) messageApi.error('No items')
                setNewState(prev => ({
                  ...prev,
                  lineItems: newState.selectedInquiries
                    .map(inq => inquiries?.find(inq2 => inq2.id === inq)!)
                    .map(inq => ({
                      key: Math.random(),
                      inquiryId: inq.id,
                      inquiry: inq,
                      itemId: inq.id2,
                      description: inq.salesDescription || undefined,
                      size: inq.size || undefined,
                      unitId: inq.salesUnit?.id || undefined,
                      originalQuantity: inq.quantity || undefined,
                      originalPrice: inq.customerPrice || undefined,
                      quantity: inq.quantity || undefined,
                      price: inq.customerPrice || undefined,
                      edit: false
                    }))
                }))
                setChooseInquiriesModal(false)
              }}
            >
              Done
            </Button>
          }
        />
      </Drawer>
    </Layout>
  )
}

export default SalesOrderPage
