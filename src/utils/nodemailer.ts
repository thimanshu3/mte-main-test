import { createTransport } from 'nodemailer'
import Mail from 'nodemailer/lib/mailer'
import { env } from '~/env.mjs'

const mailTransporter = createTransport({
  host: env.EMAIL_SERVER_HOST,
  port: parseInt(env.EMAIL_SERVER_PORT),
  auth: {
    user: env.EMAIL_SERVER_USER,
    pass: env.EMAIL_SERVER_PASSWORD
  }
})

export const sendMail = async (options: Mail.Options) => {
  if (!options.from) options.from = env.EMAIL_FROM

  return await mailTransporter.sendMail(options)
}
