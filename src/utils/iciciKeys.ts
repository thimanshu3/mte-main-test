import crypto from 'crypto'

const iciciKeys = {
  test: {
    ours: {
      public: `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAnua67+D39Xs8ryefoDGN
Jxd81dLnlXnZWgXqKuv779oYpJ1QjGVyCP/VVCbC3nfE/qySdQHN99ulGI72JbUi
i4uj4oq/di+kU+QzY/W3xfZs3+n+eyPRAZ0HTpXa/667Q05dt/wvy5/JyH59nk35
lJs1wc9SXgL1/r/d1vtablJbm6jQsRfuaVYKP0/C2Pfu1rbzoC2DKfRktCcAvmWf
Fv+0A2hosxSNYeW+ahrFEm4Yewcf1imeHs4Bf0C1af/OAl0RP1NCX+RJ0M9gYUNg
EumXsGesJG7vp6PKLzkzMbrQwlj3oMYiusUU/7KxIbcAXbNOh303C/C6J1F4Onu0
+y4G/1FAK+RGxfFaXSrWNPUmwA9LMI73VKtb0515spSae2KwDlAwcIgme3Obv6hQ
gVxcME4mI9VN8vnYHWYjhRGwhMJP62xWMtadHCAkU4jUEUmbH+X5WyiIO2VdVTnF
1QvJuXnU09msjLnAu1fEwR4EyHQsPm779FaOHp0+xyOzec+/RzTKkAoGa0YUUah5
+3ecAsBCuY8Itd7LZ03/ebrPRP2NrhT3nAVMWbnQzjkNzuEVxkm9Z2URhkeYlkI/
ClXvytMXO64ypyZAguhERoMDRZAwJQepFgW95BQCA1H45PN6gIa7g4J4/7jkItTd
3LoAdiwsmxEvMi8OqZty+F0CAwEAAQ==
-----END PUBLIC KEY-----
`,
      private: `-----BEGIN PRIVATE KEY-----
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
nxG2YSH6qgfy2bd2pyzWC8FYw5+4
-----END PRIVATE KEY-----
`
    },
    theirs: {
      public: ``,
      private: ``
    }
  },
  live: {
    ours: {
      public: `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtDYFUhxJnLEcNETzvBg4
JfBkRTHqRznij8RlIPCwwQHxHUCfyaVB4jwuo8kh8RkRubn7F8uM1MtLcOYO1A1g
B/GrZ9sbOmRcbuXz3+g+FG5HQ885Z/tng3CidvLqQ17bPCTfyZlt2FFrSXnB4OsA
EkrTupH2LfC8XfK3BUZmyrObSofS5b0090Q9THi0jPnjngNsnHL7ko2Z2kvmrJM/
GvOxwYfV9d9Z4GZmk04NhUbT9EN2hiZue1zkkp/RY1aiFGKnkLfPVPnz8a0pw4fS
F8Plb2LsQD8bM2lmXD4xSqxbq9KAMmbh1xXoSU/I0fSnNo5+SpDM0J4Gv8nZ8z47
gqo9SUg6/yqNpdpKsaYHIN7LH4H5I6Ds71BavU8KJLXjgCP3T5EZr/kBmnWfZMvc
RxkOMM88ddI1etLWfb3QvnH8qj03YH553IBjDKzKUmL+A58NfH0j5QdQvmo076xl
BkM7nrQp+ZBoltBCY0SsuCB2ECcxQ7v3HosVFuN7zmV+t+OCtr287KJE7zMxAqL5
BGd+dKSvGVb/prn1va2GcJ7U+/ZFlK6BT801DqE/Kjbs608e/IYx7GWXQIWpQg7M
rFqC0vgQNWTlDB9BVlDz5ZbOAh3iUVzRzlDMNr9zHkOTLhYdA5zLF3+EV7xDNN+r
ibjkDogmG3KbENi54mHJwosCAwEAAQ==
-----END PUBLIC KEY-----
`,
      private: `-----BEGIN PRIVATE KEY-----
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
mRQnYWbQ6QhlkGv5VfnTeBHtk5R7Jwk=
-----END PRIVATE KEY-----
`
    },
    theirs: {
      public: ``,
      private: ``
    }
  }
}

export const encryptData = ({
  data,
  env,
  keyPair
}: {
  data: string
  env: 'test' | 'live'
  keyPair: 'ours' | 'theirs'
}) => {
  const encryptedData = crypto.publicEncrypt(
    {
      key: iciciKeys[env][keyPair].public,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(data)
  )
  return encryptedData.toString('base64')
}

export const decryptData = ({
  data,
  env,
  keyPair
}: {
  data: string
  env: 'test' | 'live'
  keyPair: 'ours' | 'theirs'
}) => {
  const decryptedData = crypto.privateDecrypt(
    {
      key: iciciKeys[env][keyPair].private,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    Buffer.from(data, 'base64')
  )
  return decryptedData.toString()
}

const encryptedData = encryptData({
  env: 'test',
  keyPair: 'ours',
  data: JSON.stringify({
    message: 'This is a secret message.'
  })
})

const decryptedData = decryptData({
  env: 'test',
  keyPair: 'ours',
  data: encryptedData
})

console.log(encryptedData, decryptedData)
