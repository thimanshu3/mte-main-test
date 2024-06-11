import { Parser } from 'json2csv'
import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'

const create = z.object({
  remarks: z.string().optional(),
  amount: z.number(),
  purchaseOrderId: z.string()
})

export const paymentRequestRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        status: z.enum(['Pending', 'Approved', 'Paid']).optional(),
        search: z.string().optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where = input.search
        ? {
            status: input.status,
            OR: [
              {
                id: input.search
              },
              {
                purchaseOrderId: input.search
              },
              {
                purchaseOrder: {
                  id2: {
                    contains: input.search,
                    mode: 'insensitive' as const
                  }
                }
              },
              {
                purchaseOrder: {
                  supplier: {
                    name: {
                      contains: input.search,
                      mode: 'insensitive' as const
                    }
                  }
                }
              }
            ]
          }
        : {
            status: input.status
          }
      if (input.search && where?.OR && !isNaN(parseInt(input.search))) {
        ;(where as any).OR.push({
          id2: parseFloat(input.search)
        })
        ;(where as any).OR.push({
          amount: parseFloat(input.search)
        })
      }
      const [paymentRequests, total] = await Promise.all([
        prisma.paymentRequest.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          include: {
            purchaseOrder: {
              select: {
                id: true,
                id2: true,
                supplier: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            createdBy: {
              select: {
                id: true,
                name: true
              }
            },
            updatedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        prisma.paymentRequest.count({
          where
        })
      ])
      return { paymentRequests, total }
    }),

  create: adminProtectedProcedure
    .input(create)
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const po = await prisma.purchaseOrder.findFirstOrThrow({
        where: {
          OR: [
            {
              id: input.purchaseOrderId
            },
            {
              id2: input.purchaseOrderId
            }
          ]
        }
      })
      const allPaymentRequests = await prisma.paymentRequest.findMany({
        where: {
          purchaseOrderId: po.id
        }
      })
      const total = parseFloat(
        allPaymentRequests
          .reduce((acc, curr) => acc + curr.amount, 0)
          .toFixed(2)
      )
      console.log(parseFloat((total + input.amount).toFixed(2)), po.totalAmount)
      if (parseFloat((total + input.amount).toFixed(2)) > po.totalAmount) {
        throw new Error(
          'Total amount of payment requests exceeds total amount of purchase order'
        )
      }
      return await prisma.paymentRequest.create({
        data: {
          purchaseOrderId: po.id,
          amount: parseFloat(input.amount.toFixed(2)),
          remarks: input.remarks,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }),

  updateStatus: adminProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(['Pending', 'Approved', 'Paid'])
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      return await prisma.paymentRequest.update({
        where: {
          id: input.id
        },
        data: {
          status: input.status
        }
      })
    }),

  exportCSV: adminProtectedProcedure.mutation(async ({ ctx: { prisma } }) => {
    const paymentRequests = await prisma.paymentRequest.findMany({
      include: {
        purchaseOrder: {
          select: {
            id: true,
            id2: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true
          }
        },
        updatedBy: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const csv: any = []

    paymentRequests.forEach(paymentRequest => {
      csv.push({
        Id: paymentRequest.id2,
        'Purchase Order Id': paymentRequest.purchaseOrder.id2,
        Supplier: paymentRequest.purchaseOrder.supplier.name,
        Amount: paymentRequest.amount,
        Status: paymentRequest.status,
        Remarks: paymentRequest.remarks,
        'Created By': paymentRequest.createdBy.name,
        'Updated By': paymentRequest.updatedBy.name,
        'Created At': paymentRequest.createdAt,
        'Updated At': paymentRequest.updatedAt
      })
    })

    const parser = new Parser()
    const c = parser.parse(csv)

    const f = await storageClient.addFile({
      data: c,
      filename: `payment-requests-${Date.now()}.csv`
    })

    return f
  })
})
