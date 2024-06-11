import { Workbook, Worksheet } from 'exceljs'
import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure,
  rawProtectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'
import { getIdStart } from '~/utils/getIdStart'

const createInput = z.object({
  date: z.date().optional(),
  customerId: z.string(),
  siteId: z.string().optional().nullable(),
  prNumberAndName: z.string().optional().nullable(),
  salesDescription: z.string().optional().nullable(),
  salesUnitId: z.string().optional().nullable(),
  quantity: z.number().optional().nullable(),
  size: z.string().optional().nullable(),
  frontPersonRepresentativeId: z.string(),
  purchaseDescription: z.string().optional().nullable(),
  purchaseUnitId: z.string().optional().nullable(),
  gstRateId: z.string().optional().nullable(),
  hsnCode: z.string().max(8).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  inquiryToSupplierDate: z.date().optional().nullable(),
  supplierPrice: z.number().optional().nullable(),
  supplierOfferDate: z.date().optional().nullable(),
  estimatedDeliveryDays: z.number().int().optional().nullable(),
  margin: z.number().optional().nullable(),
  customerPrice: z.number().optional().nullable(),
  offerSubmissionDate: z.date().optional().nullable(),
  statusId: z.string().optional().nullable(),
  resultId: z.string().optional().nullable(),
  cancelReasonId: z.string().optional().nullable(),
  shopDrawing: z.boolean().optional().nullable(),
  remarks: z.string().optional().nullable(),
  attachmentIds: z.array(z.string()).optional().nullable(),
  emailForSupplierRemarks: z.string().optional().nullable(),
  emailForCustomerRemarks: z.string().optional().nullable(),
  sapCode: z.string().optional().nullable(),
  supplierCurrencyId: z.string().optional().nullable(),
  customerCurrencyId: z.string().optional().nullable(),
  imageId: z.string().optional().nullable()
})
const updateInput = z.object({
  id: z.string(),
  date: z.date().optional(),
  customerId: z.string().optional(),
  siteId: z.string().optional().nullable(),
  prNumberAndName: z.string().optional().nullable(),
  salesDescription: z.string().optional().nullable(),
  salesUnitId: z.string().optional().nullable(),
  quantity: z.number().optional().nullable(),
  size: z.string().optional().nullable(),
  frontPersonRepresentativeId: z.string().optional(),
  purchaseDescription: z.string().optional().nullable(),
  purchaseUnitId: z.string().optional().nullable(),
  gstRateId: z.string().optional().nullable(),
  hsnCode: z.string().max(8).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  inquiryToSupplierDate: z.date().optional().nullable(),
  supplierPrice: z.number().optional().nullable(),
  supplierOfferDate: z.date().optional().nullable(),
  estimatedDeliveryDays: z.number().int().optional().nullable(),
  margin: z.number().optional().nullable(),
  customerPrice: z.number().optional().nullable(),
  offerSubmissionDate: z.date().optional().nullable(),
  statusId: z.string().optional().nullable(),
  resultId: z.string().optional().nullable(),
  cancelReasonId: z.string().optional().nullable(),
  shopDrawing: z.boolean().optional().nullable(),
  remarks: z.string().optional().nullable(),
  attachmentIds: z.array(z.string()).optional().nullable(),
  emailForSupplierRemarks: z.string().optional().nullable(),
  emailForCustomerRemarks: z.string().optional().nullable(),
  sapCode: z.string().optional().nullable(),
  supplierCurrencyId: z.string().optional().nullable(),
  customerCurrencyId: z.string().optional().nullable(),
  imageId: z.string().optional().nullable()
})

const procedureGetLocal = rawProtectedProcedure([
  'ADMIN',
  'ADMINVIEWER',
  'USER',
  'USERVIEWER'
])
const procedureMutateLocal = rawProtectedProcedure(['ADMIN', 'USER'])

export const inquiriesRouter = createTRPCRouter({
  getAll: procedureGetLocal
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        customerId: z.string().optional(),
        siteId: z.string().optional().nullable(),
        frontPersonRepresentativeId: z.string().optional(),
        supplierId: z.string().optional().nullable(),
        statusId: z.string().optional().nullable(),
        resultId: z.string().optional().nullable(),
        cancelReasonId: z.string().optional().nullable(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        inquiryToSupplierDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        supplierOfferDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        offerSubmissionDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        prNumberAndName: z.string().optional().nullable(),
        sortBy: z.enum(['date', 'createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
      })
    )
    .query(async ({ ctx: { session, prisma }, input }) => {
      const where = {
        customerId: input.customerId,
        siteId: input.siteId,
        frontPersonRepresentativeId: ['USER', 'USERVIEWER'].includes(
          session.user.role
        )
          ? session.user.id
          : input.frontPersonRepresentativeId,
        supplierId: input.supplierId,
        statusId: input.statusId,
        resultId: input.resultId,
        cancelReasonId: input.cancelReasonId,
        date: input.dateRange
          ? {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            }
          : undefined,
        inquiryToSupplierDate: input.inquiryToSupplierDateRange
          ? {
              gte: input.inquiryToSupplierDateRange.startDate,
              lte: input.inquiryToSupplierDateRange.endDate
            }
          : undefined,
        supplierOfferDate: input.supplierOfferDateRange
          ? {
              gte: input.supplierOfferDateRange.startDate,
              lte: input.supplierOfferDateRange.endDate
            }
          : undefined,
        offerSubmissionDate: input.offerSubmissionDateRange
          ? {
              gte: input.offerSubmissionDateRange.startDate,
              lte: input.offerSubmissionDateRange.endDate
            }
          : undefined,
        prNumberAndName: input.prNumberAndName,
        OR: input.search
          ? [
              {
                id: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              },
              {
                id2: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              }
            ]
          : undefined,
        deletedAt: null
      }
      const [inquiries, total] = await Promise.all([
        prisma.inquiry.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          orderBy: {
            [input.sortBy || 'createdAt']: input.sortOrder || 'desc'
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
            frontPersonRepresentative: {
              select: {
                id: true,
                name: true
              }
            },
            supplier: {
              select: {
                id: true,
                name: true
              }
            },
            status: {
              select: {
                id: true,
                name: true
              }
            },
            result: {
              select: {
                id: true,
                name: true
              }
            },
            cancelReason: {
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
            }
          }
        }),
        prisma.inquiry.count({
          where
        })
      ])
      return { inquiries, total }
    }),

  getPrNumber: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        customerId: z.string().optional(),
        siteId: z.string().optional().nullable(),
        frontPersonRepresentativeId: z.string().optional(),
        supplierId: z.string().optional().nullable(),
        statusId: z.string().optional().nullable(),
        resultId: z.string().optional().nullable(),
        cancelReasonId: z.string().optional().nullable(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        inquiryToSupplierDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        supplierOfferDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        offerSubmissionDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return (
        await prisma.inquiry.groupBy({
          by: ['prNumberAndName'],
          where: {
            customerId: input.customerId,
            siteId: input.siteId,
            frontPersonRepresentativeId: input.frontPersonRepresentativeId,
            supplierId: input.supplierId,
            statusId: input.statusId,
            resultId: input.resultId,
            cancelReasonId: input.cancelReasonId,
            date: input.dateRange
              ? {
                  gte: input.dateRange.startDate,
                  lte: input.dateRange.endDate
                }
              : undefined,
            inquiryToSupplierDate: input.inquiryToSupplierDateRange
              ? {
                  gte: input.inquiryToSupplierDateRange.startDate,
                  lte: input.inquiryToSupplierDateRange.endDate
                }
              : undefined,
            supplierOfferDate: input.supplierOfferDateRange
              ? {
                  gte: input.supplierOfferDateRange.startDate,
                  lte: input.supplierOfferDateRange.endDate
                }
              : undefined,
            offerSubmissionDate: input.offerSubmissionDateRange
              ? {
                  gte: input.offerSubmissionDateRange.startDate,
                  lte: input.offerSubmissionDateRange.endDate
                }
              : undefined,
            prNumberAndName: input.search
              ? {
                  contains: input.search,
                  mode: 'insensitive'
                }
              : {
                  not: null
                }
          },
          _count: {
            prNumberAndName: true
          },
          orderBy: {
            _count: {
              prNumberAndName: 'desc'
            }
          },
          skip: 0,
          take: 25
        })
      ).filter(inq => !!inq.prNumberAndName)
    }),

  getOne: procedureGetLocal
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.inquiry.findUniqueOrThrow({
        where: {
          id: input.id
        },
        include: {
          attachments: true,
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
          inquiriesSentToSupplierInquiry: {
            select: {
              inquiriesSentToSupplierId: true
            }
          },
          offerSentToCustomerInquiry: {
            select: {
              inquiriesSentToCustomerId: true
            }
          },
          salesOrderItem: {
            select: {
              salesOrderId: true
            }
          },
          purchaseOrderItem: {
            select: {
              purchaseOrderId: true
            }
          },
          image: {
            select: {
              id: true,
              newFilename: true,
              originalFilename: true,
              url: true
            }
          }
        }
      })
    }),

  createOne: procedureMutateLocal
    .input(createInput)
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const date = input.date || new Date()
      const start = getIdStart(date)
      const lastOne = await prisma.inquiry.findFirst({
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

      let newId2 = `${start.itemIdStart}000001`
      if (lastOne?.id2) {
        const lastNum = parseInt(lastOne.id2.slice(4) || '0')
        newId2 = `${start.itemIdStart}${(lastNum + 1)
          .toString()
          .padStart(6, '0')}`
      }

      const inquiry = await prisma.inquiry.create({
        data: {
          id2: newId2,
          date,
          customerId: input.customerId,
          siteId: input.siteId,
          prNumberAndName: input.prNumberAndName,
          salesDescription: input.salesDescription,
          salesUnitId: input.salesUnitId,
          quantity: input.quantity,
          size: input.size,
          frontPersonRepresentativeId:
            session.user.role === 'ADMIN'
              ? input.frontPersonRepresentativeId
              : session.user.id,
          purchaseDescription: input.purchaseDescription,
          purchaseUnitId: input.purchaseUnitId,
          gstRateId: input.gstRateId,
          hsnCode: input.hsnCode,
          supplierId: input.supplierId,
          inquiryToSupplierDate: input.inquiryToSupplierDate,
          supplierCurrencyId: input.supplierCurrencyId,
          supplierPrice: input.supplierPrice,
          supplierOfferDate: input.supplierOfferDate,
          estimatedDeliveryDays: input.estimatedDeliveryDays,
          margin: input.margin,
          customerCurrencyId: input.customerCurrencyId,
          customerPrice: input.customerPrice,
          offerSubmissionDate: input.offerSubmissionDate,
          statusId: input.statusId,
          resultId: input.resultId,
          cancelReasonId: input.cancelReasonId,
          remarks: input.remarks,
          emailForSupplierRemarks: input.emailForSupplierRemarks,
          emailForCustomerRemarks: input.emailForCustomerRemarks,
          sapCode: input.sapCode,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })

      if (input.attachmentIds) {
        await prisma.attachment.updateMany({
          where: {
            id: {
              in: input.attachmentIds
            }
          },
          data: {
            inquiryId: inquiry.id
          }
        })
      }

      if (input.imageId) {
        await prisma.attachment.update({
          where: {
            id: input.imageId
          },
          data: {
            inquiryImageId: inquiry.id
          }
        })
      }

      return inquiry
    }),

  updateOne: procedureMutateLocal
    .input(updateInput)
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (input.attachmentIds) {
        await prisma.attachment.updateMany({
          where: {
            id: {
              in: input.attachmentIds
            }
          },
          data: {
            inquiryId: input.id
          }
        })
      }

      if (input.imageId) {
        await prisma.attachment.update({
          where: {
            id: input.imageId
          },
          data: {
            inquiryImageId: input.id
          }
        })
      }

      return await prisma.inquiry.update({
        where: {
          id: input.id
        },
        data: {
          date: input.date,
          customerId: input.customerId,
          siteId: input.siteId,
          prNumberAndName: input.prNumberAndName,
          salesDescription: input.salesDescription,
          salesUnitId: input.salesUnitId,
          quantity: input.quantity,
          size: input.size,
          frontPersonRepresentativeId:
            session.user.role === 'ADMIN'
              ? input.frontPersonRepresentativeId
              : session.user.id,
          purchaseDescription: input.purchaseDescription,
          purchaseUnitId: input.purchaseUnitId,
          gstRateId: input.gstRateId,
          hsnCode: input.hsnCode,
          supplierId: input.supplierId,
          inquiryToSupplierDate: input.inquiryToSupplierDate,
          supplierCurrencyId: input.supplierCurrencyId,
          supplierPrice: input.supplierPrice,
          supplierOfferDate: input.supplierOfferDate,
          estimatedDeliveryDays: input.estimatedDeliveryDays,
          margin: input.margin,
          customerCurrencyId: input.customerCurrencyId,
          customerPrice: input.customerPrice,
          offerSubmissionDate: input.offerSubmissionDate,
          statusId: input.statusId,
          resultId: input.resultId,
          cancelReasonId: input.cancelReasonId,
          remarks: input.remarks,
          emailForSupplierRemarks: input.emailForSupplierRemarks,
          emailForCustomerRemarks: input.emailForCustomerRemarks,
          sapCode: input.sapCode,
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
      await prisma.inquiry.update({
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

      return {
        success: true
      }
    }),

  export: procedureGetLocal
    .input(
      z.object({
        search: z.string().optional(),
        customerId: z.string().optional(),
        siteId: z.string().optional().nullable(),
        frontPersonRepresentativeId: z.string().optional(),
        supplierId: z.string().optional().nullable(),
        statusId: z.string().optional().nullable(),
        resultId: z.string().optional().nullable(),
        cancelReasonId: z.string().optional().nullable(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        inquiryToSupplierDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        supplierOfferDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        offerSubmissionDateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        prNumberAndName: z.string().optional().nullable(),
        sortBy: z.enum(['number', 'date', 'createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        view: z.enum(['supplier', 'customer']).nullable().optional(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { session, prisma }, input }) => {
      let skip = 0
      const take = 1000
      const where = {
        customerId: input.customerId,
        siteId: input.siteId,
        frontPersonRepresentativeId: ['USER', 'USERVIEWER'].includes(
          session.user.role
        )
          ? session.user.id
          : input.frontPersonRepresentativeId,
        supplierId: input.supplierId,
        statusId: input.statusId,
        resultId: input.resultId,
        cancelReasonId: input.cancelReasonId,
        prNumberAndName: input.prNumberAndName,
        date: input.dateRange
          ? {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            }
          : undefined,
        inquiryToSupplierDate: input.inquiryToSupplierDateRange
          ? {
              gte: input.inquiryToSupplierDateRange.startDate,
              lte: input.inquiryToSupplierDateRange.endDate
            }
          : undefined,
        supplierOfferDate: input.supplierOfferDateRange
          ? {
              gte: input.supplierOfferDateRange.startDate,
              lte: input.supplierOfferDateRange.endDate
            }
          : undefined,
        offerSubmissionDate: input.offerSubmissionDateRange
          ? {
              gte: input.offerSubmissionDateRange.startDate,
              lte: input.offerSubmissionDateRange.endDate
            }
          : undefined,
        OR: input.search
          ? [
              {
                id: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              },
              {
                id2: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              }
            ]
          : undefined,
        deletedAt: null
      }
      const include = {
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
        purchaseUnit: {
          select: {
            id: true,
            name: true
          }
        },
        salesUnit: {
          select: {
            id: true,
            name: true
          }
        },
        frontPersonRepresentative: {
          select: {
            id: true,
            name: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true
          }
        },
        gstRate: {
          select: {
            id: true,
            rate: true
          }
        },
        status: {
          select: {
            id: true,
            name: true
          }
        },
        result: {
          select: {
            id: true,
            name: true
          }
        },
        cancelReason: {
          select: {
            id: true,
            name: true
          }
        },
        supplierCurrency: {
          select: {
            id: true,
            name: true
          }
        },
        customerCurrency: {
          select: {
            id: true,
            name: true
          }
        },
        image: {
          select: {
            id: true,
            newFilename: true
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
      const orderBy = {
        [input.sortBy || 'createdAt']: input.sortOrder || 'desc'
      }
      const allInquiries: any[] = []

      const fixTimezone = (date: Date) => {
        date.setUTCMinutes(date.getUTCMinutes() - input.timezoneOffset)
        return date
      }

      while (skip < 10000) {
        const inquiries = await prisma.inquiry.findMany({
          where,
          include,
          orderBy,
          skip,
          take
        })
        if (!inquiries.length) break
        for (let i = 0; i < inquiries.length; i++) {
          const inquiry = inquiries[i]
          if (!inquiry) continue

          allInquiries.push({
            sr: skip + i + 1,
            id: inquiry.id,
            id2: inquiry.id2,
            date: fixTimezone(inquiry.date),
            customerName: inquiry.customer.name,
            prNumberAndName: inquiry.prNumberAndName,
            siteRef: inquiry.site?.name,
            salesDescription: inquiry.salesDescription,
            salesUnit: inquiry.salesUnit?.name,
            quantity: inquiry.quantity,
            size: inquiry.size,
            purchaseDescription: inquiry.purchaseDescription,
            purchaseUnit: inquiry.purchaseUnit?.name,
            gstRate: inquiry.gstRate?.rate,
            hsnCode: inquiry.hsnCode,
            inquiryToSupplierDate: inquiry.inquiryToSupplierDate
              ? fixTimezone(inquiry.inquiryToSupplierDate)
              : undefined,
            supplierName: inquiry.supplier?.name,
            supplierOfferDate: inquiry.supplierOfferDate
              ? fixTimezone(inquiry.supplierOfferDate)
              : undefined,
            estimatedDeliveryDays: inquiry.estimatedDeliveryDays,
            supplierCurrency: inquiry.supplierCurrency?.name,
            supplierPrice: inquiry.supplierPrice,
            totalSupplierPrice:
              inquiry.supplierPrice && inquiry.quantity
                ? Math.round(inquiry.supplierPrice * inquiry.quantity)
                : undefined,
            margin: inquiry.margin,
            customerCurrency: inquiry.customerCurrency?.name,
            customerPrice: inquiry.customerPrice,
            totalCustomerPrice:
              inquiry.customerPrice && inquiry.quantity
                ? Math.round(inquiry.customerPrice * inquiry.quantity)
                : undefined,
            status: inquiry.status?.name,
            offerSubmissionDate: inquiry.offerSubmissionDate
              ? fixTimezone(inquiry.offerSubmissionDate)
              : undefined,
            result: inquiry.result?.name,
            cancelReason: inquiry.cancelReason?.name,
            remarks: inquiry.remarks,
            emailForSupplierRemarks: inquiry.emailForSupplierRemarks,
            emailForCustomerRemarks: inquiry.emailForCustomerRemarks,
            sapCode: inquiry.sapCode,
            fpr: inquiry.frontPersonRepresentative.name,
            createdAt: inquiry.createdAt,
            updatedAt: inquiry.updatedAt,
            createdBy: inquiry.createdBy?.name,
            updatedBy: inquiry.updatedBy?.name,
            imageUrl: inquiry.image?.newFilename
          })
        }
        skip += take
      }

      const book = new Workbook()
      const sheet = book.addWorksheet('Inquiries')

      let allColumns = [
        { header: 'INQUIRY ITEM ID', key: 'id2', width: 10 },
        { header: 'SR. NO.', key: 'sr', width: 8 },
        { header: 'INQUIRY DATE', key: 'date', width: 10 },
        { header: 'CUSTOMER NAME', key: 'customerName', width: 25 },
        { header: 'PR NUMBER & NAME', key: 'prNumberAndName', width: 25 },
        { header: 'SITE REF', key: 'siteRef', width: 15 },
        {
          header: 'GOODS DESCRIPTION (SALES DESCRIPTION)',
          key: 'salesDescription',
          width: 30
        },
        { header: 'UNIT', key: 'salesUnit', width: 8 },
        { header: 'QTY', key: 'quantity', width: 8 },
        { header: 'SIZE/SPECIFICATION', key: 'size', width: 20 },
        {
          header: 'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)',
          key: 'purchaseDescription',
          width: 30
        },
        { header: 'UOM FROM SUPPLIER', key: 'purchaseUnit', width: 8 },
        {
          header: 'INQUIRY SUBMISSION DATE TO SUPPLIER',
          key: 'inquiryToSupplierDate',
          width: 10
        },
        { header: 'SUPPLIER NAME', key: 'supplierName', width: 20 },
        { header: 'SUPPLIER OFFER DATE', key: 'supplierOfferDate', width: 10 },
        { header: 'SUPPLIER CURRENCY', key: 'supplierCurrency', width: 10 },
        { header: 'SUPPLIER PRICE', key: 'supplierPrice', width: 10 },
        {
          header: 'ESTIMATED DELIVERY DAYS',
          key: 'estimatedDeliveryDays',
          width: 10
        },
        { header: 'GST RATE', key: 'gstRate', width: 8 },
        { header: 'HSN CODE', key: 'hsnCode', width: 12 },
        {
          header: 'Total SUPPLIER PRICE',
          key: 'totalSupplierPrice',
          width: 10
        },
        { header: 'MARGIN %', key: 'margin', width: 8 },
        { header: 'CUSTOMER CURRENCY', key: 'customerCurrency', width: 10 },
        {
          header: 'OFFER PRICE TO OUR BUYER/CUSTOMER',
          key: 'customerPrice',
          width: 10
        },
        {
          header: 'TOTAL Customer Price',
          key: 'totalCustomerPrice',
          width: 10
        },
        { header: 'QUOTE STATUS', key: 'status', width: 10 },
        {
          header: 'OFFER SUBMISSION DATE',
          key: 'offerSubmissionDate',
          width: 10
        },
        { header: 'RESULT OF QUOTE', key: 'result', width: 10 },
        { header: 'QUOTE CANCEL REASON', key: 'cancelReason', width: 10 },
        { header: 'REMARKS', key: 'remarks', width: 20 },
        {
          header: 'EMAIL FOR SUPPLIER REMARKS',
          key: 'emailForSupplierRemarks',
          width: 20
        },
        {
          header: 'EMAIL FOR CUSTOMER REMARKS',
          key: 'emailForCustomerRemarks',
          width: 20
        },
        { header: 'FPR', key: 'fpr', width: 10 },
        { header: 'SAP CODE', key: 'sapCode', width: 8 },
        { header: 'INQUIRY ID', key: 'id', width: 10 },
        { header: 'IMAGE', key: 'image', width: 15 },
        { header: 'CREATED AT', key: 'createdAt', width: 10 },
        { header: 'UPDATED AT', key: 'updatedAt', width: 10 },
        { header: 'CREATED BY', key: 'createdBy', width: 8 },
        { header: 'UPDATED BY', key: 'updatedBy', width: 8 }
      ]

      let keysToGreen: Record<string, boolean> = {}
      let keysToBlue: Record<string, boolean> = {}

      if (input.view === 'supplier') {
        allColumns = allColumns.filter(
          ac =>
            ![
              'date',
              'customerName',
              'supplierName',
              'supplierOfferDate',
              'margin',
              'customerCurrency',
              'customerPrice',
              'totalCustomerPrice',
              'status',
              'offerSubmissionDate',
              'result',
              'cancelReason',
              'remarks',
              'emailForSupplierRemarks',
              'emailForCustomerRemarks',
              'fpr',
              'createdAt',
              'updatedAt',
              'createdBy',
              'updatedBy'
            ].includes(ac.key)
        )
        keysToGreen = {
          'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)': true,
          'UOM FROM SUPPLIER': true,
          'SUPPLIER PRICE': true
        }
        keysToBlue = {
          'ESTIMATED DELIVERY DAYS': true,
          'GST RATE': true,
          'HSN CODE': true,
          'SAP CODE': true
        }
      } else if (input.view === 'customer') {
        allColumns = allColumns.filter(
          ac =>
            ![
              'inquiryToSupplierDate',
              'supplierName',
              'supplierOfferDate',
              'supplierCurrency',
              'supplierPrice',
              'gstRate',
              'hsnCode',
              'totalSupplierPrice',
              'margin',
              'status',
              'result',
              'cancelReason',
              'remarks',
              'emailForSupplierRemarks',
              'emailForCustomerRemarks',
              'sapCode',
              'fpr',
              'createdAt',
              'updatedAt',
              'createdBy',
              'updatedBy'
            ].includes(ac.key)
        )
      }

      sheet.columns = allColumns

      const imageColumnIndex = allColumns.findIndex(ac => ac.key === 'image')

      for (let i = 0; i < allInquiries.length; i++) {
        const inq = allInquiries[i]
        sheet.addRow(inq)

        if (imageColumnIndex > -1 && inq.imageUrl) {
          sheet.properties.defaultRowHeight = 80
          const rowNum = i + 1
          const ext = inq.imageUrl.split('.').pop()
          const imageId = book.addImage({
            extension: ext,
            buffer: await storageClient.getFile(inq.imageUrl)
          })
          sheet.addImage(imageId, {
            tl: { col: imageColumnIndex, row: rowNum },
            ext: { width: 100, height: 100 }
          })
        }
      }

      const headerRow = sheet.getRow(1)
      headerRow.eachCell(cell => {
        cell.font = { bold: true }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: keysToGreen[cell.value?.toString() || '']
              ? 'FF00FF00'
              : keysToBlue[cell.value?.toString() || '']
              ? 'FF87CEEB'
              : 'FFFFFF00'
          }
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

      const filename = `Inquiries${
        input.view === 'supplier'
          ? '-Supplier'
          : input.view === 'customer'
          ? '-Customer'
          : ''
      }-${Date.now()}.xlsx`
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

  import: procedureMutateLocal
    .input(
      z.object({
        attachmentId: z.string(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const attachment = await prisma.attachment.findUnique({
        where: {
          id: input.attachmentId
        }
      })
      if (!attachment)
        return {
          message: 'No attachment'
        }

      await prisma.attachment.delete({
        where: {
          id: input.attachmentId
        }
      })
      const buffer = await storageClient.getFile(attachment.newFilename)
      await storageClient.deleteFile(attachment.newFilename)

      const book = new Workbook()
      await book.xlsx.load(buffer)

      let sheet: Worksheet | undefined = book.worksheets[0]

      for (const s of book.worksheets) {
        if (s.state.toString() === 'hidden') continue
        sheet = s
        break
      }

      if (!sheet)
        return {
          message: 'No sheet in excel file'
        }

      const [
        users,
        customers,
        suppliers,
        gstRates,
        units,
        statuses,
        results,
        cancelReasons,
        currencies
      ] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            name: true
          }
        }),
        prisma.customer.findMany({
          select: {
            id: true,
            name: true,
            sites: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }),
        prisma.supplier.findMany({
          select: {
            id: true,
            name: true
          }
        }),
        prisma.gstRate.findMany({
          select: {
            id: true,
            rate: true
          }
        }),
        prisma.unit.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        }),
        prisma.inquiryStatus.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        }),
        prisma.inquiryResult.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        }),
        prisma.inquiryCancelReason.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        }),
        prisma.currency.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        })
      ])

      const usersObj: any = {}
      users.forEach(u => {
        if (u.name) usersObj[u.name] = u.id
      })
      const customersObj: any = {}
      customers.forEach(c => {
        const sitesObj: any = {}
        c.sites.forEach(s => {
          sitesObj[s.name] = s.id
        })
        customersObj[c.name] = {
          id: c.id,
          sitesObj
        }
      })

      const suppliersObj: any = {}
      suppliers.forEach(s => {
        suppliersObj[s.name] = s.id
      })

      let openStatusId: string | undefined
      statuses.forEach(s => {
        if (s.name.toLowerCase() === 'open') openStatusId = s.id
      })

      const currencyObj: any = {}
      currencies.forEach(s => {
        currencyObj[s.name] = s.id
      })

      const headerMapping: any = {
        'INQUIRY ID': 'id',
        'INQUIRY DATE': 'date',
        'CUSTOMER NAME': 'customerName',
        'PR NUMBER & NAME': 'prNumberAndName',
        'SITE REF': 'siteRef',
        'GOODS DESCRIPTION (SALES DESCRIPTION)': 'salesDescription',
        UNIT: 'salesUnit',
        QTY: 'quantity',
        'SIZE/SPECIFICATION': 'size',
        'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)':
          'purchaseDescription',
        'UOM FROM SUPPLIER': 'purchaseUnit',
        'INQUIRY SUBMISSION DATE TO SUPPLIER': 'inquiryToSupplierDate',
        'SUPPLIER NAME': 'supplierName',
        'SUPPLIER OFFER DATE': 'supplierOfferDate',
        'SUPPLIER CURRENCY': 'supplierCurrency',
        'SUPPLIER PRICE': 'supplierPrice',
        'ESTIMATED DELIVERY DAYS': 'estimatedDeliveryDays',
        'GST RATE': 'gstRate',
        'HSN CODE': 'hsnCode',
        'MARGIN %': 'margin',
        'CUSTOMER CURRENCY': 'customerCurrency',
        'OFFER PRICE TO OUR BUYER/CUSTOMER': 'customerPrice',
        'QUOTE STATUS': 'status',
        'OFFER SUBMISSION DATE': 'offerSubmissionDate',
        'RESULT OF QUOTE': 'result',
        'QUOTE CANCEL REASON': 'cancelReason',
        REMARKS: 'remarks',
        'EMAIL FOR SUPPLIER REMARKS': 'emailForSupplierRemarks',
        'EMAIL FOR CUSTOMER REMARKS': 'emailForCustomerRemarks',
        'SAP CODE': 'sapCode',
        FPR: 'fpr'
      }
      const jsonData: any[] = []

      let dataValidationError = false
      const errorColumnIndex = sheet.columnCount + 1
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const rowData: any = {}
        let flag = false

        row.eachCell((cell, colNumber) => {
          const headerCell = sheet!.getCell(1, colNumber)
          const headerValue = headerCell.value

          if (headerValue && headerMapping[headerValue.toString()]) {
            flag = true
            rowData[headerMapping[headerValue.toString()]] =
              cell.value === 'NULL' ? null : cell.value
          }
        })

        if (!flag) return

        if (!rowData.id) {
          if (!rowData.customerName) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'CUSTOMER NAME is required'
            return
          }

          if (!(rowData.prNumberAndName || rowData.siteRef)) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'PR NUMBER & NAME or SITE REF is required'
            return
          }
        }

        if (rowData.date) {
          const date = new Date(rowData.date)
          if (date.toString() === 'Invalid Date') {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid INQUIRY DATE'
            return
          }
          date.setUTCMinutes(date.getUTCMinutes() + input.timezoneOffset)
          rowData.date = date
        }

        if (rowData.customerName)
          rowData.customerName = rowData.customerName.toString()
        if (rowData.prNumberAndName)
          rowData.prNumberAndName = rowData.prNumberAndName.toString()
        if (rowData.siteRef) rowData.siteRef = rowData.siteRef.toString()
        if (rowData.salesDescription)
          rowData.salesDescription = rowData.salesDescription.toString()
        if (rowData.salesUnit) rowData.salesUnit = rowData.salesUnit.toString()

        if (rowData.quantity) rowData.quantity = parseFloat(rowData.quantity)

        if (rowData.size) rowData.size = rowData.size.toString()
        if (rowData.purchaseDescription)
          rowData.purchaseDescription = rowData.purchaseDescription.toString()
        if (rowData.purchaseUnit)
          rowData.purchaseUnit = rowData.purchaseUnit.toString()

        if (rowData.inquiryToSupplierDate) {
          const date = new Date(rowData.inquiryToSupplierDate)
          if (date.toString() === 'Invalid Date') {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid INQUIRY SUBMISSION DATE TO SUPPLIER'
            return
          }
          date.setUTCMinutes(date.getUTCMinutes() + input.timezoneOffset)
          rowData.inquiryToSupplierDate = date
        }

        if (rowData.supplierName)
          rowData.supplierName = rowData.supplierName.toString()

        if (rowData.supplierOfferDate) {
          const date = new Date(rowData.supplierOfferDate)
          if (date.toString() === 'Invalid Date') {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid SUPPLIER OFFER DATE'
            return
          }
          date.setUTCMinutes(date.getUTCMinutes() + input.timezoneOffset)
          rowData.supplierOfferDate = date
        }

        if (rowData.supplierPrice)
          rowData.supplierPrice = parseFloat(rowData.supplierPrice)

        if (rowData.estimatedDeliveryDays)
          rowData.estimatedDeliveryDays = parseInt(
            rowData.estimatedDeliveryDays
          )

        if (rowData.gstRate) rowData.gstRate = parseFloat(rowData.gstRate)
        if (rowData.hsnCode) {
          rowData.hsnCode = rowData.hsnCode.toString()
          if (rowData.hsnCode.length > 8) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'HSN CODE must be less than 8'
            return
          }
        }

        if (rowData.margin) rowData.margin = parseFloat(rowData.margin)
        if (rowData.customerPrice)
          rowData.customerPrice = parseFloat(rowData.customerPrice)

        if (rowData.supplierCurrency)
          rowData.supplierCurrency = rowData.supplierCurrency.toString()
        if (rowData.customerCurrency)
          rowData.customerCurrency = rowData.customerCurrency.toString()

        if (rowData.status) rowData.status = rowData.status.toString()

        if (rowData.offerSubmissionDate) {
          const date = new Date(rowData.offerSubmissionDate)
          if (date.toString() === 'Invalid Date') {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid OFFER SUBMISSION DATE'
            return
          }
          date.setUTCMinutes(date.getUTCMinutes() + input.timezoneOffset)
          rowData.offerSubmissionDate = date
        }

        if (rowData.result) rowData.result = rowData.result.toString()
        if (rowData.cancelReason)
          rowData.cancelReason = rowData.cancelReason.toString()
        if (rowData.remarks) rowData.remarks = rowData.remarks.toString()
        if (rowData.emailForSupplierRemarks)
          rowData.emailForSupplierRemarks =
            rowData.emailForSupplierRemarks.toString()
        if (rowData.emailForCustomerRemarks)
          rowData.emailForCustomerRemarks =
            rowData.emailForCustomerRemarks.toString()
        if (rowData.sapCode) rowData.sapCode = rowData.sapCode.toString()
        if (rowData.fpr) rowData.fpr = rowData.fpr.toString()

        if (rowData.customerName) {
          const foundCustomer = customersObj[rowData.customerName]
          if (foundCustomer) {
            rowData.customerId = foundCustomer.id
            if (rowData.siteRef) {
              const foundSite = foundCustomer.sitesObj[rowData.siteRef]
              if (foundSite) rowData.siteId = foundSite
              else {
                dataValidationError = true
                sheet!.getCell(rowNumber, errorColumnIndex).value =
                  'Invalid Site'
                return
              }
            }
          } else {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid Customer'
            return
          }
        }
        delete rowData.customerName
        delete rowData.siteRef

        if (rowData.fpr) {
          const foundUser = usersObj[rowData.fpr]
          if (foundUser) rowData.frontPersonRepresentativeId = foundUser
          else {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value = 'Invalid FPR'
            return
          }
        }
        delete rowData.fpr

        if (rowData.supplierName || rowData.supplierName === null) {
          if (rowData.supplierName === null) {
            rowData.supplierId = null
          } else {
            const foundSupplier = suppliersObj[rowData.supplierName]
            if (foundSupplier) rowData.supplierId = foundSupplier
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Supplier'
              return
            }
          }
        }
        delete rowData.supplierName

        if (rowData.gstRate || rowData.gstRate === null) {
          if (rowData.gstRate === null) {
            rowData.gstRateId = null
          } else {
            const foundGstRate = gstRates.find(g => g.rate === rowData.gstRate)
            if (foundGstRate) rowData.gstRateId = foundGstRate.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid GST RATE'
              return
            }
          }
        }
        delete rowData.gstRate

        if (rowData.salesUnit || rowData.salesUnit === null) {
          if (rowData.salesUnit === null) {
            rowData.salesUnitId = null
          } else {
            const foundUnit = units.find(u => u.name === rowData.salesUnit)
            if (foundUnit) rowData.salesUnitId = foundUnit.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Sales Unit'
              return
            }
          }
        }
        delete rowData.salesUnit

        if (rowData.purchaseUnit || rowData.purchaseUnit === null) {
          if (rowData.purchaseUnit === null) {
            rowData.purchaseUnitId = null
          } else {
            const foundUnit = units.find(u => u.name === rowData.purchaseUnit)
            if (foundUnit) rowData.purchaseUnitId = foundUnit.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Purchase Unit'
              return
            }
          }
        }
        delete rowData.purchaseUnit

        if (rowData.status || rowData.status === null) {
          if (rowData.status === null) {
            rowData.statusId = null
          } else {
            const foundStatus = statuses.find(s => s.name === rowData.status)
            if (foundStatus) rowData.statusId = foundStatus.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Status'
              return
            }
          }
        } else {
          if (!rowData.id) rowData.statusId = openStatusId
        }
        delete rowData.status

        if (rowData.result || rowData.result === null) {
          if (rowData.result === null) {
            rowData.resultId = null
          } else {
            const foundResult = results.find(r => r.name === rowData.result)
            if (foundResult) rowData.resultId = foundResult.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Result'
              return
            }
          }
        }
        delete rowData.result

        if (rowData.cancelReason || rowData.cancelReason === null) {
          if (rowData.cancelReason === null) {
            rowData.cancelReasonId = null
          } else {
            const foundCancelReason = cancelReasons.find(
              r => r.name === rowData.cancelReason
            )
            if (foundCancelReason) rowData.cancelReasonId = foundCancelReason.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Cancel Reason'
              return
            }
          }
        }
        delete rowData.cancelReason

        if (!rowData.id) {
          if (!rowData.frontPersonRepresentativeId) {
            rowData.frontPersonRepresentativeId = session.user.id
          } else {
            if (session.user.role !== 'ADMIN') {
              rowData.frontPersonRepresentativeId = session.user.id
            }
          }
        } else {
          if (rowData.frontPersonRepresentativeId) {
            if (session.user.role !== 'ADMIN') {
              delete rowData.frontPersonRepresentativeId
            }
          }
        }

        if (rowData.supplierPrice && rowData.customerPrice && !rowData.margin) {
          rowData.margin = parseFloat(
            (
              ((rowData.customerPrice - rowData.supplierPrice) /
                rowData.supplierPrice) *
              100
            ).toFixed(2)
          )
        }

        if (rowData.supplierPrice && rowData.margin && !rowData.customerPrice) {
          rowData.customerPrice = parseFloat(
            (rowData.supplierPrice * (1 + rowData.margin / 100)).toFixed(2)
          )
        }

        if (rowData.supplierCurrency) {
          rowData.supplierCurrencyId = currencyObj[rowData.supplierCurrency]
          delete rowData.supplierCurrency
        }

        if (rowData.customerCurrency) {
          rowData.customerCurrencyId = currencyObj[rowData.customerCurrency]
          delete rowData.customerCurrency
        }

        const parsed = rowData.id
          ? updateInput.safeParse(rowData)
          : createInput.safeParse(rowData)

        if (!parsed.success) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = JSON.stringify(
            parsed.error.flatten().fieldErrors
          )
          return
        }

        jsonData.push(parsed.data)
      })

      const handleError = async () => {
        const errorHeaderCell = sheet!.getCell(1, errorColumnIndex)
        errorHeaderCell.value = 'Error'
        errorHeaderCell.font = { bold: true }
        errorHeaderCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF0000' }
        }
        errorHeaderCell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }

        const filename = `Error-Import-Inquiry-${Date.now()}.xlsx`
        const buffer = await book.xlsx.writeBuffer()
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
          errorFile: url,
          message: 'Import failed'
        }
      }

      if (dataValidationError) return await handleError()

      let transactionError = false
      try {
        await prisma.$transaction(
          async tx => {
            const cacheObj: any = {}
            for (let i = 0; i < jsonData.length; i++) {
              const data = jsonData[i]
              if (data.id) {
                try {
                  data.updatedById = session.user.id
                  await tx.inquiry.update({
                    where: {
                      id: data.id
                    },
                    data
                  })
                } catch (err: any) {
                  sheet!.getCell(i + 2, errorColumnIndex).value =
                    JSON.stringify(err.message || 'Error updating')
                  throw err
                }
              } else {
                try {
                  if (!data.date) data.date = new Date()
                  const start = getIdStart(data.date)

                  const cache = cacheObj[start.itemIdStart]
                  if (!cache) {
                    const lastOne = await tx.inquiry.findFirst({
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

                    let newId2 = `${start.itemIdStart}000001`
                    if (lastOne?.id2) {
                      const lastNum = parseInt(lastOne.id2.slice(4) || '0')
                      newId2 = `${start.itemIdStart}${(lastNum + 1)
                        .toString()
                        .padStart(6, '0')}`
                      cacheObj[start.itemIdStart] = lastNum + 1
                    } else {
                      cacheObj[start.itemIdStart] = 1
                    }
                    data.id2 = newId2
                  } else {
                    cacheObj[start.itemIdStart] = cache + 1
                    data.id2 = `${start.itemIdStart}${(cache + 1)
                      .toString()
                      .padStart(6, '0')}`
                  }

                  data.createdById = session.user.id
                  data.updatedById = session.user.id
                  await tx.inquiry.create({
                    data
                  })
                } catch (err: any) {
                  sheet!.getCell(i + 2, errorColumnIndex).value =
                    JSON.stringify(err.message || 'Error creating')
                  throw err
                }
              }
            }
          },
          {
            isolationLevel: 'Serializable'
          }
        )
      } catch (err) {
        transactionError = true
      }

      if (transactionError) return await handleError()

      return {
        message: 'Import successfull'
      }
    }),

  importFromSupplier: procedureMutateLocal
    .input(
      z.object({
        attachmentId: z.string(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const attachment = await prisma.attachment.findUnique({
        where: {
          id: input.attachmentId
        }
      })

      if (!attachment)
        return {
          message: 'No attachment'
        }

      await prisma.attachment.delete({
        where: {
          id: input.attachmentId
        }
      })
      const buffer = await storageClient.getFile(attachment.newFilename)
      await storageClient.deleteFile(attachment.newFilename)

      const book = new Workbook()
      await book.xlsx.load(buffer)

      let sheet: Worksheet | undefined

      for (const s of book.worksheets) {
        if (s.state.toString() === 'hidden') continue
        sheet = s
        break
      }

      if (!sheet)
        return {
          message: 'No sheet in excel file'
        }

      const [gstRates, units] = await Promise.all([
        prisma.gstRate.findMany({
          select: {
            id: true,
            rate: true
          }
        }),
        prisma.unit.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        })
      ])

      const headerMapping: any = {
        'INQUIRY ID': 'id',
        'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)':
          'purchaseDescription',
        'UOM FROM SUPPLIER': 'purchaseUnit',
        'SUPPLIER PRICE': 'supplierPrice',
        'ESTIMATED DELIVERY DAYS': 'estimatedDeliveryDays',
        'GST RATE': 'gstRate',
        'HSN CODE': 'hsnCode',
        'SAP CODE': 'sapCode'
      }
      const jsonData: any[] = []

      let dataValidationError = false
      const errorColumnIndex = sheet.columnCount + 1
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const rowData: any = {}
        let flag = false

        row.eachCell((cell, colNumber) => {
          const headerCell = sheet!.getCell(1, colNumber)
          const headerValue = headerCell.value

          if (headerValue && headerMapping[headerValue.toString()]) {
            flag = true
            rowData[headerMapping[headerValue.toString()]] =
              cell.value === 'NULL' ? null : cell.value
          }
        })

        if (!flag) return

        if (!rowData.id) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'INQUIRY ID is required'
          return
        }

        if (!rowData.purchaseDescription) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION) is required'
          return
        } else {
          rowData.purchaseDescription = rowData.purchaseDescription.toString()
        }

        if (!rowData.purchaseUnit) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'UOM FROM SUPPLIER is required'
          return
        } else {
          rowData.purchaseUnit = rowData.purchaseUnit.toString()
        }

        if (!rowData.supplierPrice) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'SUPPLIER PRICE is required'
          return
        } else {
          rowData.supplierPrice = parseFloat(rowData.supplierPrice)
        }

        if (rowData.estimatedDeliveryDays) {
          rowData.estimatedDeliveryDays = parseInt(
            rowData.estimatedDeliveryDays
          )
        }

        if (rowData.gstRate || rowData.gstRate === null) {
          if (rowData.gstRate === null) {
            rowData.gstRateId = null
          } else {
            const foundGstRate = gstRates.find(
              g => g.rate === parseFloat(rowData.gstRate)
            )
            if (foundGstRate) rowData.gstRateId = foundGstRate.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid GST RATE'
              return
            }
          }
        }
        delete rowData.gstRate

        if (rowData.hsnCode) {
          rowData.hsnCode = rowData.hsnCode.toString()
          if (
            !(
              rowData.hsnCode.length === 4 ||
              rowData.hsnCode.length === 6 ||
              rowData.hsnCode.length === 8
            )
          ) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid HSN CODE'
            return
          }
        }

        if (rowData.purchaseUnit || rowData.purchaseUnit === null) {
          if (rowData.purchaseUnit === null) {
            rowData.purchaseUnitId = null
          } else {
            const foundUnit = units.find(u => u.name === rowData.purchaseUnit)
            if (foundUnit) rowData.purchaseUnitId = foundUnit.id
            else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid UOM FROM SUPPLIER'
              return
            }
          }
        }

        if (rowData.sapCode) rowData.sapCode = rowData.sapCode.toString()
        delete rowData.purchaseUnit

        const parsed = updateInput.safeParse(rowData)

        if (!parsed.success) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = JSON.stringify(
            parsed.error.flatten().fieldErrors
          )
          return
        }
        jsonData.push(parsed.data)
      })

      const handleError = async () => {
        const errorHeaderCell = sheet!.getCell(1, errorColumnIndex)
        errorHeaderCell.value = 'Error'
        errorHeaderCell.font = { bold: true }
        errorHeaderCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF0000' }
        }
        errorHeaderCell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }

        const filename = `Error-Import-Inquiry-${Date.now()}.xlsx`
        const buffer = await book.xlsx.writeBuffer()
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
          errorFile: url,
          message: 'Import failed'
        }
      }

      if (dataValidationError) return await handleError()

      let transactionError = false
      try {
        await prisma.$transaction(
          async tx => {
            for (let i = 0; i < jsonData.length; i++) {
              const data = jsonData[i]
              const { id, ...updateData } = data
              try {
                updateData.supplierOfferDate = new Date()
                updateData.updatedById = session.user.id
                await tx.inquiry.update({
                  where: {
                    id
                  },
                  data: updateData
                })
              } catch (err: any) {
                sheet!.getCell(i + 2, errorColumnIndex).value = JSON.stringify(
                  err.message || 'Error updating'
                )
                throw err
              }
            }
          },
          {
            isolationLevel: 'Serializable'
          }
        )
      } catch (err) {
        transactionError = true
      }

      if (transactionError) return await handleError()

      return {
        message: 'Import successfull'
      }
    }),

  importFromUser: procedureMutateLocal
    .input(
      z.object({
        attachmentId: z.string(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const attachment = await prisma.attachment.findUnique({
        where: {
          id: input.attachmentId
        }
      })

      if (!attachment)
        return {
          message: 'No attachment'
        }

      await prisma.attachment.delete({
        where: {
          id: input.attachmentId
        }
      })
      const buffer = await storageClient.getFile(attachment.newFilename)
      await storageClient.deleteFile(attachment.newFilename)

      const book = new Workbook()
      await book.xlsx.load(buffer)

      let sheet: Worksheet | undefined

      for (const s of book.worksheets) {
        if (s.state.toString() === 'hidden') continue
        sheet = s
        break
      }

      if (!sheet)
        return {
          message: 'No sheet in excel file'
        }

      const headerMapping: any = {
        'INQUIRY ID': 'id',
        'MARGIN %': 'margin',
        'OFFER PRICE TO OUR BUYER/CUSTOMER': 'customerPrice'
      }
      const jsonData: any[] = []

      let dataValidationError = false
      const errorColumnIndex = sheet.columnCount + 1
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const rowData: any = {}
        let flag = false

        row.eachCell((cell, colNumber) => {
          const headerCell = sheet!.getCell(1, colNumber)
          const headerValue = headerCell.value

          if (headerValue && headerMapping[headerValue.toString()]) {
            flag = true
            rowData[headerMapping[headerValue.toString()]] =
              cell.value === 'NULL' ? null : cell.value
          }
        })

        if (!flag) return

        if (!rowData.id) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'INQUIRY ID is required'
          return
        }

        if (rowData.margin) rowData.margin = parseFloat(rowData.margin)
        if (rowData.customerPrice)
          rowData.customerPrice = parseFloat(rowData.customerPrice)

        if (
          typeof rowData.margin === 'number' ||
          typeof rowData.customerPrice === 'number'
        ) {
          if (typeof rowData.customerPrice) {
          }
        } else {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'MARGIN % or OFFER PRICE TO OUR BUYER/CUSTOMER is required'
          return
        }

        const parsed = updateInput.safeParse(rowData)

        if (!parsed.success) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = JSON.stringify(
            parsed.error.flatten().fieldErrors
          )
          return
        }
        jsonData.push(parsed.data)
      })

      const handleError = async () => {
        const errorHeaderCell = sheet!.getCell(1, errorColumnIndex)
        errorHeaderCell.value = 'Error'
        errorHeaderCell.font = { bold: true }
        errorHeaderCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF0000' }
        }
        errorHeaderCell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }

        const filename = `Error-Import-Inquiry-${Date.now()}.xlsx`
        const buffer = await book.xlsx.writeBuffer()
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
          errorFile: url,
          message: 'Import failed'
        }
      }

      if (dataValidationError) return await handleError()

      let transactionError = false
      try {
        await prisma.$transaction(
          async tx => {
            for (let i = 0; i < jsonData.length; i++) {
              const data = jsonData[i]
              const { id, ...updateData } = data
              try {
                updateData.updatedById = session.user.id
                const inq = await tx.inquiry.findUniqueOrThrow({
                  where: {
                    id
                  },
                  select: {
                    id: true,
                    supplierPrice: true
                  }
                })
                if (!inq.supplierPrice)
                  throw new Error('Supplier Price is not set')

                if (typeof updateData.customerPrice === 'number') {
                  const margin = parseFloat(
                    (
                      ((updateData.customerPrice - inq.supplierPrice) /
                        inq.supplierPrice) *
                      100
                    ).toFixed(2)
                  )
                  updateData.margin = margin
                } else {
                  updateData.margin = parseFloat(updateData.margin.toFixed(2))
                  updateData.customerPrice = parseFloat(
                    (inq.supplierPrice * (1 + updateData.margin / 100)).toFixed(
                      2
                    )
                  )
                }
                await tx.inquiry.update({
                  where: {
                    id
                  },
                  data: updateData
                })
              } catch (err: any) {
                sheet!.getCell(i + 2, errorColumnIndex).value = JSON.stringify(
                  err.message || 'Error updating'
                )
                throw err
              }
            }
          },
          {
            isolationLevel: 'Serializable'
          }
        )
      } catch (err) {
        transactionError = true
      }

      if (transactionError) return await handleError()

      return {
        message: 'Import successfull'
      }
    })
})
