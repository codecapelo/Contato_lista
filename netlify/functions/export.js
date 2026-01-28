import {
  loadPatients,
  formatCPF,
  formatCelular,
  formatDateBR,
  withCors,
  getAdminToken,
  mapStorageError
} from './lib/storage.js'

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return withCors(200, '')
    }

    if (event.httpMethod !== 'GET') {
      return withCors(405, { ok: false, error: 'Método não suportado' })
    }

    const adminToken = getAdminToken()
    const token = event.headers['x-admin-token'] || event.queryStringParameters?.token || ''
    if (adminToken && token !== adminToken) {
      return withCors(401, { ok: false, error: 'Não autorizado' })
    }

    const patients = await loadPatients()
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

    return withCors(200, csv, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename=\"pacientes.csv\"'
    })
  } catch (err) {
    console.error(err)
    return withCors(500, { ok: false, error: mapStorageError(err) })
  }
}
