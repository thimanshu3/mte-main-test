import { readFileSync } from 'fs'
import Handlebars from 'handlebars'
import path from 'path'

const pdfTemplate = readFileSync(
  path.join(process.cwd(), 'public', 'templates', 'pdfs', 'purchase.hbs'),
  'utf-8'
)

const pdfTemplateSales = readFileSync(
  path.join(process.cwd(), 'public', 'templates', 'pdfs', 'sales.hbs'),
  'utf-8'
)

const chinaPdfTemplate = readFileSync(
  path.join(process.cwd(), 'public', 'templates', 'pdfs', 'chinapo.hbs'),
  'utf-8'
)

export const orderTemplate = Handlebars.compile(pdfTemplate)
export const salesTemplate = Handlebars.compile(pdfTemplateSales)
export const chinaOrderTemplate = Handlebars.compile(chinaPdfTemplate)

export const eInvoiceTemplate = Handlebars.compile(
  readFileSync(
    path.join(process.cwd(), 'public', 'templates', 'pdfs', 'einvoice.hbs'),
    'utf-8'
  )
)

export const stickersTemplate = Handlebars.compile(
  readFileSync(
    path.join(process.cwd(), 'public', 'templates', 'pdfs', 'stickers.hbs'),
    'utf-8'
  )
)

export const stickersTemplateWithQr = Handlebars.compile(
  readFileSync(
    path.join(
      process.cwd(),
      'public',
      'templates',
      'pdfs',
      'stickersQRCode.hbs'
    ),
    'utf-8'
  )
)
