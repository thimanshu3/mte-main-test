import { Button, Card, Col, Form, Input, Row, notification } from 'antd'
import type { GetServerSideProps, NextPage } from 'next'
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

const passwordCheckRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])/

const ChangePasswordPage: NextPage = () => {
  const { mutateAsync, isLoading: isSaving } =
    api.users.updatePassword.useMutation()

  return (
    <Layout
      breadcrumbs={[{ label: 'Home', link: '/' }, { label: 'Change Password' }]}
      title="Change Password"
    >
      <Card>
        <Row>
          <Col span={12}>
            <Form
              onFinish={async formData => {
                const res = await mutateAsync({
                  password: formData.newPassword,
                  currentPassword: formData.currentPassword
                })

                if (res.success) {
                  notification.success({
                    message: 'Success',
                    description: 'Password changed successfully'
                  })
                } else {
                  notification.error({
                    message: 'Error',
                    description: res.message || 'Error changing password'
                  })
                }
              }}
              layout="vertical"
            >
              <Form.Item
                label="Current Password"
                name="currentPassword"
                rules={[
                  {
                    required: true,
                    message: 'Please enter current password!'
                  }
                ]}
              >
                <Input.Password />
              </Form.Item>
              <Form.Item
                label="New Password"
                name="newPassword"
                dependencies={['currentPassword']}
                rules={[
                  { required: true, message: 'Please enter new password!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (
                        !value ||
                        getFieldValue('currentPassword') !== value
                      ) {
                        if (!value) return Promise.resolve()
                        if (passwordCheckRegex.test(value))
                          return Promise.resolve()
                        return Promise.reject(new Error('password too weak!'))
                      }
                      return Promise.reject(
                        new Error('new & current passwords cannot be same!')
                      )
                    }
                  })
                ]}
              >
                <Input.Password />
              </Form.Item>
              <Form.Item
                label="Confirm Password"
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  {
                    required: true,
                    message: 'Please enter confirm password!'
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value)
                        return Promise.resolve()
                      return Promise.reject(
                        new Error(
                          'new & confirm passwords that you entered do not match!'
                        )
                      )
                    }
                  })
                ]}
              >
                <Input.Password />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isSaving}>
                  Update
                </Button>
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </Card>
    </Layout>
  )
}

export default ChangePasswordPage
