import { Workbook, Worksheet } from 'exceljs'
import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'

const updateCreate = z.object({
  id: z.string().optional(),
  pinvNumber: z.string().optional(),
  type: z.string().optional(),
  portOfDischarge: z.string().optional(),
  salesOrderNumber: z.string().optional(),
  bvRef: z.string().optional(),
  fileNumber: z.string().optional(),
  remarks: z.string().optional()
})

export const salesCollectionRouter = createTRPCRouter({
  getAll: protectedProcedure
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
      const [salesCollection, total] = await Promise.all([
        prisma.salesCollection.findMany({
          orderBy: {
            [input.sortBy || 'createdAt']: input.sortOrder || 'desc'
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            bvRef: true,
            remarks: true,
            fileNumber: true,
            pinvNumber: true,
            salesOrderNumber: true,
            portOfDischarge: true,
            type: true,
            createdAt: true,
            createdBy: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }),
        prisma.salesCollection.count({
          where
        })
      ])
      return { salesCollection, total }
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
      const [salesCollections, total] = await Promise.all([
        prisma.salesCollection.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            bvRef: true,
            remarks: true,
            fileNumber: true,
            pinvNumber: true,
            portOfDischarge: true,
            type: true,
            salesOrderNumber: true
          }
        }),
        prisma.salesCollection.count({
          where
        })
      ])
      return { salesCollections, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.salesCollection.findUniqueOrThrow({
        where: {
          id: input.id
        },
        select: {
          id: true,
          bvRef: true,
          remarks: true,
          fileNumber: true,
          portOfDischarge: true,
          pinvNumber: true,
          type: true
        }
      })
    }),

  createOrUpdateOne: adminProtectedProcedure
    .input(updateCreate)
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (input.id)
        return await prisma.salesCollection.update({
          where: {
            id: input.id
          },
          data: {
            pinvNumber: input.pinvNumber,
            salesOrderNumber: input.salesOrderNumber,
            portOfDischarge: input.portOfDischarge,
            bvRef: input.bvRef,
            fileNumber: input.fileNumber,
            remarks: input.remarks,
            type: input.type,
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
      return await prisma.salesCollection.create({
        data: {
          pinvNumber: input.pinvNumber || '',
          salesOrderNumber: input.salesOrderNumber || '',
          portOfDischarge: input.portOfDischarge || '',
          bvRef: input.bvRef || '',
          fileNumber: input.fileNumber || '',
          remarks: input.remarks || '',
          type: input.type || '',
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
      return await prisma.salesCollection.update({
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

  export: protectedProcedure
    .input(
      z.object({
        search: z.string().optional()
      })
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
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

      let skip = 0
      const take = 1000
      const allSalesCollection: any[] = []
      while (skip < 10000) {
        const salesCollection = await prisma.salesCollection.findMany({
          where,
          skip,
          take
        })
        if (!salesCollection.length) break
        for (let i = 0; i < salesCollection.length; i++) {
          const salesCollections = salesCollection[i]
          if (!salesCollections) continue
          allSalesCollection.push({
            srno: i + 1 + skip,
            ...salesCollections
          })
        }
        skip += take
      }
      const book = new Workbook()
      const sheet = book.addWorksheet('Sales Collection')

      sheet.columns = [
        { header: 'ID', key: 'id', width: 32 },
        { header: 'SALES ORDER NO', key: 'salesOrderNumber', width: 32 },
        { header: 'PINV NO', key: 'pinvNumber', width: 10 },
        { header: 'TYPE', key: 'type', width: 32 },
        { header: 'PORT OF DISCHARGE', key: 'portOfDischarge', width: 10 },
        { header: 'BV REF', key: 'bvRef', width: 32 },
        { header: 'FILE NO', key: 'fileNumber', width: 32 },
        { header: 'REMARKS', key: 'remarks', width: 32 }
      ]
      sheet.addRows(allSalesCollection)

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

      const filename = `SalesCollection-${Date.now()}.xlsx`
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

  import: adminProtectedProcedure
    .input(
      z.object({
        attachmentId: z.string()
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

      const headerMapping: any = {
        ID: 'id',
        'SALES ORDER NO': 'salesOrderNumber',
        'PORT OF DISCHARGE': 'portOfDischarge',
        TYPE: 'type',
        'PINV NO': 'pinvNumber',
        'BV REF': 'bvRef',
        'FILE NO': 'fileNumber',
        REMARKS: 'remarks'
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

        const parsed = updateCreate.safeParse(rowData)

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

        const filename = `Error-salescollection-${Date.now()}.xlsx`
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
              if (data.id) {
                try {
                  data.updatedById = session.user.id
                  await tx.salesCollection.update({
                    where: {
                      id: data.id
                    },
                    data: {
                      ...data,
                      updatedById: session.user.id
                    }
                  })
                } catch (err: any) {
                  sheet!.getCell(i + 2, errorColumnIndex).value =
                    JSON.stringify(err.message || 'Error updating')
                  throw err
                }
              } else {
                try {
                  data.createdById = session.user.id
                  await tx.salesCollection.create({
                    data: {
                      ...data,
                      createdById: session.user.id,
                      updatedById: session.user.id
                    }
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
    })
})
