import { z } from 'zod'
import { createTRPCRouter, rawProtectedProcedure } from '~/server/api/trpc'

export const dashboardRouter = createTRPCRouter({
  admin: rawProtectedProcedure(['ADMIN', 'ADMINVIEWER'])
    .input(
      z.object({
        dateRange: z.object({
          startDate: z.date(),
          endDate: z.date()
        })
      })
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const [
        totalInquiries,
        statusWiseInquiries,
        resultWiseInquiries,
        uniqueInquiriesBySiteAndPR
      ] = await Promise.all([
        prisma.inquiry.count({
          where: {
            date: {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            },
            deletedAt: null
          }
        }),
        prisma.inquiry.groupBy({
          by: ['statusId'],
          where: {
            date: {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            },
            deletedAt: null
          },
          _count: {
            id: true
          },
          orderBy: {
            _count: {
              id: 'desc'
            }
          }
        }),
        prisma.inquiry.groupBy({
          by: ['resultId'],
          where: {
            date: {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            },
            deletedAt: null
          },
          _count: {
            id: true
          },
          orderBy: {
            _count: {
              id: 'desc'
            }
          }
        }),
        prisma.inquiry.groupBy({
          by: ['siteId', 'prNumberAndName'],
          where: {
            date: {
              gte: input.dateRange.startDate,
              lte: input.dateRange.endDate
            },
            deletedAt: null
          }
        })
      ])
      return {
        inquiries: {
          total: totalInquiries,
          statusWise: statusWiseInquiries,
          resultWise: resultWiseInquiries,
          uniqueInquiriesBySiteAndPR: uniqueInquiriesBySiteAndPR.length
        }
      }
    })
})
