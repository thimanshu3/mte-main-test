import { Prisma } from '@prisma/client'
import { Parser } from 'json2csv'
import { z } from 'zod'
import { storageClient } from '~/utils/cloudStorage'
import { formatDate } from '~/utils/formatDate'
import { htmlToPdf } from '~/utils/htmlToPdf'
import { createTRPCRouter, rawProtectedProcedure } from '../../trpc'
import { stickersTemplate, stickersTemplateWithQr } from './pdfTemplate'

const procedureMutateLocal = rawProtectedProcedure([
  'ADMIN',
  'USER',
  'FULFILMENT'
])
const procedureGetLocal = rawProtectedProcedure([
  'ADMIN',
  'ADMINVIEWER',
  'USER',
  'USERVIEWER',
  'FULFILMENT'
])

export const inventoryRouter = createTRPCRouter({
  createInventoryItems: procedureMutateLocal
    .input(
      z.object({
        gateEntryNumber: z.string(),
        gateEntryDate: z.date(),
        invoiceId: z.string(),
        supplierId: z.string(),
        invoiceDate: z.date(),
        location: z.string(),
        purchaseOrderId: z.string(),
        remarks: z.string().optional().nullable(),
        items: z.array(
          z.object({
            purchaseOrderItemId: z.string(),
            quantity: z.number(),
            hsnCode: z.string().max(8).optional().nullable(),
            gstRateId: z.string().optional().nullable()
          })
        ),
        expenses: z.array(
          z.object({
            id: z.string().min(1),
            description: z.string(),
            price: z.number().min(0),
            gstRateId: z.string().optional().nullable(),
            isNew: z.boolean().optional().nullable()
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (!input.items.length) throw new Error('No items to add')
      let createdId = ''
      await prisma.$transaction(async tx => {
        const allPurchaseOrderItems = await tx.purchaseOrderItem.findMany({
          where: {
            purchaseOrderId: input.purchaseOrderId
          },
          include: {
            inventoryItem: true
          }
        })
        const fulfilmentLog = await prisma.fulfilmentLog.create({
          data: {
            gateEntryNumber: input.gateEntryNumber,
            gateEntryDate: input.gateEntryDate,
            invoiceId: input.invoiceId,
            supplierId: input.supplierId,
            invoiceDate: input.invoiceDate,
            location: input.location,
            remarks: input.remarks,
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
        createdId = fulfilmentLog.id
        for (const ex of input.expenses) {
          if (ex.isNew) {
            await tx.purchaseOrderExpense.create({
              data: {
                description: ex.description,
                purchaseOrderId: input.purchaseOrderId,
                price: ex.price,
                gstRateId: ex.gstRateId,
                showInFulfilment: true,
                fulfilmentLogId: fulfilmentLog.id
              }
            })
          } else {
            await tx.purchaseOrderExpense.update({
              where: {
                id: ex.id
              },
              data: {
                description: ex.description,
                price: ex.price,
                gstRateId: ex.gstRateId
              }
            })
          }
        }
        for (const item of input.items) {
          const poi = allPurchaseOrderItems.find(
            poi => poi.id === item.purchaseOrderItemId
          )
          if (!poi) continue

          if (poi.hsnCode !== item.hsnCode || poi.gstRateId !== item.gstRateId)
            await tx.purchaseOrderItem.update({
              where: {
                id: poi.id
              },
              data: {
                hsnCode: item.hsnCode,
                gstRateId: item.gstRateId
              }
            })

          if (poi.quantity < item.quantity) continue
          if (poi.inventoryItem?.quantity) {
            const totalQuantity = parseFloat(
              (poi.inventoryItem.quantity + item.quantity).toFixed()
            )
            if (totalQuantity < 0) continue
            if (totalQuantity > poi.quantity) continue
            await tx.inventoryItem.update({
              where: {
                id: poi.inventoryItem.id
              },
              data: {
                quantity: totalQuantity
              }
            })
            await tx.fulfilmentLogItem.create({
              data: {
                quantity: item.quantity,
                inventoryItemId: poi.inventoryItem.id,
                fulfilmentLogId: fulfilmentLog.id
              }
            })
          } else {
            if (item.quantity < 0) continue
            if (poi.quantity < item.quantity) continue
            const invItem = await tx.inventoryItem.create({
              data: {
                quantity: item.quantity,
                purchaseOrderItemId: poi.id
              }
            })
            await tx.fulfilmentLogItem.create({
              data: {
                quantity: item.quantity,
                inventoryItemId: invItem.id,
                fulfilmentLogId: fulfilmentLog.id
              }
            })
          }
        }
        const allPurchaseOrderItems2 = await tx.purchaseOrderItem.findMany({
          where: {
            purchaseOrderId: input.purchaseOrderId
          },
          include: {
            inventoryItem: true
          }
        })
        let flag = false
        let allFullfilled = true
        for (const item of allPurchaseOrderItems2) {
          if (item.inventoryItem) {
            flag = true
            if (item.quantity > item.inventoryItem.quantity)
              allFullfilled = false
          } else allFullfilled = false
        }

        if (allFullfilled)
          await tx.purchaseOrder.update({
            where: {
              id: input.purchaseOrderId
            },
            data: {
              stage: 'Closed'
            }
          })
        else if (flag)
          await tx.purchaseOrder.update({
            where: {
              id: input.purchaseOrderId
            },
            data: {
              stage: 'Fulfilment'
            }
          })

        const len = await tx.fulfilmentLogItem.count({
          where: {
            id: createdId
          }
        })
        if (!len) throw new Error('No items')
      })

      return createdId
    }),

  createInventoryItemsBulkPO: procedureMutateLocal
    .input(
      z.object({
        gateEntryNumber: z.string(),
        gateEntryDate: z.date(),
        supplierId: z.string(),
        invoiceId: z.string(),
        invoiceDate: z.date(),
        location: z.string(),
        remarks: z.string().optional().nullable(),
        arr: z.array(
          z.object({
            purchaseOrderId: z.string(),
            items: z.array(
              z.object({
                purchaseOrderItemId: z.string(),
                quantity: z.number(),
                hsnCode: z.string().max(8).optional().nullable(),
                gstRateId: z.string().optional().nullable()
              })
            ),
            expenses: z.array(
              z.object({
                description: z.string(),
                price: z.number().min(0),
                gstRateId: z.string().optional().nullable()
              })
            )
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (!input.arr.length) throw new Error('No po fulfilments to add')
      let createdId = ''
      await prisma.$transaction(async tx => {
        const fulfilmentLog = await prisma.fulfilmentLog.create({
          data: {
            gateEntryNumber: input.gateEntryNumber,
            gateEntryDate: input.gateEntryDate,
            invoiceId: input.invoiceId,
            supplierId: input.supplierId,
            invoiceDate: input.invoiceDate,
            location: input.location,
            remarks: input.remarks,
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
        createdId = fulfilmentLog.id

        for (const a of input.arr) {
          const allPurchaseOrderItems = await tx.purchaseOrderItem.findMany({
            where: {
              purchaseOrderId: a.purchaseOrderId
            },
            include: {
              inventoryItem: true
            }
          })
          for (const ex of a.expenses) {
            await tx.purchaseOrderExpense.create({
              data: {
                description: ex.description,
                purchaseOrderId: a.purchaseOrderId,
                price: ex.price,
                gstRateId: ex.gstRateId,
                showInFulfilment: true,
                fulfilmentLogId: fulfilmentLog.id
              }
            })
          }
          for (const item of a.items) {
            const poi = allPurchaseOrderItems.find(
              poi => poi.id === item.purchaseOrderItemId
            )
            if (!poi) continue

            if (
              poi.hsnCode !== item.hsnCode ||
              poi.gstRateId !== item.gstRateId
            )
              await tx.purchaseOrderItem.update({
                where: {
                  id: poi.id
                },
                data: {
                  hsnCode: item.hsnCode,
                  gstRateId: item.gstRateId
                }
              })

            if (poi.quantity < item.quantity) continue
            if (poi.inventoryItem) {
              const totalQuantity = parseFloat(
                (poi.inventoryItem.quantity + item.quantity).toFixed(3)
              )
              if (totalQuantity < 0) continue
              if (totalQuantity > poi.quantity) continue
              await tx.inventoryItem.update({
                where: {
                  id: poi.inventoryItem.id
                },
                data: {
                  quantity: totalQuantity
                }
              })
              await tx.fulfilmentLogItem.create({
                data: {
                  quantity: item.quantity,
                  inventoryItemId: poi.inventoryItem.id,
                  fulfilmentLogId: fulfilmentLog.id
                }
              })
            } else {
              if (item.quantity < 0) continue
              if (poi.quantity < item.quantity) continue
              const invItem = await tx.inventoryItem.create({
                data: {
                  quantity: item.quantity,
                  purchaseOrderItemId: poi.id
                }
              })
              await tx.fulfilmentLogItem.create({
                data: {
                  quantity: item.quantity,
                  inventoryItemId: invItem.id,
                  fulfilmentLogId: fulfilmentLog.id
                }
              })
            }
          }
          const allPurchaseOrderItems2 = await tx.purchaseOrderItem.findMany({
            where: {
              purchaseOrderId: a.purchaseOrderId
            },
            include: {
              inventoryItem: true
            }
          })
          let flag = false
          let allFullfilled = true
          for (const item of allPurchaseOrderItems2) {
            if (item.inventoryItem) {
              flag = true
              if (item.quantity > item.inventoryItem.quantity)
                allFullfilled = false
            } else allFullfilled = false
          }

          if (allFullfilled)
            await tx.purchaseOrder.update({
              where: {
                id: a.purchaseOrderId
              },
              data: {
                stage: 'Closed'
              }
            })
          else if (flag)
            await tx.purchaseOrder.update({
              where: {
                id: a.purchaseOrderId
              },
              data: {
                stage: 'Fulfilment'
              }
            })
        }
      })

      return createdId
    }),

  getAll: procedureGetLocal
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        sortBy: z
          .enum(['quantity', 'quantityGone', 'createdAt', 'updatedAt'])
          .optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.InventoryItemWhereInput = input.search
        ? {
            OR: [
              {
                id: {
                  contains: input.search,
                  mode: 'insensitive'
                }
              },
              {
                purchaseOrderItem: {
                  itemId: {
                    contains: input.search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                purchaseOrderItem: {
                  description: {
                    contains: input.search,
                    mode: 'insensitive'
                  }
                }
              },
              {
                fulfilmentLogItems: {
                  some: {
                    fulfilmentLog: {
                      id: {
                        contains: input.search,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              },
              {
                fulfilmentLogItems: {
                  some: {
                    fulfilmentLog: {
                      invoiceId: {
                        contains: input.search,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              },
              {
                fulfilmentLogItems: {
                  some: {
                    fulfilmentLog: {
                      gateEntryNumber: {
                        contains: input.search,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              },
              {
                fulfilmentLogItems: {
                  some: {
                    fulfilmentLog: {
                      location: {
                        contains: input.search,
                        mode: 'insensitive'
                      }
                    }
                  }
                }
              }
            ]
          }
        : {}
      const [inventory, total] = await Promise.all([
        prisma.inventoryItem.findMany({
          where,
          include: {
            fulfilmentLogItems: {
              select: {
                id: true,
                quantity: true,
                fulfilmentLog: {
                  select: {
                    id: true,
                    gateEntryNumber: true,
                    gateEntryDate: true,
                    invoiceId: true,
                    invoiceDate: true,
                    location: true,
                    createdAt: true
                  }
                }
              }
            },
            purchaseOrderItem: {
              select: {
                id: true,
                itemId: true,
                description: true,
                unit: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                purchaseOrderId: true,
                price: true
              }
            }
          },
          orderBy: {
            [input.sortBy || 'createdAt']: input.sortOrder || 'desc'
          }
        }),
        prisma.inventoryItem.count({
          where
        })
      ])
      return { inventory, total }
    }),

  getAllFulfilmentLogs: procedureGetLocal
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.FulfilmentLogWhereInput = input.search
        ? {
            OR: [
              {
                id: {
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
              },
              {
                invoiceId: {
                  contains: input.search,
                  mode: 'insensitive'
                }
              },
              {
                gateEntryNumber: {
                  contains: input.search,
                  mode: 'insensitive'
                }
              },
              {
                location: {
                  contains: input.search,
                  mode: 'insensitive'
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
        : {}
      const [fulfilmentLogs, total] = await Promise.all([
        prisma.fulfilmentLog.findMany({
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
            }
          }
        }),
        prisma.fulfilmentLog.count({
          where
        })
      ])
      return {
        fulfilmentLogs,
        total
      }
    }),

  getOneFulfilmentLog: procedureGetLocal
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.fulfilmentLog.findUniqueOrThrow({
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
          supplier: {
            select: {
              id: true,
              name: true,
              taxCalcType: true
            }
          },
          items: {
            include: {
              inventoryItem: {
                include: {
                  purchaseOrderItem: {
                    select: {
                      id: true,
                      itemId: true,
                      description: true,
                      quantity: true,
                      price: true,
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
                      },
                      hsnCode: true,
                      purchaseOrder: {
                        select: {
                          id: true,
                          id2: true,
                          referenceId: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          expenses: {
            select: {
              id: true,
              description: true,
              price: true,
              gstRate: {
                select: {
                  id: true,
                  rate: true
                }
              },
              purchaseOrder: {
                select: {
                  id: true,
                  id2: true,
                  referenceId: true,
                  supplier: {
                    select: {
                      id: true,
                      name: true,
                      taxCalcType: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    }),

  exportAllFulfilmentLogs: procedureGetLocal
    .input(
      z.object({
        search: z.string().optional(),
        sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const where: Prisma.FulfilmentLogWhereInput = input.search
        ? {
            OR: [
              {
                id: {
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
              },
              {
                invoiceId: {
                  contains: input.search,
                  mode: 'insensitive'
                }
              },
              {
                gateEntryNumber: {
                  contains: input.search,
                  mode: 'insensitive'
                }
              },
              {
                location: {
                  contains: input.search,
                  mode: 'insensitive'
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
        : {}
      const fulfilmentLogs = await prisma.fulfilmentLog.findMany({
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
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          items: {
            include: {
              inventoryItem: {
                include: {
                  purchaseOrderItem: {
                    include: {
                      purchaseOrder: {
                        select: {
                          id: true,
                          id2: true,
                          referenceId: true
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
                  }
                }
              }
            }
          },
          expenses: {
            include: {
              gstRate: {
                select: {
                  id: true,
                  rate: true
                }
              },
              purchaseOrder: {
                select: {
                  id: true,
                  id2: true,
                  referenceId: true
                }
              }
            }
          }
        }
      })
      let sr = 1
      const finalData: any[] = []
      for (const log of fulfilmentLogs) {
        for (const item of log.items) {
          finalData.push({
            'Sr. No.': sr++,
            'Gate Entry Number': log.gateEntryNumber,
            'Gate Entry Date': formatDate(
              log.gateEntryDate,
              input.timezoneOffset
            ),
            Supplier: log.supplier.name,
            'Invoice ID': log.invoiceId,
            'Invoice Date': formatDate(log.invoiceDate, input.timezoneOffset),
            Type: 'Item',
            'Item ID': item.inventoryItem.purchaseOrderItem.itemId,
            'Item Description':
              item.inventoryItem.purchaseOrderItem.description,
            'HSN Code': item.inventoryItem.purchaseOrderItem.hsnCode,
            Quantity: item.quantity,
            UOM: item.inventoryItem.purchaseOrderItem.unit.name,
            Price: item.inventoryItem.purchaseOrderItem.price,
            'GST Rate': item.inventoryItem.purchaseOrderItem.gstRate?.rate,
            'Purchase Order Reference ID':
              item.inventoryItem.purchaseOrderItem.purchaseOrder.referenceId,
            'Purchase Order ID':
              item.inventoryItem.purchaseOrderItem.purchaseOrder.id2,
            Remarks: log.remarks,
            'Created At': formatDate(log.createdAt, input.timezoneOffset),
            'Created By': log.createdBy.name
          })
        }
        for (const expense of log.expenses) {
          finalData.push({
            'Sr. No.': sr++,
            'Gate Entry Number': log.gateEntryNumber,
            'Gate Entry Date': formatDate(
              log.gateEntryDate,
              input.timezoneOffset
            ),
            Supplier: log.supplier.name,
            'Invoice ID': log.invoiceId,
            'Invoice Date': formatDate(log.invoiceDate, input.timezoneOffset),
            Type: 'Expense',
            'Item ID': '',
            'Item Description': expense.description,
            'HSN Code': '',
            Quantity: '',
            UOM: '',
            Price: expense.price,
            'GST Rate': expense.gstRate?.rate,
            'Purchase Order Reference ID': expense.purchaseOrder.referenceId,
            'Purchase Order ID': expense.purchaseOrder.id2,
            Remarks: log.remarks,
            'Created At': formatDate(log.createdAt, input.timezoneOffset),
            'Created By': log.createdBy.name
          })
        }
      }

      const parser = new Parser()
      const csv = parser.parse(finalData)
      return csv
    }),

  generateStickerPdf: procedureGetLocal
    .input(
      z.object({
        arr: z.array(
          z.object({
            id: z.string(),
            description: z.string(),
            quantity: z.number(),
            uom: z.string(),
            storeNo: z.string(),
            poRef: z.string(),
            poId: z.string(),
            stickers: z.object({
              distributeEvenly: z.boolean(),
              spq: z.number(),
              customDistribution: z.array(z.number())
            })
          })
        ),
        qr: z.boolean().optional().nullable()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      const arr: any[] = []
      for (const item of input.arr) {
        const stickers = item.stickers

        if (stickers.distributeEvenly) {
          const numberOfStickers = Math.ceil(item.quantity / stickers.spq)
          let q = item.quantity
          for (let i = 1; i <= numberOfStickers; i++) {
            arr.push({
              ...item,
              blank: false,
              stickers: undefined,
              of: `${i} OF ${numberOfStickers}`,
              q: q > stickers.spq ? stickers.spq : q,
              qrcode: JSON.stringify({
                id: item.id,
                q: q > stickers.spq ? stickers.spq : q,
                poId: item.poId,
                of: `${i} OF ${numberOfStickers}`
              })
            })
            q -= stickers.spq
          }
        } else {
          const numberOfStickers = stickers.customDistribution.length
          for (let i = 1; i <= numberOfStickers; i++) {
            arr.push({
              ...item,
              blank: false,
              stickers: undefined,
              of: `${i} OF ${numberOfStickers}`,
              q: stickers.customDistribution[i - 1],
              qrcode: JSON.stringify({
                id: item.id,
                q: stickers.customDistribution[i - 1],
                poId: item.poId,
                of: `${i} OF ${numberOfStickers}`
              })
            })
          }
        }
      }

      const chunkSize = input.qr ? 6 : 8
      const chunks: any[] = []
      for (let i = 0; i < arr.length; i += chunkSize) {
        const c = arr.slice(i, i + chunkSize)
        if (c.length < chunkSize) {
          for (let j = c.length; j < chunkSize; j++) {
            c.push({
              blank: true
            })
          }
        }
        chunks.push(c)
      }

      const html = (input.qr ? stickersTemplateWithQr : stickersTemplate)({
        chunks
      })
      const filename = `STICKERS #${input.arr[0]?.storeNo} - ${Date.now()}.pdf`
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

      return {
        url
      }
    }),

  deleteOneItem: procedureMutateLocal
    .input(z.string())
    .mutation(async ({ ctx: { prisma }, input: id }) => {
      const found = await prisma.fulfilmentLogItem.findUniqueOrThrow({
        where: {
          id
        },
        include: {
          inventoryItem: {
            select: {
              quantity: true,
              purchaseOrderItem: {
                select: {
                  salesOrderItem: {
                    select: {
                      invoiceItems: {
                        select: {
                          id: true,
                          quantity: true
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

      const invQty =
        found.inventoryItem.purchaseOrderItem.salesOrderItem?.invoiceItems
          .reduce((acc, item) => acc + item.quantity, 0)
          .toFixed(3)

      if (
        invQty &&
        parseFloat(invQty) >
          parseFloat((found.inventoryItem.quantity - found.quantity).toFixed(3))
      )
        throw new Error('Cannot delete item with invoice items')

      await prisma.$transaction(async tx => {
        await prisma.inventoryItem.update({
          where: {
            id: found.inventoryItemId
          },
          data: {
            quantity: {
              decrement: found.quantity
            }
          }
        })
        await tx.fulfilmentLogItem.delete({
          where: {
            id
          }
        })
      })

      return 'Done'
    }),

  deleteOne: procedureMutateLocal
    .input(z.string())
    .mutation(async ({ ctx: { prisma }, input: id }) => {
      const found = await prisma.fulfilmentLog.findUniqueOrThrow({
        where: {
          id
        },
        include: {
          _count: {
            select: {
              items: true
            }
          }
        }
      })
      if (found._count.items)
        throw new Error('Cannot delete fulfilment log with items')

      await prisma.fulfilmentLog.delete({
        where: {
          id
        }
      })

      return 'Done'
    })
})
