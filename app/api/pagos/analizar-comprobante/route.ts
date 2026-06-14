import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mediaType } = await request.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    // Autenticación con Google
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })

    const token = await auth.getAccessToken()

    // Llamar a Vision API
    const visionRes = await fetch(
      'https://vision.googleapis.com/v1/images:annotate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: imageBase64 },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      }
    )

    const visionData = await visionRes.json()
    const textoCompleto =
      visionData.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!textoCompleto) {
      return NextResponse.json({ valor: null, confianza: 'baja' })
    }

    // Extraer valor del texto detectado
    const valor = extraerValorPago(textoCompleto)

    return NextResponse.json({
      valor,
      confianza: valor ? 'alta' : 'baja',
      textoDetectado: textoCompleto,
    })
  } catch (error) {
    console.error('Error analizando comprobante:', error)
    return NextResponse.json({ valor: null, confianza: 'baja' })
  }
}

function extraerValorPago(texto: string): number | null {
  // Palabras clave que indican el valor transferido
  const lineas = texto.split('\n').map(l => l.trim())

  // Patrones de montos colombianos: 50.000, 500.000, 1.500.000, $250000, etc
  const patronMonto = /\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{5,9})/g

  // Buscar cerca de palabras clave como "valor", "monto", "total", "transferencia", "pagaste"
  const palabrasClave = [
    'valor', 'monto', 'total', 'transferenci', 'pagaste',
    'enviaste', 'recibiste', 'pagado', 'transaccion', 'transacción',
    'por valor de', 'cantidad'
  ]

  // Primero buscar en líneas con palabras clave
  for (const linea of lineas) {
    const lineaLower = linea.toLowerCase()
    const tienePalabraClave = palabrasClave.some(p => lineaLower.includes(p))

    if (tienePalabraClave) {
      const matches = [...linea.matchAll(patronMonto)]
      if (matches.length > 0) {
        const valorStr = matches[0][1].replace(/\./g, '').replace(',', '')
        const valor = parseInt(valorStr)
        if (valor >= 10000 && valor <= 5000000) return valor
      }

      // Buscar también en la siguiente línea
      const idx = lineas.indexOf(linea)
      if (idx < lineas.length - 1) {
        const siguiente = lineas[idx + 1]
        const matchesSig = [...siguiente.matchAll(patronMonto)]
        if (matchesSig.length > 0) {
          const valorStr = matchesSig[0][1].replace(/\./g, '').replace(',', '')
          const valor = parseInt(valorStr)
          if (valor >= 10000 && valor <= 5000000) return valor
        }
      }
    }
  }

  // Si no encontró con palabras clave, buscar el monto más grande en el texto
  // (suele ser el valor principal en comprobantes)
  const todosLosMontos: number[] = []
  const matchesGlobal = [...texto.matchAll(patronMonto)]
  for (const m of matchesGlobal) {
    const valorStr = m[1].replace(/\./g, '').replace(',', '')
    const valor = parseInt(valorStr)
    if (valor >= 10000 && valor <= 5000000) {
      todosLosMontos.push(valor)
    }
  }

  if (todosLosMontos.length > 0) {
    // Retornar el monto que más se repite, o el más grande
    const frecuencia: Record<number, number> = {}
    for (const v of todosLosMontos) {
      frecuencia[v] = (frecuencia[v] || 0) + 1
    }
    const masRepetido = Object.entries(frecuencia).sort((a, b) => b[1] - a[1])[0]
    return parseInt(masRepetido[0])
  }

  return null
}
