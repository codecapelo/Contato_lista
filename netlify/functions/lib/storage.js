import { getStore } from '@netlify/blobs'
import fs from 'fs/promises'
import path from 'path'

const STORE_NAME = 'patients-store'
const STORE_KEY = 'patients.json'
const CSV_KEY = 'patients.csv'

export function getEnv(key) {
  if (globalThis.Netlify?.env?.get) return Netlify.env.get(key)
  return process.env[key]
}

function getStoreClient() {
  const siteID = getEnv('NETLIFY_SITE_ID') || getEnv('SITE_ID')
  const token =
    getEnv('NETLIFY_BLOBS_TOKEN') ||
    getEnv('NETLIFY_AUTH_TOKEN') ||
    getEnv('NETLIFY_API_TOKEN')

  if (siteID && token) {
    return getStore(STORE_NAME, { siteID, token })
  }

  return getStore(STORE_NAME)
}

function isNetlifyRuntime() {
  return Boolean(getEnv('NETLIFY') || getEnv('NETLIFY_SITE_ID') || getEnv('SITE_ID'))
}

async function ensureLocalFile(filePath) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  try {
    await fs.access(filePath)
  } catch {
    await fs.writeFile(filePath, '[]', 'utf-8')
  }
}

export async function loadPatients() {
  if (isNetlifyRuntime()) {
    const store = getStoreClient()
    const data = await store.get(STORE_KEY, { type: 'json' })
    return Array.isArray(data) ? data : []
  }

  const filePath = path.resolve(process.cwd(), 'data', 'patients.json')
  await ensureLocalFile(filePath)
  const raw = await fs.readFile(filePath, 'utf-8')
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

export async function savePatients(patients) {
  if (isNetlifyRuntime()) {
    const store = getStoreClient()
    await store.set(STORE_KEY, patients)
    await store.set(CSV_KEY, serializeCsv(patients))
    return
  }

  const filePath = path.resolve(process.cwd(), 'data', 'patients.json')
  await ensureLocalFile(filePath)
  await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8')

  const csvPath = path.resolve(process.cwd(), 'data', 'patients.csv')
  await fs.writeFile(csvPath, serializeCsv(patients), 'utf-8')
}

export function normalizeDigits(value) {
  return (value || '').toString().replace(/\D+/g, '')
}

export function parseDateToISO(value) {
  const raw = (value || '').toString().trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/')
    return `${y}-${m}-${d}`
  }
  return raw
}

export function formatCPF(value) {
  const digits = normalizeDigits(value)
  if (digits.length !== 11) return value || ''
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function formatCelular(value) {
  const digits = normalizeDigits(value)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return value || ''
}

export function formatDateBR(value) {
  const raw = (value || '').toString().trim()
  if (!raw) return ''
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-')
    return `${d}/${m}/${y}`
  }
  return raw
}

export function serializeCsv(patients) {
  const header = ['Nome Completo', 'Celular', 'CPF', 'Sexo', 'Data de Nascimento', 'Email']
  const rows = patients.map((p) => [
    p.nome_completo || '',
    formatCelular(p.celular),
    formatCPF(p.cpf),
    p.sexo || '',
    formatDateBR(p.data_nascimento),
    p.email || ''
  ])
  return [header, ...rows]
    .map((r) => r.map((c) => (c || '').toString().replace(/\r?\n/g, ' ')).join(','))
    .join('\n')
}

export function normalizeRecord(body) {
  const nome = (body.nome_completo || '').trim()
  const celular = normalizeDigits(body.celular)
  if (!nome) return { ok: false, error: 'Nome Completo é obrigatório' }
  if (!celular) return { ok: false, error: 'Celular é obrigatório' }

  return {
    ok: true,
    record: {
      nome_completo: nome,
      celular,
      cpf: normalizeDigits(body.cpf),
      sexo: body.sexo || '',
      data_nascimento: parseDateToISO(body.data_nascimento),
      email: (body.email || '').trim()
    }
  }
}

export function upsertOne(patients, record) {
  let index = -1
  if (record.cpf) index = patients.findIndex((p) => normalizeDigits(p.cpf) === record.cpf)
  const action = index >= 0 ? 'update' : 'insert'
  const row = index >= 0 ? index + 1 : patients.length + 1
  if (index >= 0) patients[index] = record
  else patients.push(record)
  return { action, row }
}

export function withCors(statusCode, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  const finalHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    ...headers
  }

  if (typeof Response === 'function') {
    return new Response(payload, { status: statusCode, headers: finalHeaders })
  }

  return {
    statusCode,
    headers: finalHeaders,
    body: payload
  }
}

export function getAdminToken() {
  return getEnv('ADMIN_TOKEN') || ''
}

export async function readBody(input) {
  if (!input) return {}
  if (typeof input.json === 'function') {
    try {
      return await input.json()
    } catch {
      return {}
    }
  }
  if (!input.body) return {}
  const raw = input.isBase64Encoded
    ? Buffer.from(input.body, 'base64').toString('utf-8')
    : input.body
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function mapStorageError(err) {
  const msg = err?.message || 'Erro interno'
  if (msg.includes('NETLIFY_BLOBS') || msg.toLowerCase().includes('blobs')) {
    return 'Netlify Blobs não configurado para este runtime. Verifique se Blobs está ativo no site, faça redeploy e confirme que a Function é v2.'
  }
  return msg
}
