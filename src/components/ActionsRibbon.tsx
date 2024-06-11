import { Space, theme } from 'antd'
import { FC } from 'react'

export const ActionRibbon: FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const {
    token: { colorBgContainer }
  } = theme.useToken()

  return (
    <Space
      className="sticky top-0 z-20 mb-5 w-full"
      style={{ background: colorBgContainer }}
    >
      {children}
    </Space>
  )
}
