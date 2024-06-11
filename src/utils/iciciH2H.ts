import dayjs from 'dayjs'

export const ICICIH2H_VERIFICATION_AMOUNT = 1

export const ICICIH2H_ACCOUNT_NUMBER = '000101237680'

export const ICICIH2H_COMPANY_CODE = 'MTE'

export type ICICIH2HInputType = {
  'Payment Indicator': 'D' | 'C' | 'I' | 'R' | 'N' | 'B' | 'M' | 'A'
  'Unique Cust Ref No': string
  'Vendor / Beneficiary Code': string
  'Name of Beneficiary': string
  'Instrument Amount': number
  'Payment Date': Date
  'Cheque Number'?: string
  'Beneficiary Bank A/c No': string
  'Beneficiary Bank IFSC Code': string
  'Beneficiary Bank Name': string
  'Beneficiary Mailing Address 1': string
  'Beneficiary Mailing Address 2'?: string | null
  'Beneficiary Mailing Address 3'?: string | null
  'Beneficiary City': string
  'Beneficiary Zip': string
  'Debit Narration'?: string | null
  'Print Location'?: string | null
  'Payable Location'?: string | null
  'Email id': string
  'Beneficiary Mobile No': string
}

const formatDateForICICIH2H = (date: Date) => {
  const d = dayjs(date)
  return d.format('DD/MM/YYYY')
}

export const parseICICIH2H = (data: ICICIH2HInputType) => {
  const formattedDate = formatDateForICICIH2H(data['Payment Date'])
  const year = data['Payment Date'].getUTCFullYear().toString()
  const amount = data['Instrument Amount'].toFixed(2)

  const arr1: string[] = []

  arr1.push('I') // Record Identifier
  arr1.push(data['Payment Indicator'])
  arr1.push(data['Unique Cust Ref No'])
  arr1.push(data['Vendor / Beneficiary Code'])
  arr1.push(data['Name of Beneficiary'])
  arr1.push(amount)
  arr1.push(formattedDate)
  arr1.push(data['Cheque Number'] || '')
  arr1.push(ICICIH2H_ACCOUNT_NUMBER) // Debit Account No
  arr1.push(data['Beneficiary Bank A/c No'])
  arr1.push(data['Beneficiary Bank IFSC Code'])
  arr1.push(data['Beneficiary Bank Name'])
  arr1.push(data['Beneficiary Mailing Address 1'])
  arr1.push(data['Beneficiary Mailing Address 2'] || '')
  arr1.push(data['Beneficiary Mailing Address 3'] || '')
  arr1.push(data['Beneficiary City'])
  arr1.push(data['Beneficiary Zip'])
  arr1.push(data['Debit Narration'] || '')
  arr1.push(data['Print Location'] || '')
  arr1.push(data['Payable Location'] || '')
  arr1.push(year) // Fiscal Year
  arr1.push(ICICIH2H_COMPANY_CODE) // Company Code
  arr1.push(data['Email id'])
  arr1.push(data['Beneficiary Mobile No'])
  arr1.push('') // AADHAR Number

  const arr2: string[] = []
  arr2.push('A') // Record Identifier
  arr2.push(data['Unique Cust Ref No']) // Unique Cust Ref No
  arr2.push('') // Invoice No
  arr2.push(formattedDate) // Invoice Date
  arr2.push('') // Gross Amount
  arr2.push('') // Deductions
  arr2.push(amount) // Net Amount

  return {
    arr1,
    arr2,
    str: arr1.join('|') + '\n' + arr2.join('|')
  }
}

// I|I|2000000044|0000113859|Forgings Limited|147980.00|06/02/2023||000101237680|000651000232|ICIC0000006|ICICI BANK LIMITED|Plant V,Vill Baliguma, PO Kolabira,|Saraikela Kharswan,Jharkhand|IN,34|Saraikela Kharswan|833220 |Debit Narration|Print Location|Payable Location|2023|8014 |xxxxxx.marketing@xxxxxforgings.com DONE|MOBILE|AADHAR|||
// A|RKA-102223-01598|12/01/2022|151000.00|3020.00||147980.00
