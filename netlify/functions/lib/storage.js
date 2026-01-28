import { getStore } from '@netlify/blobs'
import fs from 'fs/promises'
import path from 'path'

const STORE_NAME = 'patients-store'
const STORE_KEY = 'patients.json'
const useBlobs = Boolean(process.env.SITE_ID)

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
  if (useBlobs) {
    const store = getStore(STORE_NAME)
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
  if (useBlobs) {
    const store = getStore(STORE_NAME)
    await store.set(STORE_KEY, patients)
    return
  }

  const filePath = path.resolve(process.cwd(), 'data', 'patients.json')
  await ensureLocalFile(filePath)
  await fs.writeFile(filePath, JSON.stringify(patients, null, 2), 'utf-8')
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
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      ...headers
    },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  }
}

export function getAdminToken() {
  return process.env.ADMIN_TOKEN || ''
}

export function readBody(event) {
  if (!event.body) return {}
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf-8')
    : event.body
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function mapStorageError(err) {
  const msg = err?.message || 'Erro interno'
  if (msg.includes('NETLIFY_BLOBS') || msg.toLowerCase().includes('blobs')) {
    return 'Netlify Blobs não habilitado. Ative Blobs no painel do Netlify e redeploy.'
  }
  return msg
}
