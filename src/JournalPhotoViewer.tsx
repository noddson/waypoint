import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { mapSearchUrl } from './destinations'
import { DriveJournalPhotoMetadata, loadDriveJournalPhoto, loadDriveJournalPhotoMetadata } from './googleDrive'
import { languageMetadata, LanguageCode, uiText } from './i18n'
import { loadMapProvider } from './mapProvider'
import { JournalPhoto } from './types'

type ViewerPhoto = Pick<JournalPhoto,'name'|'mimeType'|'size'>
type NaturalSize = {width:number;height:number}

const finiteNumber = (value:unknown):value is number => typeof value==='number'&&Number.isFinite(value)

export function formatExifDateTime(value:string,locale:string) {
  const exif=value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if(exif){
    const [,year,month,day,hour,minute,second='00']=exif
    const date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day),Number(hour),Number(minute),Number(second)))
    if(!Number.isNaN(date.getTime()))return new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'medium',timeZone:'UTC'}).format(date)
  }
  const date=new Date(value)
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'medium'}).format(date)
}

export function formatPhotoSize(bytes:number,locale:string) {
  if(!Number.isFinite(bytes)||bytes<0)return ''
  if(bytes<1024)return `${new Intl.NumberFormat(locale).format(bytes)} B`
  const units=['KB','MB','GB']
  let value=bytes/1024,index=0
  while(value>=1024&&index<units.length-1){value/=1024;index+=1}
  return `${new Intl.NumberFormat(locale,{maximumFractionDigits:value<10?1:0}).format(value)} ${units[index]}`
}

function exposureTime(value:number) {
  if(value>0&&value<1){
    const denominator=Math.round(1/value)
    if(denominator>1)return `1/${denominator} s`
  }
  return `${Number(value.toFixed(3))} s`
}

function cameraName(metadata:NonNullable<DriveJournalPhotoMetadata['imageMediaMetadata']>) {
  const make=metadata.cameraMake?.trim(),model=metadata.cameraModel?.trim(),lens=metadata.lens?.trim()
  const camera=model&&make&&model.toLocaleLowerCase().startsWith(make.toLocaleLowerCase())?model:[make,model].filter(Boolean).join(' ')
  return [camera,lens&&lens!==camera?lens:undefined].filter(Boolean).join(' · ')
}

function exposureDetails(metadata:NonNullable<DriveJournalPhotoMetadata['imageMediaMetadata']>) {
  const details=[
    finiteNumber(metadata.exposureTime)&&metadata.exposureTime>0?exposureTime(metadata.exposureTime):undefined,
    finiteNumber(metadata.aperture)&&metadata.aperture>0?`ƒ/${Number(metadata.aperture.toFixed(1))}`:undefined,
    finiteNumber(metadata.focalLength)&&metadata.focalLength>0?`${Number(metadata.focalLength.toFixed(1))} mm`:undefined,
    finiteNumber(metadata.isoSpeed)&&metadata.isoSpeed>0?`ISO ${metadata.isoSpeed}`:undefined,
    finiteNumber(metadata.exposureBias)?`${metadata.exposureBias>0?'+':''}${Number(metadata.exposureBias.toFixed(1))} EV`:undefined,
  ]
  return details.filter(Boolean).join(' · ')
}

function stopViewerEvent(event:MouseEvent) { event.stopPropagation() }

function PhotoViewer({photo,url,metadata,language,onClose}:{photo:ViewerPhoto;url:string;metadata?:DriveJournalPhotoMetadata|null;language:LanguageCode;onClose:()=>void}) {
  const titleId=useId(),closeRef=useRef<HTMLButtonElement>(null),[naturalSize,setNaturalSize]=useState<NaturalSize|null>(null)
  const locale=languageMetadata[language].locale
  const imageMetadata=metadata?.imageMediaMetadata
  const width=imageMetadata?.width||naturalSize?.width,height=imageMetadata?.height||naturalSize?.height
  const taken=imageMetadata?.time?formatExifDateTime(imageMetadata.time,locale):''
  const camera=imageMetadata?cameraName(imageMetadata):''
  const exposure=imageMetadata?exposureDetails(imageMetadata):''
  const location=imageMetadata?.location
  const latitude=location?.latitude,longitude=location?.longitude,altitude=location?.altitude
  const hasCoordinates=finiteNumber(latitude)&&finiteNumber(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180
  const coordinateLabel=hasCoordinates?`${latitude.toFixed(6)}, ${longitude.toFixed(6)}${finiteNumber(altitude)?` · ${Number(altitude.toFixed(1))} m`:''}`:''
  const coordinateUrl=hasCoordinates?mapSearchUrl(`${latitude},${longitude}`,loadMapProvider()):''

  useEffect(()=>setNaturalSize(null),[url])
  useEffect(()=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
    const root=document.documentElement,body=document.body,scrollX=window.scrollX,scrollY=window.scrollY
    const previous={rootOverflow:root.style.overflow,rootOverscroll:root.style.overscrollBehavior,rootScrollbarGutter:root.style.scrollbarGutter,bodyOverflow:body.style.overflow,bodyOverscroll:body.style.overscrollBehavior,bodyPosition:body.style.position,bodyTop:body.style.top,bodyLeft:body.style.left,bodyRight:body.style.right,bodyWidth:body.style.width}
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose()}}
    root.style.overflow='hidden';root.style.overscrollBehavior='none';root.style.scrollbarGutter='auto'
    body.style.overflow='hidden';body.style.overscrollBehavior='none';body.style.position='fixed';body.style.top=`-${scrollY}px`;body.style.left=`-${scrollX}px`;body.style.right='0';body.style.width='100vw'
    window.addEventListener('keydown',closeOnEscape)
    closeRef.current?.focus()
    return()=>{
      window.removeEventListener('keydown',closeOnEscape)
      root.style.overflow=previous.rootOverflow;root.style.overscrollBehavior=previous.rootOverscroll;root.style.scrollbarGutter=previous.rootScrollbarGutter
      body.style.overflow=previous.bodyOverflow;body.style.overscrollBehavior=previous.bodyOverscroll;body.style.position=previous.bodyPosition;body.style.top=previous.bodyTop;body.style.left=previous.bodyLeft;body.style.right=previous.bodyRight;body.style.width=previous.bodyWidth
      window.scrollTo(scrollX,scrollY)
      previousFocus?.focus()
    }
  },[])

  const details:Array<{label:string;value:ReactNode}>=[]
  if(taken)details.push({label:'Taken',value:taken})
  if(hasCoordinates)details.push({label:'GPS',value:<a href={coordinateUrl} target="_blank" rel="noreferrer">{coordinateLabel}</a>})
  if(camera)details.push({label:'Camera',value:camera})
  if(width&&height)details.push({label:'Image',value:`${width} × ${height} px`})
  if(exposure)details.push({label:'Exposure',value:exposure})

  return createPortal(<div
    className="photo-viewer-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget)onClose()}}
    onDoubleClick={stopViewerEvent}
  >
    <section className="photo-viewer" onClick={stopViewerEvent} onDoubleClick={stopViewerEvent}>
      <header className="photo-viewer-header">
        <div><h2 id={titleId}>{photo.name}</h2><p>{[formatPhotoSize(photo.size,locale),photo.mimeType].filter(Boolean).join(' · ')}</p></div>
        <button ref={closeRef} type="button" className="photo-viewer-close" aria-label={uiText('Close',language)} onClick={onClose}>×</button>
      </header>
      <div className="photo-viewer-stage"><img src={url} alt={photo.name} onLoad={event=>setNaturalSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})}/></div>
      {details.length>0&&<dl className="photo-viewer-details">{details.map(detail=><div key={detail.label}><dt>{uiText(detail.label,language)}</dt><dd>{detail.value}</dd></div>)}</dl>}
    </section>
  </div>,document.body)
}

function PhotoTrigger({name,url,language,onOpen}:{name:string;url:string;language:LanguageCode;onOpen:()=>void}) {
  return <button
    type="button"
    className="journal-photo-trigger"
    aria-label={`${uiText('View full photo',language)}: ${name}`}
    title={uiText('View full photo',language)}
    onClick={event=>{event.stopPropagation();onOpen()}}
    onDoubleClick={stopViewerEvent}
  ><img src={url} alt=""/></button>
}

export function DriveJournalPhoto({photo,connected,language}:{photo:JournalPhoto;connected:boolean;language:LanguageCode}){
  const [url,setUrl]=useState(''),[failed,setFailed]=useState(false),[open,setOpen]=useState(false),[metadata,setMetadata]=useState<DriveJournalPhotoMetadata|null|undefined>(undefined)
  const t=(value:string)=>uiText(value,language)
  useEffect(()=>{let disposed=false,objectUrl='';setUrl('');setFailed(false);setOpen(false);setMetadata(undefined);if(!connected)return;void loadDriveJournalPhoto(photo).then(blob=>{if(disposed)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl)}).catch(()=>{if(!disposed)setFailed(true)});return()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[photo.driveFileId,photo.resourceKey,connected])
  useEffect(()=>{if(!open||metadata!==undefined)return;let disposed=false;void loadDriveJournalPhotoMetadata(photo).then(result=>{if(!disposed)setMetadata(result)}).catch(()=>{if(!disposed)setMetadata(null)});return()=>{disposed=true}},[open,metadata,photo.driveFileId,photo.resourceKey])
  if(!connected)return <div className="journal-photo-placeholder"><span>{t('Photo in Google Drive')}</span><small>{t('Reconnect to view')}</small></div>
  if(failed)return <div className="journal-photo-placeholder"><span>{photo.name}</span><small>{t('Photo unavailable')}</small></div>
  if(!url)return <div className="journal-photo-placeholder"><span>{photo.name}</span><small>{t('Loading photo…')}</small></div>
  return <><PhotoTrigger name={photo.name} url={url} language={language} onOpen={()=>setOpen(true)}/>{open&&<PhotoViewer photo={photo} url={url} metadata={metadata} language={language} onClose={()=>setOpen(false)}/>}</>
}

export function LocalJournalPhoto({file,language}:{file:File;language:LanguageCode}){
  const [url,setUrl]=useState(''),[open,setOpen]=useState(false)
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);setOpen(false);return()=>URL.revokeObjectURL(objectUrl)},[file])
  if(!url)return null
  const photo={name:file.name,mimeType:file.type,size:file.size}
  return <><PhotoTrigger name={file.name} url={url} language={language} onOpen={()=>setOpen(true)}/>{open&&<PhotoViewer photo={photo} url={url} language={language} onClose={()=>setOpen(false)}/>}</>
}
