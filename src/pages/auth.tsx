import { Button, Card } from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { signIn } from 'next-auth/react'
import { getServerAuthSession } from '~/server/auth'

export const getServerSideProps: GetServerSideProps = async ctx => {
  const session = await getServerAuthSession(ctx)
  return {
    redirect: session
      ? {
          destination: '/'
        }
      : undefined,
    props: {}
  }
}

const AuthPage: NextPage = () => {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Card className="my-8">
        <Button
          size="large"
          onClick={() =>
            signIn(undefined, {
              callbackUrl: '/'
            })
          }
        >
          Sign In with Credentials
        </Button>
      </Card>
    </div>
  )
}

export default AuthPage
