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

const Teams: NextPage = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [variables, setVariables] = useState({
    page: 1,
    limit: 10,
    search: undefined as string | undefined
  })

  // ? useQuery
  const { data: teams, isLoading } = api.teams.getAll.useQuery(variables, {
    enabled: !!session
  })

  return (
    <Layout
      breadcrumbs={[{ label: 'Home', link: '/' }, { label: 'Task Management' }]}
      title="Task Management"
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

        <Link href="/task-management/teams/new">
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
            render: (name, team) => (
              <Link href={`/task-management/teams/${team.id}`}>{name}</Link>
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
          },
          {
            title: 'Actions',
            dataIndex: 'id',
            render: teamId => (
              <Link href={`/task-management/taskBoard?teamId=${teamId}`}>
                <Button type="primary">Board</Button>
              </Link>
            )
          }
        ]}
        dataSource={teams?.teams}
        rowKey="id"
        pagination={{
          current: variables.page,
          pageSize: variables.limit,
          total: teams?.total,
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
export default Teams
