export class ICICI_CIB {
  private apiKey: string
  private corpId: string
  private userId: string
  private aggrId: string
  private aggrName: string
  private urn?: string | null
  private baseUrl: string = 'https://developerportaluat.icicibank.com'

  constructor({
    apiKey,
    corpId,
    userId,
    aggrId,
    aggrName,
    urn
  }: {
    apiKey: string
    corpId: string
    userId: string
    aggrId: string
    aggrName: string
    urn?: string | null
  }) {
    this.apiKey = apiKey
    this.corpId = corpId
    this.userId = userId
    this.aggrId = aggrId
    this.aggrName = aggrName
    this.urn = urn
  }

  async createRegistration() {
    if (this.urn) return

    const now = Date.now()
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        CORPID: this.corpId,
        USERID: this.userId,
        AGGRID: this.aggrId,
        AGGRNAME: this.aggrName,
        UNIQUEREFERENCENUMBER: `REF-${now}`,
        ALIASID: `MTE-${now}`
      })
    })
    const json = await res.json()
    this.urn = json.UNIQUEREFERENCENUMBER
  }

  async checkRegistration() {
    if (!this.urn) return false

    try {
      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          CORPID: this.corpId,
          USERID: this.userId,
          AGGRID: this.aggrId,
          AGGRNAME: this.aggrName,
          URN: this.urn
        })
      })
      const json = await res.json()
      return json.status.toLowerCase() === 'registered'
    } catch (err) {
      console.error(err)
      return false
    }
  }

  async transactionWithOtp() {
    if (!this.urn) throw new Error('Not registered with ICICI')

    const isRegistered = await this.checkRegistration()
    if (!isRegistered) throw new Error('Not registered with ICICI')

    const txnId = `TXN-${Date.now()}`

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        CORPID: this.corpId,
        USERID: this.userId,
        AGGRID: this.aggrId,
        AGGRNAME: this.aggrName,
        URN: this.urn,
        UNIQUEID: txnId,
        DEBITACC: '',
        CREDITACC: '',
        IFSC: '',
        AMOUNT: 0,
        CURRENCY: 'INR',
        TXNTYPE: '', // RTG for RTGS, RGS for NEFT, IFS for IMPS, TPA for icici to icici,
        OTP: '',
        PAYEENAME: '',
        REMARKS: ''
      })
    })
    const json = await res.json()
    return json
  }
}
