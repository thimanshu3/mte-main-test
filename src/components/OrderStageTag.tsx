import { OrderStage } from '@prisma/client'
import { Tag } from 'antd'
import { FC } from 'react'

export const OrderStageTag: FC<{ stage: OrderStage }> = ({ stage }) => {
  let color = 'green'

  if (stage === 'Pending') color = 'yellow'

  if (stage === 'Fulfilment') color = 'blue'

  if (stage === 'Invoice') color = 'blue'

  if (stage === 'Cancelled') color = 'red'

  if (stage === 'Closed') color = 'grey'

  return <Tag color={color}>{stage}</Tag>
}
