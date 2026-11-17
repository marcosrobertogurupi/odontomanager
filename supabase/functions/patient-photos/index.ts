// Fotos dos pacientes (radiografias, antes e depois).
//
// Os arquivos ficam no Cloudflare R2 (NUNCA no Supabase Storage), do mesmo jeito que o
// projeto LojaCarros guarda as fotos dos carros: as chaves do R2 existem só aqui no servidor,
// o navegador nunca as vê. Diferença deliberada: o bucket é PRIVADO e as fotos são mostradas por
// links assinados que expiram, porque radiografia é dado de saúde (LGPD) e não pode ter URL pública.
//
// Segurança: o isolamento por clínica vem do RLS. Todas as leituras/escritas no banco usam o
// cliente com o JWT de quem chamou, então só enxerga/altera foto de paciente da própria clínica.
// O tenant_id NUNCA vem do corpo da requisição: é lido do cadastro do paciente.
//
// Segredos (supabase secrets set ...): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// O navegador reduz a foto antes de enviar; estes são tetos de segurança no servidor.
const TAMANHOS = { grande: 3 * 1024 * 1024, media: 1024 * 1024, mini: 400 * 1024 } as const
type Tamanho = keyof typeof TAMANHOS
const NOMES_TAMANHO = Object.keys(TAMANHOS) as Tamanho[]
const MAX_FOTOS_POR_PACIENTE = 200
const CATEGORIAS = new Set(['radiografia', 'antes', 'depois', 'outra'])
const VALIDADE_LINK_SEG = 2 * 60 * 60

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Cloudflare R2 (API S3)
// ---------------------------------------------------------------------------
function r2() {
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET')
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new HttpError(503, 'Armazenamento de fotos (R2) não configurado no servidor.')
  }
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  return { client, base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}` }
}

const urlObjeto = (base: string, chave: string) =>
  `${base}/${chave.split('/').map(encodeURIComponent).join('/')}`

async function enviarObjeto(chave: string, corpo: Uint8Array, contentType: string) {
  const { client, base } = r2()
  const res = await client.fetch(urlObjeto(base, chave), {
    method: 'PUT',
    body: corpo,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=31536000, immutable' },
  })
  if (!res.ok) throw new Error(`R2 PUT ${res.status}`)
}

async function apagarObjeto(chave: string) {
  const { client, base } = r2()
  const res = await client.fetch(urlObjeto(base, chave), { method: 'DELETE' })
  // 404 = já não existe, o que também serve.
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}`)
}

// Link assinado de leitura. O horário de assinatura é arredondado para a hora cheia para o link
// ser o mesmo durante a hora toda e o navegador reaproveitar a foto do cache.
async function linkAssinado(chave: string): Promise<string> {
  const { client, base } = r2()
  const agora = new Date()
  agora.setUTCMinutes(0, 0, 0)
  const datetime = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const assinado = await client.sign(`${urlObjeto(base, chave)}?X-Amz-Expires=${VALIDADE_LINK_SEG}`, {
    method: 'GET',
    aws: { signQuery: true, datetime },
  })
  return assinado.url
}

// ---------------------------------------------------------------------------
// Imagem: o tipo vem do CONTEÚDO (bytes iniciais), nunca do nome nem do Content-Type informado
// ---------------------------------------------------------------------------
function detectarFormato(b: Uint8Array): { ext: 'webp' | 'jpg' | 'png'; mime: string } | null {
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { ext: 'webp', mime: 'image/webp' }
  }
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' }
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' }
  }
  return null
}

const chaveObjeto = (path: string, tamanho: Tamanho, ext: string) => `${path}-${tamanho}.${ext}`

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
type Db = any

async function pacienteDaClinica(db: Db, patientId: unknown) {
  if (typeof patientId !== 'string' || !/^[0-9a-f-]{36}$/i.test(patientId)) throw new HttpError(400, 'Paciente inválido.')
  const { data, error } = await db.from('patients').select('id, tenant_id').eq('id', patientId).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, 'Paciente não encontrado.') // RLS esconde pacientes de outras clínicas
  return data as { id: string; tenant_id: string }
}

function validarDataISO(valor: unknown): string | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const d = new Date(`${valor}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : valor
}

function limparLegenda(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim().slice(0, 200)
  return t || null
}

async function enviarFoto(db: Db, userId: string, form: FormData) {
  const paciente = await pacienteDaClinica(db, form.get('patient_id'))

  const category = String(form.get('category') ?? 'outra')
  if (!CATEGORIAS.has(category)) throw new HttpError(400, 'Categoria inválida.')

  const { count } = await db.from('patient_photos').select('id', { count: 'exact', head: true }).eq('patient_id', paciente.id)
  if ((count ?? 0) >= MAX_FOTOS_POR_PACIENTE) {
    throw new HttpError(400, `Limite de ${MAX_FOTOS_POR_PACIENTE} fotos por paciente.`)
  }

  const bytes: Partial<Record<Tamanho, Uint8Array>> = {}
  let formato: ReturnType<typeof detectarFormato> = null
  for (const nome of NOMES_TAMANHO) {
    const arquivo = form.get(nome)
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new HttpError(400, 'Envio incompleto.')
    if (arquivo.size > TAMANHOS[nome]) throw new HttpError(413, 'Foto grande demais.')
    const dados = new Uint8Array(await arquivo.arrayBuffer())
    const f = detectarFormato(dados)
    if (!f) throw new HttpError(400, 'Use uma foto JPG, PNG ou WebP.')
    if (formato && f.ext !== formato.ext) throw new HttpError(400, 'Envio inconsistente.')
    formato = f
    bytes[nome] = dados
  }
  const fmt = formato!

  const path = `odontomanager/${paciente.tenant_id}/pacientes/${paciente.id}/${crypto.randomUUID()}`
  const chaves = NOMES_TAMANHO.map((n) => chaveObjeto(path, n, fmt.ext))

  try {
    await Promise.all(NOMES_TAMANHO.map((n) => enviarObjeto(chaveObjeto(path, n, fmt.ext), bytes[n]!, fmt.mime)))
    const { data, error } = await db.from('patient_photos').insert({
      tenant_id: paciente.tenant_id,
      patient_id: paciente.id,
      path,
      ext: fmt.ext,
      category,
      caption: limparLegenda(form.get('caption')),
      taken_on: validarDataISO(form.get('taken_on')) ?? new Date().toISOString().slice(0, 10),
      size_bytes: bytes.grande!.length + bytes.media!.length + bytes.mini!.length,
      uploaded_by: userId,
    }).select('id').single()
    if (error) throw error
    return { success: true, id: data.id }
  } catch (e) {
    await Promise.allSettled(chaves.map(apagarObjeto)) // não deixa arquivo órfão no R2
    if (e instanceof HttpError) throw e
    console.error('[patient-photos] falha no envio', e instanceof Error ? e.message : 'desconhecido')
    throw new HttpError(500, 'Não foi possível salvar a foto. Tente novamente.')
  }
}

async function listarFotos(db: Db, body: Record<string, unknown>) {
  const paciente = await pacienteDaClinica(db, body.patient_id)
  const { data, error } = await db
    .from('patient_photos')
    .select('id, path, ext, category, caption, taken_on, created_at')
    .eq('patient_id', paciente.id)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_FOTOS_POR_PACIENTE)
  if (error) throw error

  const fotos = await Promise.all(
    // deno-lint-ignore no-explicit-any
    (data as any[]).map(async (f) => {
      const [grande, media, mini] = await Promise.all(
        NOMES_TAMANHO.map((n) => linkAssinado(chaveObjeto(f.path, n, f.ext))),
      )
      return {
        id: f.id,
        category: f.category,
        caption: f.caption,
        taken_on: f.taken_on,
        created_at: f.created_at,
        urls: { grande, media, mini },
      }
    }),
  )
  return { success: true, fotos }
}

async function atualizarFoto(db: Db, body: Record<string, unknown>) {
  const update: Record<string, unknown> = {}
  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || !CATEGORIAS.has(body.category)) throw new HttpError(400, 'Categoria inválida.')
    update.category = body.category
  }
  if (body.caption !== undefined) update.caption = limparLegenda(body.caption)
  if (body.taken_on !== undefined) {
    const d = validarDataISO(body.taken_on)
    if (!d) throw new HttpError(400, 'Data inválida.')
    update.taken_on = d
  }
  if (Object.keys(update).length === 0) throw new HttpError(400, 'Nada para atualizar.')
  if (typeof body.id !== 'string') throw new HttpError(400, 'Foto inválida.')
  const { data, error } = await db.from('patient_photos').update(update).eq('id', body.id).select('id')
  if (error) throw error
  if (!data?.length) throw new HttpError(404, 'Foto não encontrada.')
  return { success: true }
}

async function apagarFoto(db: Db, body: Record<string, unknown>) {
  if (typeof body.id !== 'string') throw new HttpError(400, 'Foto inválida.')
  const { data: foto, error } = await db.from('patient_photos').select('id, path, ext').eq('id', body.id).maybeSingle()
  if (error) throw error
  if (!foto) throw new HttpError(404, 'Foto não encontrada.')

  // Primeiro o registro (some da tela), depois os arquivos.
  const { error: delError } = await db.from('patient_photos').delete().eq('id', foto.id)
  if (delError) throw delError
  const falhas = (await Promise.allSettled(NOMES_TAMANHO.map((n) => apagarObjeto(chaveObjeto(foto.path, n, foto.ext)))))
    .filter((r) => r.status === 'rejected')
  if (falhas.length) console.error('[patient-photos] arquivos não removidos do R2', { path: foto.path })
  return { success: true }
}

// Chamado antes de excluir um paciente: apaga todos os arquivos dele no R2.
// Se algum arquivo não puder ser removido, devolve erro e a exclusão do paciente deve ser cancelada.
async function apagarTodasDoPaciente(db: Db, body: Record<string, unknown>) {
  const paciente = await pacienteDaClinica(db, body.patient_id)
  const { data, error } = await db.from('patient_photos').select('id, path, ext').eq('patient_id', paciente.id)
  if (error) throw error
  if (!data?.length) return { success: true, removidas: 0 }

  // deno-lint-ignore no-explicit-any
  const chaves = (data as any[]).flatMap((f) => NOMES_TAMANHO.map((n) => chaveObjeto(f.path, n, f.ext)))
  const resultados = await Promise.allSettled(chaves.map(apagarObjeto))
  if (resultados.some((r) => r.status === 'rejected')) {
    throw new HttpError(502, 'Não foi possível apagar todas as fotos do paciente. Tente novamente.')
  }
  const { error: delError } = await db.from('patient_photos').delete().eq('patient_id', paciente.id)
  if (delError) throw delError
  return { success: true, removidas: data.length }
}

// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const authorization = req.headers.get('Authorization') ?? ''
    if (!authorization.startsWith('Bearer ')) throw new HttpError(401, 'Sessão inválida.')

    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const { data: { user }, error: userError } = await db.auth.getUser()
    if (userError || !user) throw new HttpError(401, 'Sessão inválida.')

    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await req.formData().catch(() => { throw new HttpError(400, 'Envio inválido.') })
      if (form.get('action') !== 'upload') throw new HttpError(400, 'Ação inválida.')
      return json(await enviarFoto(db, user.id, form), 201)
    }

    const body = await req.json().catch(() => { throw new HttpError(400, 'Requisição inválida.') })
    switch (body?.action) {
      case 'list': return json(await listarFotos(db, body))
      case 'update': return json(await atualizarFoto(db, body))
      case 'delete': return json(await apagarFoto(db, body))
      case 'purge': return json(await apagarTodasDoPaciente(db, body))
      default: throw new HttpError(400, 'Ação inválida.')
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error('[patient-photos]', e instanceof Error ? e.message : 'erro desconhecido')
    return json({ error: 'Erro interno ao processar as fotos.' }, 500)
  }
})
