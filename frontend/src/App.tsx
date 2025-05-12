import { extendTheme, ThemeConfig } from '@chakra-ui/react'
import { Routes, Route, Navigate } from 'react-router-dom'
import TabNavigation from './components/TabNavigation'
import Proposals from './pages/Proposals'
import Preferences from './pages/Preferences'

// Define theme configuration
const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

// Define theme with dark mode as default
export const theme = extendTheme({
  config,
  colors: {
    gray: {
      50: '#f7fafc',
      100: '#edf2f7',
      200: '#e2e8f0',
      300: '#cbd5e0',
      400: '#a0aec0',
      500: '#718096',
      600: '#4a5568',
      700: '#2d3748',
      800: '#1a202c',
      900: '#171923',
    },
  },
  styles: {
    global: (props) => ({
      body: {
        bg: 'gray.900',
        color: 'whiteAlpha.900',
        overflowY: 'scroll',
      },
      // Style scrollbars for dark mode
      '::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
      },
      '::-webkit-scrollbar-track': {
        bg: 'gray.800',
      },
      '::-webkit-scrollbar-thumb': {
        bg: 'gray.600',
        borderRadius: '8px',
      },
    }),
  },
  components: {
    Button: {
      baseStyle: {
        _focus: {
          boxShadow: 'outline',
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'gray.800',
          borderColor: 'gray.700',
        },
      },
    },
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif',
  },
})

function App() {
  return (
    <div className="min-h-screen">
      <TabNavigation />
      <Routes>
        <Route path="/" element={<Navigate to="/proposals" replace />} />
        <Route path="/proposals" element={<Proposals />} />
        <Route path="/preferences" element={<Preferences />} />
      </Routes>
    </div>
  )
}

export default App 