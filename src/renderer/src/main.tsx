import './assets/base.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from "react-router"

// Pages
import Homepage from './pages/Home'
import DefaultLayout from './layouts/DefaultLayout'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<DefaultLayout />}>
          <Route index element={<Homepage />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>
)
