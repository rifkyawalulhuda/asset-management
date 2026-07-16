import api from './api'
import type { FixedAsset, FixedAssetListResponse, AssetFilters, AcquisitionDisposal, SummaryMonthly, SummaryByGroup } from '../types'

// Assets
export const fetchAssets = async (filters: AssetFilters = {}): Promise<FixedAssetListResponse> => {
  const { data } = await api.get('/assets', { params: filters })
  return data
}

export const fetchAsset = async (key: string): Promise<FixedAsset> => {
  const { data } = await api.get(`/assets/${key}`)
  return data
}

export const createAsset = async (payload: Partial<FixedAsset>): Promise<FixedAsset> => {
  const { data } = await api.post('/assets', payload)
  return data
}

export const updateAsset = async (key: string, payload: Partial<FixedAsset>): Promise<FixedAsset> => {
  const { data } = await api.put(`/assets/${key}`, payload)
  return data
}

export const deleteAsset = async (id: number): Promise<void> => {
  await api.delete(`/assets/${id}`)
}

// Acquisitions
export const fetchAcquisitions = async (params?: { year_ref?: number; status?: string }): Promise<AcquisitionDisposal[]> => {
  const { data } = await api.get('/acquisitions', { params })
  return data
}

export const createAcquisition = async (payload: Partial<AcquisitionDisposal>): Promise<AcquisitionDisposal> => {
  const { data } = await api.post('/acquisitions', payload)
  return data
}

export const updateAcquisition = async (id: number, payload: Partial<AcquisitionDisposal>): Promise<AcquisitionDisposal> => {
  const { data } = await api.put(`/acquisitions/${id}`, payload)
  return data
}

export const deleteAcquisition = async (id: number): Promise<void> => {
  await api.delete(`/acquisitions/${id}`)
}

// Summary
export const fetchSummaryMonthly = async (year_ref: number, site_location?: string, group_by?: 'job' | 'category' | 'group_name'): Promise<SummaryMonthly> => {
  const params: Record<string, unknown> = { year_ref }
  if (site_location) params.site_location = site_location
  if (group_by) params.group_by = group_by
  const { data } = await api.get('/summary/monthly', { params })
  return data
}

export const fetchSummaryByGroup = async (year_ref: number, site_location?: string): Promise<SummaryByGroup> => {
  const params: Record<string, unknown> = { year_ref }
  if (site_location) params.site_location = site_location
  const { data } = await api.get('/summary/by-group', { params })
  return data
}

export const fetchSummaryTotals = async (year_ref: number, site_location?: string) => {
  const params: Record<string, unknown> = { year_ref }
  if (site_location) params.site_location = site_location
  const { data } = await api.get('/summary/totals', { params })
  return data
}

export const fetchSummaryByCategory = async (year_ref: number, site_location?: string) => {
  const params: Record<string, unknown> = { year_ref }
  if (site_location) params.site_location = site_location
  const { data } = await api.get('/summary/by-category', { params })
  return data
}

export const fetchSiteLocations = async (year_ref?: number): Promise<{ site_location: string; count: number }[]> => {
  const { data } = await api.get('/summary/site-locations', { params: year_ref ? { year_ref } : {} })
  return data
}

// Import Excel
export const importExcel = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/import/excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// Forecast
export const fetchForecastTotals = async (forecast_year: number, site_location?: string, include_planned?: boolean) => {
  const params: Record<string, unknown> = { forecast_year }
  if (site_location) params.site_location = site_location
  if (include_planned) params.include_planned = true
  const { data } = await api.get('/forecast/totals', { params })
  return data
}

export const fetchForecastMonthly = async (forecast_year: number, site_location?: string, group_by?: 'job' | 'category' | 'group_name', include_planned?: boolean) => {
  const params: Record<string, unknown> = { forecast_year }
  if (site_location) params.site_location = site_location
  if (group_by) params.group_by = group_by
  if (include_planned) params.include_planned = true
  const { data } = await api.get('/forecast/monthly', { params })
  return data
}

export const fetchForecastByGroup = async (forecast_year: number, site_location?: string, include_planned?: boolean) => {
  const params: Record<string, unknown> = { forecast_year }
  if (site_location) params.site_location = site_location
  if (include_planned) params.include_planned = true
  const { data } = await api.get('/forecast/by-group', { params })
  return data
}

export const fetchForecastByCategory = async (forecast_year: number, site_location?: string, include_planned?: boolean) => {
  const params: Record<string, unknown> = { forecast_year }
  if (site_location) params.site_location = site_location
  if (include_planned) params.include_planned = true
  const { data } = await api.get('/forecast/by-category', { params })
  return data
}

export const fetchForecastAssets = async (
  forecast_year: number,
  params?: { site_location?: string; group_name?: string; category?: string; search?: string; page?: number; size?: number; include_planned?: boolean }
) => {
  const { data } = await api.get('/forecast/assets', { params: { forecast_year, ...params } })
  return data
}

// Planned Assets
export const fetchPlannedAssets = async (forecast_year?: number, site_location?: string) => {
  const params: Record<string, unknown> = {}
  if (forecast_year) params.forecast_year = forecast_year
  if (site_location) params.site_location = site_location
  const { data } = await api.get('/planned-assets', { params })
  return data
}

export const createPlannedAsset = async (payload: {
  forecast_year: number
  name: string
  purchase_price?: number
  depreciation_period_total?: number
  planned_purchase_month: number
  planned_purchase_year: number
  site_location?: string
  job?: string
  category?: string
  group_name?: string
}) => {
  const { data } = await api.post('/planned-assets', payload)
  return data
}

export const updatePlannedAsset = async (id: number, payload: Partial<{
  name: string
  purchase_price: number
  depreciation_period_total: number
  planned_purchase_month: number
  planned_purchase_year: number
  site_location: string
  job: string
  category: string
  group_name: string
}>) => {
  const { data } = await api.put(`/planned-assets/${id}`, payload)
  return data
}

export const deletePlannedAsset = async (id: number): Promise<void> => {
  await api.delete(`/planned-assets/${id}`)
}
