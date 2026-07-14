import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { fetchAsset, createAsset, updateAsset } from '../services/assets'

const schema = z.object({
  asset_no: z.string().min(1, 'Asset No is required'),
  name: z.string().min(1, 'Name is required'),
  site_location: z.string().optional().nullable(),
  job: z.string().optional().nullable(),
  account_no: z.coerce.number().optional().nullable(),
  category: z.string().optional().nullable(),
  fixed_asset_number_ax: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  group_name: z.string().optional().nullable(),
  voucher_no: z.string().optional().nullable(),
  maker_type_location: z.string().optional().nullable(),
  capacity_size_user: z.string().optional().nullable(),
  year: z.coerce.number().optional().nullable(),
  police_no: z.string().optional().nullable(),
  machine_no: z.string().optional().nullable(),
  chasis_no: z.string().optional().nullable(),
  quantity: z.coerce.number().optional().nullable(),
  valas: z.string().optional().nullable(),
  purchase_price: z.coerce.number().optional().nullable(),
  depreciation_period_total: z.coerce.number().optional().nullable(),
  photo_status: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  remark: z.string().optional().nullable(),
  year_ref: z.coerce.number().default(2026),
})

type FormData = z.infer<typeof schema>

const GROUPS = ['Building', 'Structures', 'Machinary and Equipment', 'Tools Furniture Fixtures', 'Vehicles']
const CATEGORIES = ['WH1', 'WH2', 'TRP', 'BALI', 'MDN', 'PBG', 'MKS', 'SBY', 'OTHERS']

export default function AssetForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: asset } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => fetchAsset(id!),
    enabled: isEdit,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { year_ref: 2026 },
  })

  useEffect(() => {
    if (asset) {
      reset({
        ...asset,
        purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
      })
    }
  }, [asset, reset])

  const createMut = useMutation({
    mutationFn: createAsset,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      const key = data.fixed_asset_number_ax || String(data.id)
      navigate(`/assets/${key}`)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ key, data }: { key: string; data: Partial<FormData> }) => updateAsset(key, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); navigate(`/assets/${id}`) },
  })

  const onSubmit = (data: FormData) => {
    if (isEdit) updateMut.mutate({ key: id!, data })
    else createMut.mutate(data)
  }

  const isLoading = createMut.isPending || updateMut.isPending

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Back</button>
        <h1 className="text-xl font-bold">{isEdit ? 'Edit Asset' : 'Add New Asset'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Section title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Asset No *" error={errors.asset_no?.message}>
              <input {...register('asset_no')} className="input" />
            </Field>
            <Field label="Fixed Asset No (AX)">
              <input {...register('fixed_asset_number_ax')} className="input" />
            </Field>
            <Field label="Name *" error={errors.name?.message} className="col-span-2">
              <input {...register('name')} className="input" />
            </Field>
            <Field label="Group">
              <select {...register('group_name')} className="input">
                <option value="">Select group...</option>
                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select {...register('category')} className="input">
                <option value="">Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Site/Location">
              <input {...register('site_location')} className="input" />
            </Field>
            <Field label="Job">
              <input {...register('job')} className="input" />
            </Field>
            <Field label="Account No">
              <input type="number" {...register('account_no')} className="input" />
            </Field>
            <Field label="Voucher No">
              <input {...register('voucher_no')} className="input" />
            </Field>
            <Field label="Purchase Date">
              <input type="date" {...register('purchase_date')} className="input" />
            </Field>
            <Field label="Year">
              <input type="number" {...register('year')} className="input" />
            </Field>
            <Field label="Year Reference">
              <select {...register('year_ref')} className="input">
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </Field>
            <Field label="Quantity">
              <input type="number" {...register('quantity')} className="input" />
            </Field>
          </div>
        </Section>

        {/* Asset Details */}
        <Section title="Asset Details">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Maker/Type/Location" className="col-span-2">
              <textarea {...register('maker_type_location')} rows={2} className="input" />
            </Field>
            <Field label="Capacity/Size/User" className="col-span-2">
              <textarea {...register('capacity_size_user')} rows={2} className="input" />
            </Field>
            <Field label="Police No">
              <input {...register('police_no')} className="input" />
            </Field>
            <Field label="Machine No">
              <input {...register('machine_no')} className="input" />
            </Field>
            <Field label="Chasis No">
              <input {...register('chasis_no')} className="input" />
            </Field>
            <Field label="Valas (Currency)">
              <input {...register('valas')} className="input" placeholder="e.g. USD" />
            </Field>
          </div>
        </Section>

        {/* Depreciation */}
        <Section title="Depreciation">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Purchase Price (IDR)">
              <input type="number" step="0.01" {...register('purchase_price')} className="input" />
            </Field>
            <Field label="Depreciation Period (months)">
              <input type="number" {...register('depreciation_period_total')} className="input" />
            </Field>
          </div>
          <p className="text-xs text-gray-400 mt-2">Monthly depreciation will be calculated automatically.</p>
        </Section>

        {/* Status */}
        <Section title="Status & Condition">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Photo Status">
              <select {...register('photo_status')} className="input">
                <option value="">Select...</option>
                <option value="Ok">Ok</option>
                <option value="Not Ok">Not Ok</option>
              </select>
            </Field>
            <Field label="Condition">
              <input {...register('condition')} className="input" />
            </Field>
            <Field label="Remark" className="col-span-2">
              <textarea {...register('remark')} rows={2} className="input" />
            </Field>
          </div>
        </Section>

        <div className="flex gap-3">
          <button type="submit" disabled={isLoading} className="bg-blue-700 text-white px-6 py-2 rounded hover:bg-blue-800 disabled:opacity-50 font-medium">
            {isLoading ? 'Saving...' : isEdit ? 'Update Asset' : 'Create Asset'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border px-6 py-2 rounded hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h2 className="font-semibold text-gray-700 mb-4 border-b pb-2">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
