import {
  loadPatients,
  savePatients,
  normalizeRecord,
  upsertOne,
  withCors,
  getAdminToken,
  readBody
} from './lib/storage.js'

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return withCors(200, '')
  }

  if (event.httpMethod === 'GET') {
    const adminToken = getAdminToken()
    const token = event.headers['x-admin-token'] || event.queryStringParameters?.token || ''
    if (adminToken && token !== adminToken) {
      return withCors(401, { ok: false, error: 'Não autorizado' })
    }
    const patients = await loadPatients()
    return withCors(200, { ok: true, patients })
  }

  if (event.httpMethod === 'POST') {
    const body = readBody(event)
    const normalized = normalizeRecord(body)
    if (!normalized.ok) return withCors(400, { ok: false, error: normalized.error })

    const patients = await loadPatients()
    const result = upsertOne(patients, normalized.record)
    await savePatients(patients)
    return withCors(200, { ok: true, ...result })
  }

  return withCors(405, { ok: false, error: 'Método não suportado' })
}
