import { DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, Space, Table, Tag } from 'antd'
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
      : !['ADMIN', 'ADMINVIEWER'].includes(session.user.role)
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const UsersPage: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined
  })

  // ? useQuery
  const { data, isLoading } = api.users.getAll.useQuery(variables, {
    enabled: !!session
  })

  // ? useMutation
  const { mutateAsync: exportUsers, isLoading: exportUsersLoading } =
    api.users.export.useMutation()

  return (
    <Layout
      breadcrumbs={[{ label: 'Home', link: '/' }, { label: 'Users' }]}
      title="Users"
    >
      <div className="mb-2 mt-4 flex items-center justify-between">
        <Input.Search
          className="w-96"
          placeholder="Type anything to search..."
          onSearch={searchStr => {
            setVariables(prev => ({
              ...prev,
              page: 1,
              search: searchStr ? searchStr : undefined
            }))
          }}
        />
        <Link href="/users/new">
          {session?.user.role !== 'ADMINVIEWER' ? (
            <Button type="primary" icon={<PlusOutlined />}>
              New
            </Button>
          ) : null}
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
            render: (_1, _2, i) =>
              (variables.page - 1) * variables.limit + i + 1
          },
          {
            title: 'Name',
            dataIndex: 'name',
            render: (name, record) => (
              <Link href={`/users/${record.id}`}>
                <Button type="link">{name}</Button>
              </Link>
            )
          },
          {
            title: 'Email',
            dataIndex: 'email',
            render: email => (
              <Link href={`mailto:${email}`}>
                <Button type="link">{email}</Button>
              </Link>
            )
          },
          {
            title: 'Mobile',
            dataIndex: 'mobile',
            render: mobile =>
              mobile ? (
                <Link href={`telto:${mobile}`}>
                  <Button type="link">{mobile}</Button>
                </Link>
              ) : null
          },
          {
            title: 'Active',
            dataIndex: 'active',
            render: active =>
              active ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>
          },
          {
            title: 'Role',
            dataIndex: 'role'
          },
          {
            title: 'Supplier',
            dataIndex: 'supplier',
            render: supplier =>
              supplier ? (
                <Link href={`/suppliers/${supplier.id}`}>
                  <Button type="link">{supplier.name}</Button>
                </Link>
              ) : null
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
            render: date => date.toLocaleString()
          },
          {
            title: 'Updated At',
            dataIndex: 'updatedAt',
            render: date => date.toLocaleString()
          }
        ]}
        dataSource={data?.users}
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
        caption={
          <Space>
            <Button
              type="primary"
              loading={exportUsersLoading}
              icon={<DownloadOutlined />}
              onClick={async () => {
                const result = await exportUsers({
                  search: variables.search
                })
                window.open(result.url)
              }}
            >
              Export
            </Button>
          </Space>
        }
      />
    </Layout>
  )
}

export default UsersPage
