import { Card, Result, Skeleton } from 'antd'
import { FC } from 'react'
import { api } from '~/utils/api'
import { Task } from './Task'

export const MyTasks: FC = () => {
  const { data: tasks, isLoading } = api.tasks.getByUser.useQuery()

  return (
    <Card title="My Tasks" className="mt-8">
      {isLoading ? (
        <Skeleton />
      ) : !tasks?.length ? (
        <Result status={'error'} title="No Tasks assigned to me" />
      ) : (
        <div className="flex flex-col items-center gap-8 sm:grid  sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasks?.map(task => (
            <Task
              key={task.id}
              task={task}
              setTasks={() => {}}
              teamId={task.taskList.teamId}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
