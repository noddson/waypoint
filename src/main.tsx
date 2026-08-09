import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { shouldEnableMobileExperience } from './mobileMode'
import './styles.css'
import './mobile.css'
import './tripPicker.css'
import './routeSegments.css'
import './weather.css'
import './journal.css'
import './unifiedMenu.css'

const mobileExperience = shouldEnableMobileExperience()
document.body.classList.toggle('mobile-experience', mobileExperience)

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
