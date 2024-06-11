import { createContext, useContext } from 'react'

const DarkModeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {}
})

export const DarkModeProvider = DarkModeContext.Provider

export const useDarkMode = () => {
  const darkMode = useContext(DarkModeContext)
  return darkMode
}
