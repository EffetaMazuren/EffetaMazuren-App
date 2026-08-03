import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const caminanteNombre = formData.get('caminanteNombre') as string
    const caminanteId = formData.get('caminanteId') as string

    if (!file || !caminanteNombre || !caminanteId) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extension = file.name.split('.').pop()
    const nombreArchivo = `comprobante_${timestamp}.${extension}`
    const carpeta = caminanteNombre.trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = `${carpeta}/${nombreArchivo}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: uploadError } = await supabase.storage
      .from('comprobantes-pagos')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error subiendo a Supabase Storage:', uploadError)
      return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('comprobantes-pagos')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      fileId: filePath,
      fileUrl: urlData.publicUrl,
      fileName: nombreArchivo,
    })
  } catch (error) {
    console.error('Error en upload:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
