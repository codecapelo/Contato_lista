import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''

app.use(cors())
app.use(express.json())

// Static files (built client)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))

const dataDir = path.join(__dirname, '..', 'data')
const dataFile = path.join(dataDir, 'patients.json')
ensureDataFile()

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
  if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]', 'utf-8')
}

function loadPatients() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Erro ao ler arquivo de dados', err)
    return []
  }
}

function savePatients(patients) {
  fs.writeFileSync(dataFile, JSON.stringify(patients, null, 2), 'utf-8')
}

function normalizeDigits(value) {
  return (value || '').toString().replace(/\D+/g, '')
}

function parseDateToISO(value) {
  const raw = (value || '').toString().trim()
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('/')
    return `${y}-${m}-${d}`
  }
  return raw
}

function normalizeRecord(body) {
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

function upsertOne(patients, record) {
  let index = -1
  if (record.cpf) index = patients.findIndex((p) => normalizeDigits(p.cpf) === record.cpf)
  const action = index >= 0 ? 'update' : 'insert'
  const row = index >= 0 ? index + 1 : patients.length + 1
  if (index >= 0) patients[index] = record
  else patients.push(record)
  return { action, row }
}

function formatCPF(value) {
  const digits = normalizeDigits(value)
  if (digits.length !== 11) return value || ''
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function formatCelular(value) {
  const digits = normalizeDigits(value)
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return value || ''
}

function formatDateBR(value) {
  const raw = (value || '').toString().trim()
  if (!raw) return ''
  // If already dd/mm/yyyy, keep
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw
  // If yyyy-mm-dd, convert
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-')
    return `${d}/${m}/${y}`
  }
  return raw
}

app.get('/api/patients', (req, res) => {
  if (ADMIN_TOKEN && req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Não autorizado' })
  }
  const patients = loadPatients()
  res.json({ patients })
})

app.post('/api/patients', (req, res) => {
  const normalized = normalizeRecord(req.body || {})
  if (!normalized.ok) return res.status(400).json({ ok: false, error: normalized.error })

  const patients = loadPatients()
  const result = upsertOne(patients, normalized.record)
  savePatients(patients)
  res.json({ ok: true, ...result })
})

app.get('/api/patients/export', (_req, res) => {
  if (ADMIN_TOKEN && _req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Não autorizado' })
  }
  const patients = loadPatients()
  const header = ['Nome Completo', 'Celular', 'CPF', 'Sexo', 'Data de Nascimento', 'Email']
  const rows = patients.map((p) => [
    p.nome_completo || '',
    formatCelular(p.celular),
    formatCPF(p.cpf),
    p.sexo || '',
    formatDateBR(p.data_nascimento),
    p.email || ''
  ])
  const csv = [header, ...rows]
    .map((r) => r.map((c) => (c || '').toString().replace(/\r?\n/g, ' ')).join(','))
    .join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="pacientes.csv"')
  res.send(csv)
})

// Fallback to client SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
