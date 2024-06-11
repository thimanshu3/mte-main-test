import { createTRPCRouter } from '~/server/api/trpc'
import { bulkRouter } from './bulk'
import { inventoryRouter } from './inventory'
import { invoiceRouter } from './invoice'
import { purchaseRouter } from './purchase'
import { salesRouter } from './sales'

export const ordersRouter = createTRPCRouter({
  sales: salesRouter,
  purchase: purchaseRouter,
  bulk: bulkRouter,
  inventory: inventoryRouter,
  invoices: invoiceRouter
})
