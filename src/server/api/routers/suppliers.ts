import { Workbook, Worksheet } from 'exceljs'
import { z } from 'zod'
import {
  adminProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'

const createOrUpdateInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  businessTypeId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  paymentTermId: z.string().optional().nullable(),
  gst: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  alternateMobile: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  email2: z.string().optional().nullable(),
  email3: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  purchaseContactName: z.string().optional().nullable(),
  purchaseContactGender: z
    .enum(['Male', 'Female', 'Other'])
    .optional()
    .nullable(),
  purchaseContactDesignation: z.string().optional().nullable(),
  purchaseContactAadhar: z.string().optional().nullable(),
  purchaseContactPan: z.string().optional().nullable(),
  purchaseContactAddress: z.string().optional().nullable(),
  purchaseContactMobile: z.string().optional().nullable(),
  accountsContactName: z.string().optional().nullable(),
  accountsContactGender: z
    .enum(['Male', 'Female', 'Other'])
    .optional()
    .nullable(),
  accountsContactDesignation: z.string().optional().nullable(),
  accountsContactAadhar: z.string().optional().nullable(),
  accountsContactPan: z.string().optional().nullable(),
  accountsContactAddress: z.string().optional().nullable(),
  accountsContactMobile: z.string().optional().nullable(),
  logisticContactName: z.string().optional().nullable(),
  logisticContactGender: z
    .enum(['Male', 'Female', 'Other'])
    .optional()
    .nullable(),
  logisticContactDesignation: z.string().optional().nullable(),
  logisticContactAadhar: z.string().optional().nullable(),
  logisticContactPan: z.string().optional().nullable(),
  logisticContactAddress: z.string().optional().nullable(),
  logisticContactMobile: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankBranchCode: z.string().optional().nullable(),
  bankAccountHolderName: z.string().optional().nullable(),
  bankAccountNumber: z.string().optional().nullable(),
  bankIfscCode: z.string().optional().nullable(),
  bankMicrNumber: z.string().optional().nullable(),
  primaryBankAccountId: z.string().optional().nullable(),
  taxCalcType: z.enum(['InterState', 'IntraState']).optional().nullable(),
  attachmentIds: z.array(z.string()).optional().nullable()
})

export const suppliersRouter = createTRPCRouter({
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
      const [suppliers, total] = await Promise.all([
        prisma.supplier.findMany({
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
            },
            _count: {
              select: {
                inquiries: true
              }
            }
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.supplier.count({
          where
        })
      ])
      return { suppliers, total }
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
      const [suppliers, total] = await Promise.all([
        prisma.supplier.findMany({
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
        prisma.supplier.count({
          where
        })
      ])
      return { suppliers, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1)
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.supplier.findUniqueOrThrow({
        where: {
          id: input.id
        },
        include: {
          attachments: true,
          bankAccounts: true,
          primaryBankAccount: true,
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
    .input(createOrUpdateInput)
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      if (input.primaryBankAccountId) {
        const b = await prisma.bankAccount.findUniqueOrThrow({
          where: {
            id: input.primaryBankAccountId
          }
        })
        if (!b.isVerified) throw new Error('Bank Account is not verified')
      }
      if (input.id) {
        const updated = await prisma.supplier.update({
          where: {
            id: input.id
          },
          data: {
            name: input.name,
            businessTypeId: input.businessTypeId,
            address: input.address,
            gst: input.gst,
            pan: input.pan,
            mobile: input.mobile,
            alternateMobile: input.alternateMobile,
            email: input.email,
            email2: input.email2,
            email3: input.email3,
            whatsapp: input.whatsapp,
            website: input.website,
            paymentTermId: input.paymentTermId,
            purchaseContactName: input.purchaseContactName,
            purchaseContactGender: input.purchaseContactGender,
            purchaseContactDesignation: input.purchaseContactDesignation,
            purchaseContactAadhar: input.purchaseContactAadhar,
            purchaseContactPan: input.purchaseContactPan,
            purchaseContactAddress: input.purchaseContactAddress,
            purchaseContactMobile: input.purchaseContactMobile,
            accountsContactName: input.accountsContactName,
            accountsContactGender: input.accountsContactGender,
            accountsContactDesignation: input.accountsContactDesignation,
            accountsContactAadhar: input.accountsContactAadhar,
            accountsContactPan: input.accountsContactPan,
            accountsContactAddress: input.accountsContactAddress,
            accountsContactMobile: input.accountsContactMobile,
            logisticContactName: input.logisticContactName,
            logisticContactGender: input.logisticContactGender,
            logisticContactDesignation: input.logisticContactDesignation,
            logisticContactAadhar: input.logisticContactAadhar,
            logisticContactPan: input.logisticContactPan,
            logisticContactAddress: input.logisticContactAddress,
            logisticContactMobile: input.logisticContactMobile,
            bankName: input.bankName,
            bankBranchCode: input.bankBranchCode,
            bankAccountHolderName: input.bankAccountHolderName,
            bankAccountNumber: input.bankAccountNumber,
            bankIfscCode: input.bankIfscCode,
            bankMicrNumber: input.bankMicrNumber,
            primaryBankAccountId: input.primaryBankAccountId,
            taxCalcType: input.taxCalcType,
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
              supplierId: input.id
            }
          })
        }
        return updated
      } else {
        const newSupplier = await prisma.supplier.create({
          data: {
            name: input.name,
            businessTypeId: input.businessTypeId,
            address: input.address,
            gst: input.gst,
            pan: input.pan,
            mobile: input.mobile,
            alternateMobile: input.alternateMobile,
            email: input.email,
            email2: input.email2,
            email3: input.email3,
            whatsapp: input.whatsapp,
            website: input.website,
            paymentTermId: input.paymentTermId,
            purchaseContactName: input.purchaseContactName,
            purchaseContactGender: input.purchaseContactGender,
            purchaseContactDesignation: input.purchaseContactDesignation,
            purchaseContactAadhar: input.purchaseContactAadhar,
            purchaseContactPan: input.purchaseContactPan,
            purchaseContactAddress: input.purchaseContactAddress,
            purchaseContactMobile: input.purchaseContactMobile,
            accountsContactName: input.accountsContactName,
            accountsContactGender: input.accountsContactGender,
            accountsContactDesignation: input.accountsContactDesignation,
            accountsContactAadhar: input.accountsContactAadhar,
            accountsContactPan: input.accountsContactPan,
            accountsContactAddress: input.accountsContactAddress,
            accountsContactMobile: input.accountsContactMobile,
            logisticContactName: input.logisticContactName,
            logisticContactGender: input.logisticContactGender,
            logisticContactDesignation: input.logisticContactDesignation,
            logisticContactAadhar: input.logisticContactAadhar,
            logisticContactPan: input.logisticContactPan,
            logisticContactAddress: input.logisticContactAddress,
            logisticContactMobile: input.logisticContactMobile,
            bankName: input.bankName,
            bankBranchCode: input.bankBranchCode,
            bankAccountHolderName: input.bankAccountHolderName,
            bankAccountNumber: input.bankAccountNumber,
            bankIfscCode: input.bankIfscCode,
            bankMicrNumber: input.bankMicrNumber,
            primaryBankAccountId: input.primaryBankAccountId,
            taxCalcType: input.taxCalcType,
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
              supplierId: newSupplier.id
            }
          })
        }
        return newSupplier
      }
    }),

  deleteOne: adminProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        activate: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      return await prisma.supplier.update({
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

      const include = {
        businessType: {
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
        }
      }

      let skip = 0
      const take = 1000
      const allSupplier: any[] = []
      while (skip < 10000) {
        const suppliers = await prisma.supplier.findMany({
          where,
          include,
          skip,
          take
        })
        if (!suppliers.length) break
        for (let i = 0; i < suppliers.length; i++) {
          const supplier = suppliers[i]
          if (!supplier) continue
          allSupplier.push({
            srno: i + 1 + skip,
            ...supplier,
            bussinessType: supplier.businessType?.name,
            paymentTerms: supplier.paymentTerm?.name
          })
        }
        skip += take
      }

      const book = new Workbook()
      const sheet = book.addWorksheet('Suppliers')

      sheet.columns = [
        { header: 'SUPPLIER ID', key: 'id', width: 10 },
        { header: 'NAME', key: 'name', width: 32 },
        { header: 'BUSINESS TYPE', key: 'bussinessType', width: 32 },
        { header: 'ADDRESS', key: 'address', width: 32 },
        { header: 'GST', key: 'gst', width: 32 },
        { header: 'PAN', key: 'pan', width: 32 },
        { header: 'MOBILE', key: 'mobile', width: 32 },
        { header: 'ALTERNATE MOBILE', key: 'alternateMobile', width: 32 },
        { header: 'EMAIL', key: 'email', width: 32 },
        { header: 'EMAIL 2', key: 'email2', width: 32 },
        { header: 'EMAIL 3', key: 'email3', width: 32 },
        { header: 'WHATSAPP', key: 'whatsapp', width: 32 },
        { header: 'WEBSITE', key: 'website', width: 32 },
        { header: 'PAYMENT TERMS', key: 'paymentTerms', width: 32 },

        {
          header: 'PURCHASE CONTACT NAME',
          key: 'purchaseContactName',
          width: 32
        },
        {
          header: 'PURCHASE CONTACT GENDER',
          key: 'purchaseContactGender',
          width: 32
        },
        {
          header: 'PURCHASE CONTACT DESIGNATION',
          key: 'purchaseContactDesignation',
          width: 32
        },
        {
          header: 'PURCHASE CONTACT AADHAR',
          key: 'purchaseContactAadhar',
          width: 32
        },
        {
          header: 'PURCHASE CONTACT PAN',
          key: 'purchaseContactPan',
          width: 32
        },
        {
          header: 'PURCHASE CONTACT ADDRESS',
          key: 'purchaseContactAddress',
          width: 32
        },
        {
          header: 'PURCHASE CONTACT MOBILE',
          key: 'purchaseContactMobile',
          width: 32
        },
        {
          header: 'ACCOUNTS CONTACT NAME',
          key: 'accountsContactName',
          width: 32
        },
        {
          header: 'ACCOUNTS CONTACT GENDER',
          key: 'accountsContactGender',
          width: 32
        },
        {
          header: 'ACCOUNTS CONTACT DESIGNATION',
          key: 'accountsContactDesignation',
          width: 32
        },
        {
          header: 'ACCOUNTS CONTACT AADHAR',
          key: 'accountsContactAadhar',
          width: 32
        },

        {
          header: 'ACCOUNTS CONTACT PAN',
          key: 'accountsContactPan',
          width: 32
        },
        {
          header: 'ACCOUNTS CONTACT ADDRESS',
          key: 'accountsContactAddress',

          width: 32
        },

        {
          header: 'ACCOUNTS CONTACT MOBILE',
          key: 'accountsContactMobile',
          width: 32
        },
        {
          header: 'LOGISTIC CONTACT NAME',
          key: 'logisticContactName',
          width: 32
        },
        {
          header: 'LOGISTIC CONTACT GENDER',
          key: 'logisticContactGender',
          width: 32
        },
        {
          header: 'LOGISTIC CONTACT DESIGNATION',
          key: 'logisticContactDesignation',
          width: 32
        },
        {
          header: 'LOGISTIC CONTACT AADHAR',
          key: 'logisticContactAadhar',
          width: 32
        },
        {
          header: 'LOGISTIC CONTACT PAN',
          key: 'logisticContactPan',
          width: 32
        },
        {
          header: 'LOGISTIC CONTACT ADDRESS',
          key: 'logisticContactAddress',
          width: 32
        },
        {
          header: 'LOGISTIC CONTACT MOBILE',
          key: 'logisticContactMobile',
          width: 32
        },
        {
          header: 'BANK NAME',
          key: 'bankName',
          width: 32
        },
        {
          header: 'BANK BRANCH CODE',
          key: 'bankBranchCode',
          width: 32
        },
        {
          header: 'BANK ACCOUNT HOLDER NAME',
          key: 'bankAccountHolderName',
          width: 32
        },
        {
          header: 'BANK ACCOUNT NUMBER',
          key: 'bankAccountNumber',
          width: 32
        },
        {
          header: 'BANK IFSC CODE',
          key: 'bankIfscCode',
          width: 32
        },
        {
          header: 'BANK MICR NUMBER',
          key: 'bankMicrNumber',
          width: 32
        },
        {
          header: 'TAX CALC TYPE',
          key: 'taxCalcType',
          width: 32
        }
      ]

      sheet.addRows(allSupplier)

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

      const filename = `Suppliers-${Date.now()}.xlsx`
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

      const [businessTypes, paymentTerms] = await Promise.all([
        prisma.businessType.findMany({
          select: {
            id: true,
            name: true
          }
        }),
        prisma.paymentTerm.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ])

      const headerMapping: any = {
        'SUPPLIER ID': 'id',
        NAME: 'name',
        'BUSINESS TYPE': 'bussinessType',
        ADDRESS: 'address',
        GST: 'gst',
        PAN: 'pan',
        MOBILE: 'mobile',
        'ALTERNATE MOBILE': 'alternateMobile',
        EMAIL: 'email',
        'EMAIL 2': 'email2',
        'EMAIL 3': 'email3',
        WHATSAPP: 'whatsapp',
        WEBSITE: 'website',
        'PAYMENT TERMS': 'paymentTerms',
        'PURCHASE CONTACT NAME': 'purchaseContactName',
        'PURCHASE CONTACT GENDER': 'purchaseContactGender',
        'PURCHASE CONTACT DESIGNATION': 'purchaseContactDesignation',
        'PURCHASE CONTACT AADHAR': 'purchaseContactAadhar',
        'PURCHASE CONTACT PAN': 'purchaseContactPan',
        'PURCHASE CONTACT ADDRESS': 'purchaseContactAddress',
        'PURCHASE CONTACT MOBILE': 'purchaseContactMobile',
        'ACCOUNTS CONTACT NAME': 'accountsContactName',
        'ACCOUNTS CONTACT GENDER': 'accountsContactGender',
        'ACCOUNTS CONTACT DESIGNATION': 'accountsContactDesignation',
        'ACCOUNTS CONTACT AADHAR': 'accountsContactAadhar',
        'ACCOUNTS CONTACT PAN': 'accountsContactPan',
        'ACCOUNTS CONTACT ADDRESS': 'accountsContactAddress',
        'ACCOUNTS CONTACT MOBILE': 'accountsContactMobile',
        'LOGISTIC CONTACT NAME': 'logisticContactName',
        'LOGISTIC CONTACT GENDER': 'logisticContactGender',
        'LOGISTIC CONTACT DESIGNATION': 'logisticContactDesignation',
        'LOGISTIC CONTACT AADHAR': 'logisticContactAadhar',
        'LOGISTIC CONTACT PAN': 'logisticContactPan',
        'LOGISTIC CONTACT ADDRESS': 'logisticContactAddress',
        'LOGISTIC CONTACT MOBILE': 'logisticContactMobile',
        'BANK NAME': 'bankName',
        'BANK BRANCH CODE': 'bankBranchCode',
        'BANK ACCOUNT HOLDER NAME': 'bankAccountHolderName',
        'BANK ACCOUNT NUMBER': 'bankAccountNumber',
        'BANK IFSC CODE': 'bankIfscCode',
        'BANK MICR NUMBER': 'bankMicrNumber',
        'TAX CALC TYPE': 'taxCalcType'
      }

      const jsonData: any = []
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

        if (rowData.bussinessType || rowData.bussinessType === null) {
          if (rowData.bussinessType === null) {
            rowData.businessTypeId = null
          } else {
            const foundBusinessType = businessTypes.find(
              b => b.name === rowData.bussinessType
            )

            if (foundBusinessType) {
              rowData.businessTypeId = foundBusinessType.id
            } else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Business Type'
              return
            }
          }
        }
        delete rowData.bussinessType

        if (rowData.paymentTerms || rowData.paymentTerms === null) {
          if (rowData.paymentTerms === null) {
            rowData.paymentTermId = null
          } else {
            const foundPaymentTerm = paymentTerms.find(
              b => b.name === rowData.paymentTerms
            )

            if (foundPaymentTerm) {
              rowData.paymentTermId = foundPaymentTerm.id
            } else {
              dataValidationError = true
              sheet!.getCell(rowNumber, errorColumnIndex).value =
                'Invalid Payment Term'
              return
            }
          }
        }
        delete rowData.paymentTerms

        const parsed = (rowData.id = createOrUpdateInput.safeParse(rowData))

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

        const filename = `Error-Import-Supplier-${Date.now()}.xlsx`
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
                  await tx.supplier.update({
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
                if (session.user.role === 'SUPPLIER') continue
                try {
                  data.createdById = session.user.id
                  data.updatedById = session.user.id
                  await tx.supplier.create({
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
