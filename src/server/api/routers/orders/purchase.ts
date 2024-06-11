import { Prisma } from '@prisma/client'
import dayjs from 'dayjs'
import { parseAsync } from 'json2csv'
import { z } from 'zod'
import { env } from '~/env.mjs'
import { createTRPCRouter, rawProtectedProcedure } from '~/server/api/trpc'
import { prisma } from '~/server/db'
import { storageClient } from '~/utils/cloudStorage'
import { formatDate } from '~/utils/formatDate'
import { getIdStart } from '~/utils/getIdStart'
import { getPOComment } from '~/utils/getPOComment'
import { htmlToPdf } from '~/utils/htmlToPdf'
import { sendMail } from '~/utils/nodemailer'
import { chinaOrderTemplate, orderTemplate } from './pdfTemplate'

const procedureGetLocal = rawProtectedProcedure([
  'ADMIN',
  'ADMINVIEWER',
  'USER',
  'USERVIEWER',
  'FULFILMENT'
])
const procedureMutateLocal = rawProtectedProcedure(['ADMIN', 'USER'])

const generatePdf = async (id: string) => {
  const purchaseOrder = await prisma.purchaseOrder.findUniqueOrThrow({
    where: {
      id
    },
    include: {
      currency: {
        select: {
          id: true,
          name: true,
          symbol: true
        }
      },
      representativeUser: {
        select: {
          name: true,
          email: true,
          mobile: true
        }
      },
      salesOrder: {
        select: {
          customer: {
            select: {
              id2: true
            }
          }
        }
      },
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
      },
      items: {
        include: {
          gstRate: {
            select: {
              rate: true
            }
          },
          unit: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      expenses: {
        include: {
          gstRate: {
            select: {
              rate: true
            }
          }
        }
      },
      createdBy: {
        select: {
          email: true
        }
      }
    }
  })

  let totalTax = 0
  // let totalItemsAmount = 0
  let showSapCode = false
  const poItems = purchaseOrder.items.map((item, i) => {
    const taxAmount = item.price * ((item.gstRate?.rate || 0) / 100)
    totalTax = totalTax + taxAmount * item.quantity
    // totalItemsAmount += (item.price + taxAmount) * item.quantity
    if (item.sapCode) showSapCode = true
    return {
      i: i + 1,
      sapCode: item.sapCode,
      showSapCode: false,
      sku: item.itemId,
      name: (item.description + ' ' + (item.size || '')).trim(),
      quantity: item.quantity.toFixed(2),
      unit: item.unit.name,
      price: item.price.toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      gst: item.gstRate?.rate || 0,
      taxableValue: parseFloat(
        (item.price * item.quantity).toFixed(2)
      ).toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      total: parseFloat(
        ((item.price + taxAmount) * item.quantity).toFixed(2)
      ).toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }
  })
  poItems.forEach(poi => {
    poi.showSapCode = showSapCode
  })
  let expensesTotal = 0
  let expensesTax = 0
  const poExpenses = purchaseOrder.expenses.map((ex, i) => {
    expensesTotal += ex.price
    const taxAmount = ex.price * ((ex.gstRate?.rate || 0) / 100)
    expensesTax += taxAmount
    return {
      i: i + 1,
      description: ex.description,
      price: ex.price.toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      gst: ex.gstRate?.rate || 0,
      taxableValue: ex.price.toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      total: parseFloat((ex.price + taxAmount).toFixed(2)).toLocaleString(
        'en-IN',
        {
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )
    }
  })

  expensesTotal = parseFloat(expensesTotal.toFixed(2))
  totalTax = parseFloat((totalTax + expensesTax).toFixed(2))
  // const total = parseFloat(
  //   (totalItemsAmount + expensesTotal + totalTax).toFixed(2)
  // )
  const total = parseFloat(
    (purchaseOrder.totalAmount + expensesTotal + totalTax).toFixed(2)
  )

  const html = orderTemplate({
    type: 'PURCHASE ORDER',
    typeShort: 'PO',
    id: purchaseOrder.id2,
    ref: purchaseOrder.referenceId,
    project: purchaseOrder.salesOrder?.customer.id2,
    approved: purchaseOrder.approved ? 'APPROVED' : 'UNAPPROVED',
    date: dayjs(purchaseOrder.date).format('DD/MM/YYYY'),
    repName: purchaseOrder.representativeUser.name,
    repEmail: purchaseOrder.representativeUser.email,
    repMobile: purchaseOrder.representativeUser.mobile,
    supplierName: purchaseOrder.supplier.name,
    supplierGST: purchaseOrder.supplier.gst,
    supplierAddress: purchaseOrder.supplier.address,
    showSapCode,
    items: poItems,
    expenses: poExpenses,
    expensesTotal: parseFloat(expensesTotal.toFixed(2)).toLocaleString(
      'en-IN',
      {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ),
    expensesTax: parseFloat(expensesTax.toFixed(2)).toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalItemsAmount: purchaseOrder.totalAmount.toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalAmount: parseFloat(
      (purchaseOrder.totalAmount + expensesTotal).toFixed(2)
    ).toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalTax: totalTax.toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    total: total.toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalRoundOff: parseFloat(Math.round(total).toFixed(2)).toLocaleString(
      'en-IN',
      {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ),
    addressLine1: purchaseOrder.shippingAddress?.line1,
    addressLine2: purchaseOrder.shippingAddress?.line2,
    personName: purchaseOrder.shippingAddress?.personName,
    personMobile: purchaseOrder.shippingAddress?.personMobile,
    comments: purchaseOrder.comments?.split('\n').map(c => ({ c })) || []
  })
  const filename = `PURCHASE ORDER #${purchaseOrder.id2}-${Date.now()}.pdf`
  const pdf = await htmlToPdf(html)

  const url = await storageClient.addFile({
    data: pdf,
    filename
  })

  const a = await prisma.attachment.create({
    data: {
      originalFilename: filename,
      newFilename: filename,
      url
    }
  })

  return {
    url,
    pdf,
    attachmentId: a.id,
    purchaseOrder
  }
}

const generateChinaPdf = async (id: string) => {
  const purchaseOrder = await prisma.purchaseOrder.findUniqueOrThrow({
    where: {
      id
    },
    include: {
      representativeUser: {
        select: {
          name: true,
          email: true,
          mobile: true
        }
      },
      salesOrder: {
        select: {
          id2: true,
          customer: {
            select: {
              id2: true,
              name: true
            }
          }
        }
      },
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
      },
      items: {
        include: {
          gstRate: {
            select: {
              rate: true
            }
          },
          unit: {
            select: {
              id: true,
              name: true
            }
          }
        }
      },
      expenses: {
        include: {
          gstRate: {
            select: {
              rate: true
            }
          }
        }
      },
      createdBy: {
        select: {
          email: true
        }
      }
    }
  })

  let totalTax = 0
  // let totalItemsAmount = 0
  let showSapCode = false
  const poItems = purchaseOrder.items.map((item, i) => {
    const taxAmount = item.price * ((item.gstRate?.rate || 0) / 100)
    totalTax = totalTax + taxAmount * item.quantity
    // totalItemsAmount += (item.price + taxAmount) * item.quantity
    if (item.sapCode) showSapCode = true
    return {
      i: i + 1,
      sapCode: item.sapCode,
      showSapCode: false,
      sku: item.itemId,
      name: (item.description + ' ' + (item.size || '')).trim(),
      quantity: item.quantity.toFixed(2),
      unit: item.unit.name,
      price: item.price.toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      gst: item.gstRate?.rate || 0,
      taxableValue: parseFloat(
        (item.price * item.quantity).toFixed(2)
      ).toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      total: parseFloat(
        ((item.price + taxAmount) * item.quantity).toFixed(2)
      ).toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }
  })
  poItems.forEach(poi => {
    poi.showSapCode = showSapCode
  })
  let expensesTotal = 0
  let expensesTax = 0
  const poExpenses = purchaseOrder.expenses.map((ex, i) => {
    expensesTotal += ex.price
    const taxAmount = ex.price * ((ex.gstRate?.rate || 0) / 100)
    expensesTax += taxAmount
    return {
      i: i + 1,
      description: ex.description,
      price: ex.price.toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      gst: ex.gstRate?.rate || 0,
      taxableValue: ex.price.toLocaleString('en-IN', {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      total: parseFloat((ex.price + taxAmount).toFixed(2)).toLocaleString(
        'en-IN',
        {
          currency: 'INR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )
    }
  })

  expensesTotal = parseFloat(expensesTotal.toFixed(2))
  totalTax = parseFloat((totalTax + expensesTax).toFixed(2))
  // const total = parseFloat(
  //   (totalItemsAmount + expensesTotal + totalTax).toFixed(2)
  // )
  const total = parseFloat(
    (purchaseOrder.totalAmount + expensesTotal + totalTax).toFixed(2)
  )

  const html = chinaOrderTemplate({
    type: 'PURCHASE ORDER',
    typeShort: 'PO',
    id: purchaseOrder.id2,
    importer: purchaseOrder?.salesOrder?.customer?.name,
    prNumber: purchaseOrder?.salesOrder?.id2,
    ref: purchaseOrder.referenceId,
    project: purchaseOrder.salesOrder?.customer.id2,
    approved: purchaseOrder.approved ? 'APPROVED' : 'UNAPPROVED',
    date: dayjs(purchaseOrder.date).format('DD/MM/YYYY'),
    repName: purchaseOrder.representativeUser.name,
    repEmail: purchaseOrder.representativeUser.email,
    repMobile: purchaseOrder.representativeUser.mobile,
    supplierName: purchaseOrder.supplier.name,
    supplierGST: purchaseOrder.supplier.gst,
    supplierAddress: purchaseOrder.supplier.address,
    showSapCode,
    items: poItems,
    expenses: poExpenses,
    expensesTotal: parseFloat(expensesTotal.toFixed(2)).toLocaleString(
      'en-IN',
      {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ),
    expensesTax: parseFloat(expensesTax.toFixed(2)).toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalItemsAmount: purchaseOrder.totalAmount.toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalAmount: parseFloat(
      (purchaseOrder.totalAmount + expensesTotal).toFixed(2)
    ).toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalTax: totalTax.toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    total: total.toLocaleString('en-IN', {
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }),
    totalRoundOff: parseFloat(Math.round(total).toFixed(2)).toLocaleString(
      'en-IN',
      {
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    ),
    addressLine1: purchaseOrder.shippingAddress?.line1,
    addressLine2: purchaseOrder.shippingAddress?.line2,
    personName: purchaseOrder.shippingAddress?.personName,
    personMobile: purchaseOrder.shippingAddress?.personMobile,
    comments: purchaseOrder.comments?.split('\n').map(c => ({ c })) || [],
    commentsOg: purchaseOrder.comments
  })
  const filename = `PURCHASE ORDER #${purchaseOrder.id2}-${Date.now()}.pdf`
  const pdf = await htmlToPdf(html)

  const url = await storageClient.addFile({
    data: pdf,
    filename
  })

  const a = await prisma.attachment.create({
    data: {
      originalFilename: filename,
      newFilename: filename,
      url
    }
  })

  return {
    url,
    pdf,
    attachmentId: a.id,
    purchaseOrder
  }
}

export const purchaseRouter = createTRPCRouter({
  getAll: procedureGetLocal
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        currencyId: z.string().optional(),
        stage: z
          .enum(['Pending', 'Open', 'Fulfilment', 'Closed', 'Cancelled'])
          .optional(),
        approved: z.boolean().optional(),
        isEmailSent: z.boolean().optional(),
        sortBy: z.enum(['date', 'createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.PurchaseOrderWhereInput = {
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
            referenceId: {
              contains: input.search,
              mode: 'insensitive'
            }
          },
          {
            supplier: {
              name: {
                contains: input.search,
                mode: 'insensitive'
              }
            }
          }
        ],
        stage: input.stage,
        approved: input.approved,
        isEmailSent: input.isEmailSent,
        currencyId: input.currencyId
      }
      const [purchaseOrders, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          orderBy: {
            [input.sortBy || 'date']: input.sortOrder || 'desc'
          },
          include: {
            currency: {
              select: {
                id: true,
                name: true,
                symbol: true
              }
            },
            representativeUser: {
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
        prisma.purchaseOrder.count({
          where
        })
      ])
      return { purchaseOrders, total }
    }),

  createOneFromSalesOrder: procedureMutateLocal
    .input(
      z.array(
        z.object({
          date: z.date(),
          supplierId: z.string(),
          representativeUserId: z.string(),
          referenceId: z.string().optional().nullable(),
          currencyId: z.string(),
          salesOrderId: z.string(),
          lineItems: z
            .array(
              z.object({
                inquiryId: z.string().optional().nullable(),
                itemId: z.string().optional().nullable(),
                sapCode: z.string().optional().nullable(),
                description: z.string(),
                size: z.string().optional().nullable(),
                unitId: z.string(),
                price: z.number(),
                quantity: z.number(),
                gstRateId: z.string().optional().nullable(),
                hsnCode: z.string().max(8).optional().nullable(),
                estimatedDeliveryDate: z.date().optional().nullable(),
                salesOrderItemId: z.string()
              })
            )
            .min(1)
        })
      )
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      await prisma.$transaction(async tx => {
        for (const inputItem of input) {
          const start = getIdStart(inputItem.date)
          const lastOne = await tx.purchaseOrder.findFirst({
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
          let newId2 = `PO${start.itemIdStart}000001`
          if (lastOne?.id2) {
            const lastNum = parseInt(lastOne.id2.slice(6) || '0')
            newId2 = `PO${start.itemIdStart}${(lastNum + 1)
              .toString()
              .padStart(6, '0')}`
          }
          const s = await tx.supplier.findUniqueOrThrow({
            where: {
              id: inputItem.supplierId
            },
            select: {
              paymentTerm: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          })
          if (!s.paymentTerm?.id)
            throw new Error('Supplier does not have a payment term')
          await tx.purchaseOrder.create({
            data: {
              id2: newId2,
              date: inputItem.date,
              stage: 'Open',
              supplierId: inputItem.supplierId,
              currencyId: inputItem.currencyId,
              representativeUserId: inputItem.representativeUserId,
              referenceId: inputItem.referenceId,
              paymentTermId: s.paymentTerm.id,
              salesOrderId: inputItem.salesOrderId,
              totalAmount: parseFloat(
                inputItem.lineItems
                  .reduce(
                    (total, curr) => total + curr.price * curr.quantity,
                    0
                  )
                  .toFixed(2)
              ),
              items: {
                createMany: {
                  data: inputItem.lineItems.map(li => ({
                    inquiryId: li.inquiryId,
                    itemId:
                      li.itemId || Math.random().toString().replace('.', ''),
                    sapCode: li.sapCode,
                    description: li.description,
                    size: li.size,
                    unitId: li.unitId,
                    price: li.price,
                    quantity: li.quantity,
                    gstRateId: li.gstRateId,
                    hsnCode: li.hsnCode,
                    estimatedDeliveryDate: li.estimatedDeliveryDate,
                    salesOrderItemId: li.salesOrderItemId
                  }))
                }
              },
              comments: getPOComment(s.paymentTerm.name),
              createdById: session.user.id,
              updatedById: session.user.id
            }
          })

          const sois = await tx.salesOrderItem.findMany({
            where: {
              salesOrderId: inputItem.salesOrderId
            },
            select: {
              id: true,
              quantity: true,
              purchaseOrderItems: {
                select: {
                  id: true,
                  quantity: true
                }
              }
            }
          })
          let flag = true
          for (const soi of sois) {
            if (
              soi.quantity !==
              parseFloat(
                soi.purchaseOrderItems
                  .reduce((total, curr) => total + curr.quantity, 0)
                  .toFixed(2)
              )
            ) {
              flag = false
              break
            }
          }
          if (flag)
            await tx.salesOrder.update({
              where: {
                id: inputItem.salesOrderId
              },
              data: {
                stage: 'Open'
              }
            })
        }
      })
      return 'Done'
    }),

  getOne: procedureGetLocal
    .input(z.string())
    .query(async ({ ctx: { prisma }, input }) => {
      const po = await prisma.purchaseOrder.findUniqueOrThrow({
        where: {
          id: input
        },
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
          },
          items: {
            include: {
              inventoryItem: true,
              salesOrderItem: true
            }
          },
          expenses: true,
          salesOrder: {
            select: {
              id: true,
              id2: true
            }
          },
          emailHistory: {
            select: {
              id: true,
              createdAt: true,
              createdBy: {
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
        }
      })

      const fulfilments = await prisma.fulfilmentLog.findMany({
        where: {
          items: {
            some: {
              inventoryItem: {
                purchaseOrderItemId: {
                  in: po.items.map(i => i.id)
                }
              }
            }
          }
        },
        select: {
          id: true,
          gateEntryNumber: true,
          gateEntryDate: true,
          invoiceId: true,
          invoiceDate: true,
          createdAt: true,
          createdBy: {
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
        }
      })

      po.expenses = po.expenses.filter(e => !e.deletedAt)

      return { po, fulfilments }
    }),

  updateOne: procedureMutateLocal
    .input(
      z.object({
        id: z.string(),
        date: z.date(),
        representativeUserId: z.string(),
        referenceId: z.string().optional().nullable(),
        paymentTermId: z.string(),
        shippingAddressId: z.string().optional().nullable(),
        comments: z.string().optional().nullable(),
        lineItems: z
          .array(
            z.object({
              id: z.string(),
              sapCode: z.string().optional().nullable(),
              description: z.string(),
              size: z.string().optional().nullable(),
              unitId: z.string(),
              price: z.number(),
              quantity: z.number(),
              gstRateId: z.string(),
              hsnCode: z.string().max(8).optional().nullable(),
              estimatedDeliveryDate: z.date().optional().nullable()
            })
          )
          .min(1),
        expenses: z.array(
          z.object({
            id: z.string().optional().nullable(),
            description: z.string().min(1),
            price: z.number().min(0),
            gstRateId: z.string().optional().nullable(),
            showInFulfilment: z.boolean().optional()
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      await prisma.$transaction(async tx => {
        for (const li of input.lineItems) {
          await tx.purchaseOrderItem.update({
            where: {
              id: li.id,
              purchaseOrderId: input.id
            },
            data: {
              sapCode: li.sapCode,
              description: li.description,
              size: li.size,
              unitId: li.unitId,
              price: li.price,
              quantity: li.quantity,
              gstRateId: li.gstRateId,
              hsnCode: li.hsnCode,
              estimatedDeliveryDate: li.estimatedDeliveryDate
            }
          })
        }
        await tx.purchaseOrderExpense.deleteMany({
          where: {
            id: {
              notIn: input.expenses.filter(e => e.id).map(e => e.id!)
            },
            purchaseOrderId: input.id
          }
        })
        for (const ex of input.expenses) {
          if (ex.id) {
            await tx.purchaseOrderExpense.update({
              where: {
                id: ex.id
              },
              data: {
                description: ex.description,
                price: ex.price,
                gstRateId: ex.gstRateId,
                showInFulfilment: ex.showInFulfilment
              }
            })
          } else {
            await tx.purchaseOrderExpense.create({
              data: {
                description: ex.description,
                price: ex.price,
                gstRateId: ex.gstRateId,
                purchaseOrderId: input.id,
                showInFulfilment: ex.showInFulfilment
              }
            })
          }
        }
        await tx.purchaseOrder.update({
          where: {
            id: input.id
          },
          data: {
            date: input.date,
            representativeUserId: input.representativeUserId,
            referenceId: input.referenceId,
            paymentTermId: input.paymentTermId,
            shippingAddressId: input.shippingAddressId,
            comments: input.comments,
            totalAmount: parseFloat(
              input.lineItems
                .reduce((total, curr) => total + curr.price * curr.quantity, 0)
                .toFixed(2)
            ),
            updatedById: session.user.id
          }
        })
      })
      return 'Done'
    }),

  approve: procedureMutateLocal
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      await prisma.purchaseOrder.update({
        where: {
          id: input.id
        },
        data: {
          approved: true
        }
      })
    }),

  generatePdf: procedureGetLocal
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { url, attachmentId, purchaseOrder } = await generatePdf(input.id)
      return { url, attachmentId, purchaseOrder }
    }),

  generateChinaPdf: procedureGetLocal
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const { url, attachmentId, purchaseOrder } = await generateChinaPdf(
        input.id
      )
      return { url, attachmentId, purchaseOrder }
    }),

  sendPdf: procedureMutateLocal
    .input(z.object({ attachmentId: z.string(), jsonData: z.string() }))
    .mutation(async ({ input, ctx: { prisma, session } }) => {
      const purchaseOrder: any = JSON.parse(input.jsonData)
      const [currentUserEmail, attachment] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: {
            id: session.user.id
          },
          select: {
            email: true
          }
        }),
        prisma.attachment.findUniqueOrThrow({
          where: {
            id: input.attachmentId
          }
        })
      ])
      const pdf = await storageClient.getFile(attachment.newFilename)

      const ourEmails = new Set(['mukesh@mteexim.com'])
      if (currentUserEmail.email) ourEmails.add(currentUserEmail.email)
      if (purchaseOrder.representativeUser.email)
        ourEmails.add(purchaseOrder.representativeUser.email)
      if (purchaseOrder.createdBy?.email)
        ourEmails.add(purchaseOrder.createdBy.email)

      const emails = [...ourEmails]
      const replyTo = [...ourEmails]

      if (env.EMAIL_ENVIRONMENT === 'production') {
        if (purchaseOrder.supplier.email)
          emails.push(purchaseOrder.supplier.email)
        if (purchaseOrder.supplier.email2)
          emails.push(purchaseOrder.supplier.email2)
        if (purchaseOrder.supplier.email3)
          emails.push(purchaseOrder.supplier.email3)
      }

      await sendMail({
        to: emails,
        subject: `PURCHASE ORDER #${purchaseOrder.id2} FROM MTE`,
        text: `Dear Sir/ Madam

Greetings of the day.  We are pleased to confirm you the order as attached.

We request you to kindly include the given Purchase Order Number in your Tax Invoice for our further reference. In case, if multiple POs are included in your single Tax Invoice, then kindly mention all the PO numbers in the same Invoice.

Also, we have included a new column of Item ID in the Purchase Order, which we will require in our system. This information is important to settle the payments in our accounting software. Kindly add the Item ID against every item while creating your Tax Invoice.

If you find any discrepancy in the Rate, Quantity, UOM, HSN or GST in the PO or you have any queries or require further clarification, please reach out to our representative for the same.



Regards
Mukesh Jain`,
        attachments: [
          {
            filename: `PURCHASE ORDER - ${purchaseOrder.id2}.pdf`,
            content: pdf
          }
        ],
        replyTo,
        cc: 'info@mteexim.com'
      })

      await prisma.purchaseOrderEmailHistory.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })

      return 'Done'
    }),

  export: procedureGetLocal
    .input(
      z.object({
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const orders = await prisma.purchaseOrder.findMany({
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
          representativeUser: {
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
          paymentTerm: {
            select: {
              id: true,
              name: true
            }
          },
          items: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  quantity: true,
                  quantityGone: true
                }
              },
              unit: {
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
          finalData.push({
            Id: o.id,
            'Sap Id': i.sapCode,
            'Order Id': o.id2,
            'Reference Id': o.referenceId,
            Date: formatDate(o.date, input.timezoneOffset),
            Supplier: o.supplier.name,
            'Representative User': o.representativeUser.name,
            Currency: o.currency?.name,
            'Total Amount': o.totalAmount,
            'Payment Terms': o.paymentTerm.name,
            'Sales Order Id': o.salesOrderId,
            Stage: o.stage,
            'Inquiry Id': i.inquiryId,
            'Item Id': i.itemId,
            Description: i.description,
            Size: i.size,
            Unit: i.unit.name,
            Price: i.price,
            Quantity: i.quantity,
            'HSN Code': i.hsnCode,
            GST: i.gstRate?.rate,
            'Estimated Delivery Date': i.estimatedDeliveryDate,
            'Inventory Quantity': i.inventoryItem?.quantity,
            'Inventory Quantity Gone': i.inventoryItem?.quantityGone,
            'Created By': o.createdBy?.name,
            'Updated By': o.updatedBy?.name,
            'Created At': formatDate(o.createdAt, input.timezoneOffset),
            'Updated At': formatDate(o.updatedAt, input.timezoneOffset)
          })
        })
      })

      const filename = `Purchase Orders Export - ${Date.now()}.csv`

      const url = await storageClient.addFile({
        filename,
        data: await parseAsync(finalData)
      })
      return { url }
    }),

  getUnfulfilledPurchaseOrders: procedureGetLocal
    .input(
      z.object({
        supplierId: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.purchaseOrder.findMany({
        where: {
          supplierId: input.supplierId,
          stage: {
            in: ['Open', 'Fulfilment']
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

  getUnfulfilledPurchaseOrderLineItems: procedureGetLocal
    .input(z.array(z.string()))
    .query(async ({ ctx: { prisma }, input }) => {
      const lineItems = await prisma.purchaseOrderItem.findMany({
        where: {
          purchaseOrderId: {
            in: input
          }
        },
        include: {
          purchaseOrder: {
            select: {
              id: true,
              id2: true
            }
          },
          inventoryItem: {
            select: {
              id: true,
              quantity: true
            }
          }
        }
      })
      return lineItems.filter(li =>
        li.inventoryItem ? li.inventoryItem.quantity < li.quantity : true
      )
    }),

  changeStatus: procedureMutateLocal
    .input(
      z.object({
        id: z.string(),
        stage: z.enum(['Open', 'Fulfilment', 'Closed', 'Cancelled'])
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      await prisma.purchaseOrder.update({
        where: {
          id: input.id
        },
        data: {
          stage: input.stage
        }
      })
    })
})
