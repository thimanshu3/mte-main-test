import {
  DeleteOutlined,
  InboxOutlined,
  PlusOutlined,
  RestOutlined,
  SaveOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Typography,
  Upload
} from 'antd'
import dayjs from 'dayjs'
import debounce from 'lodash/debounce'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { ActionRibbon } from '~/components/ActionsRibbon'
import { Layout } from '~/components/Layout'
import { useNotificationApi } from '~/context/notifcationApi'
import { getServerAuthSession } from '~/server/auth'
import { api } from '~/utils/api'
import { handleUndefinedInFormSubmit } from '~/utils/handleUndefinedInFormSubmit'

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

const InquiryPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useState
  const [customerSearch, setCustomerSearch] = useState<string | undefined>(
    undefined
  )
  const [siteSearch, setSiteSearch] = useState<{
    search?: string
    customerId?: string
  }>({})
  const [frontPersonRepresentativeSearch, setFrontPersonRepresentativeSearch] =
    useState<string | undefined>(undefined)
  const [supplierSearch, setSupplierSearch] = useState<string | undefined>(
    undefined
  )
  const [attachments, setAttachments] = useState<
    {
      uid: string
      name: string
      filename: string
      url: string
    }[]
  >([])
  const [image, setImage] = useState<{
    uid: string
    name: string
    filename: string
    url: string
  } | null>(null)
  const [isCancelReasonRequired, setIsCancelReasonRequired] = useState(false)
  const [isRemarksRequired, setIsRemarksRequired] = useState(false)
  const [newSupplierModal, setNewSupplierModal] = useState(false)

  // ? useForm
  const [form] = Form.useForm()

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
        ...siteSearch
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
  const { data: units, isLoading: unitsLoading } =
    api.units.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const {
    data: suppliers,
    isLoading: suppliersLoading,
    refetch: refetchSuppliers
  } = api.suppliers.getAllMini.useQuery(
    {
      page: 1,
      limit: 50,
      search: supplierSearch
    },
    { enabled: !!session }
  )
  const { data: gstRates, isLoading: gstRatesLoading } =
    api.gstRates.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: statuses, isLoading: statusesLoading } =
    api.inquiryStatuses.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: results, isLoading: resultsLoading } =
    api.inquiryResults.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: cancelReasons, isLoading: cancelReasonsLoading } =
    api.inquiryCancelReasons.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data: currencies, isLoading: currenciesLoading } =
    api.currency.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      { enabled: !!session }
    )
  const { data, isLoading, refetch } = api.inquiries.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )

  // ? useMutation
  const { mutateAsync: createMutateAsync, isLoading: isCreating } =
    api.inquiries.createOne.useMutation()
  const { mutateAsync: updateMutateAsync, isLoading: isUpdating } =
    api.inquiries.updateOne.useMutation()
  const { mutateAsync: deleteAsync, isLoading: isDeleting } =
    api.inquiries.deleteOne.useMutation()
  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()
  const { mutateAsync: createSupplier, isLoading: isCreatingSupplier } =
    api.suppliers.createOrUpdateOne.useMutation()

  // ? useEffect
  useEffect(() => {
    if (form) form.resetFields()
  }, [id, data, form])
  useEffect(() => {
    if (session && form && id === 'new')
      form.setFieldValue('frontPersonRepresentativeId', session.user.id)
  }, [id, session, form])
  useEffect(() => {
    if (id !== 'new' && data) {
      setCustomerSearch(data.customerId)
      setSiteSearch({
        search: data.siteId || undefined,
        customerId: data.customerId
      })
      setFrontPersonRepresentativeSearch(data.frontPersonRepresentativeId)
      if (data.supplierId) setSupplierSearch(data.supplierId)
      if (data.attachments.length)
        setAttachments(
          data.attachments.map(attachment => ({
            uid: attachment.id,
            name: attachment.originalFilename,
            filename: attachment.newFilename,
            url: attachment.url
          }))
        )
      if (data.image)
        setImage({
          uid: data.image.id,
          name: data.image.originalFilename,
          filename: data.image.newFilename,
          url: data.image.url
        })
    } else {
      setCustomerSearch(undefined)
      setSiteSearch({})
      setFrontPersonRepresentativeSearch(undefined)
      setSupplierSearch(undefined)
      setIsCancelReasonRequired(false)
      setIsRemarksRequired(false)
      setAttachments([])
    }
  }, [id, data])
  useEffect(() => {
    if (!statuses || !results || !cancelReasons || !form) return
    if (!data) {
      form.setFieldValue('statusId', statuses.inquiryStatuses?.[0]?.id || null)
      return
    }
    if (
      data.resultId &&
      results?.inquiryResults.find(
        ir => ir.name.toLowerCase() === 'cancelled' && ir.id === data.resultId
      )
    )
      setIsCancelReasonRequired(true)
    else setIsCancelReasonRequired(false)
    if (
      data.cancelReasonId &&
      cancelReasons.inquiryCancelReasons.find(
        cs =>
          cs.name.toLowerCase() === 'others' && cs.id === data.cancelReasonId
      )
    )
      setIsRemarksRequired(true)
    else setIsRemarksRequired(false)
  }, [form, data, statuses, results, cancelReasons])

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
        setSiteSearch({
          search,
          customerId: form.getFieldValue('customerId')
        })
      }, 500),
    [form]
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
  const formInitialValues = useMemo(() => {
    if (!data || id === 'new')
      return {
        date: dayjs().startOf('day')
      }

    return {
      ...data,
      date: dayjs(data.date),
      inquiryToSupplierDate: data.inquiryToSupplierDate
        ? dayjs(data.inquiryToSupplierDate)
        : null,
      supplierOfferDate: data.supplierOfferDate
        ? dayjs(data.supplierOfferDate)
        : null,
      offerSubmissionDate: data.offerSubmissionDate
        ? dayjs(data.offerSubmissionDate).format('YYYY-MM-DD')
        : null,
      totalSupplierPrice:
        data.quantity && data.supplierPrice
          ? parseFloat((data.quantity * data.supplierPrice).toFixed(2))
          : undefined,
      totalCustomerPrice:
        data.quantity && data.customerPrice
          ? parseFloat((data.quantity * data.customerPrice).toFixed(2))
          : undefined
    }
  }, [id, data])

  // ? useNotification
  const notificationApi = useNotificationApi()

  const relatedRecords: {
    title: string
    link: string
  }[] = []

  if (data) {
    if (data.inquiriesSentToSupplierInquiry)
      relatedRecords.push({
        title: 'Inquiries Sent To Supplier',
        link: `/inquiries-sent-to-supplier/${data.inquiriesSentToSupplierInquiry.inquiriesSentToSupplierId}`
      })

    if (data.offerSentToCustomerInquiry)
      relatedRecords.push({
        title: 'Offer Sent To Customer',
        link: `/offer-sent-to-customer/${data.offerSentToCustomerInquiry.inquiriesSentToCustomerId}`
      })

    if (data.salesOrderItem)
      relatedRecords.push({
        title: 'Sales Order',
        link: `/orders/sales/${data.salesOrderItem.salesOrderId}`
      })

    if (data.purchaseOrderItem)
      relatedRecords.push({
        title: 'Purchase Order',
        link: `/orders/purchase/${data.purchaseOrderItem.purchaseOrderId}`
      })
  }

  return (
    <Layout
      loading={id !== 'new' && isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Inquiries', link: '/inquiries' },
        {
          label: id === 'new' ? 'New' : data?.id2 || id?.toString() || 'Loading'
        }
      ]}
      title={`Inquiry - ${data?.id2 || id}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            delete formData.totalSupplierPrice
            delete formData.totalCustomerPrice
            delete formData.offerSubmissionDate
            if (!id) return
            if (
              (formData.margin < 0 ||
                formData.supplierPrice > formData.customerPrice) &&
              (data ? data.margin !== formData.margin : true)
            ) {
              if (
                !confirm('You are in loss, are you sure you want to continue?')
              )
                return
            }

            const { margin, supplierPrice, customerPrice } = formData

            if (typeof margin === 'number' && supplierPrice && !customerPrice) {
              formData.customerPrice = parseFloat(
                (supplierPrice * (1 + margin / 100)).toFixed(2)
              )
              form.setFieldValue('customerPrice', formData.customerPrice)
            }

            if (supplierPrice && customerPrice && !margin) {
              formData.margin = parseFloat(
                (
                  ((customerPrice - supplierPrice) / supplierPrice) *
                  100
                ).toFixed(2)
              )
              form.setFieldValue('margin', formData.margin)
            }

            let offerSubmissionDate: Date | undefined | null
            if (formData.statusId !== data?.statusId) {
              if (
                formData.statusId &&
                statuses?.inquiryStatuses.find(
                  is =>
                    is.id === formData.statusId &&
                    is.name.toLowerCase() === 'submitted'
                )
              ) {
                const d = dayjs()
                offerSubmissionDate = d.toDate()
                form.setFieldValue(
                  'offerSubmissionDate',
                  d.format('YYYY-MM-DD')
                )
              } else {
                offerSubmissionDate = null
                form.setFieldValue('offerSubmissionDate', null)
              }
            }

            try {
              if (id === 'new') {
                if (!(formData.siteId || formData.prNumberAndName)) {
                  notificationApi.error({
                    message: 'Please enter either Site or PR Number and Name'
                  })
                  return
                }
                const res = await createMutateAsync({
                  ...handleUndefinedInFormSubmit(formData),
                  attachmentIds: attachments.map(attachment => attachment.uid),
                  date: formData.date?.toDate() || null,
                  inquiryToSupplierDate:
                    formData.inquiryToSupplierDate?.toDate() || null,
                  supplierOfferDate:
                    formData.supplierOfferDate?.toDate() || null,
                  offerSubmissionDate: offerSubmissionDate,
                  imageId: image?.uid || undefined
                })
                router.push(`/inquiries/${res.id}`)
                notificationApi.success({
                  message: 'Inquiry created'
                })
              } else {
                await updateMutateAsync({
                  ...handleUndefinedInFormSubmit(formData),
                  attachmentIds: attachments.map(attachment => attachment.uid),
                  date: formData.date?.toDate() || null,
                  inquiryToSupplierDate:
                    formData.inquiryToSupplierDate?.toDate() || null,
                  supplierOfferDate:
                    formData.supplierOfferDate?.toDate() || null,
                  offerSubmissionDate: offerSubmissionDate,
                  imageId: image?.uid || undefined,
                  id: id.toString()
                })
                notificationApi.success({
                  message: 'Inquiry updated'
                })
                refetch()
              }
            } catch (err) {
              notificationApi.error({
                message: 'Error saving Inquiry'
              })
            }
          }}
          layout="vertical"
          initialValues={formInitialValues}
        >
          <ActionRibbon>
            {!['ADMINVIEWER', 'USERVIEWER'].includes(
              session?.user.role || ''
            ) ? (
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={isCreating || isUpdating}
                htmlType="submit"
              >
                Save
              </Button>
            ) : null}
            {id !== 'new' &&
            !['ADMINVIEWER', 'USERVIEWER'].includes(
              session?.user.role || ''
            ) ? (
              <Link href="/inquiries/new">
                <Button
                  icon={<PlusOutlined />}
                  disabled={isCreating || isUpdating}
                >
                  New
                </Button>
              </Link>
            ) : null}
            {id !== 'new' && session?.user.role === 'ADMIN' ? (
              <Button
                icon={data?.deletedAt ? <RestOutlined /> : <DeleteOutlined />}
                onClick={async () => {
                  if (!id) return
                  await deleteAsync({
                    id: id.toString(),
                    activate: data?.deletedAt ? true : false
                  })
                  notificationApi.success({
                    message: `Inquiry ${
                      data?.deletedAt ? 'restored' : 'deleted'
                    }`
                  })
                  refetch()
                }}
                loading={isDeleting}
                danger
              >
                {data?.deletedAt ? 'Restore' : 'Delete'}
              </Button>
            ) : null}
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
                name="frontPersonRepresentativeId"
                label="Front Person Representative"
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
                    debouncedFrontPersonRepresentativeSearch(search)
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
                  onClear={() => setFrontPersonRepresentativeSearch(undefined)}
                />
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
                    ) : (
                      <Link href="/customers/new">
                        <Button>Create new</Button>
                      </Link>
                    )
                  }
                  options={customers?.customers.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  onChange={value => {
                    form.setFieldsValue({
                      siteId: undefined
                    })
                    setSiteSearch({
                      customerId: value || undefined
                    })
                    if (!value) setCustomerSearch(undefined)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="siteId" label="Site">
                <Select
                  allowClear
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
                    ) : undefined
                  }
                  options={sites?.sites.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  onChange={val => {
                    if (!val) return
                    const customerId =
                      sites?.sites.find(item => item.id === val)?.customerId ||
                      undefined
                    setCustomerSearch(customerId)
                    form.setFieldsValue({
                      customerId
                    })
                    setSiteSearch({
                      customerId
                    })
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prNumberAndName" label="PR no. and name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="offerSubmissionDate"
                label="Offer Submission Date"
              >
                <Input readOnly />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="statusId" label="Status">
                <Select
                  showSearch
                  loading={statusesLoading}
                  options={statuses?.inquiryStatuses.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="resultId" label="Result">
                <Select
                  allowClear
                  showSearch
                  loading={resultsLoading}
                  options={results?.inquiryResults.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={(_, o) => {
                    if (
                      !Array.isArray(o) &&
                      o?.label.toLowerCase() === 'cancelled'
                    )
                      setIsCancelReasonRequired(true)
                    else setIsCancelReasonRequired(false)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="remarks"
                label="Remarks"
                rules={[
                  {
                    required: isRemarksRequired
                  }
                ]}
              >
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="cancelReasonId"
                label="Cancel Reason"
                rules={[
                  {
                    required: isCancelReasonRequired
                  }
                ]}
              >
                <Select
                  allowClear
                  showSearch
                  loading={cancelReasonsLoading}
                  options={cancelReasons?.inquiryCancelReasons.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={(_, o) => {
                    if (
                      !Array.isArray(o) &&
                      o?.label.toLowerCase() === 'others'
                    )
                      setIsRemarksRequired(true)
                    else setIsRemarksRequired(false)
                  }}
                />
              </Form.Item>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Product Information</Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="salesDescription" label="Sales Description">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="purchaseDescription"
                label="Purchase Description"
              >
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="salesUnitId" label="Sales Unit">
                <Select
                  allowClear
                  showSearch
                  loading={unitsLoading}
                  options={units?.units.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseUnitId" label="Purchase Unit">
                <Select
                  allowClear
                  showSearch
                  loading={unitsLoading}
                  options={units?.units.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quantity" label="Quantity">
                <InputNumber
                  className="w-full"
                  min={0}
                  onChange={quantity => {
                    const supplierPrice = form.getFieldValue('supplierPrice')
                    if (quantity && supplierPrice)
                      form.setFieldValue(
                        'totalSupplierPrice',
                        parseFloat((supplierPrice * quantity).toFixed(2))
                      )
                    else form.setFieldValue('totalSupplierPrice', undefined)

                    const customerPrice = form.getFieldValue('customerPrice')
                    if (quantity && customerPrice)
                      form.setFieldValue(
                        'totalCustomerPrice',
                        parseFloat((customerPrice * quantity).toFixed(2))
                      )
                    else form.setFieldValue('totalCustomerPrice', undefined)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="size" label="Size/Specification">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gstRateId" label="GST Rate">
                <Select
                  allowClear
                  showSearch
                  loading={gstRatesLoading}
                  options={gstRates?.gstRates.map(item => ({
                    label: item.rate.toString(),
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="hsnCode"
                label="HSN Code"
                rules={[
                  {
                    validator: async (_, value) => {
                      if (value && value.length > 8)
                        return Promise.reject(
                          new Error('HSN Code cannot be greater than 8 digits')
                        )
                      return Promise.resolve()
                    }
                  }
                ]}
              >
                <Input />
              </Form.Item>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>
                Supplier Information
              </Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="supplierId" label="Supplier">
                <Select
                  allowClear
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
                    ) : !['ADMINVIEWER', 'USERVIEWER'].includes(
                        session?.user.role || ''
                      ) ? (
                      <Button onClick={() => setNewSupplierModal(true)}>
                        Create new
                      </Button>
                    ) : null
                  }
                  options={suppliers?.suppliers.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                  onClear={() => setSupplierSearch(undefined)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="inquiryToSupplierDate"
                label="Inquiry To Supplier Date"
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplierOfferDate" label="Supplier Offer Date">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="estimatedDeliveryDays"
                label="Estimated Delivery Days"
              >
                <InputNumber className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="Sap Code" label="sapCode">
                <Input />
              </Form.Item>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Pricing Information</Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="supplierCurrencyId" label="Supplier Currency">
                <Select
                  allowClear
                  showSearch
                  loading={currenciesLoading}
                  options={currencies?.currencies.map(item => ({
                    label: item.name + ` (${item.symbol})`,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="supplierPrice" label="Supplier Price">
                <InputNumber
                  className="w-full"
                  min={0}
                  onChange={val => {
                    if (val) {
                      const margin = form.getFieldValue('margin')
                      let newCustomerPrice: number | undefined
                      if (margin) {
                        newCustomerPrice = parseFloat(
                          (val * (1 + margin / 100)).toString(2)
                        )
                        form.setFieldValue('customerPrice', newCustomerPrice)
                      }
                      const quantity = form.getFieldValue('quantity')
                      if (quantity)
                        form.setFieldValue(
                          'totalSupplierPrice',
                          parseFloat((val * quantity).toFixed(2))
                        )
                      else form.setFieldValue('totalSupplierPrice', undefined)

                      if (quantity && newCustomerPrice)
                        form.setFieldValue(
                          'totalCustomerPrice',
                          parseFloat((newCustomerPrice * quantity).toFixed(2))
                        )
                      else form.setFieldValue('totalCustomerPrice', undefined)
                    } else form.setFieldValue('totalCustomerPrice', undefined)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customerCurrencyId" label="Customer Currency">
                <Select
                  allowClear
                  showSearch
                  loading={currenciesLoading}
                  options={currencies?.currencies.map(item => ({
                    label: item.name + ` (${item.symbol})`,
                    value: item.id
                  }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="customerPrice" label="Customer Price">
                <InputNumber
                  className="w-full"
                  min={0}
                  onChange={val => {
                    const supplierPrice = form.getFieldValue('supplierPrice')
                    if (val && supplierPrice) {
                      form.setFieldValue(
                        'margin',
                        parseFloat(
                          (
                            ((val - supplierPrice) / supplierPrice) *
                            100
                          ).toFixed(2)
                        )
                      )
                    }

                    const quantity = form.getFieldValue('quantity')
                    if (val && quantity)
                      form.setFieldValue(
                        'totalCustomerPrice',
                        parseFloat((val * quantity).toFixed(2))
                      )
                    else form.setFieldValue('totalCustomerPrice', undefined)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="margin" label="Margin %">
                <InputNumber
                  className="w-full"
                  onChange={val => {
                    if (
                      typeof val !== 'number' ||
                      val === undefined ||
                      val === null
                    )
                      return
                    const supplierPrice = form.getFieldValue('supplierPrice')
                    let newCustomerPrice: number | undefined
                    if (val && supplierPrice) {
                      newCustomerPrice = parseFloat(
                        (supplierPrice * (1 + val / 100)).toFixed(2)
                      )
                      form.setFieldValue('customerPrice', newCustomerPrice)
                    } else form.setFieldValue('customerPrice', undefined)

                    const quantity = form.getFieldValue('quantity')
                    if (quantity && newCustomerPrice)
                      form.setFieldValue(
                        'totalCustomerPrice',
                        parseFloat((newCustomerPrice * quantity).toFixed(2))
                      )
                    else form.setFieldValue('totalCustomerPrice', undefined)
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}></Col>
            <Col span={12}>
              <Form.Item label="Total Supplier Price" name="totalSupplierPrice">
                <InputNumber readOnly className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Total Customer Price" name="totalCustomerPrice">
                <InputNumber readOnly className="w-full" />
              </Form.Item>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>
                Emailing Remarks Information
              </Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item
                name="emailForSupplierRemarks"
                label="Email for Supplier Remarks"
              >
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="emailForCustomerRemarks"
                label="Email for Customer Remarks"
              >
                <Input.TextArea />
              </Form.Item>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Attachments</Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="shopDrawing" valuePropName="checked">
                <Checkbox>Shop Drawing</Checkbox>
              </Form.Item>
            </Col>
            <Col span={24} className="pb-48">
              <Upload.Dragger
                multiple={true}
                fileList={attachments}
                beforeUpload={async file => {
                  const formData = new FormData()
                  formData.append('file', file)

                  const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                  })
                  const json = await res.json()
                  if (json?.attachments)
                    setAttachments(prev => [
                      ...prev,
                      ...json.attachments.map((a: any) => ({
                        uid: a.id,
                        name: a.originalFilename,
                        filename: a.newFilename,
                        url: a.url
                      }))
                    ])
                }}
                onRemove={file => {
                  deleteAttachment({
                    id: file.uid
                  })
                  setAttachments(prev => prev.filter(a => a.uid !== file.uid))
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  Click or drag file to this area to upload
                </p>
                <p className="ant-upload-hint">
                  Support for a single or bulk upload. Strictly prohibited from
                  uploading company data or other banned files.
                </p>
              </Upload.Dragger>
            </Col>

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Image</Typography.Title>
            </Col>

            <Col span={24} className="pb-48">
              <Upload.Dragger
                multiple={false}
                accept="image/*"
                fileList={image ? [image] : []}
                beforeUpload={async file => {
                  const formData = new FormData()
                  formData.append('file', file)

                  if (image)
                    deleteAttachment({
                      id: image.uid
                    })

                  const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                  })
                  const json = await res.json()
                  if (json?.attachments)
                    setImage({
                      uid: json.attachments[0].id,
                      name: json.attachments[0].originalFilename,
                      filename: json.attachments[0].newFilename,
                      url: json.attachments[0].url
                    })
                }}
                onRemove={file => {
                  deleteAttachment({
                    id: file.uid
                  })
                  setImage(null)
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  Click or drag image to this area to upload
                </p>
                <p className="ant-upload-hint">
                  Support for a single image file upload. Strictly prohibited
                  from uploading company data or other banned files.
                </p>
              </Upload.Dragger>
            </Col>
          </Row>
        </Form>
        {data ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
            <Descriptions.Item label="INQUIRY ITEM ID">
              {data.id2}
            </Descriptions.Item>
            {data.createdBy ? (
              <Descriptions.Item label="Created By">
                <Link href={`/users/${data.createdById}`}>
                  {data.createdBy.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.updatedBy ? (
              <Descriptions.Item label="Updated By">
                <Link href={`/users/${data.updatedById}`}>
                  {data.updatedBy?.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            {data.deletedBy ? (
              <Descriptions.Item label="Deleted By">
                <Link href={`/users/${data.deletedById}`}>
                  {data.deletedBy.name?.toLocaleString()}
                </Link>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Created At">
              {data.createdAt.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {data.updatedAt.toLocaleString()}
            </Descriptions.Item>
            {data.deletedAt ? (
              <Descriptions.Item label="Deleted At">
                {data.deletedAt.toLocaleString()}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        ) : null}
        {data && relatedRecords.length ? (
          <Space direction="vertical">
            <Divider />
            <List
              header={
                <Typography.Title level={5} className="mb-2">
                  Related Records
                </Typography.Title>
              }
              bordered
              dataSource={relatedRecords}
              renderItem={item => (
                <List.Item>
                  <Link href={item.link}>{item.title}</Link>
                </List.Item>
              )}
            />
          </Space>
        ) : null}
      </Card>

      <Modal
        title="New Supplier"
        open={newSupplierModal}
        onCancel={() => setNewSupplierModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          onFinish={async formData => {
            try {
              const newSupplier = await createSupplier({
                ...formData
              })
              notificationApi.success({
                message: 'Supplier Created'
              })
              setNewSupplierModal(false)
              setSupplierSearch(formData.name)
              refetchSuppliers()
              form.setFieldValue('supplierId', newSupplier.id)
            } catch (err) {
              notificationApi.error({
                message: 'Error creating Supplier'
              })
            }
          }}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="mobile"
            label="Mobile Number"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input type="email" />
          </Form.Item>
          <Space>
            <Form.Item>
              <Button
                loading={isCreatingSupplier}
                type="primary"
                htmlType="submit"
              >
                Create
              </Button>
            </Form.Item>
            <Form.Item>
              <Button onClick={() => setNewSupplierModal(false)}>Cancel</Button>
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Layout>
  )
}

export default InquiryPage
