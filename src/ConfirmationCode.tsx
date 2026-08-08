import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmationCodeFormat, nextConfirmationCodeFormat } from './confirmationCodeFormat'
import { currentLanguage, LanguageCode, uiMessage, uiText } from './i18n'

export function ConfirmationCode({value,title,language,expanded=false,onToggleExpanded}:{value:string;title:string;language?:LanguageCode;expanded?:boolean;onToggleExpanded:()=>void}) {
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
      const scale=expanded?4:1
      try{JsBarcode(canvas,value,{format:'CODE128',displayValue:false,width:1.35*scale,height:46*scale,margin:4*scale,lineColor:'#172a24',background:'#ffffff'})}
      catch{setFailed(true)}
    }
    return()=>{active=false}
  },[expanded,format,value])

  useEffect(()=>()=>{if(clickTimer.current!==undefined)window.clearTimeout(clickTimer.current)},[])
  useEffect(()=>{
    if(!expanded)return
    const root=document.documentElement,body=document.body
    const scrollX=window.scrollX,scrollY=window.scrollY
    const previous={rootOverflow:root.style.overflow,rootOverscroll:root.style.overscrollBehavior,rootScrollbarGutter:root.style.scrollbarGutter,bodyOverflow:body.style.overflow,bodyOverscroll:body.style.overscrollBehavior,bodyPosition:body.style.position,bodyTop:body.style.top,bodyLeft:body.style.left,bodyRight:body.style.right,bodyWidth:body.style.width}
    root.style.overflow='hidden'
    root.style.overscrollBehavior='none'
    root.style.scrollbarGutter='auto'
    body.style.overflow='hidden'
    body.style.overscrollBehavior='none'
    body.style.position='fixed'
    body.style.top=`-${scrollY}px`
    body.style.left=`-${scrollX}px`
    body.style.right='0'
    body.style.width='100vw'
    return()=>{root.style.overflow=previous.rootOverflow;root.style.overscrollBehavior=previous.rootOverscroll;root.style.scrollbarGutter=previous.rootScrollbarGutter;body.style.overflow=previous.bodyOverflow;body.style.overscrollBehavior=previous.bodyOverscroll;body.style.position=previous.bodyPosition;body.style.top=previous.bodyTop;body.style.left=previous.bodyLeft;body.style.right=previous.bodyRight;body.style.width=previous.bodyWidth;window.scrollTo(scrollX,scrollY)}
  },[expanded])

  const activeLanguage=language||currentLanguage()
  const next=uiText(format==='qr'?'Code 128 barcode':'QR code',activeLanguage)
  const label=uiMessage(expanded?'Confirmation {value}. Return to item view. Double click or double tap to show {format}':'Confirmation {value}. Enlarge code. Double click or double tap to show {format}',activeLanguage,{value,format:next})
  const tooltip=uiMessage(expanded?'Click or tap to return to the item view. Double click or double tap to show {format}.':'Click or tap to enlarge. Double click or double tap to show {format}.',activeLanguage,{format:next})
  const code=<button
    type="button"
    className={`confirmation-code confirmation-code-${format}${expanded?' confirmation-code-expanded':''}`}
    aria-label={label}
    aria-expanded={expanded}
    aria-pressed={format==='code128'}
    title={tooltip}
    onClick={event=>{event.stopPropagation();if(clickTimer.current!==undefined)window.clearTimeout(clickTimer.current);clickTimer.current=window.setTimeout(()=>{clickTimer.current=undefined;onToggleExpanded()},250)}}
    onDoubleClick={event=>{event.stopPropagation();if(clickTimer.current!==undefined){window.clearTimeout(clickTimer.current);clickTimer.current=undefined}setFormat(current=>nextConfirmationCodeFormat(current))}}
    onWheel={event=>{if(expanded){event.preventDefault();event.stopPropagation()}}}
    onTouchMove={event=>{if(expanded){event.preventDefault();event.stopPropagation()}}}
  >
    <canvas ref={canvasRef} aria-hidden="true"/>
    {failed&&<span>{uiText('Code unavailable',activeLanguage)}</span>}
    {expanded&&<strong className="confirmation-code-title">{title}</strong>}
  </button>

  // Keep the full-screen code outside item-level opacity and stacking contexts.
  // Archived trips intentionally fade their items, which would otherwise make
  // the white overlay translucent and allow the itinerary to show through.
  return expanded&&typeof document!=='undefined'?createPortal(code,document.body):code
}
