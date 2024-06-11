const messages = [
  'Hello',
  'Welcome',
  'Hola',
  'Howdy',
  'Bonjour',
  'Namaste',
  'Salam',
  'Ahoy'
]

export const greet = () => {
  const randomIndex = Math.floor(Math.random() * messages.length)
  return messages[randomIndex]
}
