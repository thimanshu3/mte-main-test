import dayjs from 'dayjs'
import { Workbook } from 'exceljs'
import { readFileSync } from 'fs'
import Handlebars from 'handlebars'
import path from 'path'
import { z } from 'zod'
import { env } from '~/env.mjs'
import { storageClient } from '~/utils/cloudStorage'
import { htmlToPdf } from '~/utils/htmlToPdf'
import { sendMail } from '~/utils/nodemailer'
import { sendWhatsappMessage } from '~/utils/sendWhatsappMessage'
import {
  createTRPCRouter,
  protectedProcedure,
  rawProtectedProcedure
} from '../trpc'

const procedureLocal = rawProtectedProcedure(['ADMIN', 'USER'])

const getSendInquiryEmailTemplate = (remarks?: string) => {
  const t1 = `Dear Sir/Madam,

I hope this email finds you well.
Please find the attached offer against your subjected inquiry along with the necessary technical details. Hope this meets your requirements.`

  const t2 = `

Do let us know in case of you require any changes in technicals or have some query.

Thank You`

  if (!remarks) return t1 + t2
  return t1 + '\n\n' + remarks + t2
}

const offerTemplate = Handlebars.compile(
  readFileSync(
    path.join(
      process.cwd(),
      'public',
      'templates',
      'pdfs',
      'offerToCustomer.hbs'
    ),
    'utf-8'
  )
)

export const offerSentToCustomerRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
        customerId: z.string().optional(),
        siteId: z.string().optional(),
        createdById: z.string().optional(),
        dateRange: z
          .object({
            startDate: z.date(),
            endDate: z.date()
          })
          .optional()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const where = {
        customerId: input.customerId,
        createdById: input.createdById,
        createdAt: input.dateRange
          ? {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            }
          : undefined
      }
      const [offerSentToCustomer, total] = await Promise.all([
        prisma.offerSentToCustomer.findMany({
          where,
          select: {
            id: true,
            emailSent: true,
            whatsappSent: true,
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
            _count: {
              select: {
                inquiries: true,
                resendHistory: true
              }
            },
            lastResendAt: true,
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
        prisma.offerSentToCustomer.count({
          where
        })
      ])
      return { offerSentToCustomer, total }
    }),

  getOne: procedureLocal
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.offerSentToCustomer.findUniqueOrThrow({
        where: {
          id: input.id
        },
        select: {
          id: true,
          emailSent: true,
          whatsappSent: true,
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
          inquiries: {
            select: {
              id: true,
              inquiry: {
                select: {
                  id: true,
                  date: true,
                  prNumberAndName: true,
                  site: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  salesDescription: true,
                  salesUnit: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  quantity: true,
                  size: true,
                  customerPrice: true,
                  purchaseDescription: true,
                  purchaseUnit: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  supplierPrice: true,
                  margin: true,
                  estimatedDeliveryDays: true,
                  result: {
                    select: {
                      id: true,
                      name: true
                    }
                  },
                  frontPersonRepresentative: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      mobile: true,
                      whatsapp: true
                    }
                  }
                }
              }
            }
          },
          lastResendAt: true,
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
          },
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
    }),

  getInquiries: procedureLocal
    .input(
      z.object({
        customerId: z.string(),
        siteId: z.string().optional().nullable(),
        prNumberAndName: z.string().optional().nullable()
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
      return {
        totalAvailable: await prisma.inquiry.count({
          where: {
            customerId: input.customerId,
            siteId: input.siteId,
            prNumberAndName: input.prNumberAndName,
            statusId: openStatusId,
            offerSentToCustomerInquiry: null,
            resultId: null,
            deletedAt: null
          }
        }),
        inquiries: await prisma.inquiry.findMany({
          where: {
            customerId: input.customerId,
            siteId: input.siteId,
            prNumberAndName: input.prNumberAndName,
            statusId: openStatusId,
            offerSentToCustomerInquiry: null,
            resultId: null,
            deletedAt: null,
            inquiryToSupplierDate: {
              not: null
            },
            supplierOfferDate: {
              not: null
            },
            supplierPrice: {
              not: null
            },
            customerPrice: {
              not: null
            },
            margin: {
              not: null
            },
            offerSubmissionDate: null
          },
          select: {
            id: true,
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
            customerPrice: true,
            supplier: {
              select: {
                id: true,
                name: true
              }
            },
            purchaseDescription: true,
            purchaseUnit: {
              select: {
                id: true,
                name: true
              }
            },
            supplierPrice: true,
            margin: true,
            frontPersonRepresentative: {
              select: {
                id: true,
                name: true
              }
            },
            emailForCustomerRemarks: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        })
      }
    }),

  getReadyCustomers: procedureLocal.query(async ({ ctx: { prisma } }) => {
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
      by: ['customerId'],
      where: {
        statusId: openStatusId,
        offerSentToCustomerInquiry: null,
        resultId: null,
        deletedAt: null,
        inquiryToSupplierDate: {
          not: null
        },
        supplierOfferDate: {
          not: null
        },
        supplierPrice: {
          not: null
        },
        customerPrice: {
          not: null
        },
        margin: {
          not: null
        },
        offerSubmissionDate: null
      },
      _count: {
        id: true
      }
    })
    const customers = await prisma.customer.findMany({
      where: {
        id: {
          in: grouped.map(g => g.customerId).filter(id => id) as string[]
        }
      },
      select: {
        id: true,
        name: true
      }
    })
    return customers.map(s => ({
      id: s.id,
      name: s.name,
      count: grouped.find(g => g.customerId === s.id)?._count.id || 0
    }))
  }),

  getSites: procedureLocal
    .input(
      z.object({
        customerId: z.string()
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
      const siteIds = (
        await prisma.inquiry.groupBy({
          by: ['siteId'],
          where: {
            customerId: input.customerId,
            statusId: openStatusId,
            inquiryToSupplierDate: {
              not: null
            },
            supplierOfferDate: {
              not: null
            },
            supplierPrice: {
              not: null
            },
            offerSentToCustomerInquiry: null,
            customerPrice: {
              not: null
            },
            margin: {
              not: null
            },
            offerSubmissionDate: null,
            resultId: null,
            deletedAt: null
          },
          skip: 0,
          take: 500,
          orderBy: {
            siteId: 'asc'
          }
        })
      )
        .map(s => s.siteId)
        .filter(id => !!id) as string[]
      if (!siteIds.length) return []
      return await prisma.site.findMany({
        where: {
          id: {
            in: siteIds
          }
        },
        select: {
          id: true,
          name: true
        },
        orderBy: {
          name: 'asc'
        }
      })
    }),

  getPrNumber: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        siteId: z.string().optional().nullable()
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
      return (
        await prisma.inquiry.groupBy({
          by: ['prNumberAndName'],
          where: {
            customerId: input.customerId,
            siteId: input.siteId,
            statusId: openStatusId,
            inquiryToSupplierDate: {
              not: null
            },
            supplierOfferDate: {
              not: null
            },
            supplierPrice: {
              not: null
            },
            offerSentToCustomerInquiry: null,
            customerPrice: {
              not: null
            },
            margin: {
              not: null
            },
            offerSubmissionDate: null,
            resultId: null,
            deletedAt: null
          },
          orderBy: {
            prNumberAndName: 'asc'
          },
          skip: 0,
          take: 500
        })
      )
        .map(i => i.prNumberAndName)
        .filter(pr => !!pr) as string[]
    }),

  getCustomer: procedureLocal
    .input(z.string())
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.customer.findUniqueOrThrow({
        where: {
          id: input
        },
        select: {
          id: true,
          name: true,
          contactEmail: true,
          contactEmail2: true,
          contactEmail3: true,
          contactMobile: true
        }
      })
    }),

  previewOrCreate: procedureLocal
    .input(
      z.object({
        preview: z.boolean(),
        customerId: z.string(),
        siteId: z.string().optional().nullable(),
        prNumberAndName: z.string().optional().nullable(),
        inquiryIds: z.array(z.string()).min(1),
        email: z.boolean(),
        whatsapp: z.boolean(),
        customerEmails: z.array(z.string().email()),
        customerWhatsappNumbers: z.array(z.string()),
        remarks: z.string().optional(),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      let openStatusId: string | undefined
      let submittedStatusId: string | undefined
      const allStatuses = await prisma.inquiryStatus.findMany({
        select: {
          id: true,
          name: true
        }
      })
      allStatuses.forEach(st => {
        if (st.name.toLowerCase() === 'open') openStatusId = st.id
        if (st.name.toLowerCase() === 'submitted') submittedStatusId = st.id
      })
      if (!openStatusId) throw new Error('No inquiry "open" status found')
      if (!submittedStatusId)
        throw new Error('No inquiry "submitted" status found')
      const inquiries = await prisma.inquiry.findMany({
        where: {
          id: {
            in: input.inquiryIds
          },
          customerId: input.customerId,
          siteId: input.siteId,
          prNumberAndName: input.prNumberAndName,
          statusId: openStatusId,
          inquiryToSupplierDate: {
            not: null
          },
          supplierOfferDate: {
            not: null
          },
          supplierPrice: {
            not: null
          },
          offerSentToCustomerInquiry: null,
          customerPrice: {
            not: null
          },
          margin: {
            not: null
          },
          offerSubmissionDate: null,
          resultId: null,
          deletedAt: null
        },
        select: {
          id: true,
          id2: true,
          date: true,
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
          salesDescription: true,
          salesUnit: {
            select: {
              id: true,
              name: true
            }
          },
          quantity: true,
          size: true,
          customerCurrency: {
            select: {
              id: true,
              name: true,
              symbol: true
            }
          },
          customerPrice: true,
          purchaseDescription: true,
          purchaseUnit: {
            select: {
              id: true,
              name: true
            }
          },
          estimatedDeliveryDays: true,
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
          sr: i + 1,
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
          estimatedDeliveryDays: inquiry.estimatedDeliveryDays,
          currency: inquiry.customerCurrency?.name,
          customerPrice: inquiry.customerPrice,
          totalCustomerPrice:
            inquiry.customerPrice && inquiry.quantity
              ? Math.round(inquiry.customerPrice * inquiry.quantity)
              : undefined,
          offerSubmissionDate: timezoneFixed,
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

      const allColumns = [
        { header: 'INQUIRY ITEM ID', key: 'id2', width: 10 },
        { header: 'SR. NO.', key: 'sr', width: 8 },
        // { header: 'INQUIRY DATE', key: 'date', width: 10 },
        // { header: 'CUSTOMER NAME', key: 'customerName', width: 25 },
        // { header: 'PR NUMBER & NAME', key: 'prNumberAndName', width: 25 },
        // { header: 'SITE REF', key: 'siteRef', width: 15 },
        {
          header: 'GOODS DESCRIPTION (SALES DESCRIPTION)',
          key: 'salesDescription',
          width: 30
        },
        { header: 'UNIT', key: 'salesUnit', width: 8 },
        { header: 'QTY', key: 'quantity', width: 8 },
        { header: 'SIZE/SPECIFICATION', key: 'size', width: 20 },
        { header: 'IMAGE', key: 'image', width: 15 },
        {
          header: 'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)',
          key: 'purchaseDescription',
          width: 30
        },
        { header: 'UOM FROM SUPPLIER', key: 'purchaseUnit', width: 8 },
        {
          header: 'ESTIMATED DELIVERY DAYS',
          key: 'estimatedDeliveryDays',
          width: 10
        },
        // {
        //   header: 'CURRENCY',
        //   key: 'currency',
        //   width: 10
        // },
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
        {
          header: 'OFFER SUBMISSION DATE',
          key: 'offerSubmissionDate',
          width: 10
        }
        // { header: 'FPR', key: 'fpr', width: 12 },
        // { header: 'FPR Email', key: 'fprEmail', width: 12 },
        // { header: 'FPR Mobile', key: 'fprMobile', width: 12 },
        // { header: 'INQUIRY ID', key: 'id', width: 10 }
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
            argb: 'FFFFFF00'
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

      const filename = `Inquiries-Customer-${
        inquiries[0]?.customer?.name || ''
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

      const overAllTotalCustomerPrice = allInquiries.reduce(
        (acc, curr) => acc + (curr.totalCustomerPrice || 0),
        0
      )

      const date = new Date()

      const html = offerTemplate({
        currency: inquiries[0]?.customerCurrency?.symbol
          ? `(${inquiries[0]?.customerCurrency?.symbol})`
          : '(INR)',
        items: allInquiries,
        customer: inquiries[0]?.customer?.name,
        site: inquiries[0]?.site?.name,
        prNumberAndName: inquiries[0]?.prNumberAndName,
        repName: inquiries[0]?.frontPersonRepresentative.name,
        repEmail: inquiries[0]?.frontPersonRepresentative.email,
        repMobile: inquiries[0]?.frontPersonRepresentative.mobile,
        overAllTotalCustomerPrice: parseFloat(
          overAllTotalCustomerPrice
        ).toLocaleString(),
        date: dayjs(date).format('DD/MM/YYYY')
      })
      const pdf = await htmlToPdf(html)

      const filename2 = `Inquiries-Customer-${
        inquiries[0]?.customer?.name || ''
      }-${Date.now()}.pdf`

      const url2 = await storageClient.addFile({
        filename: filename2,
        data: pdf
      })

      await prisma.attachment.create({
        data: {
          newFilename: filename2,
          originalFilename: filename2,
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
                statusId: submittedStatusId,
                offerSubmissionDate: now,
                updatedById: session.user.id
              }
            })
            const { id } = await tx.offerSentToCustomer.create({
              data: {
                customerId: input.customerId,
                siteId: input.siteId,
                prNumberAndName: input.prNumberAndName,
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
          input.customerEmails.length &&
          env.EMAIL_ENVIRONMENT === 'production'
        )
          emails.push(...new Set(input.customerEmails))
        if (
          input.customerWhatsappNumbers.length &&
          env.WHATSAPP_ENVIRONMENT === 'production'
        )
          whatsappNumbers.push(...new Set(input.customerWhatsappNumbers))

        if (input.email && emails.length) {
          try {
            await sendMail({
              to: emails,
              subject: `OFFER FROM MTE${
                inquiries[0]?.customer?.name
                  ? ` | ${inquiries[0].customer.name}`
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
                  filename: filename2,
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
                type: 'document',
                file: buffer,
                filename
              })
              await sendWhatsappMessage({
                recipient: n,
                type: 'text',
                text: 'Please find the attached offer file.'
              })
              whatsappSent = true
            } catch (err) {
              console.error(err)
            }
          }
        }
      }

      await prisma.offerSentToCustomer.updateMany({
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

  resend: procedureLocal
    .input(
      z.object({
        id: z.string(),
        email: z.boolean(),
        whatsapp: z.boolean(),
        customerEmails: z.array(z.string().email()),
        customerWhatsappNumbers: z.array(z.string()),
        timezoneOffset: z.number()
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const inquiriesSentToCustomer =
        await prisma.offerSentToCustomer.findUnique({
          where: {
            id: input.id
          },
          select: {
            createdAt: true,
            inquiries: {
              select: {
                inquiry: {
                  select: {
                    id: true,
                    id2: true,
                    date: true,
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
                    salesDescription: true,
                    salesUnit: {
                      select: {
                        id: true,
                        name: true
                      }
                    },
                    customerCurrency: {
                      select: {
                        id: true,
                        name: true,
                        symbol: true
                      }
                    },
                    quantity: true,
                    size: true,
                    customerPrice: true,
                    purchaseDescription: true,
                    purchaseUnit: {
                      select: {
                        id: true,
                        name: true
                      }
                    },
                    estimatedDeliveryDays: true,
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

      if (!inquiriesSentToCustomer?.inquiries.length)
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
      for (let i = 0; i < inquiriesSentToCustomer.inquiries.length; i++) {
        const inquiry = inquiriesSentToCustomer.inquiries[i]?.inquiry
        if (!inquiry) continue
        allInquiries.push({
          sr: i + 1,
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
          estimatedDeliveryDays: inquiry.estimatedDeliveryDays,
          currency: inquiry.customerCurrency?.name,
          customerPrice: inquiry.customerPrice,
          totalCustomerPrice:
            inquiry.customerPrice && inquiry.quantity
              ? Math.round(inquiry.customerPrice * inquiry.quantity)
              : undefined,
          offerSubmissionDate: timezoneFixed,
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

      const allColumns = [
        // { header: 'INQUIRY ITEM ID', key: 'id2', width: 10 },
        { header: 'SR. NO.', key: 'sr', width: 8 },
        // { header: 'INQUIRY DATE', key: 'date', width: 10 },
        // { header: 'CUSTOMER NAME', key: 'customerName', width: 25 },
        // { header: 'PR NUMBER & NAME', key: 'prNumberAndName', width: 25 },
        // { header: 'SITE REF', key: 'siteRef', width: 15 },
        {
          header: 'GOODS DESCRIPTION (SALES DESCRIPTION)',
          key: 'salesDescription',
          width: 30
        },
        { header: 'UNIT', key: 'salesUnit', width: 8 },
        { header: 'QTY', key: 'quantity', width: 8 },
        { header: 'SIZE/SPECIFICATION', key: 'size', width: 20 },
        { header: 'IMAGE', key: 'image', width: 15 },
        {
          header: 'GOODS DESCRIPTION SUPPLIER (PURCHASE DESCRIPTION)',
          key: 'purchaseDescription',
          width: 30
        },
        { header: 'UOM FROM SUPPLIER', key: 'purchaseUnit', width: 8 },
        {
          header: 'ESTIMATED DELIVERY DAYS',
          key: 'estimatedDeliveryDays',
          width: 10
        },
        // {
        //   header: 'CURRENCY',
        //   key: 'currency',
        //   width: 10
        // },
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
        {
          header: 'OFFER SUBMISSION DATE',
          key: 'offerSubmissionDate',
          width: 10
        }
        // { header: 'FPR', key: 'fpr', width: 12 },
        // { header: 'FPR Email', key: 'fprEmail', width: 12 },
        // { header: 'FPR Mobile', key: 'fprMobile', width: 12 },
        // { header: 'INQUIRY ID', key: 'id', width: 10 }
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
            argb: 'FFFFFF00'
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

      const filename = `Inquiries-Customer-${
        inquiriesSentToCustomer.inquiries[0]?.inquiry?.customer?.name || ''
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
      const overAllTotalCustomerPrice = allInquiries.reduce(
        (acc, curr) => acc + (curr.totalCustomerPrice || 0),
        0
      )

      const html = offerTemplate({
        currency: inquiriesSentToCustomer.inquiries[0]?.inquiry
          ?.customerCurrency?.symbol
          ? `(${inquiriesSentToCustomer.inquiries[0]?.inquiry?.customerCurrency?.symbol})`
          : '(INR)',
        items: allInquiries,
        customer: inquiriesSentToCustomer.inquiries[0]?.inquiry?.customer.name,
        site: inquiriesSentToCustomer.inquiries[0]?.inquiry?.site?.name,
        prNumberAndName:
          inquiriesSentToCustomer.inquiries[0]?.inquiry?.prNumberAndName,
        repName:
          inquiriesSentToCustomer.inquiries[0]?.inquiry
            .frontPersonRepresentative.name,
        repEmail:
          inquiriesSentToCustomer.inquiries[0]?.inquiry
            .frontPersonRepresentative.email,
        repMobile:
          inquiriesSentToCustomer.inquiries[0]?.inquiry
            .frontPersonRepresentative.mobile,
        overAllTotalCustomerPrice: parseFloat(
          overAllTotalCustomerPrice
        ).toLocaleString(),
        date: dayjs(inquiriesSentToCustomer.createdAt).format('DD/MM/YYYY')
      })
      const pdf = await htmlToPdf(html)

      const filename2 = `Inquiries-Customer-${
        inquiriesSentToCustomer.inquiries[0]?.inquiry?.customer?.name || ''
      }-${Date.now()}.pdf`

      const url2 = await storageClient.addFile({
        filename: filename2,
        data: pdf
      })

      await prisma.attachment.create({
        data: {
          newFilename: filename2,
          originalFilename: filename2,
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
          input.customerEmails.length &&
          env.EMAIL_ENVIRONMENT === 'production'
        )
          emails.push(...new Set(input.customerEmails))
        if (
          input.customerWhatsappNumbers.length &&
          env.WHATSAPP_ENVIRONMENT === 'production'
        )
          whatsappNumbers.push(...new Set(input.customerWhatsappNumbers))

        if (input.email && emails.length) {
          try {
            await sendMail({
              to: emails,
              subject: `RE: OFFER FROM MTE${
                inquiriesSentToCustomer.inquiries[0]?.inquiry?.customer?.name
                  ? ` | ${inquiriesSentToCustomer.inquiries[0]?.inquiry.customer.name}`
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
                  filename: filename2,
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
                type: 'document',
                file: buffer,
                filename
              })
              await sendWhatsappMessage({
                recipient: n,
                type: 'text',
                text: 'Please find the attached offer file.'
              })
              whatsappSent = true
            } catch (err) {
              console.error(err)
            }
          }
        }
      }

      await Promise.all([
        prisma.offerSentToCustomer.update({
          where: {
            id: input.id
          },
          data: {
            lastResendAt: new Date(),
            updatedById: session.user.id
          }
        }),
        prisma.offerSentToCustomerResendHistory.create({
          data: {
            inquiriesSentToCustomerId: input.id,
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
