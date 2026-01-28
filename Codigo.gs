const SHEET_NAME = 'APP_RAW'
const REQUIRED_TOKEN = 'API_TOKEN_AQUI' // <-- substitua pelo mesmo valor de API_TOKEN no .env

function doPost(e) {
  const tokenOk = validateToken(e)
  if (!tokenOk) return jsonResp({ ok: false, error: 'Token inválido' }, 401)

  const action = (e.parameter && e.parameter.action || '').toLowerCase()
  if (action === 'atualizar_export_final') {
    return jsonResp(runAtualizarExportFinal())
  }

  let body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return jsonResp({ ok: false, error: 'JSON inválido' }, 400)
  }
  const result = upsertRow(body)
  return jsonResp(result, result.ok ? 200 : 400)
}

function doGet(e) {
  const tokenOk = validateToken(e)
  if (!tokenOk) return jsonResp({ ok: false, error: 'Token inválido' }, 401)
  const mode = (e.parameter.mode || '').toLowerCase()
  if (mode === 'list') {
    return jsonResp(listRows())
  }
  if ((e.parameter.action || '').toLowerCase() === 'atualizar_export_final') {
    return jsonResp(runAtualizarExportFinal())
  }
  return jsonResp({ ok: true, info: 'Use mode=list ou POST para gravar.' })
}

function validateToken(e) {
  const t = (e.parameter.token || '').trim()
  return t && t === REQUIRED_TOKEN
}

function normalizeDigits(value) {
  return (value || '').toString().replace(/\D+/g, '')
}

function upsertRow(data) {
  const nome = (data.nome_completo || '').trim()
  const celular = normalizeDigits(data.celular)
  if (!nome) return { ok: false, error: 'Nome Completo é obrigatório' }
  if (!celular) return { ok: false, error: 'Celular é obrigatório' }

  const cpf = normalizeDigits(data.cpf)
  const sexo = data.sexo || ''
  const nasc = (data.data_nascimento || '').trim()
  const email = (data.email || '').trim()

  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) return { ok: false, error: `Aba ${SHEET_NAME} não encontrada` }

  const lastRow = sheet.getLastRow()
  const values = lastRow >= 2 ? sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat() : [] // CPF column C
  let rowIndex = -1
  if (cpf) {
    rowIndex = values.findIndex((c) => normalizeDigits(c) === cpf)
  }

  const rowNumber = rowIndex >= 0 ? rowIndex + 2 : lastRow + 1
  const action = rowIndex >= 0 ? 'update' : 'insert'

  sheet.getRange(rowNumber, 1, 1, 6).setValues([
    [nome, celular, cpf, sexo, nasc, email]
  ])

  return { ok: true, action, row: rowNumber }
}

function listRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName(SHEET_NAME)
  if (!sheet) return { ok: false, error: `Aba ${SHEET_NAME} não encontrada` }
  const lastRow = sheet.getLastRow()
  if (lastRow < 2) return { ok: true, patients: [] }
  const data = sheet.getRange(2, 1, lastRow - 1, 6).getValues()
  const patients = data.map((row) => ({
    nome_completo: row[0] || '',
    celular: normalizeDigits(row[1] || ''),
    cpf: normalizeDigits(row[2] || ''),
    sexo: row[3] || '',
    data_nascimento: row[4] || '',
    email: row[5] || ''
  }))
  return { ok: true, patients }
}

function runAtualizarExportFinal() {
  try {
    const fn = this.atualizarExportFinal || this.atualizarExportFinal_ || null
    if (typeof fn === 'function') {
      fn()
      return { ok: true, action: 'atualizar_export_final' }
    }
    return { ok: false, error: 'Função atualizarExportFinal() não encontrada' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

function jsonResp(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setResponseCode(status || 200)
}
