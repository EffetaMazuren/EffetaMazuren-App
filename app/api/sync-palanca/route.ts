import { NextRequest, NextResponse } from 'next/server'

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz_QYfs6yiwRH1aQRt2smJoQIgRQ-bzFzWK3fgDFrbD6ApiaUygGIEYJUVcxp7Mf00oOw/exec'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 })
  }
}
