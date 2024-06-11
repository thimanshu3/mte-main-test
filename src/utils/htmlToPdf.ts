import puppeteer from 'puppeteer-core'

export const htmlToPdf = async (html: string) => {
  const browser = await puppeteer.connect({
    browserWSEndpoint:
      // 'wss://chrome.browserless.io?token=1657de87-780c-4b05-9b47-848804eabc46'
      // 'wss://chrome.browserless.io?token=8c54659e-5b5f-489a-b7bf-33101ffb46db'
      // 'wss://mte-browserless-4npemgsjqa-el.a.run.app?token=wlEnH8klB0ZXlFOmqHmQ4EVLTwR9b4d7',
      // 'wss://browserless-4npemgsjqa-uc.a.run.app?token=v4gR7BGheVhmUHUEgr3WidIAF3alRKma'
      'wss://browserless.mteexim.com?token=QN36sW6YZ2IyzOAv81rIUeCfrTdcu7Fw'
  })

  const page = await browser.newPage()

  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  await page.emulateMediaType('screen')

  const pdfBuffer = await page.pdf({
    margin: { top: '32px', right: '16px', bottom: '32px', left: '16px' },
    printBackground: true,
    format: 'a4',
    timeout: 0
  })

  await browser.close()

  return pdfBuffer
}
