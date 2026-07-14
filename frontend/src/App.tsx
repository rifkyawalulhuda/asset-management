import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import AssetList from './pages/AssetList'
import AssetDetail from './pages/AssetDetail'
import AssetForm from './pages/AssetForm'
import SummaryReport from './pages/SummaryReport'
import Acquisitions from './pages/Acquisitions'
import ImportExcel from './pages/ImportExcel'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="assets" element={<AssetList />} />
            <Route path="assets/new" element={<AssetForm />} />
            <Route path="assets/:id" element={<AssetDetail />} />
            <Route path="assets/:id/edit" element={<AssetForm />} />
            <Route path="summary" element={<SummaryReport />} />
            <Route path="acquisitions" element={<Acquisitions />} />
            <Route path="import" element={<ImportExcel />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
