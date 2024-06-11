/** @type {import("prettier").Config} */
const config = {
  plugins: [require.resolve('prettier-plugin-tailwindcss')],
  arrowParens: 'avoid',
  trailingComma: 'none',
  semi: false,
  singleQuote: true
}

module.exports = config
