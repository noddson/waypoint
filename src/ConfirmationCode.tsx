import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { ConfirmationCodeFormat, nextConfirmationCodeFormat } from './confirmationCodeFormat'

export function ConfirmationCode({value,expanded=false,onToggleExpanded}:{value:string;expanded?:boolean;onToggleExpanded:()=>void}) {
  const [format,setFormat]=useState<ConfirmationCodeFormat>('qr')
  const [failed,setFailed]=useState(false)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const clickTimer=useRef<number|undefined>(undefined)

  useEffect(()=>{
    const canvas=canvasRef.current
    if(!canvas)return
    let active=true
    setFailed(false)
    canvas.removeAttribute('style')
    if(format==='qr'){
      const width=expanded?Math.max(72,Math.floor(Math.min(window.innerWidth*.9,window.innerHeight*.9))):72
      void QRCode.toCanvas(canvas,value,{width,margin:1,errorCorrectionLevel:'M',color:{dark:'#172a24',light:'#ffffff'}}).catch(()=>{if(active)setFailed(true)})
    }else{
      try{JsBarcode(canvas,value,{format:'CODE128',displayValue:false,width:expanded?3:1.35,height:expanded?Math.max(46,Math.floor(window.innerHeight*.65)):46,margin:4,lineColor:'#172a24',background:'#ffffff'})}
      catch{setFailed(true)}
    }
    return()=>{active=false}
  },[expanded,format,value])

  useEffect(()=>()=>{if(clickTimer.current!==undefined)window.clearTimeout(clickTimer.current)},[])

  const next=format==='qr'?'Code 128 barcode':'QR code'
  return <button
    type="button"
    className={`confirmation-code confirmation-code-${format}${expanded?' confirmation-code-expanded':''}`}
    aria-label={`Confirmation ${value}. ${expanded?'Return to item view':'Enlarge code'}. Double click or double tap to show ${next}`}
    aria-expanded={expanded}
    aria-pressed={format==='code128'}
    title={`${expanded?'Click or tap to return to the item view':'Click or tap to enlarge'}. Double click or double tap to show ${next}.`}
    onClick={event=>{event.stopPropagation();if(clickTimer.current!==undefined)window.clearTimeout(clickTimer.current);clickTimer.current=window.setTimeout(()=>{clickTimer.current=undefined;onToggleExpanded()},250)}}
    onDoubleClick={event=>{event.stopPropagation();if(clickTimer.current!==undefined){window.clearTimeout(clickTimer.current);clickTimer.current=undefined}setFormat(current=>nextConfirmationCodeFormat(current))}}
  >
    <canvas ref={canvasRef} aria-hidden="true"/>
    {failed&&<span>Code unavailable</span>}
  </button>
}
