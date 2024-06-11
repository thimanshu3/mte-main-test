import { Layout } from 'antd'
import { FC } from 'react'

export const Footer: FC = () => {
  return (
    <Layout.Footer style={{ textAlign: 'center' }}>
      MTE ERP &copy; {new Date().getFullYear()} Created by The Developer Company
    </Layout.Footer>
  )
}
