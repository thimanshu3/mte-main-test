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
  name: z.string().min(1)
})

export const inquiryCancelReasonsRouter = createTRPCRouter({
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
      const [inquiryCancelReasons, total] = await Promise.all([
        prisma.inquiryCancelReason.findMany({
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
        prisma.inquiryCancelReason.count({
          where
        })
      ])
      return { inquiryCancelReasons, total }
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
      const [inquiryCancelReasons, total] = await Promise.all([
        prisma.inquiryCancelReason.findMany({
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
        prisma.inquiryCancelReason.count({
          where
        })
      ])
      return { inquiryCancelReasons, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.inquiryCancelReason.findUniqueOrThrow({
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
        return await prisma.inquiryCancelReason.update({
          where: {
            id: input.id
          },
          data: {
            name: input.name,
            updatedById: session.user.id
          }
        })
      return await prisma.inquiryCancelReason.create({
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
      return await prisma.inquiryCancelReason.update({
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
      const allInquiriesCancelReasons: any[] = []
      while (skip < 10000) {
        const inquiryCancelReasons = await prisma.inquiryCancelReason.findMany({
          where,
          skip,
          take
        })
        if (!inquiryCancelReasons.length) break
        for (let i = 0; i < inquiryCancelReasons.length; i++) {
          const inquiriesCancelReason = inquiryCancelReasons[i]
          if (!inquiriesCancelReason) continue
          allInquiriesCancelReasons.push({
            srno: i + 1 + skip,
            ...inquiriesCancelReason
          })
        }
        skip += take
      }
      const book = new Workbook()
      const sheet = book.addWorksheet('Inquiry Cancel Reasons')

      sheet.columns = [
        { header: 'INQUIRY CANCEL REASON ID', key: 'id', width: 10 },
        { header: 'NAME', key: 'name', width: 32 }
      ]
      sheet.addRows(allInquiriesCancelReasons)

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

      const filename = `Inquiry Cancel Reasons-${Date.now()}.xlsx`
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
        'INQUIRY CANCEL REASON ID': 'id',
        NAME: 'name'
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

        const filename = `Error-Import-Inquiry Cancel Reason-${Date.now()}.xlsx`
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
                  await tx.inquiryCancelReason.update({
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
                  data.createdById = session.user.id
                  await tx.inquiryCancelReason.create({
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
    })
})
