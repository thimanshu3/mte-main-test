import dayjs from 'dayjs'
import { Workbook } from 'exceljs'
import { readFileSync } from 'fs'
import Handlebars from 'handlebars'
import path from 'path'
import { z } from 'zod'
import { env } from '~/env.mjs'
import {
  createTRPCRouter,
  protectedProcedure,
  rawProtectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'
import { htmlToPdf } from '~/utils/htmlToPdf'
import { sendMail } from '~/utils/nodemailer'
import { sendWhatsappMessage } from '~/utils/sendWhatsappMessage'

const procedureLocal = rawProtectedProcedure(['ADMIN', 'USER'])

const getSendInquiryEmailTemplate = (remarks?: string) => {
  const t1 = `Dear Sir/Madam,

I hope this email finds you well. I am writing this to inquire about specific items and have attached the inquiry excel file for your reference. We request you to provide us with your best offer in response.

We value your attention to detail and would greatly appreciate if you could ensure that all the necessary information is included in your offer. Specifically, kindly provide the details mentioned in the "Green" coloured columns of the attached file. This information is crucial for our evaluation and further decision-making process.
If you have any queries or require further clarification, please do not hesitate to reach out to our representative (FPR) as you can also find in the below attached file.`

  const t2 = `

Thank You`

  if (!remarks) return t1 + t2
  return t1 + '\n\n' + remarks + t2
}

const supplierTemplate = Handlebars.compile(
  readFileSync(
    path.join(
      process.cwd(),
      'public',
      'templates',
      'pdfs',
      'quotationToSupplier.hbs'
    ),
    'utf-8'
  )
)

export const inquiriesSentToSupplierRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        supplierId: z.string().optional(),
        createdById: z.string().optional(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional(),
        showFulfilled: z.boolean().default(false)
      })
    )
    .query(async ({ ctx: { prisma, session }, input }) => {
      const openStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'open')?.id
      if (!openStatusId) throw new Error('No inquiry "open" status found')
      let supplierId: string | undefined
      if (session.user.role === 'SUPPLIER')
        supplierId = session.user.supplierId || ''
      const where = {
        supplierId: supplierId || input.supplierId,
        createdById: input.createdById,
        createdAt: input.dateRange
          ? {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            }
          : undefined,
        ...(supplierId !== undefined ||
        (session.user.role !== 'SUPPLIER' && !input.showFulfilled)
          ? {
              inquiries: {
                some: {
                  inquiry: {
                    statusId: openStatusId,
                    resultId: null,
                    supplierOfferDate: null
                  }
                }
              }
            }
          : {})
      }
      const [inquiriesSentToSupplier, total] = await Promise.all([
        prisma.inquiriesSentToSupplier.findMany({
          where,
          select: {
            id: true,
            emailSent: true,
            whatsappSent: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            },
            _count: {
              select: {
                inquiries: true,
                ...(session.user.role !== 'SUPPLIER'
                  ? {
                      resendHistory: true
                    }
                  : {})
              }
            },
            ...(session.user.role !== 'SUPPLIER'
              ? {
                  lastResendAt: true
                }
              : {}),
            createdAt: true,
            createdBy: {
              select: {
                id: true,
                name: true
              }
            }
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: {
            createdAt: 'desc'
          }
        }),
        prisma.inquiriesSentToSupplier.count({
          where
        })
      ])
      return { inquiriesSentToSupplier, total }
    }),

  getOne: protectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ ctx: { prisma, session }, input }) => {
      let openStatusId = ''
      if (session.user.role === 'SUPPLIER') {
        const statusId = (
          await prisma.inquiryStatus.findMany({
            select: {
              id: true,
              name: true
            }
          })
        ).find(st => st.name.toLowerCase() === 'open')?.id
        if (!statusId) throw new Error('No inquiry "open" status found')
        openStatusId = statusId
      }
      const inquiriesSentToSupplier =
        await prisma.inquiriesSentToSupplier.findFirstOrThrow({
          where: {
            id: input.id,
            ...(session.user.role === 'SUPPLIER'
              ? {
                  supplierId: session.user.supplierId || ''
                }
              : {})
          },
          select: {
            id: true,
            emailSent: true,
            whatsappSent: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            },
            inquiries: {
              where:
                session.user.role === 'SUPPLIER'
                  ? {
                      inquiry: {
                        statusId: openStatusId,
                        resultId: null,
                        supplierOfferDate: null
                      }
                    }
                  : undefined,
              select: {
                id: true,
                inquiry: {
                  select: {
                    id: true,
                    salesDescription: true,
                    salesUnitId: true,
                    quantity: true,
                    size: true,
                    purchaseDescription: true,
                    purchaseUnitId: true,
                    supplierPrice: true,
                    estimatedDeliveryDays: true,
                    gstRateId: true,
                    hsnCode: true,
                    supplierOfferDate: true,
                    frontPersonRepresentative: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true,
                        whatsapp: true
                      }
                    },
                    updatedAt: true,
                    updatedBy: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  }
                }
              }
            },
            lastResendAt: true,
            ...(session.user.role !== 'SUPPLIER'
              ? {
                  resendHistory: {
                    select: {
                      id: true,
                      emailSent: true,
                      whatsappSent: true,
                      createdAt: true,
                      createdBy: {
                        select: {
                          id: true,
                          name: true
                        }
                      }
                    },
                    orderBy: {
                      createdAt: 'desc'
                    }
                  }
                }
              : {}),
            createdAt: true,
            updatedAt: true,
            createdById: true,
            createdBy: {
              select: {
                id: true,
                name: true
              }
            },
            updatedById: true,
            updatedBy: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
      return inquiriesSentToSupplier
    }),

  getInquiries: procedureLocal
    .input(
      z.object({
        supplierId: z.string()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const openStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'open')?.id
      if (!openStatusId) throw new Error('No inquiry "open" status found')
      return await prisma.inquiry.findMany({
        where: {
          supplierId: input.supplierId,
          inquiryToSupplierDate: null,
          statusId: openStatusId,
          inquiriesSentToSupplierInquiry: null,
          resultId: null,
          supplierOfferDate: null,
          deletedAt: null
        },
        select: {
          id: true,
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
          prNumberAndName: true,
          date: true,
          salesDescription: true,
          salesUnit: {
            select: {
              id: true,
              name: true
            }
          },
          quantity: true,
          size: true,
          frontPersonRepresentative: {
            select: {
              id: true,
              name: true
            }
          },
          emailForSupplierRemarks: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    }),

  getReadySuppliers: procedureLocal.query(async ({ ctx: { prisma } }) => {
    const openStatusId = (
      await prisma.inquiryStatus.findMany({
        select: {
          id: true,
          name: true
        }
      })
    ).find(st => st.name.toLowerCase() === 'open')?.id
    if (!openStatusId) throw new Error('No inquiry "open" status found')
    const grouped = await prisma.inquiry.groupBy({
      by: ['supplierId'],
      where: {
        inquiryToSupplierDate: null,
        statusId: openStatusId,
        inquiriesSentToSupplierInquiry: null,
        resultId: null,
        supplierOfferDate: null,
        deletedAt: null
      },
      _count: {
        id: true
      }
    })
    const suppliers = await prisma.supplier.findMany({
      where: {
        id: {
          in: grouped.map(g => g.supplierId).filter(id => id) as string[]
        },
        deletedAt: null
      },
      select: {
        id: true,
        name: true
      }
    })
    return suppliers.map(s => ({
      id: s.id,
      name: s.name,
      count: grouped.find(g => g.supplierId === s.id)?._count.id || 0
    }))
  }),

  getSupplier: procedureLocal
    .input(z.string())
    .query(async ({ ctx: { prisma }, input }) => {
      return prisma.supplier.findUniqueOrThrow({
        where: {
          id: input
        },
        select: {
          id: true,
          email: true,
          email2: true,
          email3: true,
          whatsapp: true,
          mobile: true,
          alternateMobile: true,
          accountsContactMobile: true,
          logisticContactMobile: true,
          purchaseContactMobile: true
        }
      })
    }),

  previewOrCreate: procedureLocal
    .input(
      z.object({
        preview: z.boolean(),
        supplierId: z.string(),
        inquiryIds: z.array(z.string()).min(1),
        email: z.boolean(),
        whatsapp: z.boolean(),
        supplierEmails: z.array(z.string().email()),
        supplierWhatsappNumbers: z.array(z.string()),
        remarks: z.string().optional(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const openStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'open')?.id
      if (!openStatusId) throw new Error('No inquiry "open" status found')
      const inquiries = await prisma.inquiry.findMany({
        where: {
          id: {
            in: input.inquiryIds
          },
          supplierId: input.supplierId,
          inquiryToSupplierDate: null,
          statusId: openStatusId,
          inquiriesSentToSupplierInquiry: null,
          resultId: null,
          supplierOfferDate: null,
          deletedAt: null
        },
        select: {
          id: true,
          id2: true,
          date: true,
          site: {
            select: {
              id: true,
              name: true
            }
          },
          prNumberAndName: true,
          salesDescription: true,
          salesUnit: {
            select: {
              id: true,
              name: true
            }
          },
          quantity: true,
          size: true,
          supplier: {
            select: {
              id: true,
              name: true
            }
          },
          supplierPrice: true,
          frontPersonRepresentative: {
            select: {
              id: true,
              name: true,
              email: true,
              mobile: true
            }
          },
          image: {
            select: {
              id: true,
              newFilename: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
      if (!inquiries.length)
        return {
          success: false,
          message: 'No inquiries'
        }
      const allInquiries: any[] = []
      const uniqueFprIds = new Set([session.user.id])
      const fixTimezone = (date: Date) => {
        date.setUTCMinutes(date.getUTCMinutes() - input.timezoneOffset)
        return date
      }
      const now = new Date()
      const timezoneFixed = fixTimezone(new Date(now))
      const uniqueSubjectSitePr = new Set<string>()
      for (let i = 0; i < inquiries.length; i++) {
        const inquiry = inquiries[i]
        if (!inquiry) continue
        allInquiries.push({
          id: inquiry.id,
          id2: inquiry.id2,
          sr: i + 1,
          siteRef: inquiry.site?.name,
          prNumberAndName: inquiry.prNumberAndName,
          salesDescription: inquiry.salesDescription,
          salesUnit: inquiry.salesUnit?.name,
          quantity: inquiry.quantity,
          size: inquiry.size,
          inquiryToSupplierDate: timezoneFixed,
          totalSupplierPrice:
            inquiry.supplierPrice && inquiry.quantity
              ? (inquiry.supplierPrice * inquiry.quantity).toFixed(2)
              : undefined,
          fpr: inquiry.frontPersonRepresentative.name,
          fprEmail: inquiry.frontPersonRepresentative.email,
          fprMobile: inquiry.frontPersonRepresentative.mobile,
          imageUrl: inquiry.image?.newFilename || undefined
        })
        uniqueFprIds.add(inquiry.frontPersonRepresentative.id)
        uniqueSubjectSitePr.add(
          `${inquiry.site?.name ? ` ${inquiry.site.name}` : ''}${
            inquiry.prNumberAndName || ''
          }`
        )
      }
      if (!allInquiries.length)
        return {
          success: false,
          message: 'No inquiries'
        }

      const keysToGreen: any = {
        'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)': true,
        'UOM FROM SUPPLIER': true,
        'SUPPLIER PRICE': true
      }
      const keysToBlue: any = {
        'ESTIMATED DELIVERY DAYS': true,
        'GST RATE': true,
        'HSN CODE': true
      }

      const allColumns = [
        { header: 'INQUIRY ITEM ID', key: 'id2', width: 10 },
        { header: 'SR. NO.', key: 'sr', width: 8 },
        { header: 'PR NUMBER & NAME', key: 'prNumberAndName', width: 25 },
        // { header: 'SITE REF', key: 'siteRef', width: 15 },
        {
          header: 'GOODS DESCRIPTION (SALES DESCRIPTION)',
          key: 'salesDescription',
          width: 30
        },
        { header: 'UNIT', key: 'salesUnit', width: 8 },
        { header: 'QTY', key: 'quantity', width: 8 },
        { header: 'SIZE/SPECIFICATION', key: 'size', width: 20 },
        {
          header: 'IMAGE',
          key: 'image',
          width: 15
        },
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
        { header: 'SUPPLIER PRICE', key: 'supplierPrice', width: 10 },
        {
          header: 'ESTIMATED DELIVERY DAYS',
          key: 'estimatedDeliveryDays',
          width: 10
        },
        { header: 'GST RATE', key: 'gstRate', width: 8 },
        { header: 'HSN CODE', key: 'hsnCode', width: 12 },
        {
          header: 'TOTAL SUPPLIER PRICE',
          key: 'totalSupplierPrice',
          width: 10
        },
        { header: 'FPR', key: 'fpr', width: 12 },
        { header: 'FPR Email', key: 'fprEmail', width: 12 },
        { header: 'FPR Mobile', key: 'fprMobile', width: 12 },
        { header: 'INQUIRY ID', key: 'id', width: 10 }
      ]

      const book = new Workbook()
      const sheet = book.addWorksheet('Inquiries')

      sheet.columns = allColumns

      const imageColumnIndex = allColumns.findIndex(c => c.header === 'IMAGE')

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

      const buffer = Buffer.from(await book.xlsx.writeBuffer())

      const filename = `Inquiries-Supplier-${
        inquiries[0]?.supplier?.name || ''
      }-${Date.now()}.xlsx`

      const url = await storageClient.addFile({
        filename,
        data: buffer
      })

      await prisma.attachment.create({
        data: {
          newFilename: filename,
          originalFilename: filename,
          url
        }
      })

      const date = new Date()

      const html = supplierTemplate({
        date: dayjs(date).format('DD/MM/YYYY'),
        items: allInquiries,
        supplier: inquiries[0]?.supplier?.name || '',
        site: inquiries[0]?.site?.name || '',
        prNumberAndName: inquiries[0]?.prNumberAndName || '',
        repName: inquiries[0]?.frontPersonRepresentative?.name || '',
        repEmail: inquiries[0]?.frontPersonRepresentative?.email || '',
        repMobile: inquiries[0]?.frontPersonRepresentative?.mobile || ''
      })

      const pdf = await htmlToPdf(html)

      const fileName2 = `Inquiries-Supplier-${
        inquiries[0]?.supplier?.name || ''
      }-${Date.now()}.pdf`

      const url2 = await storageClient.addFile({
        filename: fileName2,
        data: pdf
      })

      await prisma.attachment.create({
        data: {
          newFilename: fileName2,
          originalFilename: fileName2,
          url: url2
        }
      })

      if (input.preview)
        return {
          success: true,
          url,
          url2
        }

      let createdId = ''
      try {
        await prisma.$transaction(
          async tx => {
            await tx.inquiry.updateMany({
              where: {
                id: {
                  in: allInquiries.map(ai => ai.id)
                }
              },
              data: {
                inquiryToSupplierDate: now,
                updatedById: session.user.id
              }
            })
            const { id } = await tx.inquiriesSentToSupplier.create({
              data: {
                supplierId: input.supplierId,
                createdById: session.user.id,
                updatedById: session.user.id,
                emailSent: input.email,
                whatsappSent: input.whatsapp,
                inquiries: {
                  createMany: {
                    data: allInquiries.map(ai => ({
                      inquiryId: ai.id
                    }))
                  }
                }
              }
            })
            createdId = id
          },
          {
            isolationLevel: 'Serializable'
          }
        )
      } catch (err: any) {
        return {
          success: false,
          message: err.message || 'Something went wrong'
        }
      }

      let emailSent = false
      let whatsappSent = false
      if (input.email || input.whatsapp) {
        const users = await prisma.user.findMany({
          where: {
            id: {
              in: Array.from(uniqueFprIds)
            }
          },
          select: {
            email: true,
            whatsapp: true
          }
        })

        const emails: string[] = []
        const whatsappNumbers: string[] = []

        for (const u of users) {
          if (u.email) emails.push(u.email)
          if (u.whatsapp) whatsappNumbers.push(u.whatsapp)
        }

        const replyToEmails = emails.length ? [...new Set(emails)] : undefined

        if (
          input.supplierEmails.length &&
          env.EMAIL_ENVIRONMENT === 'production'
        )
          emails.push(...new Set(input.supplierEmails))
        if (
          input.supplierWhatsappNumbers.length &&
          env.WHATSAPP_ENVIRONMENT === 'production'
        )
          whatsappNumbers.push(...new Set(input.supplierWhatsappNumbers))

        if (input.email && emails.length) {
          try {
            await sendMail({
              to: emails,
              subject: `INQUIRY FROM MTE${
                inquiries[0]?.supplier?.name
                  ? ` | ${inquiries[0].supplier.name}`
                  : ''
              }${
                uniqueSubjectSitePr.size
                  ? ` ${[...uniqueSubjectSitePr].join(',')}`
                  : ''
              } #${createdId}`,
              text: getSendInquiryEmailTemplate(input.remarks),
              attachments: [
                {
                  filename,
                  content: buffer
                },
                {
                  filename: fileName2,
                  content: pdf
                }
              ],
              replyTo: replyToEmails
            })
            emailSent = true
          } catch (err) {
            console.error(err)
          }
        }

        if (input.whatsapp && whatsappNumbers.length) {
          for (const n of whatsappNumbers) {
            try {
              await sendWhatsappMessage({
                recipient: n,
                type: 'template',
                templateName: 'inquiries_send_to_supplier',
                parameters: [
                  {
                    type: 'text',
                    text: url
                  },
                  {
                    type: 'text',
                    text: url2
                  }
                ]
              })
              whatsappSent = true
            } catch (err) {
              console.error(err)
            }
          }
        }
      }

      await prisma.inquiriesSentToSupplier.updateMany({
        where: {
          id: createdId
        },
        data: {
          emailSent,
          whatsappSent
        }
      })

      return {
        success: true,
        url,
        url2,
        id: createdId,
        emailSent,
        whatsappSent
      }
    }),

  updateOne: rawProtectedProcedure(['ADMIN', 'USER', 'SUPPLIER'])
    .input(
      z.object({
        id: z.string(),
        inquiries: z.array(
          z.object({
            id: z.string(),
            purchaseDescription: z.string().optional().nullable(),
            purchaseUnitId: z.string().optional().nullable(),
            supplierPrice: z.number().optional().nullable(),
            estimatedDeliveryDays: z.number().int().optional().nullable(),
            gstRateId: z.string().optional().nullable(),
            hsnCode: z.string().max(8).optional().nullable()
          })
        )
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const now = new Date()
      await prisma.$transaction(async tx => {
        for (const i of input.inquiries) {
          await tx.inquiry.update({
            where: {
              id: i.id
            },
            data: {
              purchaseDescription: i.purchaseDescription,
              purchaseUnitId: i.purchaseUnitId,
              supplierPrice: i.supplierPrice,
              estimatedDeliveryDays: i.estimatedDeliveryDays,
              gstRateId: i.gstRateId,
              hsnCode: i.hsnCode,
              updatedById: session.user.id,
              supplierOfferDate:
                i.purchaseDescription && i.purchaseUnitId && i.supplierPrice
                  ? now
                  : undefined
            }
          })
        }
      })
    }),

  resend: procedureLocal
    .input(
      z.object({
        id: z.string(),
        email: z.boolean(),
        whatsapp: z.boolean(),
        supplierEmails: z.array(z.string().email()),
        supplierWhatsappNumbers: z.array(z.string()),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const openStatusId = (
        await prisma.inquiryStatus.findMany({
          select: {
            id: true,
            name: true
          }
        })
      ).find(st => st.name.toLowerCase() === 'open')?.id
      const inquiriesSentToSupplier =
        await prisma.inquiriesSentToSupplier.findUnique({
          where: {
            id: input.id
          },
          select: {
            id: true,
            emailSent: true,
            whatsappSent: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            },
            inquiries: {
              where: {
                inquiry: {
                  statusId: openStatusId,
                  resultId: null,
                  supplierOfferDate: null
                }
              },
              select: {
                inquiry: {
                  select: {
                    id: true,
                    id2: true,
                    date: true,
                    site: {
                      select: {
                        id: true,
                        name: true
                      }
                    },
                    prNumberAndName: true,
                    salesDescription: true,
                    salesUnit: {
                      select: {
                        id: true,
                        name: true
                      }
                    },
                    quantity: true,
                    size: true,
                    supplier: {
                      select: {
                        id: true,
                        name: true
                      }
                    },
                    supplierPrice: true,
                    frontPersonRepresentative: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true
                      }
                    },
                    image: {
                      select: {
                        id: true,
                        newFilename: true
                      }
                    }
                  }
                }
              }
            }
          }
        })

      if (!inquiriesSentToSupplier?.inquiries.length)
        return {
          success: false,
          message: 'No inquiries'
        }

      const allInquiries: any[] = []
      const uniqueFprIds = new Set([session.user.id])
      const fixTimezone = (date: Date) => {
        date.setUTCMinutes(date.getUTCMinutes() - input.timezoneOffset)
        return date
      }
      const now = new Date()
      const timezoneFixed = fixTimezone(new Date(now))
      const uniqueSubjectSitePr = new Set<string>()
      for (let i = 0; i < inquiriesSentToSupplier.inquiries.length; i++) {
        const inquiry = inquiriesSentToSupplier.inquiries[i]?.inquiry
        if (!inquiry) continue
        allInquiries.push({
          id: inquiry.id,
          id2: inquiry.id2,
          sr: i + 1,
          siteRef: inquiry.site?.name,
          prNumberAndName: inquiry.prNumberAndName,
          salesDescription: inquiry.salesDescription,
          salesUnit: inquiry.salesUnit?.name,
          quantity: inquiry.quantity,
          size: inquiry.size,
          inquiryToSupplierDate: timezoneFixed,
          totalSupplierPrice:
            inquiry.supplierPrice && inquiry.quantity
              ? (inquiry.supplierPrice * inquiry.quantity).toFixed(2)
              : undefined,
          fpr: inquiry.frontPersonRepresentative.name,
          fprEmail: inquiry.frontPersonRepresentative.email,
          fprMobile: inquiry.frontPersonRepresentative.mobile,
          imageUrl: inquiry.image?.newFilename || undefined
        })
        uniqueFprIds.add(inquiry.frontPersonRepresentative.id)
        uniqueSubjectSitePr.add(
          `${inquiry.site?.name ? ` ${inquiry.site.name}` : ''}${
            inquiry.prNumberAndName || ''
          }`
        )
      }
      if (!allInquiries.length)
        return {
          success: false,
          message: 'No inquiries'
        }

      const keysToGreen: any = {
        'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)': true,
        'UOM FROM SUPPLIER': true,
        'SUPPLIER PRICE': true
      }
      const keysToBlue: any = {
        'ESTIMATED DELIVERY DAYS': true,
        'GST RATE': true,
        'HSN CODE': true
      }

      const allColumns = [
        { header: 'INQUIRY ITEM ID', key: 'id2', width: 10 },
        { header: 'SR. NO.', key: 'sr', width: 8 },
        { header: 'PR NUMBER & NAME', key: 'prNumberAndName', width: 25 },
        // { header: 'SITE REF', key: 'siteRef', width: 15 },
        {
          header: 'GOODS DESCRIPTION (SALES DESCRIPTION)',
          key: 'salesDescription',
          width: 30
        },
        { header: 'UNIT', key: 'salesUnit', width: 8 },
        { header: 'QTY', key: 'quantity', width: 8 },
        { header: 'SIZE/SPECIFICATION', key: 'size', width: 20 },
        {
          header: 'IMAGE',
          key: 'image',
          width: 15
        },
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
        { header: 'SUPPLIER PRICE', key: 'supplierPrice', width: 10 },
        {
          header: 'ESTIMATED DELIVERY DAYS',
          key: 'estimatedDeliveryDays',
          width: 10
        },
        { header: 'GST RATE', key: 'gstRate', width: 8 },
        { header: 'HSN CODE', key: 'hsnCode', width: 12 },
        {
          header: 'TOTAL SUPPLIER PRICE',
          key: 'totalSupplierPrice',
          width: 10
        },
        { header: 'FPR', key: 'fpr', width: 12 },
        { header: 'FPR Email', key: 'fprEmail', width: 12 },
        { header: 'FPR Mobile', key: 'fprMobile', width: 12 },
        { header: 'INQUIRY ID', key: 'id', width: 10 }
      ]

      const book = new Workbook()
      const sheet = book.addWorksheet('Inquiries')

      sheet.columns = allColumns

      const imageColumnIndex = allColumns.findIndex(c => c.header === 'IMAGE')

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

      const buffer = Buffer.from(await book.xlsx.writeBuffer())

      const filename = `Inquiries-Supplier-${
        inquiriesSentToSupplier.inquiries[0]?.inquiry?.supplier?.name || ''
      }-${Date.now()}.xlsx`

      const url = await storageClient.addFile({
        filename,
        data: buffer
      })

      const date = new Date()

      const html = supplierTemplate({
        date: dayjs(date).format('DD/MM/YYYY'),
        items: allInquiries,
        supplier: inquiriesSentToSupplier.inquiries[0]?.inquiry?.supplier?.name,
        site: inquiriesSentToSupplier.inquiries[0]?.inquiry?.site?.name,
        prNumberAndName:
          inquiriesSentToSupplier.inquiries[0]?.inquiry?.prNumberAndName,
        repName:
          inquiriesSentToSupplier.inquiries[0]?.inquiry
            ?.frontPersonRepresentative?.name,
        repEmail:
          inquiriesSentToSupplier.inquiries[0]?.inquiry
            ?.frontPersonRepresentative?.email,
        repMobile:
          inquiriesSentToSupplier.inquiries[0]?.inquiry
            ?.frontPersonRepresentative?.mobile
      })

      const pdf = await htmlToPdf(html)

      const fileName2 = `Inquiries-Supplier-${
        inquiriesSentToSupplier.inquiries[0]?.inquiry?.supplier?.name || ''
      }-${Date.now()}.pdf`

      const url2 = await storageClient.addFile({
        filename: fileName2,
        data: pdf
      })

      await prisma.attachment.create({
        data: {
          newFilename: fileName2,
          originalFilename: fileName2,
          url: url2
        }
      })

      let emailSent = false
      let whatsappSent = false
      if (input.email || input.whatsapp) {
        const users = await prisma.user.findMany({
          where: {
            id: {
              in: Array.from(uniqueFprIds)
            }
          },
          select: {
            email: true,
            whatsapp: true
          }
        })

        const emails: string[] = []
        const whatsappNumbers: string[] = []

        for (const u of users) {
          if (u.email) emails.push(u.email)
          if (u.whatsapp) whatsappNumbers.push(u.whatsapp)
        }

        const replyToEmails = emails.length ? [...new Set(emails)] : undefined

        if (
          input.supplierEmails.length &&
          env.EMAIL_ENVIRONMENT === 'production'
        )
          emails.push(...new Set(input.supplierEmails))
        if (
          input.supplierWhatsappNumbers.length &&
          env.WHATSAPP_ENVIRONMENT === 'production'
        )
          whatsappNumbers.push(...new Set(input.supplierWhatsappNumbers))

        if (input.email && emails.length) {
          try {
            await sendMail({
              to: emails,
              subject: `RE: INQUIRY FROM MTE${
                inquiriesSentToSupplier.inquiries[0]?.inquiry?.supplier?.name
                  ? ` | ${inquiriesSentToSupplier.inquiries[0]?.inquiry?.supplier?.name}`
                  : ''
              }${
                uniqueSubjectSitePr.size
                  ? ` ${[...uniqueSubjectSitePr].join(',')}`
                  : ''
              } #${input.id}`,
              text: getSendInquiryEmailTemplate(),
              attachments: [
                {
                  filename,
                  content: buffer
                },
                {
                  filename: fileName2,
                  content: pdf
                }
              ],
              replyTo: replyToEmails
            })
            emailSent = true
          } catch (err) {
            console.error(err)
          }
        }

        if (input.whatsapp && whatsappNumbers.length) {
          for (const n of whatsappNumbers) {
            try {
              await sendWhatsappMessage({
                recipient: n,
                type: 'template',
                templateName: 'inquiries_send_to_supplier',
                parameters: [
                  {
                    type: 'text',
                    text: url
                  },
                  {
                    type: 'text',
                    text: url2
                  }
                ]
              })
              whatsappSent = true
            } catch (err) {
              console.error(err)
            }
          }
        }
      }

      await Promise.all([
        prisma.inquiriesSentToSupplier.update({
          where: {
            id: input.id
          },
          data: {
            lastResendAt: new Date(),
            updatedById: session.user.id
          }
        }),
        prisma.inquiriesSentToSupplierResendHistory.create({
          data: {
            inquiriesSentToSupplierId: input.id,
            emailSent,
            whatsappSent,
            createdById: session.user.id,
            createdAt: now
          }
        })
      ])

      return {
        success: true,
        url,
        url2,
        emailSent,
        whatsappSent
      }
    })
})
