import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const caminanteNombre = formData.get('caminanteNombre') as string
    const caminanteId = formData.get('caminanteId') as string

    if (!file || !caminanteNombre || !caminanteId) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
    }

    // Autenticación con Google
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
    })

    const drive = google.drive({ version: 'v3', auth })

    // Buscar o crear carpeta del caminante
    const carpetaNombre = caminanteNombre.trim()
    const carpetaPadreId = process.env.GOOGLE_DRIVE_FOLDER_ID

    const buscarCarpeta = await drive.files.list({
      q: `name='${carpetaNombre}' and mimeType='application/vnd.google-apps.folder' and '${carpetaPadreId}' in parents and trashed=false`,
      fields: 'files(id, name)',
    })

    let carpetaId: string

    if (buscarCarpeta.data.files && buscarCarpeta.data.files.length > 0) {
      carpetaId = buscarCarpeta.data.files[0].id!
    } else {
      const nuevaCarpeta = await drive.files.create({
        requestBody: {
          name: carpetaNombre,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [carpetaPadreId!],
        },
        fields: 'id',
      })
      carpetaId = nuevaCarpeta.data.id!
    }

    // Subir archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const { Readable } = require('stream')
    const stream = Readable.from(buffer)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extension = file.name.split('.').pop()
    const nombreArchivo = `comprobante_${timestamp}.${extension}`

    const archivoSubido = await drive.files.create({
      requestBody: {
        name: nombreArchivo,
        parents: [carpetaId],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: 'id, webViewLink',
    })

    // Hacer el archivo público para poder verlo
    await drive.permissions.create({
      fileId: archivoSubido.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })

    return NextResponse.json({
      success: true,
      fileId: archivoSubido.data.id,
      fileUrl: archivoSubido.data.webViewLink,
      fileName: nombreArchivo,
    })
  } catch (error) {
    console.error('Error subiendo a Drive:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}
