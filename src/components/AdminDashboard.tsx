import { Card, DatePicker, Skeleton, Statistic, Typography } from 'antd'
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js'
import dayjs from 'dayjs'
import { useSession } from 'next-auth/react'
import { FC, useState } from 'react'
import { Doughnut } from 'react-chartjs-2'
import { api } from '~/utils/api'

ChartJS.register(ArcElement, Tooltip, Legend)

export const AdminDashboard: FC = () => {
  // ? useSession
  const { data: session } = useSession()

  // ? useState
  const [dateRange, setDateRange] = useState<{
    startDate: Date
    endDate: Date
  }>({
    startDate: dayjs().startOf('month').toDate(),
    endDate: dayjs().endOf('month').toDate()
  })

  // ? useQuery
  const { data, isLoading } = api.dashboard.admin.useQuery(
    {
      dateRange
    },
    {
      enabled: !!session && ['ADMIN', 'ADMINVIEWER'].includes(session.user.role)
    }
  )
  const { data: statuses, isLoading: statusLoading } =
    api.inquiryStatuses.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      {
        enabled:
          !!session && ['ADMIN', 'ADMINVIEWER'].includes(session.user.role)
      }
    )
  const { data: results, isLoading: resultLoading } =
    api.inquiryResults.getAllMini.useQuery(
      {
        page: 1,
        limit: 100
      },
      {
        enabled:
          !!session && ['ADMIN', 'ADMINVIEWER'].includes(session.user.role)
      }
    )

  if (isLoading || statusLoading || resultLoading) return <Skeleton />

  return (
    <div className="mt-8">
      <DatePicker.RangePicker
        className="w-64"
        value={
          dateRange
            ? [dayjs(dateRange.startDate), dayjs(dateRange.endDate)]
            : undefined
        }
        onChange={dates =>
          setDateRange(prev =>
            dates && dates[0] && dates[1]
              ? {
                  startDate: dates[0].startOf('day').toDate(),
                  endDate: dates[1].endOf('day').toDate()
                }
              : prev
          )
        }
      />
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div>
          <Card>
            <Statistic
              title="Total Inquiries"
              value={data?.inquiries.total || 0}
            />
          </Card>
          <br />
          <Card>
            <Statistic
              title="Unique Inquiries by Site and PR number"
              value={data?.inquiries.uniqueInquiriesBySiteAndPR || 0}
            />
          </Card>
        </div>
        <div>
          <Card>
            <Typography.Title level={5}>Inquiries by Status</Typography.Title>
            <Doughnut
              options={{
                responsive: true
              }}
              data={{
                labels: statuses?.inquiryStatuses.map(s => s.name),
                datasets: [
                  {
                    label: '# of Inquiries',
                    data: statuses?.inquiryStatuses.map(
                      s =>
                        data?.inquiries.statusWise.find(
                          sw => sw.statusId === s.id
                        )?._count.id || 0
                    ),
                    backgroundColor: [
                      'rgba(255, 99, 132, 0.2)',
                      'rgba(54, 162, 235, 0.2)',
                      'rgba(255, 206, 86, 0.2)',
                      'rgba(75, 192, 192, 0.2)',
                      'rgba(153, 102, 255, 0.2)',
                      'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                      'rgba(255, 99, 132, 1)',
                      'rgba(54, 162, 235, 1)',
                      'rgba(255, 206, 86, 1)',
                      'rgba(75, 192, 192, 1)',
                      'rgba(153, 102, 255, 1)',
                      'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                  }
                ]
              }}
            />
          </Card>
        </div>
        <div>
          <Card>
            <Typography.Title level={5}>Inquiries by Result</Typography.Title>
            <Doughnut
              options={{
                responsive: true
              }}
              data={{
                labels: results?.inquiryResults.map(r => r.name),
                datasets: [
                  {
                    label: '# of Inquiries',
                    data: results?.inquiryResults.map(
                      r =>
                        data?.inquiries.resultWise.find(
                          rw => rw.resultId === r.id
                        )?._count.id || 0
                    ),
                    backgroundColor: [
                      'rgba(255, 99, 132, 0.2)',
                      'rgba(54, 162, 235, 0.2)',
                      'rgba(255, 206, 86, 0.2)',
                      'rgba(75, 192, 192, 0.2)',
                      'rgba(153, 102, 255, 0.2)',
                      'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                      'rgba(255, 99, 132, 1)',
                      'rgba(54, 162, 235, 1)',
                      'rgba(255, 206, 86, 1)',
                      'rgba(75, 192, 192, 1)',
                      'rgba(153, 102, 255, 1)',
                      'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                  }
                ]
              }}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
