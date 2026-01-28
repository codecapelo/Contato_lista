import {
  loadPatients,
  withCors,
  getAdminToken,
  mapStorageError,
  serializeCsv
} from './lib/storage.js'

export default async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return withCors(200, '')
    }

    if (req.method !== 'GET') {
      return withCors(405, { ok: false, error: 'Método não suportado' })
    }

    const adminToken = getAdminToken()
    const url = new URL(req.url)
    const token = req.headers.get('x-admin-token') || url.searchParams.get('token') || ''
    if (adminToken && token !== adminToken) {
      return withCors(401, { ok: false, error: 'Não autorizado' })
    }

    const patients = await loadPatients()
    const csv = serializeCsv(patients)

    return withCors(200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=\"pacientes.csv\"'
    })
  } catch (err) {
    console.error(err)
    return withCors(500, { ok: false, error: mapStorageError(err) })
  }
}
