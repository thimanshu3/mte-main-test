import { createHash } from 'crypto'
import { z } from 'zod'
import { createTRPCRouter, rawProtectedProcedure } from '~/server/api/trpc'
import { ICICIH2H_VERIFICATION_AMOUNT, parseICICIH2H } from '~/utils/iciciH2H'

const procedure = rawProtectedProcedure(['ADMIN'])

export const bankAccountsRouter = createTRPCRouter({
  createOne: procedure
    .input(
      z.object({
        bankName: z.string().min(1),
        beneficiaryName: z.string().min(1),
        accountNumber: z.string().min(1),
        ifscCode: z.string().min(1),
        mailingAddressLine1: z.string().min(1),
        mailingAddressLine2: z.string().min(1).optional().nullable(),
        mailingAddressLine3: z.string().min(1).optional().nullable(),
        beneficiaryCity: z.string().min(1),
        beneficiaryZipCode: z.string().min(1),
        supplierId: z.string().min(1)
      })
    )
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const hash = createHash('sha256')
        .update(JSON.stringify(input))
        .digest('hex')
      return await prisma.bankAccount.create({
        data: {
          ...input,
          hash,
          createdById: session.user.id,
          updatedById: session.user.id
        }
      })
    }),

  sendVerification: procedure
    .input(z.string())
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const bankAccount = await prisma.bankAccount.findUniqueOrThrow({
        where: {
          id: input,
          isVerificationSent: false,
          isVerified: false
        },
        include: {
          supplier: true
        }
      })

      if (!bankAccount) throw new Error('No bank account to send verification')

      const date = new Date()

      const obj = parseICICIH2H({
        'Payment Indicator': 'D',
        'Unique Cust Ref No': bankAccount.id,
        'Vendor / Beneficiary Code': bankAccount.supplier.id,
        'Name of Beneficiary': bankAccount.beneficiaryName,
        'Instrument Amount': ICICIH2H_VERIFICATION_AMOUNT,
        'Payment Date': date,
        'Cheque Number': undefined,
        'Beneficiary Bank A/c No': bankAccount.accountNumber,
        'Beneficiary Bank IFSC Code': bankAccount.ifscCode,
        'Beneficiary Bank Name': bankAccount.bankName,
        'Beneficiary Mailing Address 1': bankAccount.mailingAddressLine1,
        'Beneficiary Mailing Address 2': bankAccount.mailingAddressLine2,
        'Beneficiary Mailing Address 3': bankAccount.mailingAddressLine3,
        'Beneficiary City': bankAccount.beneficiaryCity,
        'Beneficiary Zip': bankAccount.beneficiaryZipCode,
        'Email id':
          bankAccount.supplier.email ||
          bankAccount.supplier.email2 ||
          bankAccount.supplier.email3 ||
          '',
        'Beneficiary Mobile No':
          bankAccount.supplier.mobile ||
          bankAccount.supplier.whatsapp ||
          bankAccount.supplier.alternateMobile ||
          ''
      })

      await prisma.bankAccount.update({
        where: {
          id: input
        },
        data: {
          isVerificationSent: true,
          verificationSentAt: date,
          updatedById: session.user.id
        }
      })

      return obj
    }),

  verify: procedure
    .input(z.string())
    .mutation(async ({ ctx: { prisma, session }, input }) => {
      const bankAccount = await prisma.bankAccount.findUniqueOrThrow({
        where: {
          id: input,
          isVerificationSent: true,
          isVerified: false
        }
      })

      if (!bankAccount) throw new Error('No bank account to verify')

      await prisma.bankAccount.update({
        where: {
          id: input
        },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          verifiedById: session.user.id,
          updatedById: session.user.id
        }
      })
    })
})
