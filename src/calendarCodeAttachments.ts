import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import { CalendarAttachment, itemHasCalendarCode } from './calendarExport'
import { confirmationCodeValue } from './confirmationCodeFormat'
import { Trip } from './types'

const pngBase64=(canvas:HTMLCanvasElement)=>canvas.toDataURL('image/png').split(',',2)[1]||''

async function codeAttachments(value:string):Promise<CalendarAttachment[]> {
  const qrCanvas=document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas,value,{width:256,margin:2,errorCorrectionLevel:'M',color:{dark:'#172a24',light:'#ffffff'}})
  const barcodeCanvas=document.createElement('canvas')
  JsBarcode(barcodeCanvas,value,{format:'CODE128',displayValue:true,fontSize:18,width:2,height:96,margin:12,lineColor:'#172a24',background:'#ffffff'})
  return [
    {mimeType:'image/png',dataBase64:pngBase64(qrCanvas)},
    {mimeType:'image/png',dataBase64:pngBase64(barcodeCanvas)},
  ]
}

export async function buildCalendarCodeAttachments(trip:Trip) {
  const attachments:Record<string,CalendarAttachment[]>={}
  await Promise.all(trip.items.filter(itemHasCalendarCode).map(async item=>{
    const value=confirmationCodeValue(item.confirmation)
    if(value)try{attachments[item.id]=await codeAttachments(value)}catch{/* Keep the calendar portable when a confirmation cannot be encoded as a barcode. */}
  }))
  return attachments
}
