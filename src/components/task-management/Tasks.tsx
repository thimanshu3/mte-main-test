import { FC, useEffect, useState } from 'react'
import { Draggable } from 'react-beautiful-dnd'
import { api } from '~/utils/api'
import { pusherClient } from '~/utils/pusher/client'
import { Task } from './Task'

export const Tasks: FC<{ teamId: string; taskListId: string }> = ({
  teamId,
  taskListId
}) => {
  //? States
  const [tasks, setTasks] = useState<typeof tasksData>([])

  //? Queries
  const { data: tasksData } = api.tasks.getAllByTaskList.useQuery({
    taskListId
  })

  //? UseEffects
  useEffect(() => {
    if (tasksData) {
      setTasks(tasksData)
    }
  }, [tasksData])

  useEffect(() => {
    const sub = pusherClient.subscribe(`private-taskList-${taskListId}`)

    sub.bind('task-created', (task: any) => {
      setTasks(prev => (prev ? [...prev, task] : [task]))
    })

    sub.bind('task-updated', (task: any) => {
      setTasks(prev =>
        prev
          ? prev.map(prevTask =>
              prevTask.id === task.id ? { ...prevTask, ...task } : prevTask
            )
          : [task]
      )
    })

    sub.bind('task-reorder', (tasks: any[]) => {
      setTasks(tasks)
    })

    return () => {
      sub.unbind_all()
      sub.unsubscribe()
    }
  }, [taskListId])

  return tasks?.map(task => (
    <Draggable key={task.id} draggableId={task.id} index={task.order}>
      {provided => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <Task task={task} setTasks={setTasks} teamId={teamId} key={task.id} />
        </div>
      )}
    </Draggable>
  ))
}
