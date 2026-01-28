import { useState } from 'react'

const emptyForm = {
  nome_completo: '',
  celular: '',
  cpf: '',
  sexo: '',
  data_nascimento: '',
  email: ''
}

function normalizeDigits(value) {
  return value.replace(/\D+/g, '')
}

export default function App() {
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const payload = {
        nome_completo: form.nome_completo.trim(),
        celular: normalizeDigits(form.celular),
        cpf: normalizeDigits(form.cpf),
        sexo: form.sexo,
        data_nascimento: form.data_nascimento,
        email: form.email.trim()
      }
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Erro no servidor')
      setMessage('Cadastro enviado com sucesso. Obrigado!')
      setForm(emptyForm)
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Netlify · CSV</p>
          <h1>Cadastro de Pacientes</h1>
          <p className="sub">Salve e atualize pacientes com dedupe por CPF.</p>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <div className="card-header">
            <h2>Novo/Editar</h2>
            {message && <span className="status">{message}</span>}
          </div>
          <form className="form" onSubmit={handleSubmit}>
            <label>
              Nome Completo*
              <input name="nome_completo" value={form.nome_completo} onChange={handleChange} required />
            </label>
            <label>
              Celular* (apenas números)
              <input name="celular" value={form.celular} onChange={handleChange} required />
            </label>
            <label>
              CPF
              <input name="cpf" value={form.cpf} onChange={handleChange} placeholder="00000000000" />
            </label>
            <label>
              Sexo
              <select name="sexo" value={form.sexo} onChange={handleChange}>
                <option value="">Selecione</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </label>
            <label>
              Data de Nascimento
              <input type="date" name="data_nascimento" value={form.data_nascimento} onChange={handleChange} />
            </label>
            <label>
              Email
              <input type="email" name="email" value={form.email} onChange={handleChange} />
            </label>
            <button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar/Atualizar'}</button>
          </form>
        </section>
      </main>
    </div>
  )
}
