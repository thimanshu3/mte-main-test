import { Button, Card } from 'antd'
import { GetServerSideProps, NextPage } from 'next'
import { useRef, useState } from 'react'
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

const ParseSupplierPDFPage: NextPage = () => {
  // ? useState
  const [isLoading, setIsLoading] = useState(false)

  // ? useRef
  const inputFileRef = useRef<HTMLInputElement | null>(null)

  return (
    <Layout
      breadcrumbs={[
        { label: 'Home', link: '/' },
        { label: 'Tools' },
        { label: 'Parse Supplier PDF' }
      ]}
      title="Parse Supplier PDF"
    >
      <Card>
        <div className="flex flex-col items-start justify-start gap-y-5">
          <input type="file" name="myfile" ref={inputFileRef} multiple />
          <Button
            type="primary"
            loading={isLoading}
            onClick={async () => {
              if (!inputFileRef.current?.files?.length) {
                alert('Please, select file you want to upload')
                return
              }

              setIsLoading(true)

              const formData = new FormData()
              Object.values(inputFileRef.current.files).forEach(file => {
                formData.append('file', file)
              })
              formData.append('name', 'John Doe')
              formData.append('kfnknf', 'kldfbnkldgn')

              const response = await fetch('/api/tools/parseSupplierPdf', {
                method: 'POST',
                body: formData
              })

              const json = await response.json()
              if (json.url) {
                window.open(json.url)
              } else {
                alert(json.message || 'Unknown error')
              }

              setIsLoading(false)
            }}
          >
            Upload
          </Button>
        </div>
      </Card>
    </Layout>
  )
}

export default ParseSupplierPDFPage
