import { Fields, Files, IncomingForm } from 'formidable'
import { NextApiRequest } from 'next'

export const parseMultipartRequest = (req: NextApiRequest) =>
  new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
    const form = new IncomingForm()
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err)

      const fields2 = { ...fields }

      if (fields2) {
        Object.keys(fields2).forEach(key => {
          if (
            fields2[key] &&
            Array.isArray(fields2[key]) &&
            fields2[key]!.length === 1
          ) {
            fields2[key]! = fields2[key]![0] as any
          }
        })
      }

      return resolve({
        fields: fields2,
        files
      })
    })
  })
