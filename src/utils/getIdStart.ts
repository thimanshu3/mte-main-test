import dayjs from 'dayjs'

export const getIdStart = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const dateRange = {
    startDate: dayjs(date).startOf('month').toDate(),
    endDate: dayjs(date).endOf('month').toDate()
  }
  return {
    year,
    month,
    dateRange,
    itemIdStart: `${year.toString().slice(2)}${month
      .toString()
      .padStart(2, '0')}`
  }
}
