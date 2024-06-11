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
  invoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional(),
  customerName: z.string().optional(),
  inspectionAppliedDate: z.date().optional(),
  modeOfTransPort: z.string().optional(),
  from: z.string().optional(),
  dateOfLoading: z.date().optional(),
  onBoardDate: z.date().optional(),
  cntrNumber: z.string().optional(),
  shippingBillNumber: z.number().optional(),
  shippingBillDate: z.date().optional(),
  seaWayBlNumber: z.string().optional(),
  seaWayBlIssueDate: z.date().optional(),
  docsSubmissionDate: z.date().optional(),
  feriNumber: z.string().optional(),
  feriDate: z.date().optional(),
  crfApplyDate: z.date().optional(),
  crfIssueDate: z.date().optional(),
  etaOfShippment: z.string().optional(),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  policyNumber: z.string().optional(),
  rotdpAmount: z.number().optional(),
  dbk: z.number().optional(),
  dbkScrollNumber: z.string().optional(),
  dbkScrollDate: z.date().optional(),
  dbkCreditDate: z.date().optional(),
  rodtepRemarksScriptNumber: z.string().optional(),
  rodtepRemarksScriptDate: z.date().optional(),
  brcSubmissionDate: z.date().optional(),
  brcNumber: z.string().optional(),
  brcDate: z.date().optional(),
  billIdNumber: z.string().optional(),
  realisationDate: z.date().optional(),
  ammountSettledNumber: z.number().optional(),
  billAmountUsd: z.number().optional(),
  freightUsd: z.number().optional(),
  insuranceUsd: z.number().optional(),
  fobNetUsd: z.number().optional(),
  taxableValueInr: z.number().optional(),
  igstInr: z.number().optional(),
  amountReceivedPerTally: z.string().optional(),
  fobValueInr: z.number().optional(),
  freightInr: z.number().optional(),
  insuranceInr: z.number().optional(),
  exchangeRateInr: z.number().optional(),
  remarks: z.string().optional()
})

export const invoiceCollectionRouter = createTRPCRouter({
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
      const [invoiceCollection, total] = await Promise.all([
        prisma.invoiceCollection.findMany({
          orderBy: {
            [input.sortBy || 'createdAt']: input.sortOrder || 'desc'
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            customerName: true,
            inspectionAppliedDate: true,
            modeOfTransPort: true,
            from: true,
            dateOfLoading: true,
            onBoardDate: true,
            cntrNumber: true,
            shippingBillNumber: true,
            shippingBillDate: true,
            seaWayBlNumber: true,
            seaWayBlIssueDate: true,
            docsSubmissionDate: true,
            feriNumber: true,
            feriDate: true,
            crfApplyDate: true,
            crfIssueDate: true,
            etaOfShippment: true,
            portOfLoading: true,
            portOfDischarge: true,
            policyNumber: true,
            rotdpAmount: true,
            dbk: true,
            dbkScrollNumber: true,
            dbkScrollDate: true,
            dbkCreditDate: true,
            rodtepRemarksScriptNumber: true,
            rodtepRemarksScriptDate: true,
            brcSubmissionDate: true,
            brcNumber: true,
            brcDate: true,
            billIdNumber: true,
            realisationDate: true,
            ammountSettledNumber: true,
            billAmountUsd: true,
            freightUsd: true,
            insuranceUsd: true,
            fobNetUsd: true,
            taxableValueInr: true,
            igstInr: true,
            amountReceivedPerTally: true,
            fobValueInr: true,
            freightInr: true,
            insuranceInr: true,
            exchangeRateInr: true,
            remarks: true,
            createdAt: true,
            createdBy: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }),
        prisma.invoiceCollection.count({
          where
        })
      ])
      return { invoiceCollection, total }
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
      const [invoiceCollections, total] = await Promise.all([
        prisma.invoiceCollection.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where
        }),
        prisma.invoiceCollection.count({
          where
        })
      ])
      return { invoiceCollections, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.invoiceCollection.findUniqueOrThrow({
        where: {
          id: input.id
        }
      })
    }),

  createOrUpdateOne: adminProtectedProcedure
    .input(updateCreate)
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (input.id)
        return await prisma.invoiceCollection.update({
          where: {
            id: input.id
          },
          data: {
            ...input,
            billIdNumber: input?.billIdNumber?.toString(),
            seaWayBlNumber: input.seaWayBlNumber?.toString(),
            dbkScrollNumber: input.dbkScrollNumber?.toString(),
            createdById: session.user.id,
            updatedById: session.user.id
          }
        })
      return await prisma.invoiceCollection.create({
        data: {
          ...input,
          billIdNumber: input?.billIdNumber?.toString(),
          seaWayBlNumber: input.seaWayBlNumber?.toString(),
          dbkScrollNumber: input.dbkScrollNumber?.toString(),
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
      return await prisma.invoiceCollection.update({
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
      const allInvoiceCollection: any[] = []
      while (skip < 10000) {
        const invoiceCollection = await prisma.invoiceCollection.findMany({
          where,
          skip,
          take
        })
        if (!invoiceCollection.length) break
        for (let i = 0; i < invoiceCollection.length; i++) {
          const invoiceCollections = invoiceCollection[i]
          if (!invoiceCollections) continue
          allInvoiceCollection.push({
            srno: i + 1 + skip,
            ...invoiceCollections
          })
        }
        skip += take
      }
      const book = new Workbook()
      const sheet = book.addWorksheet('Invoice Collection')

      sheet.columns = [
        { header: 'ID', key: 'id', width: 32 },
        { header: 'INVOICE NO', key: 'invoiceNumber', width: 32 },
        { header: 'INVOICE DATE', key: 'invoiceDate', width: 32 },
        { header: 'CUSTOMER NAME', key: 'customerName', width: 32 },
        {
          header: 'INSPECTION APPLIED DATE',
          key: 'inspectionAppliedDate',
          width: 32
        },
        {
          header: 'MODE OF TRANSPORT',
          key: 'modeOfTransPort',
          width: 32
        },
        {
          header: 'FROM',
          key: 'from',
          width: 32
        },
        {
          header: 'DATE OF LOADING',
          key: 'dateOfLoading',
          width: 32
        },
        {
          header: 'ON BOARD DATE',
          key: 'onBoardDate',
          width: 32
        },
        {
          header: 'CNTR NO',
          key: 'cntrNumber',
          width: 32
        },
        {
          header: 'SHIPPING BILL NO',
          key: 'shippingBillNumber',
          width: 32
        },
        {
          header: 'SHIPPING BILL DATE',
          key: 'shippingBillDate',
          width: 32
        },
        {
          header: 'SEAWAY BL NO',
          key: 'seaWayBlNumber',
          width: 32
        },
        {
          header: 'SEAWAY BL ISSUE DATE',
          key: 'seaWayBlIssueDate',
          width: 32
        },
        {
          header: 'DOCS SUBMISSION DATE',
          key: 'docsSubmissionDate',
          width: 32
        },
        {
          header: 'FERI NO',
          key: 'feriNumber',
          width: 32
        },
        {
          header: 'FERI DATE',
          key: 'feriDate',
          width: 32
        },
        {
          header: 'CRF APPLY DATE',
          key: 'crfApplyDate',
          width: 32
        },
        {
          header: 'CRF ISSUE DATE',
          key: 'crfIssueDate',
          width: 32
        },
        {
          header: 'ETA OF SHIPMENT',
          key: 'etaOfShippment',
          width: 32
        },
        {
          header: 'PORT OF LOADING',
          key: 'portOfLoading',
          width: 32
        },
        {
          header: 'PORT OF DISCHARGE',
          key: 'portOfDischarge',
          width: 32
        },
        {
          header: 'POLICY NO',
          key: 'policyNumber',
          width: 32
        },
        {
          header: 'ROTDP AMOUNT',
          key: 'rotdpAmount',
          width: 32
        },
        {
          header: 'DBK',
          key: 'dbk',
          width: 32
        },
        {
          header: 'DBK SCROLL NO',
          key: 'dbkScrollNumber',
          width: 32
        },
        {
          header: 'DBK SCROLL DATE',
          key: 'dbkScrollDate',
          width: 32
        },
        {
          header: 'DBK CREDIT DATE',
          key: 'dbkCreditDate',
          width: 32
        },
        {
          header: 'RODTEP REMARKS SCRIPT NO',
          key: 'rodtepRemarksScriptNumber',
          width: 32
        },
        {
          header: 'RODTEP REMARKS SCRIPT DATE',
          key: 'rodtepRemarksScriptDate',
          width: 32
        },
        {
          header: 'BRC DATE OF SUBMISSION',
          key: 'brcSubmissionDate',
          width: 32
        },
        {
          header: 'BRC NO',
          key: 'brcNumber',
          width: 32
        },
        {
          header: 'BRC DATE',
          key: 'brcDate',
          width: 32
        },
        {
          header: 'BILL ID NO',
          key: 'billIdNumber',
          width: 32
        },
        {
          header: 'REALISATION DATE',
          key: 'realisationDate',
          width: 32
        },
        {
          header: 'AMOUNT SETTLED NO',
          key: 'ammountSettledNumber',
          width: 32
        },
        {
          header: 'BILL AMOUNT (USD)',
          key: 'billAmountUsd',
          width: 32
        },
        {
          header: 'FREIGHT (USD)',
          key: 'freightUsd',
          width: 32
        },
        {
          header: 'INSURANCE (USD)',
          key: 'insuranceUsd',
          width: 32
        },
        {
          header: 'FOB NET (USD)',
          key: 'fobNetUsd',
          width: 32
        },
        {
          header: 'TAXABLE VALUE (INR)',
          key: 'taxableValueInr',
          width: 32
        },
        {
          header: 'IGST (INR)',
          key: 'igstInr',
          width: 32
        },
        {
          header: 'AMOUNT RECEIVED PER TALLY',
          key: 'amountReceivedPerTally',
          width: 32
        },
        {
          header: 'FOB VALUE (INR)',
          key: 'fobValueInr',
          width: 32
        },
        {
          header: 'FREIGHT (INR)',
          key: 'freightInr',
          width: 32
        },
        {
          header: 'INSURANCE (INR)',
          key: 'insuranceInr',
          width: 32
        },
        {
          header: 'EXCHANGE RATE (INR)',
          key: 'exchangeRateInr',
          width: 32
        },
        {
          header: 'REMARKS',
          key: 'remarks',
          width: 32
        }
      ]

      sheet.addRows(allInvoiceCollection)

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

      const filename = `InvoiceCollection-${Date.now()}.xlsx`
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
        'INVOICE NO': 'invoiceNumber',
        'INVOICE DATE': 'invoiceDate',
        'CUSTOMER NAME': 'customerName',
        'INSPECTION APPLIED DATE': 'inspectionAppliedDate',
        'MODE OF TRANSPORT': 'modeOfTransPort',
        FROM: 'from',
        'DATE OF LOADING': 'dateOfLoading',
        'ON BOARD DATE': 'onBoardDate',
        'CNTR NO': 'cntrNumber',
        'SHIPPING BILL NO': 'shippingBillNumber',
        'SHIPPING BILL DATE': 'shippingBillDate',
        'SEAWAY BL NO': 'seaWayBlNumber',
        'SEAWAY BL ISSUE DATE': 'seaWayBlIssueDate',
        'DOCS SUBMISSION DATE': 'docsSubmissionDate',
        'FERI NO': 'feriNumber',
        'FERI DATE': 'feriDate',
        'CRF APPLY DATE': 'crfApplyDate',
        'CRF ISSUE DATE': 'crfIssueDate',
        'ETA OF SHIPMENT': 'etaOfShippment',
        'PORT OF LOADING': 'portOfLoading',
        'PORT OF DISCHARGE': 'portOfDischarge',
        'POLICY NO': 'policyNumber',
        'ROTDP AMOUNT': 'rotdpAmount',
        DBK: 'dbk',
        'DBK SCROLL NO': 'dbkScrollNumber',
        'DBK SCROLL DATE': 'dbkScrollDate',
        'DBK CREDIT DATE': 'dbkCreditDate',
        'RODTEP REMARKS SCRIPT NO': 'rodtepRemarksScriptNumber',
        'RODTEP REMARKS SCRIPT DATE': 'rodtepRemarksScriptDate',
        'BRC DATE OF SUBMISSION': 'brcSubmissionDate',
        'BRC NO': 'brcNumber',
        'BRC DATE': 'brcDate',
        'BILL ID NO': 'billIdNumber',
        'REALISATION DATE': 'realisationDate',
        'AMOUNT SETTLED NO': 'ammountSettledNumber',
        'BILL AMOUNT (USD)': 'billAmountUsd',
        'FREIGHT (USD)': 'freightUsd',
        'INSURANCE (USD)': 'insuranceUsd',
        'FOB NET (USD)': 'fobNetUsd',
        'TAXABLE VALUE (INR)': 'taxableValueInr',
        'IGST (INR)': 'igstInr',
        'AMOUNT RECEIVED PER TALLY': 'amountReceivedPerTally',
        'FOB VALUE (INR)': 'fobValueInr',
        'FREIGHT (INR)': 'freightInr',
        'INSURANCE (INR)': 'insuranceInr',
        'EXCHANGE RATE (INR)': 'exchangeRateInr',
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

            let cellValue = cell.value === 'NULL' ? null : cell.value

            if (
              headerMapping[headerValue.toString()] === 'billIdNumber' ||
              headerMapping[headerValue.toString()] === 'seaWayBlNumber' ||
              headerMapping[headerValue.toString()] === 'dbkScrollNumber'
            ) {
              cellValue = cellValue !== null ? cellValue?.toString() : null
            }

            rowData[headerMapping[headerValue.toString()]] = cellValue

            // rowData[headerMapping[headerValue.toString()]] =
            //   cell.value === 'NULL' ? null : cell.value
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

        const filename = `Error-InvoiceCollection-${Date.now()}.xlsx`
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
                  await tx.invoiceCollection.update({
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
                  await tx.invoiceCollection.create({
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
