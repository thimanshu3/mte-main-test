import { Prisma } from '@prisma/client'
import dayjs from 'dayjs'
import { parseAsync } from 'json2csv'
import { z } from 'zod'
import {
  createTRPCRouter,
  protectedProcedure,
  rawProtectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'
import { formatDate } from '~/utils/formatDate'
import { getIdStart } from '~/utils/getIdStart'
import { htmlToPdf } from '~/utils/htmlToPdf'
import { salesTemplate } from './pdfTemplate'

const procedureMutateLocal = rawProtectedProcedure(['ADMIN', 'USER'])

export const salesRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        currencyId: z.string().optional(),
        stage: z
          .enum(['Pending', 'Open', 'Invoice', 'Closed', 'Cancelled'])
          .optional(),
        approved: z.boolean().optional(),
        sortBy: z.enum(['date', 'createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.SalesOrderWhereInput = {
        OR: [
          {
            id: {
              contains: input.search,
              mode: 'insensitive'
            }
          },
          {
            id2: {
              contains: input.search,
              mode: 'insensitive'
            }
          },
          {
            prNumberAndName: {
              contains: input.search,
              mode: 'insensitive'
            }
          },
          {
            referenceId: {
              contains: input.search,
              mode: 'insensitive'
            }
          },
          {
            customer: {
              name: {
                contains: input.search,
                mode: 'insensitive'
              }
            }
          },
          {
            site: {
              name: {
                contains: input.search,
                mode: 'insensitive'
              }
            }
          }
        ],
        stage: input.stage,
        approved: input.approved,
        currencyId: input.currencyId
      }
      const [salesOrders, total] = await Promise.all([
        prisma.salesOrder.findMany({
          where,
          orderBy: {
            [input.sortBy || 'date']: input.sortOrder || 'desc'
          },
          include: {
            representativeUser: {
              select: {
                id: true,
                name: true
              }
            },
            customer: {
              select: {
                id: true,
                name: true
              }
            },
            currency: {
              select: {
                id: true,
                name: true,
                symbol: true
              }
            },
            site: {
              select: {
                id: true,
                name: true
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
            },
            _count: {
              select: {
                items: true
              }
            }
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit
        }),
        prisma.salesOrder.count({
          where
        })
      ])
      return { salesOrders, total }
    }),

  getOne: protectedProcedure
    .input(z.string())
    .query(async ({ ctx: { prisma }, input }) => {
      const so = await prisma.salesOrder.findUniqueOrThrow({
        where: {
          id: input
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true
            }
          },
          site: {
            select: {
              id: true,
              name: true
            }
          },
          currency: {
            select: {
              id: true,
              name: true,
              symbol: true
            }
          },
          items: {
            include: {
              inquiry: {
                select: {
                  id: true,
                  id2: true,
                  supplierId: true,
                  supplierPrice: true,
                  purchaseDescription: true,
                  purchaseUnitId: true,
                  hsnCode: true,
                  gstRateId: true,
                  estimatedDeliveryDays: true
                }
              },
              purchaseOrderItems: {
                select: {
                  id: true,
                  inventoryItem: {
                    select: {
                      id: true,
                      quantity: true,
                      quantityGone: true
                    }
                  }
                }
              },
              invoiceItems: {
                select: {
                  id: true,
                  quantity: true
                }
              }
            }
          },
          expenses: true,
          purchaseOrders: {
            select: {
              id: true,
              id2: true,
              date: true,
              supplier: {
                select: {
                  id: true,
                  name: true
                }
              },
              _count: {
                select: {
                  items: true
                }
              },
              totalAmount: true
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
        }
      })

      const invoices = await prisma.invoice.findMany({
        where: {
          items: {
            some: {
              salesOrderItemId: {
                in: so.items.map(i => i.id)
              }
            }
          }
        },
        select: {
          id: true,
          id2: true,
          date: true,
          total: true,
          _count: {
            select: {
              items: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
          createdAt: true
        }
      })

      const draftInvoices = await prisma.invoice2.findMany({
        where: {
          items: {
            some: {
              salesOrderItemId: {
                in: so.items.map(i => i.id)
              }
            }
          }
        },
        select: {
          id: true,
          date: true,
          total: true,
          _count: {
            select: {
              items: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
          createdAt: true
        }
      })

      return { so, invoices, draftInvoices }
    }),

  getSites: procedureMutateLocal
    .input(
      z.object({
        customerId: z.string()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const submittedStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'submitted')?.id
      if (!submittedStatusId)
        throw new Error('No inquiry "submitted" status found')
      const siteIds = (
        await prisma.inquiry.groupBy({
          by: ['siteId'],
          where: {
            customerId: input.customerId,
            statusId: submittedStatusId,
            supplierId: {
              not: null
            },
            inquiryToSupplierDate: {
              not: null
            },
            supplierOfferDate: {
              not: null
            },
            supplierPrice: {
              not: null
            },
            customerPrice: {
              not: null
            },
            margin: {
              not: null
            },
            offerSubmissionDate: {
              not: null
            },
            salesOrderItem: null,
            salesDescription: {
              not: null
            },
            salesUnitId: {
              not: null
            },
            quantity: {
              not: null
            },
            resultId: null,
            deletedAt: null
          },
          skip: 0,
          take: 500,
          _count: {
            siteId: true
          },
          orderBy: {
            _count: {
              siteId: 'desc'
            }
          }
        })
      )
        .map(s => s.siteId)
        .filter(id => !!id) as string[]
      if (!siteIds.length) return []
      return await prisma.site.findMany({
        where: {
          id: {
            in: siteIds
          }
        },
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      })
    }),

  getPrNumber: procedureMutateLocal
    .input(
      z.object({
        customerId: z.string(),
        siteId: z.string().optional().nullable()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const submittedStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'submitted')?.id
      if (!submittedStatusId)
        throw new Error('No inquiry "submitted" status found')
      return (
        await prisma.inquiry.groupBy({
          by: ['prNumberAndName'],
          where: {
            customerId: input.customerId,
            siteId: input.siteId,
            statusId: submittedStatusId,
            supplierId: {
              not: null
            },
            inquiryToSupplierDate: {
              not: null
            },
            supplierOfferDate: {
              not: null
            },
            supplierPrice: {
              not: null
            },
            customerPrice: {
              not: null
            },
            margin: {
              not: null
            },
            offerSubmissionDate: {
              not: null
            },
            salesOrderItem: null,
            salesDescription: {
              not: null
            },
            salesUnitId: {
              not: null
            },
            quantity: {
              not: null
            },
            resultId: null,
            deletedAt: null
          },
          orderBy: {
            prNumberAndName: 'asc'
          },
          skip: 0,
          take: 500
        })
      )
        .map(i => i.prNumberAndName)
        .filter(pr => !!pr) as string[]
    }),

  getInquiries: procedureMutateLocal
    .input(
      z.object({
        customerId: z.string(),
        siteId: z.string().optional().nullable(),
        prNumberAndName: z.string().optional().nullable()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const submittedStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'submitted')?.id
      if (!submittedStatusId)
        throw new Error('No inquiry "submitted" status found')
      return await prisma.inquiry.findMany({
        where: {
          customerId: input.customerId,
          siteId: input.siteId,
          prNumberAndName: input.prNumberAndName,
          statusId: submittedStatusId,
          supplierId: {
            not: null
          },
          inquiryToSupplierDate: {
            not: null
          },
          supplierOfferDate: {
            not: null
          },
          supplierPrice: {
            not: null
          },
          customerPrice: {
            not: null
          },
          margin: {
            not: null
          },
          offerSubmissionDate: {
            not: null
          },
          salesOrderItem: null,
          salesDescription: {
            not: null
          },
          salesUnitId: {
            not: null
          },
          quantity: {
            not: null
          },
          resultId: null,
          deletedAt: null
        },
        select: {
          id: true,
          id2: true,
          date: true,
          site: {
            select: {
              id: true,
              name: true
            }
          },
          prNumberAndName: true,
          salesDescription: true,
          salesUnit: {
            select: {
              id: true,
              name: true
            }
          },
          quantity: true,
          size: true,
          customerPrice: true,
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          purchaseDescription: true,
          purchaseUnit: {
            select: {
              id: true,
              name: true
            }
          },
          supplierPrice: true,
          margin: true,
          frontPersonRepresentative: {
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
    }),

  createOne: procedureMutateLocal
    .input(
      z.object({
        date: z.date(),
        representativeUserId: z.string(),
        referenceId: z.string().optional().nullable(),
        customerId: z.string(),
        currencyId: z.string(),
        siteId: z.string().optional().nullable(),
        prNumberAndName: z.string().optional().nullable(),
        lineItems: z
          .array(
            z.object({
              inquiryId: z.string().optional(),
              itemId: z.string().optional(),
              description: z.string(),
              size: z.string().optional(),
              unitId: z.string(),
              price: z.number(),
              quantity: z.number()
            })
          )
          .min(1),
        expenses: z.array(
          z.object({
            id: z.string().optional().nullable(),
            description: z.string().min(1),
            price: z.number().min(0)
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const submittedStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'submitted')?.id
      if (!submittedStatusId)
        throw new Error('No inquiry "submitted" status found')
      const orderedResultId = (
        await prisma.inquiryResult.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'ordered')?.id
      if (!orderedResultId) throw new Error('No inquiry "ordered" result found')

      const start = getIdStart(input.date)

      const lastOne = await prisma.salesOrder.findFirst({
        where: {
          date: {
            gte: start.dateRange.startDate,
            lte: start.dateRange.endDate
          }
        },
        orderBy: {
          counter: 'desc'
        },
        select: {
          id2: true
        }
      })

      let newId2 = `SO${start.itemIdStart}000001`
      if (lastOne?.id2) {
        const lastNum = parseInt(lastOne.id2.slice(6) || '0')
        newId2 = `SO${start.itemIdStart}${(lastNum + 1)
          .toString()
          .padStart(6, '0')}`
      }

      const lastSOIOne = await prisma.salesOrderItem.findFirst({
        where: {
          itemId: {
            startsWith: '0000'
          }
        },
        orderBy: {
          counter: 'desc'
        }
      })

      let count = lastSOIOne?.counter || 0

      const [salesOrder] = await Promise.all([
        prisma.salesOrder.create({
          data: {
            id2: newId2,
            date: input.date,
            representativeUserId: input.representativeUserId,
            referenceId: input.referenceId,
            currencyId: input.currencyId,
            customerId: input.customerId,
            siteId: input.siteId,
            prNumberAndName: input.prNumberAndName,
            totalAmount: parseFloat(
              input.lineItems
                .reduce((total, curr) => total + curr.price * curr.quantity, 0)
                .toFixed(2)
            ),
            items: {
              createMany: {
                data: input.lineItems.map(li => {
                  count++
                  return {
                    inquiryId: li.inquiryId,
                    itemId:
                      li.itemId || '0000' + count.toString().padStart(6, '0'),
                    description: li.description,
                    size: li.size,
                    unitId: li.unitId,
                    price: li.price,
                    quantity: li.quantity
                  }
                })
              }
            },
            expenses: {
              createMany: {
                data: input.expenses.map(e => ({
                  description: e.description,
                  price: e.price
                }))
              }
            },
            createdById: session.user.id,
            updatedById: session.user.id
          }
        }),
        prisma.inquiry.updateMany({
          where: {
            id: {
              in: input.lineItems
                .map(li => li.inquiryId)
                .filter(id => !!id) as string[]
            }
          },
          data: {
            resultId: orderedResultId,
            updatedById: session.user.id
          }
        })
      ])

      return salesOrder
    }),

  updateOne: procedureMutateLocal
    .input(
      z.object({
        id: z.string(),
        date: z.date(),
        representativeUserId: z.string(),
        referenceId: z.string().optional().nullable(),
        lineItems: z
          .array(
            z.object({
              id: z.string(),
              description: z.string(),
              size: z.string().optional().nullable(),
              unitId: z.string(),
              price: z.number(),
              quantity: z.number()
            })
          )
          .min(1),
        expenses: z.array(
          z.object({
            id: z.string().optional().nullable(),
            description: z.string().min(1),
            price: z.number().min(0)
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      for (const li of input.lineItems) {
        await prisma.salesOrderItem.update({
          where: {
            id: li.id,
            salesOrderId: input.id
          },
          data: {
            description: li.description,
            size: li.size,
            unitId: li.unitId,
            price: li.price,
            quantity: li.quantity
          }
        })
      }
      for (const e of input.expenses) {
        if (e.id) {
          await prisma.salesOrderExpense.update({
            where: {
              id: e.id,
              salesOrderId: input.id
            },
            data: {
              description: e.description,
              price: e.price
            }
          })
        } else {
          await prisma.salesOrderExpense.create({
            data: {
              description: e.description,
              price: e.price,
              salesOrderId: input.id
            }
          })
        }
      }
      return await prisma.salesOrder.update({
        where: {
          id: input.id
        },
        data: {
          date: input.date,
          representativeUserId: input.representativeUserId,
          referenceId: input.referenceId,
          totalAmount: parseFloat(
            input.lineItems
              .reduce((total, curr) => total + curr.price * curr.quantity, 0)
              .toFixed(2)
          ),
          updatedById: session.user.id
        }
      })
    }),

  approve: procedureMutateLocal
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      await prisma.salesOrder.update({
        where: {
          id: input.id
        },
        data: {
          approved: true
        }
      })
    }),

  generatePdf: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx: { prisma }, input }) => {
      const salesOrder = await prisma.salesOrder.findUniqueOrThrow({
        where: {
          id: input.id
        },
        include: {
          currency: {
            select: {
              id: true,
              name: true,
              symbol: true
            }
          },
          customer: {
            select: {
              id2: true,
              name: true,
              address: true
            }
          },
          representativeUser: {
            select: {
              name: true,
              email: true,
              mobile: true
            }
          },
          purchaseOrders: {
            include: {
              supplier: {
                select: {
                  name: true,
                  email: true,
                  email2: true,
                  email3: true,
                  gst: true,
                  address: true
                }
              },
              shippingAddress: {
                select: {
                  line1: true,
                  line2: true,
                  personName: true,
                  personMobile: true
                }
              }
            }
          },
          items: {
            include: {
              unit: {
                select: {
                  id: true,
                  name: true
                }
              },
              purchaseOrderItems: true
            }
          },
          expenses: true
        }
      })

      const Orderitems = salesOrder.items.map((item, i) => {
        return {
          i: i + 1,
          sku: item.itemId,
          name: item.description,
          quantity: item.quantity,
          unit: item.unit.name,
          price: item.price.toLocaleString('en-IN', {
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          total: parseFloat(
            (item.price * item.quantity).toFixed(2)
          ).toLocaleString('en-IN', {
            currency: 'INR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
        }
      })

      const totalAmountPrice = salesOrder.items.reduce(
        (total, curr) => total + curr.price * curr.quantity,
        0
      )

      const html = salesTemplate({
        type: 'Sales',
        id: salesOrder.id2,
        project: salesOrder?.customer.id2,
        ref: salesOrder.referenceId,
        custumerName: salesOrder.customer.name,
        custumerAddress: salesOrder.customer.address,
        approved: salesOrder.approved ? 'Approved' : 'Pending',
        date: dayjs(salesOrder.date).format('DD/MM/YYYY'),
        repName: salesOrder.representativeUser.name,
        repEmail: salesOrder.representativeUser.email,
        repMobile: salesOrder.representativeUser.mobile,
        currency: salesOrder.currency?.name,
        currencySymbol: salesOrder.currency?.symbol,
        // supplierName: salesOrder.purchaseOrders[0]?.supplier.name,
        // supplierGST: salesOrder.purchaseOrders[0]?.supplier.gst,
        // supplierAddress: salesOrder.purchaseOrders[0]?.supplier.address,
        data: salesOrder.date.toUTCString(),
        items: Orderitems,
        totalItemsAmount: salesOrder.totalAmount.toLocaleString('en-IN', {
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        totalAmount: parseFloat(
          salesOrder.totalAmount.toFixed(2)
        ).toLocaleString('en-IN', {
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        totalRoundOff: parseFloat(
          Math.round(salesOrder.totalAmount).toFixed(2)
        ).toLocaleString('en-IN', {
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        addressLine1: salesOrder.purchaseOrders[0]?.shippingAddress?.line1,
        addressLine2: salesOrder.purchaseOrders[0]?.shippingAddress?.line2,
        personName: salesOrder.purchaseOrders[0]?.shippingAddress?.personName,
        personMobile:
          salesOrder.purchaseOrders[0]?.shippingAddress?.personMobile,
        comments:
          salesOrder.purchaseOrders[0]?.comments
            ?.split('\n')
            .map(c => ({ c })) || [],
        totalAmountPrice: totalAmountPrice.toLocaleString('en-IN', {
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
        // totalItems: salesOrder.items.length,
        // totalAmount: salesOrder.totalAmount
      })
      const filename = `Sales Order #${salesOrder.id2}-${Date.now()}.pdf`
      const pdf = await htmlToPdf(html)

      const url = await storageClient.addFile({
        data: pdf,
        filename
      })

      await prisma.attachment.create({
        data: {
          originalFilename: filename,
          newFilename: filename,
          url
        }
      })

      return { url }
    }),

  export: protectedProcedure
    .input(
      z.object({
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const orders = await prisma.salesOrder.findMany({
        orderBy: {
          date: 'desc'
        },
        include: {
          representativeUser: {
            select: {
              id: true,
              name: true
            }
          },
          currency: {
            select: {
              id: true,
              name: true,
              symbol: true
            }
          },
          customer: {
            select: {
              id: true,
              name: true
            }
          },
          site: {
            select: {
              id: true,
              name: true
            }
          },
          items: {
            include: {
              unit: {
                select: {
                  id: true,
                  name: true
                }
              },
              purchaseOrderItems: {
                select: {
                  id: true,
                  quantity: true,
                  inventoryItem: {
                    select: {
                      id: true,
                      quantity: true,
                      quantityGone: true
                    }
                  }
                }
              },
              invoiceItems: {
                select: {
                  id: true,
                  quantity: true
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
        }
      })

      const finalData: any[] = []

      orders.forEach(o => {
        o.items.forEach(i => {
          let poLineStatus = 'Pending'
          if (i.purchaseOrderItems.length) {
            if (
              i.quantity.toFixed(3) ===
              i.purchaseOrderItems
                .reduce((total, poi) => total + poi.quantity, 0)
                .toFixed(3)
            ) {
              poLineStatus = 'Ordered'
            } else {
              poLineStatus = 'Partially Ordered'
            }
          }
          let invQty = 0
          let invLineStatus = 'Pending'
          if (i.invoiceItems.length) {
            invQty = i.invoiceItems.reduce(
              (total, ii) => total + ii.quantity,
              0
            )
            if (i.quantity.toFixed(3) === invQty.toFixed(3)) {
              invLineStatus = 'Invoiced'
            } else {
              invLineStatus = 'Partially Invoiced'
            }
          }
          let currentInventory = 0
          if (i.purchaseOrderItems.length) {
            i.purchaseOrderItems.forEach(poi => {
              if (poi.inventoryItem) {
                currentInventory +=
                  poi.inventoryItem.quantity - poi.inventoryItem.quantityGone
              }
            })
          }
          currentInventory = parseFloat(currentInventory.toFixed(3))
          finalData.push({
            Id: o.id,
            'Order Id': o.id2,
            'Reference Id': o.referenceId,
            Currency: o.currency?.name,
            Date: formatDate(o.date, input.timezoneOffset),
            Customer: o.customer.name,
            Site: o.site?.name,
            'Representative User': o.representativeUser.name,
            'Total Amount': o.totalAmount,
            Stage: o.stage,
            'Purchase Status': poLineStatus,
            'Invoice Status': invLineStatus,
            'Invoice Quantity': invQty,
            'Current Inventory': currentInventory,
            'Inquiry Id': i.inquiryId,
            'Item Id': i.itemId,
            Description: i.description,
            Size: i.size,
            Unit: i.unit.name,
            Price: i.price,
            Quantity: i.quantity,
            'Created By': o.createdBy?.name,
            'Updated By': o.updatedBy?.name,
            'Created At': formatDate(o.createdAt, input.timezoneOffset),
            'Updated At': formatDate(o.updatedAt, input.timezoneOffset)
          })
        })
      })

      const filename = `Sales Orders Export - ${Date.now()}.csv`

      const url = await storageClient.addFile({
        filename,
        data: await parseAsync(finalData)
      })
      return { url }
    }),

  export2: protectedProcedure
    .input(
      z.object({
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const orders = await prisma.salesOrder.findMany({
        orderBy: {
          date: 'desc'
        },
        include: {
          currency: {
            select: {
              id: true,
              name: true,
              symbol: true
            }
          },
          purchaseOrders: {
            include: {
              currency: {
                select: {
                  id: true,
                  name: true,
                  symbol: true
                }
              },
              supplier: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          representativeUser: {
            select: {
              id: true,
              name: true
            }
          },
          customer: {
            select: {
              id: true,
              name: true
            }
          },
          site: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      const finalData: any[] = []

      orders.forEach(o => {
        o.purchaseOrders.forEach(i => {
          finalData.push({
            'Sales Id': o.id,
            'Sales Order Id': o.id2,
            'Sales Order Reference Id': o.referenceId,
            'Sales Order Date': formatDate(o.date, input.timezoneOffset),
            'Sales Currency': o.currency?.name,
            Customer: o.customer.name,
            Site: o.site?.name,
            'Sales Order Stage': o.stage,
            'Purchase Id': i.id,
            'Purchase Order Id': i.id2,
            'Purchase Order Reference Id': i.referenceId,
            'Purchase Order Date': formatDate(i.date, input.timezoneOffset),
            'Purchase Currency': i.currency?.name,
            Supplier: i.supplier.name,
            'Purchase Order Stage': i.stage
          })
        })
      })

      const filename = `Sales Orders with PO Export - ${Date.now()}.csv`

      const url = await storageClient.addFile({
        filename,
        data: await parseAsync(finalData)
      })
      return { url }
    }),

  export3: protectedProcedure
    .input(
      z.object({
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const orders = await prisma.salesOrder.findMany({
        orderBy: {
          date: 'desc'
        },
        include: {
          currency: {
            select: {
              id: true,
              name: true,
              symbol: true
            }
          },
          items: {
            include: {
              purchaseOrderItems: {
                include: {
                  inventoryItem: true
                }
              }
            }
          }
        }
      })

      const finalData: any[] = []

      orders.forEach(o => {
        o.items.forEach(soi => {
          soi.purchaseOrderItems.forEach(poi => {
            finalData.push({
              'Sales Id': o.id,
              'Sales Order Id': o.id2,
              'Sales Order Reference Id': o.referenceId,
              'Sales Order Date': formatDate(o.date, input.timezoneOffset),
              'Sales Item Id': soi.id,
              'Sales Item Id 2': soi.itemId,
              'Sales Item Quantity': soi.quantity,
              'Sales Currency': o.currency?.name,
              'Purchase Order Id': poi.purchaseOrderId,
              'Purchase Order Item Id': poi.id,
              'Purchase Order Item Id 2': poi.itemId,
              'Purchase Order Quantity': poi.quantity,
              'Inventory Quantity': poi.inventoryItem?.quantity,
              'Inventory Quantity Gone': poi.inventoryItem?.quantityGone
            })
          })
        })
      })

      const filename = `Sales Orders with PO Items Export - ${Date.now()}.csv`

      const url = await storageClient.addFile({
        filename,
        data: await parseAsync(finalData)
      })
      return { url }
    }),

  getUninvoicedSalesOrders: protectedProcedure
    .input(
      z.object({
        customerId: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.salesOrder.findMany({
        where: {
          customerId: input.customerId,
          stage: {
            in: ['Pending', 'Open', 'Invoice']
          }
        },
        include: {
          _count: {
            select: {
              items: true
            }
          }
        },
        take: 500,
        orderBy: {
          date: 'desc'
        }
      })
    }),

  getUninvoicedSalesOrderLineItems: protectedProcedure
    .input(z.array(z.string()))
    .query(async ({ ctx: { prisma }, input }) => {
      const lineItems = await prisma.salesOrderItem.findMany({
        where: {
          salesOrderId: {
            in: input
          }
        },
        include: {
          salesOrder: {
            select: {
              id: true,
              id2: true
            }
          },
          invoiceItems: {
            select: {
              id: true,
              quantity: true
            }
          },
          purchaseOrderItems: {
            select: {
              inventoryItem: {
                select: {
                  quantity: true,
                  quantityGone: true
                }
              },
              price: true
            }
          }
        }
      })
      return lineItems.filter(li =>
        li.invoiceItems
          ? parseFloat(
              li.invoiceItems
                .reduce((total, curr) => total + curr.quantity, 0)
                .toFixed(3)
            ) < li.quantity
          : true
      )
    }),

  changeStatus: procedureMutateLocal
    .input(
      z.object({
        id: z.string(),
        stage: z.enum(['Pending', 'Open', 'Invoice', 'Closed', 'Cancelled'])
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      await prisma.salesOrder.update({
        where: {
          id: input.id
        },
        data: {
          stage: input.stage
        }
      })
    })
})
