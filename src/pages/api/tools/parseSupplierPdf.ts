import formidable, { File } from 'formidable'
import { promises as fs } from 'fs'
import json2csv from 'json2csv'
import { NextApiRequest, NextApiResponse } from 'next'
import PDFParser from 'pdf2json'
import { storageClient } from '~/utils/cloudStorage'

export const config = {
  api: {
    bodyParser: false
  }
}

type ProcessedFiles = Array<[string, File]>

const extractSelectedText = (string: string) => {
  const fu = string.split('√')[0]
  const final = fu?.split('( )')
  return final ? final[final.length - 1]?.replace(/\(|\)/g, '')?.trim() : ''
}

const extractDataFromPdf = (pdfText: string, fileName: string) => {
  if (
    pdfText === '' ||
    pdfText === '\r\n----------------Page (0) Break----------------\r\n'
  )
    return {
      fileName,
      date: new Date(), // Get the file's modification date
      data: { error: 'not able to extract data from this pdf' }
    }

  const businessNameMatch = pdfText.match(
    /Name of the Business Enterprise : (.+)|Name of the Business Enterprise: (.+)/
  )
  const natureOfBusinessMatch = pdfText.match(
    /Nature of Business Enterprise\s+: (.+)/
  )
  const registeredAddressMatch = pdfText.match(
    /Registered Address\s*:\s*([^]+?)\s*GST No\./
  )

  const gstAndPanMatch = pdfText.match(
    /GST\s+No\.+\s*:\s*([^:]+)\s+PAN\s+No\.+\s*:\s*([^:]+)\s+/
  )

  const contactNumberMatch = pdfText.match(
    /Contact\/ Mobile Number: ([^\r\n]+)|Contact\/ Mobile Number : ([^\r\n]+)/
  )
  const whatsappNumberMatch = pdfText.match(/Whatsapp Number\s*:\s*([^:\r\n]+)/)

  const mobileNumberMatch = pdfText.match(
    /Mobile: ([^\r\n]+)|Mobile : ([^\r\n]+)/
  )
  const emailMatch = pdfText.match(/E-Mail: ([^\r\n]+)|E-Mail : ([^\r\n]+)/)
  const proprietorNameMatch = pdfText.match(/Name: (.+)|Name : (.+)/)
  const genderMatch = pdfText.match(/Gender:\s+(Male|Female)/)
  const designationMatch = pdfText.match(/Designation\s*:\s*(\S+)/)
  const aadharNumberMatch = pdfText.match(/Aadhar Card Number\s*:\s*(.+)/)
  const bankNameMatch = pdfText.match(/Bank Name\s*:\s*(.+)/)
  const bankBranchCodeMatch = pdfText.match(/Bank Branch Code\s*:\s*(.+)/)
  const accountHolderNameMatch = pdfText.match(/Account Holder Name\s*:\s*(.+)/)
  const accountNumberMatch = pdfText.match(/Account Number\s*:\s*([^]+?)\s+/)

  const ifscCodeMatch = pdfText.match(/IFSC CODE\s*:\s*(.+)/)
  const micrNumberMatch = pdfText.match(/MICR Number\s*:\s*(.+)/)

  const section2 =
    pdfText.split(' DETAILS OF PROPRIETOR/ PARTNER/ MANAGING DIRECTOR:')
      .length > 1
      ? pdfText.split(
          ' DETAILS OF PROPRIETOR/ PARTNER/ MANAGING DIRECTOR:'
        )[1]
      : pdfText.split('DETAILS OF PROPRIETOR :\r\n')[1]

  const addressMatch = section2?.match(/Address\s*:\s*(.+)/)

  let natureOfBusiness: string | undefined
  if (natureOfBusinessMatch) {
    const natureOfBusinessText = natureOfBusinessMatch[1]
    natureOfBusiness = extractSelectedText(natureOfBusinessText || '')
  }

  const result = {
    businessDetails: {
      businessName:
        businessNameMatch && businessNameMatch[1] !== undefined
          ? businessNameMatch[1].trim()
          : businessNameMatch && businessNameMatch[2]
          ? businessNameMatch[2].trim()
          : '',
      natureOfBusiness,
      registeredAddress: registeredAddressMatch
        ? registeredAddressMatch[1]?.trim()
        : '',
      gstNumber: gstAndPanMatch ? gstAndPanMatch[1] : '',
      panNumber: gstAndPanMatch ? gstAndPanMatch[2]?.split(' ')[0] : '',
      contactNumber:
        contactNumberMatch && contactNumberMatch[1] !== undefined
          ? contactNumberMatch[1]?.split('  ')[0]
          : contactNumberMatch && contactNumberMatch[2]
          ? contactNumberMatch[2]?.trim()
          : '',
      whatsAppNumber:
        contactNumberMatch && contactNumberMatch[1] !== undefined
          ? contactNumberMatch[1]
              ?.split('  ')
              ?.filter(f => f !== '')[1]
              ?.split(':')[1]
          : whatsappNumberMatch && whatsappNumberMatch[1]?.trim(),
      email:
        emailMatch && emailMatch[1] !== undefined
          ? emailMatch[1]?.split('  ')[0]
          : emailMatch && emailMatch[2]?.split('  ')[0],
      website:
        emailMatch && emailMatch[1] !== undefined
          ? emailMatch[1]
              ?.split('  ')
              ?.filter(f => f !== '')[1]
              ?.split(':')[1]
          : ''
      //   : emailMatch &&
      //     emailMatch[2] &&
      //     emailMatch[2]
      //       ?.split('   ')
      //       ?.filter(f => f !== '')[1]
      //       .match(/Website\s*:\s*(\S+)/)[1]
    },
    detailsOfPMD: {
      name:
        proprietorNameMatch && proprietorNameMatch[1] !== undefined
          ? proprietorNameMatch[1]
          : proprietorNameMatch &&
            proprietorNameMatch[2] &&
            proprietorNameMatch[2]?.trim(),
      gender: genderMatch ? genderMatch[1] : '',
      designation: designationMatch ? designationMatch[1]?.trim() : '',
      aadharNumber: aadharNumberMatch
        ? aadharNumberMatch[1]?.split('  ')?.filter(f => f !== '')[0]
        : '',
      panNumber: aadharNumberMatch
        ? aadharNumberMatch[1]
            ?.split('  ')
            ?.filter(f => f !== '')[1]
            ?.split(':')[1]
        : '',
      address: addressMatch ? addressMatch[1]?.trim() : '',
      mobile:
        mobileNumberMatch && mobileNumberMatch[1] !== undefined
          ? mobileNumberMatch[1].trim()
          : mobileNumberMatch &&
            mobileNumberMatch[2] &&
            mobileNumberMatch[2].trim()
    },
    bankAccDetails: {
      bankName: bankNameMatch ? bankNameMatch[1]?.trim() : '',
      bankBranchCode: bankBranchCodeMatch ? bankBranchCodeMatch[1]?.trim() : '',
      accountHolderName: accountHolderNameMatch
        ? accountHolderNameMatch[1]?.trim()
        : '',
      accountNumber:
        accountNumberMatch &&
        accountNumberMatch[1] !== undefined &&
        accountNumberMatch[1] !== ''
          ? accountNumberMatch[1]?.trim()
          : pdfText
              .split('\n')
              [pdfText.split('\n').length - 4]?.replace(/\s/g, ''),
      ifscCode: ifscCodeMatch ? ifscCodeMatch[1]?.trim() : '',
      micrNumber: micrNumberMatch ? micrNumberMatch[1]?.trim() : ''
    }
  }
  return result
}

const getPdfData = (file: any) => {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as any)(this, 1)
    pdfParser.on('pdfParser_dataError', (errData: any) => {
      console.error(errData.parserError)
      reject(errData.parserError)
    })
    pdfParser.on('pdfParser_dataReady', () => {
      const pdfText = pdfParser.getRawTextContent()
      const pdfResult = extractDataFromPdf(
        pdfText,
        file.originalFilename || file.newFilename
      )
      const obj = {
        date: new Date(),
        data: pdfResult,
        fileName: file.originalFilename || file.newFilename
      }
      resolve(obj)
    })

    fs.readFile(file.filepath)
      .then(buffer => {
        pdfParser.parseBuffer(buffer)
      })
      .catch(error => {
        console.error(error)
        reject(error)
      })
  })
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  let finalpdfdata: any = []

  try {
    const files = await new Promise<ProcessedFiles | undefined>(
      (resolve, reject) => {
        const form = new formidable.IncomingForm()
        const files: any = []

        form.on('file', function (field, file) {
          files.push([field, file])
        })
        form.on('end', () => resolve(files))
        form.on('error', err => reject(err))

        form.parse(req, err => {
          if (err) {
            res.writeHead(err.httpCode || 400, { 'Content-Type': 'text/plain' })
            res.end(String(err))
            reject(err)
          }
        })
      }
    )

    if (files?.length) {
      const promises = files.map(file => getPdfData(file[1]))
      finalpdfdata = await Promise.all(promises)
    }

    if (finalpdfdata.length) {
      const csv = json2csv.parse(
        finalpdfdata.map((f: any) => ({
          fileName: f.fileName,
          date: f.date,
          ...f.data.businessDetails,
          ...f.data.detailsOfPMD,
          ...f.data.bankAccDetails
        }))
      )
      const filename = `pdf-data-${new Date().getTime()}.csv`

      const url = await storageClient.addFile({
        filename,
        data: csv
      })

      return res.status(200).json({
        url
      })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({
      message: 'Something went wrong'
    })
  }
}

export default handler
