import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mediaType } = await request.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })

    const token = await auth.getAccessToken()

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

    const valor = extraerValorPago(textoCompleto)

    return NextResponse.json({
      valor,
      confianza: valor ? 'alta' : 'baja',
      textoDetectado: textoCompleto,
      debug: lineas,
    })
  } catch (error) {
    console.error('Error analizando comprobante:', error)
    return NextResponse.json({ valor: null, confianza: 'baja' })
  }
}

function extraerValorPago(texto: string): number | null {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)

  // Palabras clave colombianas que indican el monto
  const palabrasClave = [
    'cuánto', 'cuanto', 'valor', 'monto', 'total', 'transferenci',
    'pagaste', 'enviaste', 'recibiste', 'pagado', 'transaccion',
    'transacción', 'por valor de', 'cantidad', 'importe'
  ]

  // Función para parsear monto colombiano: $500.000,00 → 500000
  function parsearMonto(str: string): number | null {
    // Quitar signo $ y espacios
    let limpio = str.replace(/\$/g, '').replace(/\s/g, '')
    // Formato colombiano: 500.000,00 → quitar puntos y coma decimal
    limpio = limpio.replace(/\.(\d{3})/g, '$1').replace(',\d+$', '').replace(/,\d+$/, '')
    // Quitar cualquier punto restante
    limpio = limpio.replace(/\./g, '')
    const num = parseInt(limpio)
    if (!isNaN(num) && num >= 5000 && num <= 10000000) return num
    return null
  }

  // Buscar en líneas con palabras clave y la línea siguiente
  for (let i = 0; i < lineas.length; i++) {
    const lineaLower = lineas[i].toLowerCase()
    const tienePalabraClave = palabrasClave.some(p => lineaLower.includes(p))

    if (tienePalabraClave) {
      // Buscar monto en la misma línea
      const matchEnLinea = lineas[i].match(/\$?\s*[\d.,]+/)
      if (matchEnLinea) {
        const v = parsearMonto(matchEnLinea[0])
        if (v) return v
      }
      // Buscar en la línea siguiente
      if (i + 1 < lineas.length) {
        const matchSiguiente = lineas[i + 1].match(/\$?\s*[\d.,]+/)
        if (matchSiguiente) {
          const v = parsearMonto(matchSiguiente[0])
          if (v) return v
        }
      }
    }
  }

  // Buscar todos los montos y retornar el más grande dentro de rango razonable
  const todosLosMontos: number[] = []
  for (const linea of lineas) {
    const matches = linea.matchAll(/\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d{5,9})/g)
    for (const m of matches) {
      const v = parsearMonto(m[0])
      if (v) todosLosMontos.push(v)
    }
  }

  if (todosLosMontos.length > 0) {
    // Retornar el más frecuente
    const frecuencia: Record<number, number> = {}
    for (const v of todosLosMontos) {
      frecuencia[v] = (frecuencia[v] || 0) + 1
    }
    const masRepetido = Object.entries(frecuencia).sort((a, b) => b[1] - a[1])[0]
    return parseInt(masRepetido[0])
  }

  return null
}
