import {
  loadPatients,
  savePatients,
  normalizeRecord,
  upsertOne,
  withCors,
  getAdminToken,
  readBody,
  mapStorageError
} from './lib/storage.js'

export default async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return withCors(200, '')
    }

    if (req.method === 'GET') {
      const adminToken = getAdminToken()
      const url = new URL(req.url)
      const token = req.headers.get('x-admin-token') || url.searchParams.get('token') || ''
      if (adminToken && token !== adminToken) {
        return withCors(401, { ok: false, error: 'Não autorizado' })
      }
      const patients = await loadPatients()
      return withCors(200, { ok: true, patients })
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const normalized = normalizeRecord(body)
      if (!normalized.ok) return withCors(400, { ok: false, error: normalized.error })

      const patients = await loadPatients()
      const result = upsertOne(patients, normalized.record)
      await savePatients(patients)
      return withCors(200, { ok: true, ...result })
    }

    return withCors(405, { ok: false, error: 'Método não suportado' })
  } catch (err) {
    console.error(err)
    return withCors(500, { ok: false, error: mapStorageError(err) })
  }
}
