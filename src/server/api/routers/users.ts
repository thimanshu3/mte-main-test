import { compare, hash } from 'bcryptjs'
import { Workbook } from 'exceljs'
import { z } from 'zod'
import {
  adminProtectedProcedure,
  adminViewerProtectedProcedure,
  createTRPCRouter,
  protectedProcedure
} from '~/server/api/trpc'
import { storageClient } from '~/utils/cloudStorage'

export const usersRouter = createTRPCRouter({
  getAll: adminViewerProtectedProcedure
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
              },
              {
                email: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              }
            ]
          }
        : undefined
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            active: true,
            role: true,
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
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.user.count({
          where
        })
      ])
      return { users, total }
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
                }
              },
              {
                email: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              }
            ]
          }
        : undefined
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          where,
          select: {
            id: true,
            name: true,
            email: true
          },
          orderBy: {
            name: 'asc'
          }
        }),
        prisma.user.count({
          where
        })
      ])
      return { users, total }
    }),

  getOne: adminViewerProtectedProcedure
    .input(
      z.object({
        id: z.string()
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      return await prisma.user.findUniqueOrThrow({
        where: {
          id: input.id
        },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          whatsapp: true,
          active: true,
          role: true,
          supplierId: true,
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
          },
          createdAt: true,
          updatedAt: true
        }
      })
    }),

  createOrUpdateOne: adminProtectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        email: z.string().email(),
        mobile: z.string().optional().nullable(),
        whatsapp: z.string().optional().nullable(),
        role: z.enum([
          'ADMIN',
          'ADMINVIEWER',
          'USER',
          'USERVIEWER',
          'FULFILMENT',
          'SUPPLIER'
        ]),
        password: z.string().optional(),
        supplierId: z.string().optional().nullable()
      })
    )
    .mutation(async ({ ctx: { session, prisma }, input }) => {
      if (input.id)
        return await prisma.user.update({
          where: {
            id: input.id
          },
          data: {
            email: input.email.trim().toLowerCase(),
            name: input.name,
            mobile: input.mobile?.trim(),
            whatsapp: input.whatsapp,
            password: input.password
              ? await hash(input.password, 10)
              : undefined,
            role: input.role,
            supplierId: input.supplierId,
            updatedById: session.user.id
          }
        })
      return await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          mobile: input.mobile,
          whatsapp: input.whatsapp,
          password: input.password ? await hash(input.password, 10) : undefined,
          role: input.role,
          supplierId: input.supplierId,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }),

  updatePassword: adminProtectedProcedure
    .input(
      z.object({
        password: z.string(),
        currentPassword: z.string()
      })
    )
    .mutation(async ({ ctx: { session, prisma }, input }) => {
      const user = await prisma.user.findUnique({
        where: {
          id: session.user.id
        }
      })

      if (!user)
        return {
          success: false,
          message: 'User not found'
        }

      if (!user.password)
        return {
          success: false,
          message: 'User has no password'
        }

      const passwordMatch = await compare(input.currentPassword, user.password)
      if (!passwordMatch) return { success: false, message: 'Wrong password' }

      await prisma.user.update({
        where: {
          id: session.user.id
        },
        data: {
          password: await hash(input.password, 10)
        }
      })

      return {
        success: true
      }
    }),

  deactivateOne: adminProtectedProcedure
    .input(
      z.object({
        id: z.string(),
        activate: z.boolean()
      })
    )
    .mutation(async ({ ctx: { session, prisma }, input }) => {
      if (input.id === session.user.id) return false
      await prisma.user.update({
        where: {
          id: input.id
        },
        data: {
          active: input.activate
        }
      })
      return true
    }),

  export: adminViewerProtectedProcedure
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
              },
              {
                email: {
                  contains: input.search,
                  mode: 'insensitive' as const
                }
              }
            ]
          }
        : undefined

      let skip = 0
      const take = 1000
      const allUsers: any[] = []
      while (skip < 10000) {
        const users = await prisma.user.findMany({
          where,
          skip,
          take
        })
        if (!users.length) break
        for (let i = 0; i < users.length; i++) {
          const user = users[i]
          if (!user) continue
          allUsers.push({
            srno: i + 1 + skip,
            ...user
          })
        }
        skip += take
      }
      const book = new Workbook()
      const sheet = book.addWorksheet('Users')

      sheet.columns = [
        { header: 'USER ID', key: 'id', width: 10 },
        { header: 'NAME', key: 'name', width: 10 },
        { header: 'EMAIL', key: 'email', width: 10 },
        { header: 'MOBILE', key: 'mobile', width: 10 },
        { header: 'WHATSAPP', key: 'whatsapp', width: 10 },
        { header: 'ROLE', key: 'role', width: 10 }
      ]
      sheet.addRows(allUsers)

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

      const filename = `Users-${Date.now()}.xlsx`
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
    })
})
