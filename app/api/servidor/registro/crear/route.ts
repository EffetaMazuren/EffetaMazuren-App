import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BUCKET = 'comprobantes-pagos'

function normalizarDocumento(valor: string): string {
  return valor.trim()
}

export async function POST(request: NextRequest) {
  let nuevoUsuarioId: string | null = null

  try {
    const form = await request.formData()

    const numeroDocumento = normalizarDocumento(String(form.get('numero_documento') || ''))
    const nombre = String(form.get('nombre') || '').trim()
    const correo = String(form.get('correo') || '').trim().toLowerCase()
    const password = String(form.get('password') || '')
    const ideaRecaudo = String(form.get('idea_recaudo') || '').trim()
    const ideaReunion = String(form.get('idea_reunion') || '').trim()
    const foto = form.get('foto') as File | null

    const faltantes: string[] = []
    if (!numeroDocumento) faltantes.push('numero_documento')
    if (!nombre) faltantes.push('nombre')
    if (!correo) faltantes.push('correo')
    if (!password || password.length < 6) faltantes.push('password (mínimo 6 caracteres)')

    if (faltantes.length > 0) {
      return NextResponse.json(
        { error: `Faltan datos requeridos: ${faltantes.join(', ')}` },
        { status: 400 }
      )
    }

    const { data: retiro } = await supabase
      .from('retiros')
      .select('id')
      .eq('estado', 'activo')
      .single()

    if (!retiro) {
      return NextResponse.json({ error: 'No hay un retiro activo configurado.' }, { status: 500 })
    }

    // ── Re-verificar server-side que no exista ya una cuenta ────────────
    // No confiar en lo que el cliente vio en /buscar hace un momento.
    const { data: porDocumentoDirecto, error: errDirecto } = await supabase
      .from('servidores_inscripcion')
      .select('id')
      .eq('numero_documento', numeroDocumento)
      .not('usuario_id', 'is', null)

    if (errDirecto) {
      return NextResponse.json({ error: errDirecto.message }, { status: 500 })
    }
    if ((porDocumentoDirecto?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Este documento ya tiene una cuenta creada. Inicia sesión normal.' },
        { status: 400 }
      )
    }

    const { data: personaExistente } = await supabase
      .from('personas')
      .select('id, foto_url')
      .eq('numero_documento_normalizado', numeroDocumento)
      .maybeSingle()

    if (personaExistente) {
      const { data: yaVinculada, error: errVinculada } = await supabase
        .from('servidores_inscripcion')
        .select('id')
        .eq('id_persona', personaExistente.id)
        .not('usuario_id', 'is', null)

      if (errVinculada) {
        return NextResponse.json({ error: errVinculada.message }, { status: 500 })
      }
      if ((yaVinculada?.length ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Este documento ya tiene una cuenta creada. Inicia sesión normal.' },
          { status: 400 }
        )
      }
    }

    // ── Crear cuenta de Auth (server-side, con rollback si algo falla después) ──
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    })

    if (authErr || !authData?.user) {
      return NextResponse.json(
        { error: authErr?.message || 'No se pudo crear la cuenta' },
        { status: 400 }
      )
    }

    nuevoUsuarioId = authData.user.id

    // ── usuarios ──────────────────────────────────────────────────────
    const { error: errUsuarios } = await supabase
      .from('usuarios')
      .upsert({ id: nuevoUsuarioId, nombre, correo, rol: 'servidor' }, { onConflict: 'id' })

    if (errUsuarios) throw new Error(`usuarios: ${errUsuarios.message}`)

    // ── personas: reusar si ya existía, insertar si no ──────────────────
    let personaId: string
    let subirFoto = !!foto

    if (personaExistente) {
      personaId = personaExistente.id
      if (personaExistente.foto_url) subirFoto = false
    } else {
      const { data: nuevaPersona, error: errPersona } = await supabase
        .from('personas')
        .insert({ nombre_completo: nombre, numero_documento_normalizado: numeroDocumento })
        .select('id')
        .single()

      if (errPersona || !nuevaPersona) throw new Error(`personas: ${errPersona?.message}`)
      personaId = nuevaPersona.id
    }

    // ── foto (opcional) ──────────────────────────────────────────────
    let fotoUrl: string | null = null
    if (subirFoto && foto) {
      const buffer = Buffer.from(await foto.arrayBuffer())
      const nombreArchivo = `personas/${personaId}/foto_${Date.now()}.jpg`

      const { error: errUpload } = await supabase.storage
        .from(BUCKET)
        .upload(nombreArchivo, buffer, { contentType: 'image/jpeg', upsert: false })

      if (!errUpload) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(nombreArchivo)
        fotoUrl = urlData.publicUrl
        await supabase.from('personas').update({ foto_url: fotoUrl }).eq('id', personaId)
      } else {
        console.error('Error subiendo foto (no aborta el registro):', errUpload)
      }
    }

    // ── servidores_inscripcion: reclamar fila precargada por un líder, o crear ──
    const { data: filaPrecargada, error: errPrecargada } = await supabase
      .from('servidores_inscripcion')
      .select('id')
      .eq('numero_documento', numeroDocumento)
      .eq('retiro_id', retiro.id)
      .is('usuario_id', null)
      .maybeSingle()

    if (errPrecargada) throw new Error(`servidores_inscripcion (búsqueda): ${errPrecargada.message}`)

    const camposInscripcion = {
      id_persona: personaId,
      usuario_id: nuevoUsuarioId,
      nombre,
      correo,
      numero_documento: numeroDocumento,
      idea_recaudo: ideaRecaudo || null,
      idea_reunion: ideaReunion || null,
    }

    if (filaPrecargada) {
      const { error: errUpdate } = await supabase
        .from('servidores_inscripcion')
        .update(camposInscripcion)
        .eq('id', filaPrecargada.id)

      if (errUpdate) throw new Error(`servidores_inscripcion (update): ${errUpdate.message}`)
    } else {
      const { error: errInsert } = await supabase
        .from('servidores_inscripcion')
        .insert({ ...camposInscripcion, retiro_id: retiro.id })

      if (errInsert) throw new Error(`servidores_inscripcion (insert): ${errInsert.message}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error en /api/servidor/registro/crear:', error)

    if (nuevoUsuarioId) {
      try {
        await supabase.auth.admin.deleteUser(nuevoUsuarioId)
      } catch (errRollback) {
        console.error('Error revirtiendo usuario de Auth tras fallo:', errRollback)
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
