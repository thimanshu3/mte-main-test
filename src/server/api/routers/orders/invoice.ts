import { Prisma } from '@prisma/client'
import { readFileSync } from 'fs'
import Handlebars from 'handlebars'
import { parseAsync } from 'json2csv'
import path from 'path'
import { z } from 'zod'
import { storageClient } from '~/utils/cloudStorage'
import { formatDate } from '~/utils/formatDate'
import { getIdStart } from '~/utils/getIdStart'
import { htmlToPdf } from '~/utils/htmlToPdf'
import { createTRPCRouter, rawProtectedProcedure } from '../../trpc'
import { eInvoiceTemplate } from './pdfTemplate'

const procedureMutateLocal = rawProtectedProcedure(['ADMIN', 'USER'])
const procedureGetLocal = rawProtectedProcedure([
  'ADMIN',
  'ADMINVIEWER',
  'USER',
  'USERVIEWER'
])

const invoiceTemplate = Handlebars.compile(
  readFileSync(
    path.join(process.cwd(), 'public', 'templates', 'pdfs', 'invoice.hbs'),
    'utf-8'
  )
)

const packingListTemplate = Handlebars.compile(
  readFileSync(
    path.join(process.cwd(), 'public', 'templates', 'pdfs', 'packingList.hbs'),
    'utf-8'
  )
)

const defaultComments = ``

export const invoiceRouter = createTRPCRouter({
  createOne: procedureMutateLocal
    .input(
      z.object({
        id3: z.string().optional().nullable(),
        customerId: z.string(),
        salesOrderId: z.string(),
        customDate: z.date().optional().nullable(),
        date: z.date(),
        currencyId: z.string(),
        LutId: z.string(),
        IecId: z.string(),
        conversionRate: z.number().gt(0),
        remarks: z.string().optional().nullable(),
        amountInWords: z.string().optional().nullable(),
        totalPackages: z.string().optional().nullable(),
        totalNetWeight: z.string().optional().nullable(),
        totalGrossWeight: z.string().optional().nullable(),
        totalCbm: z.string().optional().nullable(),
        truckNumber: z.string().optional().nullable(),
        cntrNumber: z.string().optional().nullable(),
        lineSealNumber: z.string().optional().nullable(),
        rfidSealNumber: z.string().optional().nullable(),
        cntrSize: z.string().optional().nullable(),
        type: z.enum(['lut', 'gst']),
        loadingPortId: z.string(),
        dischargePortId: z.string(),
        exporterDetailsId: z.string(),
        notifyPartyId: z.string(),
        notifyPartyId2: z.string().optional().nullable(),
        representativeUserId: z.string().optional().nullable(),
        items: z.array(
          z.object({
            salesOrderItemId: z.string(),
            description: z.string(),
            size: z.string().optional().nullable(),
            quantity: z.number(),
            countryOfOriginId: z.string().optional().nullable(),
            packNumber: z.string().optional().nullable(),
            packingNumberAsPerSimpolo: z.string().optional().nullable(),
            numberOfPack: z.string().optional().nullable(),
            weightDetails: z.string().optional().nullable(),
            weight: z.string().optional().nullable(),
            weightOne: z.string().optional().nullable(),
            weightSecond: z.string().optional().nullable()
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.$transaction(async tx => {
        let total = 0
        for (const item of input.items) {
          const soi = await tx.salesOrderItem.findUniqueOrThrow({
            where: {
              id: item.salesOrderItemId
            },
            select: {
              id: true,
              quantity: true,
              price: true,
              invoiceItems: {
                select: {
                  id: true,
                  quantity: true
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
              }
            }
          })

          if (!soi.purchaseOrderItems.length)
            throw new Error('No purchase order item')

          let quantityToInvoice = parseFloat(item.quantity.toFixed(3))

          for (const poi of soi.purchaseOrderItems) {
            if (!quantityToInvoice) break
            if (!poi.inventoryItem) continue

            const available = parseFloat(
              (
                poi.inventoryItem.quantity - poi.inventoryItem.quantityGone
              ).toFixed(3)
            )

            if (!available) continue

            if (available < quantityToInvoice) {
              const q = available
              await tx.inventoryItem.update({
                where: {
                  id: poi.inventoryItem.id
                },
                data: {
                  quantityGone: parseFloat(
                    (poi.inventoryItem.quantityGone + q).toFixed(3)
                  )
                }
              })
              quantityToInvoice = parseFloat(
                (quantityToInvoice - available).toFixed(3)
              )
            } else {
              const q = quantityToInvoice
              await tx.inventoryItem.update({
                where: {
                  id: poi.inventoryItem.id
                },
                data: {
                  quantityGone: parseFloat(
                    (poi.inventoryItem.quantityGone + q).toFixed(3)
                  )
                }
              })
              quantityToInvoice = 0
            }
          }

          if (quantityToInvoice) throw new Error('Not enough inventory')

          total += soi.price * item.quantity
        }

        const date = new Date(input.date)

        const start = getIdStart(date)

        const lastOne = await prisma.invoice.findFirst({
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
        let newId2 = `IN${start.itemIdStart}000001`
        if (lastOne?.id2) {
          const lastNum = parseInt(lastOne.id2.slice(6) || '0')
          newId2 = `IN${start.itemIdStart}${(lastNum + 1)
            .toString()
            .padStart(6, '0')}`
        }

        const invoice = await tx.invoice.create({
          data: {
            id2: newId2,
            id3: input.id3,
            customDate: input.customDate,
            date,
            customerId: input.customerId,
            total,
            type: input.type,
            loadingPortId: input.loadingPortId,
            dischargePortId: input.dischargePortId,
            currencyId: input.currencyId,
            lutId: input.LutId,
            iecCodeId: input.IecId,
            exporterDetailsId: input.exporterDetailsId,
            notifyPartyId: input.notifyPartyId,
            notifyPartyId2: input.notifyPartyId2,
            conversionRate: input.conversionRate,
            remarks: input.remarks,
            amountInWords: input.amountInWords,
            totalPackages: input.totalPackages,
            totalNetWeight: input.totalNetWeight,
            totalGrossWeight: input.totalGrossWeight,
            totalCbm: input.totalCbm,
            truckNumber: input.truckNumber,
            cntrNumber: input.cntrNumber,
            lineSealNumber: input.lineSealNumber,
            rfidSealNumber: input.rfidSealNumber,
            cntrSize: input.cntrSize,
            comments: defaultComments,
            representativeUserId: input.representativeUserId,
            items: {
              createMany: {
                data: input.items.map(item => ({
                  salesOrderItemId: item.salesOrderItemId,
                  description: item.description,
                  size: item.size,
                  quantity: item.quantity,
                  countryOfOriginId: item.countryOfOriginId,
                  numberOfPack: item.numberOfPack,
                  packNumber: item.packNumber,
                  packingNumberAsPerSimpolo: item.packingNumberAsPerSimpolo,
                  weightDetails: item.weightDetails,
                  weight: item.weight,
                  weightOne: item.weightOne,
                  weightSecond: item.weightSecond
                }))
              }
            },
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })

        const allSalesOrderItems2 = await tx.salesOrderItem.findMany({
          where: {
            salesOrderId: input.salesOrderId
          },
          include: {
            invoiceItems: true
          }
        })
        let flag = false
        let allInvoiced = true
        for (const item of allSalesOrderItems2) {
          if (item.invoiceItems) {
            flag = true
            const allInvoiceQuantity = parseFloat(
              item.invoiceItems
                .reduce((total, curr) => total + curr.quantity, 0)
                .toFixed(3)
            )
            if (item.quantity > allInvoiceQuantity) allInvoiced = false
          } else allInvoiced = false
        }

        if (allInvoiced)
          await tx.salesOrder.update({
            where: {
              id: input.salesOrderId
            },
            data: {
              stage: 'Closed'
            }
          })
        else if (flag)
          await tx.salesOrder.update({
            where: {
              id: input.salesOrderId
            },
            data: {
              stage: 'Invoice'
            }
          })

        return invoice.id
      })
    }),

  createMany: procedureMutateLocal
    .input(
      z.object({
        id3: z.string().optional().nullable(),
        customDate: z.date().optional().nullable(),
        customerId: z.string(),
        date: z.date(),
        type: z.enum(['lut', 'gst']),
        loadingPortId: z.string(),
        dischargePortId: z.string(),
        exporterDetailsId: z.string(),
        notifyPartyId: z.string(),
        notifyPartyId2: z.string().optional().nullable(),
        currencyId: z.string(),
        LutId: z.string(),
        
        IecId: z.string(),
        conversionRate: z.number().gt(0),
        remarks: z.string().nullable().optional(),
        amountInWords: z.string().optional().nullable(),
        totalPackages: z.string().optional().nullable(),
        totalNetWeight: z.string().optional().nullable(),
        totalGrossWeight: z.string().optional().nullable(),
        totalCbm: z.string().optional().nullable(),
        truckNumber: z.string().optional().nullable(),
        cntrNumber: z.string().optional().nullable(),
        lineSealNumber: z.string().optional().nullable(),
        rfidSealNumber: z.string().optional().nullable(),
        cntrSize: z.string().optional().nullable(),
        isInvoice2: z.boolean(),
        representativeUserId: z.string().optional().nullable(),
        arr: z.array(
          z.object({
            salesOrderId: z.string(),
            items: z.array(
              z.object({
                salesOrderItemId: z.string(),
                description: z.string(),
                size: z.string().optional().nullable(),
                quantity: z.number(),
                countryOfOriginId: z.string().optional().nullable(),
                packNumber: z.string().optional().nullable(),
                packingNumberAsPerSimpolo: z.string().optional().nullable(),
                numberOfPack: z.string().optional().nullable(),
                weightDetails: z.string().optional().nullable(),
                weight: z.string().optional().nullable(),
                weightOne: z.string().optional().nullable(),
                weightSecond: z.string().optional().nullable()
              })
            )
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (!input.arr.length) throw new Error('No invoices to creates')
      return await prisma.$transaction(async tx => {
        const date = new Date(input.date)
        const start = getIdStart(date)

        const lastOne = await tx.invoice.findFirst({
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
        let newId2 = `IN${start.itemIdStart}000001`
        if (lastOne?.id2) {
          const lastNum = parseInt(lastOne.id2.slice(6) || '0')
          newId2 = `IN${start.itemIdStart}${(lastNum + 1)
            .toString()
            .padStart(6, '0')}`
        }

        const newInvoice = await (input.isInvoice2
          ? tx.invoice2.create({
              data: {
                id3: input.id3,
                customDate: input.customDate,
                date,
                customerId: input.customerId,
                type: input.type as any,
                loadingPortId: input.loadingPortId,
                dischargePortId: input.dischargePortId,
                exporterDetailsId: input.exporterDetailsId,
                notifyPartyId: input.notifyPartyId,
                notifyPartyId2: input.notifyPartyId2,
                currencyId: input.currencyId,
                lutId: input.LutId,
                iecCodeId: input.IecId,
                conversionRate: input.conversionRate,
                remarks: input.remarks,
                amountInWords: input.amountInWords,
                totalPackages: input.totalPackages,
                totalNetWeight: input.totalNetWeight,
                totalGrossWeight: input.totalGrossWeight,
                representativeUserId: input.representativeUserId,
                totalCbm: input.totalCbm,
                truckNumber: input.truckNumber,
                cntrNumber: input.cntrNumber,
                lineSealNumber: input.lineSealNumber,
                rfidSealNumber: input.rfidSealNumber,
                cntrSize: input.cntrSize,
                comments: defaultComments,
                total: 0,
                createdById: session.user.id,
                updatedById: session.user.id
              }
            })
          : tx.invoice.create({
              data: {
                id2: newId2,
                id3: input.id3,
                customDate: input.customDate,
                date,
                customerId: input.customerId,
                type: input.type as any,
                loadingPortId: input.loadingPortId,
                dischargePortId: input.dischargePortId,
                exporterDetailsId: input.exporterDetailsId,
                notifyPartyId: input.notifyPartyId,
                notifyPartyId2: input.notifyPartyId2,
                currencyId: input.currencyId,
                lutId: input.LutId,
                iecCodeId: input.IecId,
                conversionRate: input.conversionRate,
                remarks: input.remarks,
                amountInWords: input.amountInWords,
                totalPackages: input.totalPackages,
                totalNetWeight: input.totalNetWeight,
                totalGrossWeight: input.totalGrossWeight,
                representativeUserId: input.representativeUserId,
                totalCbm: input.totalCbm,
                truckNumber: input.truckNumber,
                cntrNumber: input.cntrNumber,
                lineSealNumber: input.lineSealNumber,
                rfidSealNumber: input.rfidSealNumber,
                cntrSize: input.cntrSize,
                comments: defaultComments,
                total: 0,
                createdById: session.user.id,
                updatedById: session.user.id
              }
            }))

        for (const a of input.arr) {
          let total = 0
          for (const item of a.items) {
            const soi = await tx.salesOrderItem.findUniqueOrThrow({
              where: {
                id: item.salesOrderItemId
              },
              select: {
                id: true,
                quantity: true,
                price: true,
                invoiceItems: {
                  select: {
                    id: true,
                    quantity: true
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
                }
              }
            })

            let quantityToInvoice = parseFloat(item.quantity.toFixed(3))

            if (!input.isInvoice2) {
              if (!soi.purchaseOrderItems.length)
                throw new Error('No purchase order item')
              for (const poi of soi.purchaseOrderItems) {
                if (!quantityToInvoice) break
                if (!poi.inventoryItem) continue

                const available = parseFloat(
                  (
                    poi.inventoryItem.quantity - poi.inventoryItem.quantityGone
                  ).toFixed(3)
                )

                if (!available) continue

                if (available < quantityToInvoice) {
                  const q = available
                  await tx.inventoryItem.update({
                    where: {
                      id: poi.inventoryItem.id
                    },
                    data: {
                      quantityGone: parseFloat(
                        (poi.inventoryItem.quantityGone + q).toFixed(3)
                      )
                    }
                  })
                  quantityToInvoice = parseFloat(
                    (quantityToInvoice - available).toFixed(3)
                  )
                } else {
                  const q = quantityToInvoice
                  await tx.inventoryItem.update({
                    where: {
                      id: poi.inventoryItem.id
                    },
                    data: {
                      quantityGone: parseFloat(
                        (poi.inventoryItem.quantityGone + q).toFixed(3)
                      )
                    }
                  })
                  quantityToInvoice = 0
                }
              }

              if (quantityToInvoice) throw new Error('Not enough inventory')
            }

            total += soi.price * item.quantity
          }

          if (input.isInvoice2)
            await tx.invoice2Item.createMany({
              data: a.items.map(item => ({
                invoice2Id: newInvoice.id,
                salesOrderItemId: item.salesOrderItemId,
                description: item.description,
                size: item.size,
                quantity: item.quantity,
                countryOfOriginId: item.countryOfOriginId,
                numberOfPack: item.numberOfPack,
                packNumber: item.packNumber,
                packingNumberAsPerSimpolo: item.packingNumberAsPerSimpolo,
                weightDetails: item.weightDetails,
                weight: item.weight,
                weightOne: item.weightOne,
                weightSecond: item.weightSecond
              }))
            })
          else {
            await tx.invoiceItem.createMany({
              data: a.items.map(item => ({
                invoiceId: newInvoice.id,
                salesOrderItemId: item.salesOrderItemId,
                description: item.description,
                size: item.size,
                quantity: item.quantity,
                countryOfOriginId: item.countryOfOriginId,
                numberOfPack: item.numberOfPack,
                packNumber: item.packNumber,
                packingNumberAsPerSimpolo: item.packingNumberAsPerSimpolo,
                weightDetails: item.weightDetails,
                weight: item.weight,
                weightOne: item.weightOne,
                weightSecond: item.weightSecond
              }))
            })

            const allSalesOrderItems2 = await tx.salesOrderItem.findMany({
              where: {
                salesOrderId: a.salesOrderId
              },
              include: {
                invoiceItems: true
              }
            })
            let flag = false
            let allInvoiced = true
            for (const item of allSalesOrderItems2) {
              if (item.invoiceItems) {
                flag = true
                const allInvoiceQuantity = parseFloat(
                  item.invoiceItems
                    .reduce((total, curr) => total + curr.quantity, 0)
                    .toFixed(3)
                )
                if (item.quantity > allInvoiceQuantity) allInvoiced = false
              } else allInvoiced = false
            }

            if (allInvoiced)
              await tx.salesOrder.update({
                where: {
                  id: a.salesOrderId
                },
                data: {
                  stage: 'Closed'
                }
              })
            else if (flag)
              await tx.salesOrder.update({
                where: {
                  id: a.salesOrderId
                },
                data: {
                  stage: 'Invoice'
                }
              })
          }

          total = parseFloat(total.toFixed(2))
          await (input.isInvoice2
            ? tx.invoice2.update({
                where: {
                  id: newInvoice.id
                },
                data: {
                  total
                }
              })
            : tx.invoice.update({
                where: {
                  id: newInvoice.id
                },
                data: {
                  total
                }
              }))
        }

        return newInvoice.id
      })
    }),

  getAll: procedureGetLocal
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        type: z.string(),
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      if (input.type === 'Draft') {
        const where: Prisma.Invoice2WhereInput = input.search
          ? {
              date: input.dateRange
                ? {
                    gte: input.dateRange.startDate,
                    lte: input.dateRange.endDate
                  }
                : undefined,
              OR: [
                {
                  id: {
                    contains: input.search,
                    mode: 'insensitive'
                  }
                },
                {
                  id3: {
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
                  representativeUser: {
                    name: {
                      contains: input.search,
                      mode: 'insensitive'
                    }
                  }
                },
                {
                  createdBy: {
                    name: {
                      contains: input.search,
                      mode: 'insensitive'
                    }
                  }
                },
                {
                  updatedBy: {
                    name: {
                      contains: input.search,
                      mode: 'insensitive'
                    }
                  }
                }
              ]
            }
          : {
              date: input.dateRange
                ? {
                    gte: input.dateRange.startDate,
                    lte: input.dateRange.endDate
                  }
                : undefined
            }

        const [draftInvoices, total] = await Promise.all([
          prisma.invoice2.findMany({
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
              customer: {
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
              representativeUser: {
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
          prisma.invoice2.count({
            where
          })
        ])
        return {
          draftInvoices,
          total
        }
      }

      const where: Prisma.InvoiceWhereInput = input.search
        ? {
            date: input.dateRange
              ? {
                  gte: input.dateRange.startDate,
                  lte: input.dateRange.endDate
                }
              : undefined,
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
                id3: {
                  contains: input.search,
                  mode: 'insensitive'
                }
              },
              {
                representativeUser: {
                  name: {
                    contains: input.search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                updatedBy: {
                  name: {
                    contains: input.search,
                    mode: 'insensitive'
                  }
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
                createdBy: {
                  name: {
                    contains: input.search,
                    mode: 'insensitive'
                  }
                }
              }
            ]
          }
        : {
            date: input.dateRange
              ? {
                  gte: input.dateRange.startDate,
                  lte: input.dateRange.endDate
                }
              : undefined
          }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
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
            customer: {
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
            representativeUser: {
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
        prisma.invoice.count({
          where
        })
      ])
      return {
        invoices,
        total
      }
    }),

  getOne: procedureGetLocal
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const invoice = await prisma.invoice.findUnique({
        where: {
          id: input.id
        },
        include: {
          loadingPort: {
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
          lut: {
            select: {
              id: true,
              name: true
            }
          },
          iecCode: {
            select: {
              id: true,
              name: true
            }
          },
          dischagePort: {
            select: {
              id: true,
              name: true
            }
          },
          exporterDetails: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          notifyParty: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          notifyParty2: {
            select: {
              id: true,
              name: true,
              address: true
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
          representativeUser: {
            select: {
              id: true,
              name: true
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          items: {
            include: {
              countryOfOrigin: {
                select: {
                  id: true,
                  name: true
                }
              },
              salesOrderItem: {
                include: {
                  salesOrder: {
                    select: {
                      id: true,
                      id2: true
                    }
                  },
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
                      gstRate: {
                        select: {
                          id: true,
                          rate: true
                        }
                      },
                      purchaseOrder: {
                        select: {
                          id: true,
                          referenceId: true,
                          supplier: {
                            select: {
                              gst: true
                            }
                          }
                        }
                      },
                      hsnCode: true,
                      price: true,
                      inventoryItem: {
                        select: {
                          fulfilmentLogItems: {
                            select: {
                              fulfilmentLog: {
                                select: {
                                  id: true,
                                  invoiceId: true,
                                  invoiceDate: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
      if (invoice)
        return invoice as typeof invoice & {
          id2?: string | null
        }

      const invoice2 = await prisma.invoice2.findUnique({
        where: {
          id: input.id
        },
        include: {
          loadingPort: {
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
          lut: {
            select: {
              id: true,
              name: true
            }
          },
          iecCode: {
            select: {
              id: true,
              name: true
            }
          },
          dischagePort: {
            select: {
              id: true,
              name: true
            }
          },
          exporterDetails: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          notifyParty: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          notifyParty2: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              address: true
            }
          },
          updatedBy: {
            select: {
              id: true,
              name: true
            }
          },
          representativeUser: {
            select: {
              id: true,
              name: true
            }
          },
          items: {
            include: {
              countryOfOrigin: {
                select: {
                  id: true,
                  name: true
                }
              },
              salesOrderItem: {
                include: {
                  salesOrder: {
                    select: {
                      id: true,
                      id2: true
                    }
                  },
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
                      gstRate: {
                        select: {
                          id: true,
                          rate: true
                        }
                      },
                      purchaseOrder: {
                        select: {
                          id: true,
                          referenceId: true,
                          supplier: {
                            select: {
                              gst: true
                            }
                          }
                        }
                      },
                      hsnCode: true,
                      price: true,
                      inventoryItem: {
                        select: {
                          fulfilmentLogItems: {
                            select: {
                              fulfilmentLog: {
                                select: {
                                  id: true,
                                  invoiceId: true,
                                  invoiceDate: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })

      if (invoice2)
        return invoice2 as typeof invoice & {
          id2?: string | null
        }

      throw new Error('Invoice not found')
    }),

  generatePdf: procedureMutateLocal
    .input(
      z.object({
        id: z.string(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      let invoiceItems
      try {
        const invoice = await prisma.invoice.findUniqueOrThrow({
          where: {
            id: input.id
          },
          include: {
            loadingPort: {
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
            lut: {
              select: {
                id: true,
                name: true
              }
            },
            iecCode: {
              select: {
                id: true,
                name: true
              }
            },
            dischagePort: {
              select: {
                id: true,
                name: true
              }
            },
            exporterDetails: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty2: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        let USDTotal = 0
        let totalCIF = 0
        let INRTotal = 0
        let totalINR = 0

        invoiceItems = invoice.items
          .map((item, i) => {
            let price = 0
            if (item.salesOrderItem.purchaseOrderItems.length) {
              const INRPrice = item.salesOrderItem.price
              price = Number((INRPrice / invoice.conversionRate).toFixed(2))
              USDTotal += parseFloat((price * item.quantity).toFixed(2))
              totalCIF += parseFloat((price * item.quantity).toFixed(2))
              INRTotal += parseFloat(
                (price * item.quantity * invoice.conversionRate).toFixed(2)
              )
              totalINR += parseFloat(
                (price * item.quantity * invoice.conversionRate).toFixed(2)
              )
            }

            return item.salesOrderItem.purchaseOrderItems.map(poi => ({
              i: i + 1,
              description: item.description,
              size: item.size,
              currency: invoice.currency.name,
              hsnCode: poi.hsnCode,
              quantity: item.quantity,
              uom: item.salesOrderItem.unit.name,
              price: price,
              total: Number(price * item.quantity).toFixed(2),
              InrTotal: Number(
                price * item.quantity * invoice.conversionRate
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              }),
              countryOfOrigin: item.countryOfOrigin?.name || '',
              POrefId: poi.purchaseOrder.referenceId,
              gstRate: poi.gstRate?.rate || 0,
              gstTotal: (
                (price *
                  item.quantity *
                  invoice.conversionRate *
                  (item.salesOrderItem.purchaseOrderItems[0]?.gstRate?.rate ||
                    0)) /
                100
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              }),
              supplierGst: poi.purchaseOrder.supplier.gst || '',
              supplierInvoiceId:
                poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                  .invoiceId || '',
              supplierInvoiceDate: poi.inventoryItem?.fulfilmentLogItems[0]
                ?.fulfilmentLog.invoiceDate
                ? formatDate(
                    poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                      .invoiceDate,
                    input.timezoneOffset
                  )
                : ''
            }))
          })
          .flat()

        USDTotal = Number(USDTotal.toFixed(2))
        totalCIF = Math.round(Number(totalCIF.toFixed(2)))
        INRTotal = Number(INRTotal.toFixed(2))
        totalINR = Math.round(Number(totalINR.toFixed(2)))

        const USDRoundOffTotal = (USDTotal - Math.round(USDTotal)).toFixed(2)
        const numericUSDRoundOffTotal = parseFloat(USDRoundOffTotal)
        const RoundOffResult =
          numericUSDRoundOffTotal > 0
            ? `(-${numericUSDRoundOffTotal})`
            : `(+${Math.abs(numericUSDRoundOffTotal)})`

        const INRRoundOffTotal = (INRTotal - Math.round(INRTotal)).toFixed(2)
        const numericINRRoundOffTotal = parseFloat(INRRoundOffTotal)
        const INRRoundOffResult =
          numericINRRoundOffTotal > 0
            ? `(-${numericINRRoundOffTotal})`
            : `(+${Math.abs(numericINRRoundOffTotal)})`

        const html = eInvoiceTemplate({
          id: invoice.id3 || invoice.id2 || invoice.id,
          currency: invoice.currency.name,
          date:
            formatDate(
              invoice?.customDate || new Date(),
              input.timezoneOffset
            ) || formatDate(invoice.date, input.timezoneOffset),
          invoiceType: invoice.type.toLocaleUpperCase(),
          LUT: invoice?.lut?.name || '',
          IECcode: invoice?.iecCode?.name || '',
          isLUT: invoice.type === 'lut',
          conversionRate: invoice.conversionRate,
          customerName: invoice.customer.name,
          customerAddress: invoice.customer.address,
          portOfLoading: invoice.loadingPort.name,
          portOfDischarge: invoice.dischagePort.name,
          notifyName1: invoice.notifyParty.name,
          notifyAddress1: invoice.notifyParty.address,
          notifyName2: invoice.notifyParty2?.name,
          notifyAddress2: invoice.notifyParty2?.address,
          items: invoiceItems,
          exporterDetails: invoice.exporterDetails.name,
          exporterDetailsAddress: invoice.exporterDetails.address,
          reMarks: invoice.remarks,
          amountInWords: invoice.amountInWords,
          USDTotal,
          totalCIF,
          INRTotal: INRTotal.toLocaleString('en-IN', {
            currency: 'INR',
            maximumFractionDigits: 2
          }),
          INRTotal2: parseInt(Math.round(INRTotal).toFixed(2)).toLocaleString(
            'en-IN',
            {
              currency: 'INR'
            }
          ),
          USDRoundOffTotal: RoundOffResult,
          INRRoundOffTotal: INRRoundOffResult
        })

        const pdf = await htmlToPdf(html)

        const url = await storageClient.addFile({
          data: pdf,
          filename: `e-Invoice - ${invoice.id2}-${Date.now()}.pdf`
        })

        return url
      } catch (error) {
        const invoice2 = await prisma?.invoice2?.findUniqueOrThrow({
          where: {
            id: input.id
          },
          include: {
            loadingPort: {
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
            lut: {
              select: {
                id: true,
                name: true
              }
            },
            iecCode: {
              select: {
                id: true,
                name: true
              }
            },
            dischagePort: {
              select: {
                id: true,
                name: true
              }
            },
            exporterDetails: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty2: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        let USDTotal = 0
        let totalCIF = 0
        let INRTotal = 0
        let totalINR = 0

        invoiceItems = invoice2?.items
          .map((item, i) => {
            let price = 0
            if (item.salesOrderItem.purchaseOrderItems.length) {
              const INRPrice = item.salesOrderItem.price
              price = Number((INRPrice / invoice2.conversionRate).toFixed(2))
              USDTotal += parseFloat((price * item.quantity).toFixed(2))
              totalCIF += parseFloat((price * item.quantity).toFixed(2))
              INRTotal += parseFloat(
                (price * item.quantity * invoice2.conversionRate).toFixed(2)
              )
              totalINR += parseFloat(
                (price * item.quantity * invoice2.conversionRate).toFixed(2)
              )
            }

            return item?.salesOrderItem?.purchaseOrderItems?.map(poi => ({
              i: i + 1,
              description: item.description,
              size: item.size,
              currency: invoice2.currency.name,
              hsnCode: poi.hsnCode,
              quantity: item.quantity,
              uom: item.salesOrderItem.unit.name,
              price: price,
              total: Number(price * item.quantity).toFixed(2),
              InrTotal: Number(
                price * item.quantity * invoice2.conversionRate
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              }),
              countryOfOrigin: item.countryOfOrigin?.name || '',
              POrefId: poi.purchaseOrder.referenceId,
              gstRate: poi.gstRate?.rate || 0,
              supplierGst: poi?.purchaseOrder?.supplier?.gst || '',
              supplierInvoiceId:
                poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                  .invoiceId || '',
              supplierInvoiceDate: poi?.inventoryItem?.fulfilmentLogItems[0]
                ?.fulfilmentLog.invoiceDate
                ? formatDate(
                    poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                      .invoiceDate,
                    input.timezoneOffset
                  )
                : '',
              gstTotal: (
                (price *
                  item.quantity *
                  invoice2.conversionRate *
                  (item?.salesOrderItem?.purchaseOrderItems[0]?.gstRate?.rate ||
                    0)) /
                100
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              })
            }))
          })
          .flat()

        USDTotal = Number(USDTotal.toFixed(2))
        totalCIF = Math.round(Number(totalCIF.toFixed(2)))
        INRTotal = Number(INRTotal.toFixed(2))
        totalINR = Math.round(Number(totalINR.toFixed(2)))

        const USDRoundOffTotal = (USDTotal - Math.round(USDTotal)).toFixed(2)
        const numericUSDRoundOffTotal = parseFloat(USDRoundOffTotal)
        const RoundOffResult =
          numericUSDRoundOffTotal > 0
            ? `(-${numericUSDRoundOffTotal})`
            : `(+${Math.abs(numericUSDRoundOffTotal)})`

        const INRRoundOffTotal = (INRTotal - Math.round(INRTotal)).toFixed(2)
        const numericINRRoundOffTotal = parseFloat(INRRoundOffTotal)
        const INRRoundOffResult =
          numericINRRoundOffTotal > 0
            ? `(-${numericINRRoundOffTotal})`
            : `(+${Math.abs(numericINRRoundOffTotal)})`

        const html = eInvoiceTemplate({
          id: invoice2.id3 || invoice2.id,
          currency: invoice2.currency.name,
          date:
            formatDate(
              invoice2?.customDate || new Date(),
              input.timezoneOffset
            ) || formatDate(invoice2.date, input.timezoneOffset),
          invoiceType: invoice2.type.toLocaleUpperCase(),
          LUT: invoice2?.lut?.name || '',
          IECcode: invoice2?.iecCode?.name || '',
          isLUT: invoice2.type === 'lut',
          conversionRate: invoice2.conversionRate,
          customerName: invoice2.customer.name,
          customerAddress: invoice2.customer.address,
          portOfLoading: invoice2.loadingPort.name,
          portOfDischarge: invoice2.dischagePort.name,
          notifyName1: invoice2.notifyParty.name,
          notifyAddress1: invoice2.notifyParty.address,
          notifyName2: invoice2.notifyParty2?.name,
          notifyAddress2: invoice2.notifyParty2?.address,
          items: invoiceItems,
          exporterDetails: invoice2.exporterDetails.name,
          exporterDetailsAddress: invoice2.exporterDetails.address,
          reMarks: invoice2.remarks,
          amountInWords: invoice2.amountInWords,
          USDTotal,
          totalCIF,
          INRTotal: INRTotal.toLocaleString('en-IN', {
            currency: 'INR',
            maximumFractionDigits: 2
          }),
          INRTotal2: totalINR.toLocaleString('en-IN', {
            currency: 'INR',
            maximumFractionDigits: 2
          }),
          USDRoundOffTotal: RoundOffResult,
          INRRoundOffTotal: INRRoundOffResult
        })

        const pdf = await htmlToPdf(html)

        const url = await storageClient.addFile({
          data: pdf,
          filename: `e-Invoice2 - ${invoice2.id}-${Date.now()}.pdf`
        })

        return url
      }
    }),

  generatePdfInvoice: procedureMutateLocal
    .input(
      z.object({
        id: z.string(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      let invoiceItems
      try {
        const invoice = await prisma.invoice.findUniqueOrThrow({
          where: {
            id: input.id
          },
          include: {
            loadingPort: {
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
            lut: {
              select: {
                id: true,
                name: true
              }
            },
            iecCode: {
              select: {
                id: true,
                name: true
              }
            },
            dischagePort: {
              select: {
                id: true,
                name: true
              }
            },
            exporterDetails: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty2: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        let USDTotal = 0
        let totalCIF = 0
        let INRTotal = 0
        let totalINR = 0

        invoiceItems = invoice.items
          .map((item, i) => {
            let price = 0
            if (item.salesOrderItem.purchaseOrderItems.length) {
              const INRPrice = item.salesOrderItem.price
              price = Number((INRPrice / invoice.conversionRate).toFixed(2))
              USDTotal += parseFloat((price * item.quantity).toFixed(2))
              totalCIF += parseFloat((price * item.quantity).toFixed(2))
              INRTotal += parseFloat(
                (price * item.quantity * invoice.conversionRate).toFixed(2)
              )
              totalINR += parseFloat(
                (price * item.quantity * invoice.conversionRate).toFixed(2)
              )
            }

            return item.salesOrderItem.purchaseOrderItems.map(poi => ({
              i: i + 1,
              description: item.description,
              size: item.size,
              currency: invoice.currency.name,
              hsnCode: poi.hsnCode,
              quantity: item.quantity,
              uom: item.salesOrderItem.unit.name,
              price: price,
              total: Number(price * item.quantity).toFixed(2),
              InrTotal: Number(
                price * item.quantity * invoice.conversionRate
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              }),
              countryOfOrigin: item.countryOfOrigin?.name || '',
              POrefId: poi.purchaseOrder.referenceId,
              gstRate: poi.gstRate?.rate || 0,
              gstTotal: (
                (price *
                  item.quantity *
                  invoice.conversionRate *
                  (item.salesOrderItem.purchaseOrderItems[0]?.gstRate?.rate ||
                    0)) /
                100
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              }),
              supplierGst: poi.purchaseOrder.supplier.gst || '',
              supplierInvoiceId:
                poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                  .invoiceId || '',
              supplierInvoiceDate: poi.inventoryItem?.fulfilmentLogItems[0]
                ?.fulfilmentLog.invoiceDate
                ? formatDate(
                    poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                      .invoiceDate,
                    input.timezoneOffset
                  )
                : ''
            }))
          })
          .flat()

        USDTotal = Number(USDTotal.toFixed(2))
        totalCIF = Math.round(Number(totalCIF.toFixed(2)))
        INRTotal = Number(INRTotal.toFixed(2))
        totalINR = Math.round(Number(totalINR.toFixed(2)))

        const USDRoundOffTotal = (USDTotal - Math.round(USDTotal)).toFixed(2)
        const numericUSDRoundOffTotal = parseFloat(USDRoundOffTotal)
        const RoundOffResult =
          numericUSDRoundOffTotal > 0
            ? `(-${numericUSDRoundOffTotal})`
            : `(+${Math.abs(numericUSDRoundOffTotal)})`

        const INRRoundOffTotal = (INRTotal - Math.round(INRTotal)).toFixed(2)
        const numericINRRoundOffTotal = parseFloat(INRRoundOffTotal)
        const INRRoundOffResult =
          numericINRRoundOffTotal > 0
            ? `(-${numericINRRoundOffTotal})`
            : `(+${Math.abs(numericINRRoundOffTotal)})`

        const html = invoiceTemplate({
          id: invoice.id3 || invoice.id2 || invoice.id,
          currency: invoice.currency.name,
          date:
            formatDate(
              invoice?.customDate || new Date(),
              input.timezoneOffset
            ) || formatDate(invoice.date, input.timezoneOffset),
          invoiceType: invoice.type.toLocaleUpperCase(),
          LUT: invoice?.lut?.name || '',
          IECcode: invoice?.iecCode?.name || '',
          isLUT: invoice.type === 'lut',
          conversionRate: invoice.conversionRate,
          customerName: invoice.customer.name,
          customerAddress: invoice.customer.address,
          portOfLoading: invoice.loadingPort.name,
          portOfDischarge: invoice.dischagePort.name,
          notifyName1: invoice.notifyParty.name,
          notifyAddress1: invoice.notifyParty.address,
          notifyName2: invoice.notifyParty2?.name,
          notifyAddress2: invoice.notifyParty2?.address,
          items: invoiceItems,
          exporterDetails: invoice.exporterDetails.name,
          exporterDetailsAddress: invoice.exporterDetails.address,
          reMarks: invoice.remarks,
          amountInWords: invoice.amountInWords,
          USDTotal,
          totalCIF,
          INRTotal: INRTotal.toLocaleString('en-IN', {
            currency: 'INR',
            maximumFractionDigits: 2
          }),
          INRTotal2: parseInt(Math.round(INRTotal).toFixed(2)).toLocaleString(
            'en-IN',
            {
              currency: 'INR'
            }
          ),
          USDRoundOffTotal: RoundOffResult,
          INRRoundOffTotal: INRRoundOffResult
        })

        const pdf = await htmlToPdf(html)

        const url = await storageClient.addFile({
          data: pdf,
          filename: `Invoice - ${invoice.id2}-${Date.now()}.pdf`
        })

        return url
      } catch (error) {
        const invoice2 = await prisma?.invoice2?.findUniqueOrThrow({
          where: {
            id: input.id
          },
          include: {
            loadingPort: {
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
            lut: {
              select: {
                id: true,
                name: true
              }
            },
            iecCode: {
              select: {
                id: true,
                name: true
              }
            },
            dischagePort: {
              select: {
                id: true,
                name: true
              }
            },
            exporterDetails: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty2: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        let USDTotal = 0
        let totalCIF = 0
        let INRTotal = 0
        let totalINR = 0

        invoiceItems = invoice2?.items
          .map((item, i) => {
            let price = 0
            if (item.salesOrderItem.purchaseOrderItems.length) {
              const INRPrice = item.salesOrderItem.price
              price = Number((INRPrice / invoice2.conversionRate).toFixed(2))
              USDTotal += parseFloat((price * item.quantity).toFixed(2))
              totalCIF += parseFloat((price * item.quantity).toFixed(2))
              INRTotal += parseFloat(
                (price * item.quantity * invoice2.conversionRate).toFixed(2)
              )
              totalINR += parseFloat(
                (price * item.quantity * invoice2.conversionRate).toFixed(2)
              )
            }

            return item?.salesOrderItem?.purchaseOrderItems?.map(poi => ({
              i: i + 1,
              description: item.description,
              size: item.size,
              currency: invoice2.currency.name,
              hsnCode: poi.hsnCode,
              quantity: item.quantity,
              uom: item.salesOrderItem.unit.name,
              price: price,
              total: Number(price * item.quantity).toFixed(2),
              InrTotal: Number(
                price * item.quantity * invoice2.conversionRate
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              }),
              countryOfOrigin: item.countryOfOrigin?.name || '',
              POrefId: poi.purchaseOrder.referenceId,
              gstRate: poi.gstRate?.rate || 0,
              supplierGst: poi?.purchaseOrder?.supplier?.gst || '',
              supplierInvoiceId:
                poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                  .invoiceId || '',
              supplierInvoiceDate: poi?.inventoryItem?.fulfilmentLogItems[0]
                ?.fulfilmentLog.invoiceDate
                ? formatDate(
                    poi.inventoryItem?.fulfilmentLogItems[0]?.fulfilmentLog
                      .invoiceDate,
                    input.timezoneOffset
                  )
                : '',
              gstTotal: (
                (price *
                  item.quantity *
                  invoice2.conversionRate *
                  (item?.salesOrderItem?.purchaseOrderItems[0]?.gstRate?.rate ||
                    0)) /
                100
              ).toLocaleString('en-IN', {
                currency: 'INR',
                maximumFractionDigits: 2
              })
            }))
          })
          .flat()

        USDTotal = Number(USDTotal.toFixed(2))
        totalCIF = Math.round(Number(totalCIF.toFixed(2)))
        INRTotal = Number(INRTotal.toFixed(2))
        totalINR = Math.round(Number(totalINR.toFixed(2)))

        const USDRoundOffTotal = (USDTotal - Math.round(USDTotal)).toFixed(2)
        const numericUSDRoundOffTotal = parseFloat(USDRoundOffTotal)
        const RoundOffResult =
          numericUSDRoundOffTotal > 0
            ? `(-${numericUSDRoundOffTotal})`
            : `(+${Math.abs(numericUSDRoundOffTotal)})`

        const INRRoundOffTotal = (INRTotal - Math.round(INRTotal)).toFixed(2)
        const numericINRRoundOffTotal = parseFloat(INRRoundOffTotal)
        const INRRoundOffResult =
          numericINRRoundOffTotal > 0
            ? `(-${numericINRRoundOffTotal})`
            : `(+${Math.abs(numericINRRoundOffTotal)})`

        const html = invoiceTemplate({
          id: invoice2.id3 || invoice2.id,
          currency: invoice2.currency.name,
          date:
            formatDate(
              invoice2?.customDate || new Date(),
              input.timezoneOffset
            ) || formatDate(invoice2.date, input.timezoneOffset),
          invoiceType: invoice2.type.toLocaleUpperCase(),
          LUT: invoice2?.lut?.name || '',
          IECcode: invoice2?.iecCode?.name || '',
          isLUT: invoice2.type === 'lut',
          conversionRate: invoice2.conversionRate,
          customerName: invoice2.customer.name,
          customerAddress: invoice2.customer.address,
          portOfLoading: invoice2.loadingPort.name,
          portOfDischarge: invoice2.dischagePort.name,
          notifyName1: invoice2.notifyParty.name,
          notifyAddress1: invoice2.notifyParty.address,
          notifyName2: invoice2.notifyParty2?.name,
          notifyAddress2: invoice2.notifyParty2?.address,
          items: invoiceItems,
          exporterDetails: invoice2.exporterDetails.name,
          exporterDetailsAddress: invoice2.exporterDetails.address,
          reMarks: invoice2.remarks,
          amountInWords: invoice2.amountInWords,
          USDTotal,
          totalCIF,
          INRTotal: INRTotal.toLocaleString('en-IN', {
            currency: 'INR',
            maximumFractionDigits: 2
          }),
          INRTotal2: totalINR.toLocaleString('en-IN', {
            currency: 'INR',
            maximumFractionDigits: 2
          }),
          USDRoundOffTotal: RoundOffResult,
          INRRoundOffTotal: INRRoundOffResult
        })

        const pdf = await htmlToPdf(html)

        const url = await storageClient.addFile({
          data: pdf,
          filename: `Invoice2 - ${invoice2.id}-${Date.now()}.pdf`
        })

        return url
      }
    }),

  generatePdfPackingList: procedureMutateLocal
    .input(
      z.object({
        id: z.string(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      let invoiceItems
      try {
        const invoice = await prisma.invoice.findUniqueOrThrow({
          where: {
            id: input.id
          },
          include: {
            loadingPort: {
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
            lut: {
              select: {
                id: true,
                name: true
              }
            },
            iecCode: {
              select: {
                id: true,
                name: true
              }
            },
            dischagePort: {
              select: {
                id: true,
                name: true
              }
            },
            exporterDetails: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty2: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        invoiceItems = invoice.items
          .map((item, i) => {
            return item.salesOrderItem.purchaseOrderItems.map(poi => ({
              i: i + 1,
              description: item.description,
              size: item.size,
              packNumber: item.packNumber,
              packingNumberAsPerSimpolo: item.packingNumberAsPerSimpolo,
              numberOfPack: item.numberOfPack,
              weightDetails: item.weightDetails,
              weight: item.weight,
              currency: invoice.currency.name,
              hsnCode: poi.hsnCode,
              quantity: item.quantity,
              uom: item.salesOrderItem.unit.name,
              countryOfOrigin: item.countryOfOrigin?.name || '',
              POrefId: poi.purchaseOrder.referenceId
            }))
          })
          .flat()
        invoiceItems = invoiceItems.sort(
          (a: any, b: any) => a.packNumber - b.packNumber
        )

        const html = packingListTemplate({
          id: invoice.id3 || invoice.id2 || invoice.id,
          currency: invoice.currency.name,
          date:
            formatDate(
              invoice?.customDate || new Date(),
              input.timezoneOffset
            ) || formatDate(invoice.date, input.timezoneOffset),
          invoiceType: invoice.type.toLocaleUpperCase(),
          LUT: invoice?.lut?.name || '',
          IECcode: invoice?.iecCode?.name || '',
          isLUT: invoice.type === 'lut',
          conversionRate: invoice.conversionRate,
          customerName: invoice.customer.name,
          customerAddress: invoice.customer.address,
          portOfLoading: invoice.loadingPort.name,
          portOfDischarge: invoice.dischagePort.name,
          notifyName1: invoice.notifyParty.name,
          notifyAddress1: invoice.notifyParty.address,
          notifyName2: invoice.notifyParty2?.name,
          notifyAddress2: invoice.notifyParty2?.address,
          items: invoiceItems,
          exporterDetails: invoice.exporterDetails.name,
          exporterDetailsAddress: invoice.exporterDetails.address,
          reMarks: invoice.remarks,
          amountInWords: invoice.amountInWords,
          totalNetWeight: invoice.totalNetWeight,
          totalGrossWeight: invoice.totalGrossWeight,
          totalCbm: invoice.totalCbm,
          totalPackages: invoice.totalPackages,
          cntrNumber: invoice.cntrNumber,
          truckNumber: invoice.truckNumber,
          lineSealNumber: invoice.lineSealNumber,
          rfidSealNumber: invoice.rfidSealNumber,
          cntrSize: invoice.cntrSize
        })

        const pdf = await htmlToPdf(html)

        const url = await storageClient.addFile({
          data: pdf,
          filename: `InvoicePackingList - ${invoice.id2}-${Date.now()}.pdf`
        })

        return url
      } catch (error) {
        const invoice2 = await prisma?.invoice2?.findUniqueOrThrow({
          where: {
            id: input.id
          },
          include: {
            loadingPort: {
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
            lut: {
              select: {
                id: true,
                name: true
              }
            },
            iecCode: {
              select: {
                id: true,
                name: true
              }
            },
            dischagePort: {
              select: {
                id: true,
                name: true
              }
            },
            exporterDetails: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            notifyParty2: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                address: true
              }
            },
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        invoiceItems = invoice2?.items
          .map((item, i) => {
            return item?.salesOrderItem?.purchaseOrderItems?.map(poi => ({
              i: i + 1,
              description: item.description,
              size: item.size,
              packNumber: item.packNumber,
              packingNumberAsPerSimpolo: item.packingNumberAsPerSimpolo,
              numberOfPack: item.numberOfPack,
              weightDetails: item.weightDetails,
              weight: item.weight,
              currency: invoice2.currency.name,
              hsnCode: poi.hsnCode,
              quantity: item.quantity,
              uom: item.salesOrderItem.unit.name,
              countryOfOrigin: item.countryOfOrigin?.name || '',
              POrefId: poi.purchaseOrder.referenceId
            }))
          })
          .flat()
        invoiceItems = invoiceItems.sort(
          (a: any, b: any) => a.packNumber - b.packNumber
        )

        const html = packingListTemplate({
          id: invoice2.id3 || invoice2.id,
          currency: invoice2.currency.name,
          date:
            formatDate(
              invoice2?.customDate || new Date(),
              input.timezoneOffset
            ) || formatDate(invoice2.date, input.timezoneOffset),
          invoiceType: invoice2.type.toLocaleUpperCase(),
          LUT: invoice2?.lut?.name || '',
          IECcode: invoice2?.iecCode?.name || '',
          isLUT: invoice2.type === 'lut',
          conversionRate: invoice2.conversionRate,
          customerName: invoice2.customer.name,
          customerAddress: invoice2.customer.address,
          portOfLoading: invoice2.loadingPort.name,
          portOfDischarge: invoice2.dischagePort.name,
          notifyName1: invoice2.notifyParty.name,
          notifyAddress1: invoice2.notifyParty.address,
          notifyName2: invoice2.notifyParty2?.name,
          notifyAddress2: invoice2.notifyParty2?.address,
          items: invoiceItems,
          exporterDetails: invoice2.exporterDetails.name,
          exporterDetailsAddress: invoice2.exporterDetails.address,
          reMarks: invoice2.remarks,
          amountInWords: invoice2.amountInWords,
          totalNetWeight: invoice2.totalNetWeight,
          totalGrossWeight: invoice2.totalGrossWeight,
          totalCbm: invoice2.totalCbm,
          totalPackages: invoice2.totalPackages,
          cntrNumber: invoice2.cntrNumber,
          truckNumber: invoice2.truckNumber,
          lineSealNumber: invoice2.lineSealNumber,
          rfidSealNumber: invoice2.rfidSealNumber,
          cntrSize: invoice2.cntrSize
        })

        const pdf = await htmlToPdf(html)

        const url = await storageClient.addFile({
          data: pdf,
          filename: `InvoicePackingList - ${invoice2.id}-${Date.now()}.pdf`
        })

        return url
      }
    }),

  deleteDraftInvoice: procedureMutateLocal
    .input(
      z.object({
        id: z.string()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      await prisma.invoice2.delete({
        where: {
          id: input.id
        }
      })
    }),

  exportInvoice: procedureMutateLocal
    .input(
      z.object({
        timezoneOffset: z.number(),
        type: z.string(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      let finalData: any[] = []
      if (input.type === 'Final') {
        const invoice = await prisma.invoice.findMany({
          where: {
            AND: [
              {
                date: {
                  gte: input?.dateRange?.startDate
                }
              },
              {
                date: {
                  lte: input?.dateRange?.endDate
                }
              }
            ]
          },
          orderBy: {
            date: 'desc'
          },
          include: {
            createdBy: {
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
            _count: {
              select: {
                items: true
              }
            },
            representativeUser: {
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
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
                    itemId: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        invoice.forEach(items => {
          items.items.forEach(item => {
            finalData.push({
              'Invoice No.': items.id2,
              'Custom ID': items.id3,
              'No. Of Item': items._count.items,
              Date: formatDate(items.date, input.timezoneOffset),
              Customer: items.customer?.name,
              'Created At': formatDate(items.createdAt, input.timezoneOffset),
              'Updated At': formatDate(items.updatedAt, input.timezoneOffset),
              'Updated By': items.updatedBy?.name,
              'Created By': items.createdBy?.name,
              'Representative User': items?.representativeUser?.name,
              'Item ID': item.salesOrderItem.itemId,
              'Item Description': item.description || '',
              'Item Size': item.size || '',
              Unit: item.salesOrderItem.unit.name,
              Quantity: item.quantity,
              Price: item.salesOrderItem.price,
              'Country of Origin': item.countryOfOrigin?.name || ''
            })
          })
        })

        const csv = `Invoice Export - ${Date.now()}.csv`

        const url = await storageClient.addFile({
          filename: csv,
          data: await parseAsync(finalData)
        })
        return { url }
      } else {
        const invoice2 = await prisma.invoice2.findMany({
          where: {
            AND: [
              {
                date: {
                  gte: input?.dateRange?.startDate
                }
              },
              {
                date: {
                  lte: input?.dateRange?.endDate
                }
              }
            ]
          },
          orderBy: {
            date: 'desc'
          },
          include: {
            createdBy: {
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
            _count: {
              select: {
                items: true
              }
            },
            representativeUser: {
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
            items: {
              include: {
                countryOfOrigin: true,
                salesOrderItem: {
                  select: {
                    id: true,
                    price: true,
                    quantity: true,
                    itemId: true,
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
                        gstRate: {
                          select: {
                            id: true,
                            rate: true
                          }
                        },
                        purchaseOrder: {
                          select: {
                            id: true,
                            referenceId: true,
                            supplier: {
                              select: {
                                gst: true
                              }
                            }
                          }
                        },
                        hsnCode: true,
                        inventoryItem: {
                          select: {
                            fulfilmentLogItems: {
                              select: {
                                fulfilmentLog: {
                                  select: {
                                    id: true,
                                    invoiceId: true,
                                    invoiceDate: true
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        })

        invoice2.forEach(items => {
          items.items.forEach(item => {
            finalData.push({
              'Invoice No.': items.id3 || items.id,
              'Custom ID': items.id3,
              'No. Of Item': items._count.items,
              Date: formatDate(items.date, input.timezoneOffset),
              Customer: items.customer?.name,
              'Created At': formatDate(items.createdAt, input.timezoneOffset),
              'Updated At': formatDate(items.updatedAt, input.timezoneOffset),
              'Updated By': items.updatedBy?.name,
              'Created By': items.createdBy?.name,
              'Representative User': items?.representativeUser?.name,
              'Item ID': item.salesOrderItem.itemId,
              'Item Description': item.description || '',
              'Item Size': item.size || '',
              Unit: item.salesOrderItem.unit.name,
              Quantity: item.quantity,
              Price: item.salesOrderItem.price,
              'Country of Origin': item.countryOfOrigin?.name || ''
            })
          })
        })

        const csv = `Invoice Export - ${Date.now()}.csv`

        const url = await storageClient.addFile({
          filename: csv,
          data: await parseAsync(finalData)
        })
        return { url }
      }
    })
})
