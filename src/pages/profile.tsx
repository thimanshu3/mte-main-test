import { Avatar, Card, Col, Form, Row } from 'antd'
import type { GetServerSideProps, NextPage } from 'next'
import { useSession } from 'next-auth/react'
import { Layout } from '~/components/Layout'
import { getServerAuthSession } from '~/server/auth'

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

const ProfilePage: NextPage = () => {
  const { data: session } = useSession()

  return (
    <Layout
      breadcrumbs={[{ label: 'Home', link: '/' }, { label: 'Profile' }]}
      title="Profile"
    >
      <Card>
        <Row>
          <Col md={6} xs={24}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {session?.user?.image ? (
                <Avatar size={100} src={session?.user?.image} />
              ) : (
                <Avatar size={100} className="flex items-center">
                  <div className="h-full text-6xl">
                    {session?.user?.name ? session?.user?.name[0] : ''}
                  </div>
                </Avatar>
              )}
            </div>
          </Col>
          <Col md={18} xs={24}>
            <Form layout="vertical">
              <Form.Item name="email" label="Email">
                <span>{session?.user?.email}</span>
              </Form.Item>
              <Form.Item name="role" label="Role">
                <span>{session?.user?.role}</span>
              </Form.Item>
              <Form.Item name="name" label="Name">
                <span>{session?.user?.name}</span>
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </Card>
    </Layout>
  )
}

export default ProfilePage
