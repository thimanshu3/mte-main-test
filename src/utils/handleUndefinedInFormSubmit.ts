export const handleUndefinedInFormSubmit = (obj: any) => {
  if (typeof obj === 'object')
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        if (obj[key] instanceof Array)
          for (const item in obj[key]) handleUndefinedInFormSubmit(item)
        else handleUndefinedInFormSubmit(obj[key])
      } else if (obj[key] === undefined && key.slice(-2) === 'Id')
        obj[key] = null
    }
  return obj
}
