import { createContext, useContext } from 'react'

// Lets the first screen (Home) tell App "my data is loaded" so the branded splash
// stays up until the app is fully ready — one continuous load instead of
// splash → skeletons → data.
export const AppReadyContext = createContext<{ markReady: () => void }>({ markReady: () => {} })

export const useAppReady = () => useContext(AppReadyContext)
