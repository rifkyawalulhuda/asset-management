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
export const fetchSummaryMonthly = async (year_ref: number, site_location?: string): Promise<SummaryMonthly> => {
  const params: Record<string, unknown> = { year_ref }
  if (site_location) params.site_location = site_location
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

export const fetchSummaryByCategory = async (year_ref: number) => {
  const { data } = await api.get('/summary/by-category', { params: { year_ref } })
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
