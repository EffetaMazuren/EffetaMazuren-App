import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mediaType } = await request.json()

    if (!imageBase64 || !mediaType) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `Eres un asistente que analiza comprobantes de pago colombianos (transferencias Nequi, Daviplata, PSE, consignaciones bancarias, etc).

Extrae el valor total transferido o pagado de esta imagen.

Responde ÚNICAMENTE con un JSON así, sin texto adicional, sin markdown:
{"valor": 250000, "confianza": "alta"}

- valor: número entero en pesos colombianos (sin puntos ni comas, sin el signo $)
- confianza: "alta" si estás seguro, "media" si hay ambigüedad, "baja" si no puedes leerlo bien

Si no encuentras ningún valor numérico claro, responde: {"valor": null, "confianza": "baja"}`,
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Error Anthropic API:', data)
      return NextResponse.json({ valor: null, confianza: 'baja' })
    }

    const texto = data.content?.[0]?.text?.trim()

    try {
      const parsed = JSON.parse(texto)
      return NextResponse.json({
        valor: parsed.valor || null,
        confianza: parsed.confianza || 'baja',
      })
    } catch {
      // Intentar extraer número si la respuesta no es JSON perfecto
      const match = texto?.match(/\d{4,9}/)
      if (match) {
        return NextResponse.json({ valor: parseInt(match[0]), confianza: 'media' })
      }
      return NextResponse.json({ valor: null, confianza: 'baja' })
    }
  } catch (error) {
    console.error('Error analizando comprobante:', error)
    return NextResponse.json({ valor: null, confianza: 'baja' })
  }
}
