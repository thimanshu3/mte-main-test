import { Card, Typography } from 'antd'
import type { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import Head from 'next/head'
import { AdminDashboard } from '~/components/AdminDashboard'
import { Layout } from '~/components/Layout'
import { MyTasks } from '~/components/task-management/MyTasks'
import { getServerAuthSession } from '~/server/auth'
import { greet } from '~/utils/greet'

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerAuthSession(ctx)
  return {
    redirect: !session
      ? {
          destination: '/auth'
        }
      : undefined,
    props: {
      greetMessage: greet()
    }
  }
}

const IndexPage: NextPage<{ greetMessage: string }> = ({ greetMessage }) => {
  const { data: sessionData } = useSession()

  return (
    <>
      <Head>
        <title>MTE ERP</title>
        <meta name="description" content="Mewar Traders ERP" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        <Card className="mt-4 flex flex-col gap-4">
          <Typography.Title level={2}>
            {greetMessage}, {sessionData?.user.name}!
          </Typography.Title>
          {['ADMIN', 'ADMINVIEWER'].includes(sessionData?.user.role || '') ? (
            <AdminDashboard />
          ) : null}
        </Card>

        {['ADMIN', 'ADMINVIEWER', 'USER', 'USERVIEWER'].includes(
          sessionData?.user.role || ''
        ) ? (
          <MyTasks />
        ) : null}
      </Layout>
    </>
  )
}

export default IndexPage
