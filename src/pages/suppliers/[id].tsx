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
  Col,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Row,
  Select,
  Table,
  Typography,
  Upload
} from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
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
      : undefined,
    props: {}
  }
}

const SupplierPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useRouter
  const router = useRouter()
  const { id } = router.query

  // ? useQuery
  const { data, isLoading, refetch } = api.suppliers.getOne.useQuery(
    {
      id: id?.toString() || ''
    },
    {
      enabled: !!session && !!id && id !== 'new'
    }
  )
  // ? useState
  const { data: businessTypes, isLoading: businessTypesLoading } =
    api.businessTypes.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      {
        enabled: !!session && !!id
      }
    )
  const { data: paymentTerms, isLoading: paymentTermsLoading } =
    api.paymentTerms.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      {
        enabled: !!session && !!id
      }
    )

  const [attachments, setAttachments] = useState<
    {
      uid: string
      name: string
      filename: string
      url: string
    }[]
  >([])
  const [addBankAccount, setAddBankAccount] = useState(false)

  // ? useMutation
  const { mutateAsync, isLoading: isSaving } =
    api.suppliers.createOrUpdateOne.useMutation()
  const { mutateAsync: deleteAttachment } =
    api.attachments.deleteOne.useMutation()
  const { mutateAsync: deleteAsync, isLoading: isDeleting } =
    api.suppliers.deleteOne.useMutation()
  const { mutateAsync: createBankAccount, isLoading: creatingBankAccount } =
    api.bankAccounts.createOne.useMutation()

  // ? useForm
  const [form] = Form.useForm()

  // ? useEffect
  useEffect(() => {
    if (form) form.resetFields()
    if (id === 'new') setAttachments([])
  }, [id, form])
  useEffect(() => {
    if (data?.attachments.length)
      setAttachments(
        data.attachments.map(attachment => ({
          uid: attachment.id,
          name: attachment.originalFilename,
          filename: attachment.newFilename,
          url: attachment.url
        }))
      )
  }, [data])

  // ? useNotification
  const notificationApi = useNotificationApi()
  const { mutateAsync: sendVerification, isLoading: sendingVerification } =
    api.bankAccounts.sendVerification.useMutation()

  return (
    <Layout
      loading={id !== 'new' && isLoading}
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Suppliers', link: '/suppliers' },
        {
          label: id === 'new' ? 'New' : data?.name || 'Loading'
        }
      ]}
      title={`Supplier - ${data?.name || id}`}
    >
      <Card className="my-2">
        <Form
          form={form}
          onFinish={async formData => {
            try {
              formData.name = formData.name?.trim().toUpperCase()
              const res = await mutateAsync({
                ...handleUndefinedInFormSubmit(formData),
                attachmentIds: attachments.map(attachment => attachment.uid),
                id: id && id !== 'new' ? id.toString() : undefined
              })
              if (id === 'new') {
                router.push(`/suppliers/${res.id}`)
                notificationApi.success({
                  message: 'Supplier created'
                })
              } else {
                refetch()
                notificationApi.success({
                  message: 'Supplier updated'
                })
              }
            } catch (err) {
              notificationApi.error({
                message: 'Error saving Supplier'
              })
            }
          }}
          layout="vertical"
          initialValues={data}
        >
          <ActionRibbon>
            {session?.user.role !== 'ADMINVIEWER' ? (
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                loading={isSaving}
                htmlType="submit"
              >
                Save
              </Button>
            ) : null}
            {id !== 'new' && session?.user.role !== 'ADMINVIEWER' ? (
              <Link href="/suppliers/new">
                <Button icon={<PlusOutlined />} disabled={isSaving}>
                  New
                </Button>
              </Link>
            ) : null}
            {id !== 'new' && session?.user.role !== 'ADMINVIEWER' ? (
              <Button
                icon={data?.deletedAt ? <RestOutlined /> : <DeleteOutlined />}
                onClick={async () => {
                  if (!id) return
                  await deleteAsync({
                    id: id.toString(),
                    activate: data?.deletedAt ? true : false
                  })
                  notificationApi.success({
                    message: `Supplier ${
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
            <Col span={12}>
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
            </Col>
            <Col span={12}>
              <Form.Item name="businessTypeId" label="Business Type">
                <Select
                  allowClear
                  showSearch
                  loading={businessTypesLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={businessTypes?.businessTypes.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="address" label="Address">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="gst" label="GST Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pan" label="PAN Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mobile" label="Mobile Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="alternateMobile" label="Alternate Mobile Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email2" label="Email 2">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email3" label="Email 3">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="whatsapp" label="Whatsapp Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="website" label="Website">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="paymentTermId" label="Payment Terms">
                <Select
                  allowClear
                  showSearch
                  loading={paymentTermsLoading}
                  filterOption={(input, option) =>
                    (option?.label ?? '')
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  options={paymentTerms?.paymentTerms.map(item => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="taxCalcType" label="TAX CALC TYPE">
                <Select
                  allowClear
                  showSearch
                  options={[
                    {
                      value: 'InterState'
                    },
                    {
                      value: 'IntraState'
                    }
                  ]}
                />
              </Form.Item>
            </Col>

            <Divider />

            <Col span={24}>
              <Typography.Title level={4}>
                Purchase Contact Person Details
              </Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="purchaseContactName" label="Name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseContactGender" label="Gender">
                <Select
                  allowClear
                  showSearch
                  options={[
                    {
                      value: 'Male'
                    },
                    {
                      value: 'Female'
                    },
                    {
                      value: 'Other'
                    }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseContactDesignation" label="Designation">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseContactAadhar" label="Aadhar">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseContactPan" label="PAN Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseContactAddress" label="Address">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="purchaseContactMobile" label="Mobile Number">
                <Input />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Typography.Title level={4}>
                Accounts Contact Person Details
              </Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="accountsContactName" label="Name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="accountsContactGender" label="Gender">
                <Select
                  allowClear
                  showSearch
                  options={[
                    {
                      value: 'Male'
                    },
                    {
                      value: 'Female'
                    },
                    {
                      value: 'Other'
                    }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="accountsContactDesignation" label="Designation">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="accountsContactAadhar" label="Aadhar">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="accountsContactPan" label="PAN Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="accountsContactAddress" label="Address">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="accountsContactMobile" label="Mobile Number">
                <Input />
              </Form.Item>
            </Col>

            <Divider />

            <Col span={24}>
              <Typography.Title level={4}>
                Logistic Contact Person Details
              </Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="logisticContactName" label="Name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logisticContactGender" label="Gender">
                <Select
                  allowClear
                  showSearch
                  options={[
                    {
                      value: 'Male'
                    },
                    {
                      value: 'Female'
                    },
                    {
                      value: 'Other'
                    }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logisticContactDesignation" label="Designation">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logisticContactAadhar" label="Aadhar">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logisticContactPan" label="PAN Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logisticContactAddress" label="Address">
                <Input.TextArea />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="logisticContactMobile" label="Mobile Number">
                <Input />
              </Form.Item>
            </Col>

            <Divider />

            <Col span={24}>
              <Typography.Title level={4}>Bank Details</Typography.Title>
            </Col>

            <Col span={12}>
              <Form.Item name="bankName" label="Bank Name">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankBranchCode" label="Branch Code">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="bankAccountHolderName"
                label="Account Holder Name"
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankAccountNumber" label="Account Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankIfscCode" label="IFSC Code">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankMicrNumber" label="MICR Number">
                <Input />
              </Form.Item>
            </Col>

            {id !== 'new' ? (
              <Col span={12}>
                <Form.Item
                  name="primaryBankAccountId"
                  label="Primary Bank Account"
                >
                  <Select
                    showSearch
                    loading={isLoading}
                    filterOption={(input, option) =>
                      (option?.label ?? '')
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                    options={data?.bankAccounts
                      .filter(b => b.isVerified)
                      .map(item => ({
                        label: item.bankName,
                        value: item.id
                      }))}
                  />
                </Form.Item>
              </Col>
            ) : null}

            <Divider />
            <Col span={24}>
              <Typography.Title level={4}>Attachments</Typography.Title>
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
          </Row>
        </Form>

        <Divider />
        <Typography.Title level={4}>Bank Accounts</Typography.Title>
        <Table
          size="small"
          bordered
          scroll={{ x: 800 }}
          columns={[
            {
              title: 'Sr. No.',
              render: (_, __, index) => index + 1
            },
            {
              title: 'Bank Name',
              dataIndex: 'bankName'
            },
            {
              title: 'Beneficiary Name',
              dataIndex: 'beneficiaryName'
            },
            {
              title: 'Account Number',
              dataIndex: 'accountNumber'
            },
            {
              title: 'IFSC Code',
              dataIndex: 'ifscCode'
            },
            {
              title: 'Is Primary',
              render: (_, record) =>
                record.id === data?.primaryBankAccountId ? 'Yes' : 'No'
            },
            {
              title: 'Is Verified',
              dataIndex: 'isVerified',
              render: isVerified => (isVerified ? 'Yes' : 'No')
            },
            {
              title: 'Is Verification Sent',
              dataIndex: 'isVerificationSent',
              render: isVerificationSent => (isVerificationSent ? 'Yes' : 'No')
            },
            {
              title: 'Actions',
              render: (_, record) => (
                <div>
                  {!record.isVerificationSent ? (
                    <Button
                      onClick={async () => {
                        try {
                          const result = await sendVerification(record.id)

                          const element = document.createElement('a')
                          element.setAttribute(
                            'href',
                            'data:text/text;charset=utf-8,' +
                              encodeURIComponent(result.str)
                          )
                          element.setAttribute('download', `${Date.now()}.txt`)
                          element.style.display = 'none'
                          document.body.appendChild(element)
                          element.click()
                          document.body.removeChild(element)

                          refetch()
                          notificationApi.success({
                            message: 'Verification Sent'
                          })
                        } catch (err) {
                          notificationApi.error({
                            message: 'Failed to send verification'
                          })
                        }
                      }}
                      disabled={sendingVerification}
                    >
                      Send Verification
                    </Button>
                  ) : null}
                </div>
              )
            }
          ]}
          dataSource={data?.bankAccounts}
          caption={
            <Button
              className="mx-1"
              onClick={() => setAddBankAccount(true)}
              icon={<PlusOutlined />}
            >
              Add
            </Button>
          }
        />

        {data ? (
          <Descriptions bordered>
            <Descriptions.Item label="ID">{data.id}</Descriptions.Item>
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
      </Card>

      <Drawer
        open={addBankAccount}
        onClose={() => setAddBankAccount(false)}
        destroyOnClose
        title="Add Bank Account"
      >
        <Form
          layout="vertical"
          onFinish={async formData => {
            try {
              await createBankAccount({
                supplierId: id?.toString() || '',
                bankName: formData.bankName,
                beneficiaryName: formData.beneficiaryName,
                accountNumber: formData.accountNumber,
                ifscCode: formData.ifscCode,
                mailingAddressLine1: formData.mailingAddressLine1,
                mailingAddressLine2: formData.mailingAddressLine2,
                mailingAddressLine3: formData.mailingAddressLine3,
                beneficiaryCity: formData.beneficiaryCity,
                beneficiaryZipCode: formData.beneficiaryZipCode
              })
              setAddBankAccount(false)
              refetch()
              notificationApi.success({
                message: 'Bank Account created'
              })
            } catch (err) {
              notificationApi.error({
                message: 'Failed to create bank account'
              })
            }
          }}
        >
          <Form.Item
            name="bankName"
            label="Bank Name"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="beneficiaryName"
            label="Beneficiary Name"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="accountNumber"
            label="Beneficiary Account Number"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="ifscCode"
            label="IFSC Code"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="mailingAddressLine1"
            label="Mailing Address Line 1"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="mailingAddressLine2" label="Mailing Address Line 2">
            <Input />
          </Form.Item>
          <Form.Item name="mailingAddressLine3" label="Mailing Address Line 3">
            <Input />
          </Form.Item>
          <Form.Item
            name="beneficiaryCity"
            label="Beneficiary City"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="beneficiaryZipCode"
            label="Beneficiary Zip Code"
            rules={[
              {
                required: true
              }
            ]}
          >
            <Input />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={creatingBankAccount}
            icon={<SaveOutlined />}
          >
            Save
          </Button>
        </Form>
      </Drawer>
    </Layout>
  )
}

export default SupplierPage
