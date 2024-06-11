import { sortBy } from 'lodash'
import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '../trpc'

export const whatsappRouter = createTRPCRouter({
  getContacts: protectedProcedure.query(async ({ ctx: { prisma } }) => {
    const [data, data2] = await Promise.all([
      prisma.whatsAppMessage.groupBy({
        by: ['contactPhoneNumber']
      }),
      prisma.whatsAppMessage.groupBy({
        by: ['contactPhoneNumber'],
        where: {
          seen: false,
          direction: 'incoming'
        },
        _count: {
          id: true
        }
      })
    ])

    const finalData: {
      contactPhoneNumber: string
      name?: string
      unseen?: number
      createdAt?: Date
      text?: string
      type?: string
    }[] = []

    const data2Obj: any = {}
    data2.forEach(item => {
      data2Obj[item.contactPhoneNumber] = item._count.id
    })
    data.forEach(d => {
      finalData.push({
        ...d,
        unseen: data2Obj[d.contactPhoneNumber]
      })
    })

    const numbers = finalData.map(d => d.contactPhoneNumber)

    const lastMessages = await Promise.all(
      numbers.map(n =>
        prisma.whatsAppMessage.findFirst({
          where: {
            contactPhoneNumber: n
          },
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            contactPhoneNumber: true,
            createdAt: true,
            text: true,
            type: true
          }
        })
      )
    )

    lastMessages.forEach(lm => {
      const index = finalData.findIndex(
        d => d.contactPhoneNumber === lm?.contactPhoneNumber
      )
      if (finalData[index]) finalData[index]!.createdAt = lm?.createdAt
      if (finalData[index]) finalData[index]!.text = lm?.text ?? ''
      if (finalData[index]) finalData[index]!.type = lm?.type ?? ''
    })

    const [s, u] = await Promise.all([
      prisma.supplier.findMany({
        where: {
          whatsapp: {
            in: numbers
          }
        },
        select: {
          name: true,
          whatsapp: true
        }
      }),
      prisma.user.findMany({
        where: {
          whatsapp: {
            in: numbers
          }
        },
        select: {
          name: true,
          whatsapp: true
        }
      })
    ])

    s.forEach(item => {
      const index = finalData.findIndex(
        d => d.contactPhoneNumber === item.whatsapp
      )
      if (finalData[index]) finalData[index]!.name = item.name
    })
    u.forEach(item => {
      const index = finalData.findIndex(
        d => d.contactPhoneNumber === item.whatsapp
      )
      if (finalData[index]) finalData[index]!.name = item.name || undefined
    })

    return sortBy(finalData, d => d.createdAt).reverse()
  }),

  getContact: protectedProcedure.query(async ({ ctx: { prisma } }) => {
    const [Data, Data2] = await Promise.all([
      prisma.whatsAppMessage.groupBy({
        by: ['contactPhoneNumber']
      }),
      prisma.whatsAppMessage.groupBy({
        by: ['contactPhoneNumber'],
        where: {
          seen: false
        },
        _count: {
          id: true
        }
      })
    ])

    let Dataobj: any = {}

    let FinalData: {
      unseen: number
      name?: string | null
      contactPhoneNumber?: string
      createdAt?: Date
      text?: string | null
      type?: string | null
    }[] = []

    Data2.forEach(item => {
      Dataobj[item.contactPhoneNumber] = item._count.id
    })

    Data.forEach(item => {
      FinalData.push({
        ...item,
        unseen: Dataobj[item.contactPhoneNumber]
      })
    })

    const number = FinalData.map(item => item.contactPhoneNumber)

    const lastNumber = await Promise.all(
      number.map(item => {
        const lastMessage = prisma.whatsAppMessage.findFirst({
          where: {
            contactPhoneNumber: item
          },
          orderBy: {
            createdAt: 'desc'
          },
          select: {
            contactPhoneNumber: true,
            createdAt: true,
            text: true,
            type: true
          }
        })
        return lastMessage
      })
    )

    FinalData = FinalData.map(item => {
      const index = lastNumber.findIndex(
        data => data?.contactPhoneNumber === item.contactPhoneNumber
      )

      return {
        ...item,
        createdAt: lastNumber[index]?.createdAt,
        contactPhoneNumber: lastNumber[index]?.contactPhoneNumber,
        text: lastNumber[index]?.text,
        type: lastNumber[index]?.type
      }
    })

    const [supplier, user] = await Promise.all([
      prisma.supplier.findMany({
        where: {
          whatsapp: {
            in: Data.map(item => item.contactPhoneNumber)
          }
        },
        select: {
          name: true,
          whatsapp: true
        }
      }),
      prisma.user.findMany({
        where: {
          whatsapp: {
            in: Data.map(item => item.contactPhoneNumber)
          }
        },
        select: {
          name: true,
          whatsapp: true
        }
      })
    ])

    FinalData = FinalData.map(item => {
      const supplierData = supplier.find(
        supplier => supplier.whatsapp === item.contactPhoneNumber
      )
      const userData = user.find(
        user => user.whatsapp === item.contactPhoneNumber
      )
      const name = supplierData?.name || userData?.name
      return {
        ...item,
        name: name
      }
    })

    FinalData.sort((a, b) => {
      const unseenCountB = b.unseen || 0
      const unseenCountA = a.unseen || 0
      if (unseenCountB !== unseenCountA) {
        return unseenCountB - unseenCountA
      }

      const createdAtA = a.createdAt || new Date(0)
      const createdAtB = b.createdAt || new Date(0)
      return createdAtB.getTime() - createdAtA.getTime()
    })

    return FinalData
  }),

  getMessages: protectedProcedure
    .input(
      z.object({
        contactPhoneNumber: z.string(),
        skip: z.number().optional()
      })
    )
    .mutation(
      async ({ ctx: { prisma }, input: { contactPhoneNumber, skip } }) => {
        return await prisma.whatsAppMessage.findMany({
          where: {
            contactPhoneNumber
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 20,
          skip
        })
      }
    ),

  updateOne: adminProtectedProcedure
    .input(
      z.object({
        contactPhoneNumber: z.string(),
        seen: z.boolean(),
        messageId: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const { contactPhoneNumber, seen, messageId } = input
      return await prisma.whatsAppMessage.updateMany({
        where: {
          contactPhoneNumber,
          messageId
        },
        data: {
          seen
        }
      })
    })
})
