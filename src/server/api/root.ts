import { addressRouter } from '~/server/api/routers/address'
import { attachmentsRouter } from '~/server/api/routers/attachments'
import { bankAccountsRouter } from '~/server/api/routers/bankAccounts'
import { businessTypesRouter } from '~/server/api/routers/businessTypes'
import { currencyRouter } from '~/server/api/routers/currency'
import { customersRouter } from '~/server/api/routers/customers'
import { dashboardRouter } from '~/server/api/routers/dashboard'
import { exampleRouter } from '~/server/api/routers/example'
import { expensesRouter } from '~/server/api/routers/expenses'
import { gstRatesRouter } from '~/server/api/routers/gstRates'
import { inquiriesRouter } from '~/server/api/routers/inquiries'
import { inquiriesSentToSupplierRouter } from '~/server/api/routers/inquiriesSentToSupplier'
import { inquiryCancelReasonsRouter } from '~/server/api/routers/inquiryCancelReasons'
import { inquiryResultsRouter } from '~/server/api/routers/inquiryResults'
import { inquiryStatusesRouter } from '~/server/api/routers/inquiryStatuses'
import { offerSentToCustomerRouter } from '~/server/api/routers/offerSentToCustomer'
import { ordersRouter } from '~/server/api/routers/orders'
import { paymentTermsRouter } from '~/server/api/routers/paymentTerms'
import { portsRouter } from '~/server/api/routers/ports'
import { sitesRouter } from '~/server/api/routers/sites'
import { suppliersRouter } from '~/server/api/routers/suppliers'
import { taskCheckListItemsRouter } from '~/server/api/routers/task-management/taskCheckListItems'
import { taskCheckListsRouter } from '~/server/api/routers/task-management/taskCheckLists'
import { taskListsRouter } from '~/server/api/routers/task-management/taskLists'
import { tasksRouter } from '~/server/api/routers/task-management/tasks'
import { teamsRouter } from '~/server/api/routers/task-management/teams'
import { unitsRouter } from '~/server/api/routers/units'
import { usersRouter } from '~/server/api/routers/users'
import { whatsappRouter } from '~/server/api/routers/whatsapp'
import { createTRPCRouter } from '~/server/api/trpc'
import { countryOfOriginRouter } from './routers/countryOfOrigin'
import { exporterDetailsRouter } from './routers/exporterDetails'
import { IecCode } from './routers/iEcCode'
import { invoiceCollectionRouter } from './routers/invoiceCollection'
import { LUT } from './routers/lut'
import { notifyPartyRouter } from './routers/notifyParty'
import { paymentRequestRouter } from './routers/paymentRequest'
import { salesCollectionRouter } from './routers/salesCollection'

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  example: exampleRouter,
  users: usersRouter,
  units: unitsRouter,
  gstRates: gstRatesRouter,
  inquiryStatuses: inquiryStatusesRouter,
  inquiryResults: inquiryResultsRouter,
  inquiryCancelReasons: inquiryCancelReasonsRouter,
  businessTypes: businessTypesRouter,
  paymentTerms: paymentTermsRouter,
  expenses: expensesRouter,
  suppliers: suppliersRouter,
  customers: customersRouter,
  address: addressRouter,
  ports: portsRouter,
  sites: sitesRouter,
  inquiries: inquiriesRouter,
  attachments: attachmentsRouter,
  inquiriesSentToSupplier: inquiriesSentToSupplierRouter,
  offerSentToCustomer: offerSentToCustomerRouter,
  orders: ordersRouter,
  dashboard: dashboardRouter,
  teams: teamsRouter,
  taskLists: taskListsRouter,
  tasks: tasksRouter,
  taskCheckLists: taskCheckListsRouter,
  taskCheckListItems: taskCheckListItemsRouter,
  whatsapp: whatsappRouter,
  bankAccounts: bankAccountsRouter,
  currency: currencyRouter,
  notifyParty: notifyPartyRouter,
  exporterDetails: exporterDetailsRouter,
  countryOfOrigin: countryOfOriginRouter,
  Lut: LUT,
  IecCode: IecCode,
  salesCollection: salesCollectionRouter,
  invoiceCollection: invoiceCollectionRouter,
  paymentRequests: paymentRequestRouter
})

// export type definition of API
export type AppRouter = typeof appRouter
