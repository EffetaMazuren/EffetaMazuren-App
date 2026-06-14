  async function registrarPago() {
    if (!valorPago || !servidor) return
    setGuardandoPago(true)
 
    try {
      let comprovanteUrl = null
      let comprobanteName = null
 
      if (archivo) {
        const ext = archivo.name.split('.').pop()
        const path = `servidores/${id}/${Date.now()}.${ext}`
        const { data: up } = await supabase.storage
          .from('comprobantes-pagos')
          .upload(path, archivo, { contentType: archivo.type })
        if (up) {
          const { data: url } = supabase.storage.from('comprobantes-pagos').getPublicUrl(path)
          comprovanteUrl = url.publicUrl
          comprobanteName = archivo.name
        }
      }
 
      const res = await fetch('/api/pagos/servidor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servidorId: id,
          valor: Number(valorPago),
          comprovanteUrl,
          comprobanteName,
        }),
      })
 
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error registrando pago')
 
      setValorPago('')
      setArchivo(null)
      setPrevisualizacion(null)
      setMostrarFormPago(false)
      cargar()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
 
    setGuardandoPago(false)
  }
