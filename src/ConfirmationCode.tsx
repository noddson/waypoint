import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { ConfirmationCodeFormat, nextConfirmationCodeFormat } from './confirmationCodeFormat'

export function ConfirmationCode({value}:{value:string}) {
  const [format,setFormat]=useState<ConfirmationCodeFormat>('qr')
  const [failed,setFailed]=useState(false)
  const canvasRef=useRef<HTMLCanvasElement>(null)

  useEffect(()=>{
    const canvas=canvasRef.current
    if(!canvas)return
    let active=true
    setFailed(false)
    canvas.removeAttribute('style')
    if(format==='qr'){
      void QRCode.toCanvas(canvas,value,{width:72,margin:1,errorCorrectionLevel:'M',color:{dark:'#172a24',light:'#ffffff'}}).catch(()=>{if(active)setFailed(true)})
    }else{
      try{JsBarcode(canvas,value,{format:'CODE128',displayValue:false,width:1.35,height:46,margin:4,lineColor:'#172a24',background:'#ffffff'})}
      catch{setFailed(true)}
    }
    return()=>{active=false}
  },[format,value])

  const next=format==='qr'?'Code 128 barcode':'QR code'
  return <button
    type="button"
    className={`confirmation-code confirmation-code-${format}`}
    aria-label={`Confirmation ${value}. Show ${next}`}
    aria-pressed={format==='code128'}
    title={`Click or tap to show ${next}`}
    onClick={event=>{event.stopPropagation();setFormat(current=>nextConfirmationCodeFormat(current))}}
  >
    <canvas ref={canvasRef} aria-hidden="true"/>
    {failed&&<span>Code unavailable</span>}
  </button>
}
