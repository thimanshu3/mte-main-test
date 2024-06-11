import { Prisma } from '@prisma/client'
import { Workbook } from 'exceljs'
import { readFileSync } from 'fs'
import Handlebars from 'handlebars'
import path from 'path'
import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'
import { formatDate } from '~/utils/formatDate'
import { htmlToPdf } from '~/utils/htmlToPdf'

const expensesPoPdf = Handlebars.compile(
  readFileSync(
    path.join(
      process.cwd(),
      'public',
      'templates',
      'pdfs',
      'expensesPoPdf.hbs'
    ),
    'utf-8'
  )
)

const expensesSoPdf = Handlebars.compile(
  readFileSync(
    path.join(
      process.cwd(),
      'public',
      'templates',
      'pdfs',
      'expensesSoPdf.hbs'
    ),
    'utf-8'
  )
)

export const expensesRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where = input.search
        ? {
            OR: [
              {
                id: input.search
              },
              {
                name: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              }
            ]
          }
        : undefined
      const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          include: {
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
            deletedBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.expense.count({
          where
        })
      ])
      return { expenses, total }
    }),

  getAllMini: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where = input.search
        ? {
            OR: [
              {
                id: input.search
              },
              {
                name: {
                  contains: input.search,
                  mode: 'insensitive' as const
                },
                deletedAt: null
              }
            ]
          }
        : {
            deletedAt: null
          }
      const [expenses, total] = await Promise.all([
        prisma.expense.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            name: true
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.expense.count({
          where
        })
      ])
      return { expenses, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.expense.findUniqueOrThrow({
        where: {
          id: input.id
        },
        include: {
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
          deletedBy: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    }),

  createOrUpdateOne: adminProtectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1)
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (input.id)
        return await prisma.expense.update({
          where: {
            id: input.id
          },
          data: {
            name: input.name,
            updatedById: session.user.id
          }
        })
      return await prisma.expense.create({
        data: {
          name: input.name,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }),

  deleteOne: adminProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        activate: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.expense.update({
        where: {
          id: input.id
        },
        data: input.activate
          ? {
              deletedAt: null,
              deletedById: null
            }
          : {
              deletedAt: new Date(),
              deletedById: session.user.id
            }
      })
    }),

  createPurchaseExpense: adminProtectedProcedure
    .input(
      z.object({
        purchaseOrderId: z.string(),
        description: z.string(),
        price: z.number(),
        gstRateId: z.string().optional().nullable(),
        remarks: z.string().optional().nullable(),
        customId: z.string().optional().nullable(),
        exportInvoiceDate: z.string().optional().nullable(),
        supplierInvoiceNumber: z.string().optional().nullable(),
        exportInvoiceNumber: z.string().optional().nullable(),
        poInvoiceDate: z.string().optional().nullable(),
        voucherDate: z.string().optional().nullable()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.purchaseOrderExpense.create({
        data: {
          ...input,
          showInFulfilment: false,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }),

  createSalesExpense: adminProtectedProcedure
    .input(
      z.object({
        salesOrderId: z.string(),
        description: z.string(),
        price: z.number(),
        remarks: z.string().optional().nullable(),
        customId: z.string().optional().nullable(),
        exportInvoiceDate: z.string().optional().nullable(),
        supplierInvoiceNumber: z.string().optional().nullable(),
        exportInvoiceNumber: z.string().optional().nullable(),
        poInvoiceDate: z.string().optional().nullable(),
        voucherDate: z.string().optional().nullable()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.salesOrderExpense.create({
        data: {
          ...input,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }),

  getAllExpensePo: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        dateRange: z
          .object({
            startDate: z.string(),
            endDate: z.string()
          })
          .optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.PurchaseOrderExpenseWhereInput = input.search
        ? {
            createdAt: input?.dateRange
              ? {
                  gte: input?.dateRange?.startDate,
                  lte: input?.dateRange?.endDate
                }
              : undefined,
            OR: [
              {
                id: input.search
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
                createdBy: {
                  name: {
                    contains: input.search,
                    mode: 'insensitive' as const
                  }
                }
              },
              {
                purchaseOrder: {
                  id2: {
                    contains: input.search,
                    mode: 'insensitive' as const
                  }
                }
              }
            ]
          }
        : {
            createdAt: input?.dateRange
              ? {
                  gte: input?.dateRange?.startDate,
                  lte: input?.dateRange?.endDate
                }
              : undefined
          }

      const [expenses, total] = await Promise.all([
        prisma.purchaseOrderExpense.findMany({
          where,
          orderBy: {
            [input.sortBy || 'createdAt']: input.sortOrder || 'desc'
          },
          include: {
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
            deletedBy: {
              select: {
                id: true,
                name: true
              }
            },
            purchaseOrder: true
          }
        }),
        prisma.purchaseOrderExpense.count({
          where
        })
      ])
      return { expenses, total }
    }),

  getOnePo: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.purchaseOrderExpense.findUnique({
        where: {
          id: input.id
        },
        include: {
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
          purchaseOrder: true
        }
      })
    }),

  getAllExpenseSo: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        dateRange: z
          .object({
            startDate: z.string(),
            endDate: z.string()
          })
          .optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.SalesOrderExpenseWhereInput = input.search
        ? {
            createdAt: input?.dateRange
              ? {
                  gte: input?.dateRange?.startDate,
                  lte: input?.dateRange?.endDate
                }
              : undefined,
            OR: [
              {
                id: input.search
              },
              {
                salesOrder: {
                  id: {
                    contains: input.search,
                    mode: 'insensitive' as const
                  }
                }
              }
            ]
          }
        : {
            createdAt: input?.dateRange
              ? {
                  gte: input?.dateRange?.startDate,
                  lte: input?.dateRange?.endDate
                }
              : undefined
          }

      const [expenses, total] = await Promise.all([
        prisma.salesOrderExpense.findMany({
          where,
          orderBy: {
            [input.sortBy || 'createdAt']: input.sortOrder || 'desc'
          },
          include: {
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
            deletedBy: {
              select: {
                id: true,
                name: true
              }
            },
            salesOrder: true
          }
        }),
        prisma.salesOrderExpense.count({
          where
        })
      ])
      return { expenses, total }
    }),

  getOneSo: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.salesOrderExpense.findUnique({
        where: {
          id: input.id
        },
        include: {
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
          salesOrder: true
        }
      })
    }),

  generateExpensePoPdf: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const expense = await prisma.purchaseOrderExpense.findUnique({
        where: {
          id: input.id
        },
        include: {
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
          purchaseOrder: true
        }
      })

      const totalPrice = expense?.price

      let html = expensesPoPdf({
        id: expense?.id,
        voucherDate: formatDate(
          expense?.voucherDate as Date,
          input.timezoneOffset
        ),
        voucherNumber: expense?.customId,
        invoiceNumber: expense?.exportInvoiceNumber,
        remarks: expense?.remarks,
        particulars: expense?.description,
        debit: expense?.price,
        credit: 0,
        total: totalPrice
      })

      const pdf = await htmlToPdf(html)

      const url = await storageClient.addFile({
        data: pdf,
        filename: `expense-po-${expense?.id}-${Date.now()}.pdf`
      })
      return url
    }),

  generateExpenseSoPdf: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const expense = await prisma.salesOrderExpense.findUnique({
        where: {
          id: input.id
        },
        include: {
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
          salesOrder: true
        }
      })

      const totalPrice = expense?.price

      let html = expensesSoPdf({
        id: expense?.id,
        voucherDate: formatDate(
          expense?.voucherDate as Date,
          input.timezoneOffset
        ),
        voucherNumber: expense?.customId,
        invoiceNumber: expense?.exportInvoiceNumber,
        remarks: expense?.remarks,
        particulars: expense?.description,
        debit: expense?.price,
        credit: 0,
        total: totalPrice
      })

      const pdf = await htmlToPdf(html)

      const url = await storageClient.addFile({
        data: pdf,
        filename: `expense-so-${expense?.id}-${Date.now()}.pdf`
      })
      return url
    }),

  deletePurchaseOrderExpense: adminProtectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      return await prisma.purchaseOrderExpense.delete({
        where: {
          id: input.id
        }
      })
    }),

  inActivePurchaseOrderExpense: adminProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        activate: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.purchaseOrderExpense.update({
        where: {
          id: input.id
        },
        data: input.activate
          ? {
              deletedAt: null,
              deletedById: null
            }
          : {
              deletedAt: new Date(),
              deletedById: session.user.id
            }
      })
    }),

  inActiveSalesOrderExpense: adminProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        activate: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.salesOrderExpense.update({
        where: {
          id: input.id
        },
        data: input.activate
          ? {
              deletedAt: null,
              deletedById: null
            }
          : {
              deletedAt: new Date(),
              deletedById: session.user.id
            }
      })
    }),

  deleteSalesOrderExpense: adminProtectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      return await prisma.salesOrderExpense.delete({
        where: {
          id: input.id
        }
      })
    }),

  exportPurchseOrderExpense: protectedProcedure
    .input(
      z.object({
        timezoneOffset: z.number(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.PurchaseOrderExpenseWhereInput = input?.dateRange
        ? {
            createdAt: {
              gte: input?.dateRange?.startDate,
              lte: input?.dateRange?.endDate
            }
          }
        : {
            AND: [
              {
                createdAt: {
                  gte: input?.dateRange?.startDate
                }
              },
              {
                createdAt: {
                  lte: input?.dateRange?.endDate
                }
              }
            ]
          }

      let skip = 0
      const take = 1000
      const allSalesCollection: any[] = []
      while (skip < 10000) {
        const purchaseOrderExpense = await prisma.purchaseOrderExpense.findMany(
          {
            where,
            include: {
              purchaseOrder: {
                select: {
                  id2: true
                }
              }
            },
            skip,
            take
          }
        )
        if (!purchaseOrderExpense.length) break
        for (let i = 0; i < purchaseOrderExpense.length; i++) {
          const purchaseOrderExpenses = purchaseOrderExpense[i]
          if (!purchaseOrderExpenses) continue
          allSalesCollection.push({
            srno: i + 1 + skip,
            ...purchaseOrderExpenses
          })
        }
        skip += take
      }
      const book = new Workbook()
      const sheet = book.addWorksheet('Purchase Order Expenses')

      sheet.columns = [
        { header: 'ORDER NO', key: 'id2', width: 32 },
        { header: 'CUSTOM ID', key: 'customId', width: 10 },
        { header: 'EXPORT INVOICE NO.', key: 'exportInvoiceNumber', width: 10 },
        { header: 'VOUCHER DATE', key: 'voucherDate', width: 32 },
        { header: 'EXPENSES', key: 'description', width: 32 },
        { header: 'PRICE', key: 'price', width: 32 },
        { header: 'CREATED AT', key: 'createdAt', width: 32 }
      ]
      sheet.addRows(
        allSalesCollection.map(als => ({
          ...als,
          id2: als.purchaseOrder.id2
        }))
      )

      const headerRow = sheet.getRow(1)
      headerRow.eachCell(cell => {
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' }
        }
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
      headerRow.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      }
      const buffer = await book.xlsx.writeBuffer()

      const filename = `purchaseOrderExpenses-${Date.now()}.xlsx`
      const url = await storageClient.addFile({
        filename,
        data: Buffer.from(buffer)
      })

      await prisma.attachment.create({
        data: {
          newFilename: filename,
          originalFilename: filename,
          url
        }
      })

      return {
        url
      }
    }),

  exportSalesOrderExpense: protectedProcedure
    .input(
      z.object({
        timezoneOffset: z.number(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.SalesOrderExpenseWhereInput = input?.dateRange
        ? {
            createdAt: {
              gte: input?.dateRange?.startDate,
              lte: input?.dateRange?.endDate
            }
          }
        : {
            AND: [
              {
                createdAt: {
                  gte: input?.dateRange?.startDate
                }
              },
              {
                createdAt: {
                  lte: input?.dateRange?.endDate
                }
              }
            ]
          }

      let skip = 0
      const take = 1000
      const allSalesCollection: any[] = []
      while (skip < 10000) {
        const salesOrderExpense = await prisma.salesOrderExpense.findMany({
          where,
          include: {
            salesOrder: {
              select: {
                id2: true
              }
            }
          },
          skip,
          take
        })
        if (!salesOrderExpense.length) break
        for (let i = 0; i < salesOrderExpense.length; i++) {
          const salesOrderExpenses = salesOrderExpense[i]
          if (!salesOrderExpenses) continue
          allSalesCollection.push({
            srno: i + 1 + skip,
            ...salesOrderExpenses
          })
        }
        skip += take
      }
      const book = new Workbook()
      const sheet = book.addWorksheet('Sales Order Expenses')

      sheet.columns = [
        { header: 'ORDER NO', key: 'id2', width: 32 },
        { header: 'CUSTOM ID', key: 'customId', width: 10 },
        { header: 'EXPORT INVOICE NO.', key: 'exportInvoiceNumber', width: 10 },
        { header: 'VOUCHER DATE', key: 'voucherDate', width: 32 },
        { header: 'EXPENSES', key: 'description', width: 32 },
        { header: 'PRICE', key: 'price', width: 32 },
        { header: 'CREATED AT', key: 'createdAt', width: 32 }
      ]
      sheet.addRows(
        allSalesCollection.map(als => ({
          ...als,
          id2: als.salesOrder.id2
        }))
      )

      const headerRow = sheet.getRow(1)
      headerRow.eachCell(cell => {
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' }
        }
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
      headerRow.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      }
      const buffer = await book.xlsx.writeBuffer()

      const filename = `salesOrderExpenses-${Date.now()}.xlsx`
      const url = await storageClient.addFile({
        filename,
        data: Buffer.from(buffer)
      })

      await prisma.attachment.create({
        data: {
          newFilename: filename,
          originalFilename: filename,
          url
        }
      })

      return {
        url
      }
    })
})
