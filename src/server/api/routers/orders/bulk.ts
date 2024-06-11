import { Workbook, Worksheet } from 'exceljs'
import { groupBy } from 'lodash'
import { z } from 'zod'
import { createTRPCRouter, rawProtectedProcedure } from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'
import { getIdStart } from '~/utils/getIdStart'
import { getPOComment } from '~/utils/getPOComment'

const procedureMutateLocal = rawProtectedProcedure(['ADMIN', 'USER'])

export const bulkRouter = createTRPCRouter({
  create: procedureMutateLocal
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

      const [
        users,
        customers,
        units,
        paymentTerms,
        suppliers,
        gstRates,
        lastOne,
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
        prisma.unit.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        }),
        prisma.paymentTerm.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        }),
        prisma.supplier.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            name: true
          }
        }),
        prisma.gstRate.findMany({
          where: {
            deletedAt: null
          },
          select: {
            id: true,
            rate: true
          }
        }),
        prisma.salesOrderItem.findFirst({
          orderBy: {
            counter: 'desc'
          }
        }),
        prisma.currency.findMany({})
      ])

      const usersObj: any = {}
      users.forEach(u => {
        if (u.name) usersObj[u.name] = u.id
      })

      const customersObj: any = {}
      customers.forEach(c => {
        if (c.name) customersObj[c.name] = c
      })

      const unitsObj: any = {}
      units.forEach(u => {
        if (u.name) unitsObj[u.name] = u.id
      })

      const paymentTermsObj: any = {}
      const paymentTermsObj2: any = {}
      paymentTerms.forEach(pt => {
        if (pt.name) {
          paymentTermsObj[pt.name] = pt.id
          paymentTermsObj2[pt.id] = pt.name
        }
      })

      const suppliersObj: any = {}
      suppliers.forEach(s => {
        if (s.name) suppliersObj[s.name] = s.id
      })

      const currencyObj: any = {}
      currencies.forEach(c => {
        if (c.name) currencyObj[c.name] = c.id
      })

      const headerMapping: any = {
        'ORDER ID': 'id2',
        'CUSTOMER REFERENCE ID': 'referenceId',
        DATE: 'date',
        'REPRESENTATIVE USER': 'representativeUser',
        CURRENCY: 'currency',
        'CUSTOMER NAME': 'customer',
        'PR NUMBER & NAME': 'prNumberAndName',
        'SITE REF': 'site',
        'ITEM ID': 'itemId',
        'SALES DESCRIPTION': 'description',
        'SIZE/SPECIFICATION': 'size',
        UNIT: 'unit',
        QTY: 'quantity',
        PRICE: 'price',
        'PURCHASE ORDER ID': 'poId2',
        'PO DATE': 'poDate',
        'PO REPRESENTATIVE USER': 'poRepresentativeUser',
        'SUPPLIER REFERENCE ID': 'poReferenceId',
        'SUPPLIER NAME': 'supplier',
        'PAYMENT TERMS': 'paymentTerms',
        'SAP CODE': 'sapCode',
        'PURCHASE DESCRIPTION': 'purchaseDescription',
        'PURCHASE SIZE/SPECIFICATION': 'purchaseSize',
        'PURCHASE UNIT': 'purchaseUnit',
        'PURCHASE QTY': 'purchaseQuantity',
        'PURCHASE PRICE': 'purchasePrice',
        'GST RATE': 'gstRate',
        'HSN CODE': 'hsnCode',
        'QUANTITY IN INVENTORY': 'quantityInInventory'
      }
      const jsonData: any[] = []

      let dataValidationError = false
      const errorColumnIndex = sheet.columnCount + 1

      let count = lastOne?.counter || 0

      sheet.eachRow((row, rowNumber) => {
        count++
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

        if (!rowData.date) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = 'DATE is required'
          return
        }

        if (!rowData.customer) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'CUSTOMER NAME is required'
          return
        }

        if (!rowData.description) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'SALES DESCRIPTION is required'
          return
        }

        if (!rowData.currency) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'Currency is required'
          return
        }

        if (!rowData.unit) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = 'UNIT is required'
          return
        }

        if (!rowData.quantity) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'QUANTITY is required'
          return
        }

        if (!rowData.price) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'PRICE is required'
          return
        }

        if (rowData.id2) rowData.id2 = rowData.id2.toString()
        if (rowData.referenceId)
          rowData.referenceId = rowData.referenceId.toString()
        if (rowData.quantityInInventory)
          rowData.quantityInInventory = parseFloat(rowData.quantityInInventory)

        const date = new Date(rowData.date)
        if (date.toString() === 'Invalid Date') {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = 'Invalid DATE'
          return
        }
        date.setUTCMinutes(date.getUTCMinutes() + input.timezoneOffset)
        rowData.date = date

        if (rowData.representativeUser) {
          const foundUser = usersObj[rowData.representativeUser.toString()]
          if (!foundUser) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid REPRESENTATIVE USER'
            return
          }
          rowData.representativeUserId = foundUser
          delete rowData.representativeUser
        } else {
          rowData.representativeUserId = session.user.id
        }

        const foundCustomer = customersObj[rowData.customer.toString()]
        if (!foundCustomer) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value =
            'Invalid CUSTOMER NAME'
          return
        }
        rowData.customerId = foundCustomer.id
        delete rowData.customer

        if (rowData.prNumberAndName)
          rowData.prNumberAndName = rowData.prNumberAndName.toString()

        if (rowData.site) {
          const foundSite = foundCustomer.sites.find(
            (s: any) => s.name === rowData.site.toString()
          )
          if (!foundSite) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid SITE REF'
            return
          }
          rowData.siteId = foundSite.id
          delete rowData.site
        }

        if (rowData.itemId) rowData.itemId = rowData.itemId.toString()
        else rowData.itemId = '0000' + count.toString().padStart(6, '0')

        if (
          typeof rowData.description === 'object' &&
          rowData.description.richText
        )
          rowData.description = rowData.description.richText
            .map((rt: any) => rt.text)
            .join('')
        else rowData.description = rowData.description.toString()

        if (rowData.size) rowData.size = rowData.size.toString()

        const foundUnit = unitsObj[rowData.unit.toString()]
        if (!foundUnit) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = 'Invalid UNIT'
          return
        }
        rowData.unitId = foundUnit
        delete rowData.unit

        rowData.quantity = parseFloat(rowData.quantity)
        if (isNaN(rowData.quantity)) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = 'Invalid QUANTITY'
          return
        }

        if (rowData.price) rowData.price = parseFloat(rowData.price)
        if (isNaN(rowData.price)) {
          dataValidationError = true
          sheet!.getCell(rowNumber, errorColumnIndex).value = 'Invalid PRICE'
          return
        }

        if (rowData.currency) {
          const c = currencyObj[rowData.currency.toString()]
          if (!c) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid Currency'
            return
          }
          rowData.currencyId = c
          delete rowData.currency
        }

        if (rowData.poDate) {
          const date = new Date(rowData.poDate)
          if (date.toString() === 'Invalid Date') {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid PO DATE'
            return
          }
          date.setUTCMinutes(date.getUTCMinutes() + input.timezoneOffset)
          rowData.poDate = date

          if (!rowData.supplier) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'SUPPLIER NAME is required'
            return
          }

          if (!rowData.paymentTerms) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'PAYMENT TERMS is required'
            return
          }

          if (!rowData.purchaseDescription) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'PURCHASE DESCRIPTION is required'
            return
          }

          if (!rowData.purchaseUnit) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'PURCHASE UNIT is required'
            return
          }

          if (!rowData.purchaseQuantity) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'PURCHASE QTY is required'
            return
          }

          if (!rowData.purchasePrice) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'PURCHASE PRICE is required'
            return
          }

          if (!rowData.gstRate) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'GST RATE is required'
            return
          }

          if (rowData.poRepresentativeUser) {
            const foundUser = usersObj[rowData.poRepresentativeUser.toString()]
            if (!foundUser) {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid PO REPRESENTATIVE USER'
              return
            }
            rowData.poRepresentativeUserId = foundUser
            delete rowData.poRepresentativeUser
          } else {
            rowData.poRepresentativeUserId = session.user.id
          }

          if (rowData.poId2) rowData.poId2 = rowData.poId2.toString()
          if (rowData.poReferenceId)
            rowData.poReferenceId = rowData.poReferenceId.toString()

          rowData.supplier = rowData.supplier.toString()
          const foundSupplier = suppliersObj[rowData.supplier]
          if (!foundSupplier) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid SUPPLIER NAME'
            return
          }
          rowData.supplierId = foundSupplier
          delete rowData.supplier

          rowData.paymentTerms = rowData.paymentTerms.toString()
          const foundPaymentTerm = paymentTermsObj[rowData.paymentTerms]
          if (!foundPaymentTerm) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid PAYMENT TERMS'
            return
          }
          rowData.paymentTermId = foundPaymentTerm
          delete rowData.paymentTerms

          if (
            typeof rowData.purchaseDescription === 'object' &&
            rowData.purchaseDescription.richText
          )
            rowData.purchaseDescription = rowData.purchaseDescription.richText
              .map((rt: any) => rt.text)
              .join('')
          else
            rowData.purchaseDescription = rowData.purchaseDescription.toString()

          if (rowData.sapCode) rowData.sapCode = rowData.sapCode.toString()

          if (rowData.purchaseSize)
            rowData.purchaseSize = rowData.purchaseSize.toString()

          const foundPurchaseUnit = unitsObj[rowData.purchaseUnit.toString()]
          if (!foundPurchaseUnit) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid PURCHASE UNIT'
            return
          }
          rowData.purchaseUnitId = foundPurchaseUnit
          delete rowData.purchaseUnit

          rowData.purchaseQuantity = parseFloat(rowData.purchaseQuantity)
          if (isNaN(rowData.purchaseQuantity)) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid PURCHASE QTY'
            return
          }

          rowData.purchasePrice = parseFloat(rowData.purchasePrice)
          if (isNaN(rowData.purchasePrice)) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid PURCHASE PRICE'
            return
          }

          rowData.gstRate = parseFloat(rowData.gstRate)
          if (isNaN(rowData.gstRate)) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid GST RATE'
            return
          }
          const foundGstRate = gstRates.find(g => g.rate === rowData.gstRate)
          if (!foundGstRate) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'Invalid GST RATE'
            return
          }
          rowData.gstRateId = foundGstRate.id
          delete rowData.gstRate

          if (rowData.hsnCode) rowData.hsnCode = rowData.hsnCode.toString()
          if (rowData.hsnCode && rowData.hsnCode.length > 8) {
            dataValidationError = true
            sheet!.getCell(rowNumber, errorColumnIndex).value =
              'HSN CODE must be less than 8'
            return
          }
        }

        jsonData.push(rowData)
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

        const filename = `Error-Import-Bulk Order-${Date.now()}.xlsx`
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
          errorFile: url
        }
      }

      if (dataValidationError) return await handleError()

      let transactionError = false

      try {
        await prisma.$transaction(async tx => {
          const groups = Object.values(
            groupBy(
              jsonData,
              jd =>
                (jd.id2 || '') +
                (jd.referenceId || '') +
                jd.customerId +
                (jd.prNumberAndName || '') +
                (jd.siteId || '') +
                jd.date.toISOString()
            )
          )

          for (const items of groups) {
            const start = getIdStart(items[0].date)

            let newId2 = items[0].id2

            if (!newId2) {
              const lastOne = await tx.salesOrder.findFirst({
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

              newId2 = `SO${start.itemIdStart}000001`
              if (lastOne?.id2) {
                const lastNum = parseInt(lastOne.id2.slice(6) || '0')
                newId2 = `SO${start.itemIdStart}${(lastNum + 1)
                  .toString()
                  .padStart(6, '0')}`
              }
            }

            const createdSalesOrder = await tx.salesOrder.create({
              data: {
                id2: newId2,
                totalAmount: parseFloat(
                  items
                    .reduce((acc, item) => acc + item.price * item.quantity, 0)
                    .toFixed(2)
                ),
                date: items[0].date,
                representativeUserId: items[0].representativeUserId,
                customerId: items[0].customerId,
                prNumberAndName: items[0].prNumberAndName,
                siteId: items[0].siteId,
                referenceId: items[0].referenceId,
                currencyId: items[0].currencyId,
                createdById: session.user.id,
                updatedById: session.user.id,
                items: {
                  createMany: {
                    data: items.map(item => ({
                      itemId: item.itemId,
                      description: item.description,
                      size: item.size,
                      unitId: item.unitId,
                      quantity: item.quantity,
                      price: item.price
                    }))
                  }
                }
              },
              include: {
                items: true
              }
            })
            const poGroups = Object.values(
              groupBy(
                items.filter(
                  item => item.supplierId && item.paymentTermId && item.poDate
                ),
                item =>
                  (item.poId2 || '') +
                  item.supplierId +
                  (item.poReferenceId || '') +
                  item.paymentTermId +
                  item.poDate.toISOString()
              )
            )
            for (const poItems of poGroups) {
              let newId2 = poItems[0].poId2
              if (!newId2) {
                const start = getIdStart(poItems[0].poDate)

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

                newId2 = `PO${start.itemIdStart}000001`
                if (lastOne?.id2) {
                  const lastNum = parseInt(lastOne.id2.slice(6) || '0')
                  newId2 = `PO${start.itemIdStart}${(lastNum + 1)
                    .toString()
                    .padStart(6, '0')}`
                }
              }

              const createdPO = await tx.purchaseOrder.create({
                data: {
                  id2: newId2,
                  totalAmount: parseFloat(
                    poItems
                      .reduce(
                        (acc, item) =>
                          acc + item.purchasePrice * item.purchaseQuantity,
                        0
                      )
                      .toFixed(2)
                  ),
                  date: poItems[0].poDate,
                  stage: 'Open',
                  representativeUserId: poItems[0].poRepresentativeUserId,
                  currencyId: createdSalesOrder.currencyId,
                  supplierId: poItems[0].supplierId,
                  referenceId: poItems[0].poReferenceId,
                  paymentTermId: poItems[0].paymentTermId,
                  salesOrderId: createdSalesOrder.id,
                  comments: getPOComment(
                    paymentTermsObj2[poItems[0].paymentTermId]
                  ),
                  createdById: session.user.id,
                  updatedById: session.user.id,
                  items: {
                    createMany: {
                      data: poItems.map(item => ({
                        itemId: item.itemId,
                        sapCode: item.sapCode,
                        description: item.purchaseDescription,
                        size: item.purchaseSize,
                        unitId: item.purchaseUnitId,
                        quantity: item.purchaseQuantity,
                        price: item.purchasePrice,
                        gstRateId: item.gstRateId,
                        hsnCode: item.hsnCode,
                        salesOrderItemId: createdSalesOrder.items.find(
                          i => i.itemId === item.itemId
                        )?.id
                      }))
                    }
                  }
                },
                include: {
                  items: true
                }
              })
              let allFulfilled = true
              for (const poi of poItems) {
                if (poi.quantityInInventory) {
                  const found = createdPO.items.find(
                    item => item.itemId === poi.itemId
                  )
                  if (!found) {
                    allFulfilled = false
                    continue
                  }
                  if (found.quantity < poi.quantityInInventory)
                    allFulfilled = false
                  const { id: fulfilmentLogId } = await tx.fulfilmentLog.create(
                    {
                      data: {
                        gateEntryNumber: '',
                        location: '',
                        invoiceId: Math.random().toString(),
                        supplierId: poi.supplierId,
                        createdById: session.user.id,
                        updatedById: session.user.id
                      }
                    }
                  )
                  const q = Math.min(poi.quantityInInventory, found.quantity)
                  const invItem = await tx.inventoryItem.create({
                    data: {
                      quantity: q,
                      purchaseOrderItemId: found.id
                    }
                  })
                  await tx.fulfilmentLogItem.create({
                    data: {
                      quantity: q,
                      inventoryItemId: invItem.id,
                      fulfilmentLogId
                    }
                  })
                } else allFulfilled = false
              }
              if (allFulfilled)
                await tx.purchaseOrder.update({
                  where: {
                    id: createdPO.id
                  },
                  data: {
                    stage: 'Fulfilment'
                  }
                })
            }

            const si = await tx.salesOrderItem.findMany({
              where: {
                salesOrderId: createdSalesOrder.id
              },
              select: {
                id: true,
                _count: {
                  select: {
                    purchaseOrderItems: true
                  }
                }
              }
            })
            const filtered = si.filter(item => !item._count.purchaseOrderItems)
            if (!filtered) {
              await tx.salesOrder.update({
                where: {
                  id: createdSalesOrder.id
                },
                data: {
                  stage: 'Open'
                }
              })
            }
          }
        })
      } catch (err) {
        transactionError = true
      }

      if (transactionError) return await handleError()

      return {
        message: 'Done'
      }
    })
})
