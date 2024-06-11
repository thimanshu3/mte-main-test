import dayjs from 'dayjs'

export const formatDate = (date: Date, timezoneOffset: number) => {
  const tempDate = new Date(date)
  tempDate.setUTCMinutes(tempDate.getUTCMinutes() - timezoneOffset)
  return dayjs(tempDate).format('DD-MM-YYYY')
}
