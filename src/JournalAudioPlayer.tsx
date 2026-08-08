import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { loadDriveJournalAudio } from './googleDrive'
import { languageMetadata, LanguageCode, uiText } from './i18n'
import { formatPhotoSize } from './JournalPhotoViewer'
import { JournalAudio } from './types'

type AudioDescriptor = Pick<JournalAudio,'name'|'mimeType'|'size'>

export function formatAudioTime(seconds:number) {
  if(!Number.isFinite(seconds)||seconds<0)return '0:00'
  const total=Math.floor(seconds),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),remaining=String(total%60).padStart(2,'0')
  return hours?`${hours}:${String(minutes).padStart(2,'0')}:${remaining}`:`${minutes}:${remaining}`
}

export function audioTimeAfterSkip(current:number,duration:number,seconds:number) {
  const next=Math.max(0,(Number.isFinite(current)?current:0)+seconds)
  return Number.isFinite(duration)&&duration>=0?Math.min(next,duration):next
}

const stopPlayerEvent = (event:MouseEvent) => event.stopPropagation()

function AudioPlayer({audio,url,loading,failed,language,onClose}:{audio:AudioDescriptor;url:string;loading:boolean;failed:boolean;language:LanguageCode;onClose:()=>void}) {
  const titleId=useId(),audioRef=useRef<HTMLAudioElement>(null),closeRef=useRef<HTMLButtonElement>(null)
  const [playing,setPlaying]=useState(false),[currentTime,setCurrentTime]=useState(0),[duration,setDuration]=useState(0),[playbackFailed,setPlaybackFailed]=useState(false)
  const t=(value:string)=>uiText(value,language),locale=languageMetadata[language].locale
  const unavailable=failed||playbackFailed

  useEffect(()=>{setPlaying(false);setCurrentTime(0);setDuration(0);setPlaybackFailed(false)},[url])
  useEffect(()=>{
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
    const previousOverflow=document.body.style.overflow
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose()}}
    document.body.style.overflow='hidden'
    window.addEventListener('keydown',onKeyDown)
    closeRef.current?.focus()
    return()=>{window.removeEventListener('keydown',onKeyDown);document.body.style.overflow=previousOverflow;audioRef.current?.pause();previousFocus?.focus()}
  },[])

  const togglePlayback=async()=>{
    const element=audioRef.current
    if(!element||unavailable)return
    if(element.paused){try{await element.play()}catch{setPlaybackFailed(true)}}else element.pause()
  }
  const skip=(seconds:number)=>{
    const element=audioRef.current
    if(!element)return
    const next=audioTimeAfterSkip(element.currentTime,element.duration,seconds)
    element.currentTime=next
    setCurrentTime(next)
  }
  const seek=(value:number)=>{
    const element=audioRef.current
    if(!element)return
    element.currentTime=value
    setCurrentTime(value)
  }

  return createPortal(<div className="audio-player-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event=>{event.stopPropagation();if(event.target===event.currentTarget)onClose()}} onDoubleClick={stopPlayerEvent}>
    <section className="audio-player" onClick={stopPlayerEvent} onDoubleClick={stopPlayerEvent}>
      <header className="audio-player-header"><div><span className="audio-player-icon" aria-hidden="true">♪</span><div><h2 id={titleId}>{audio.name}</h2><p>{[formatPhotoSize(audio.size,locale),audio.mimeType].filter(Boolean).join(' · ')}</p></div></div><button ref={closeRef} type="button" className="audio-player-close" aria-label={t('Close audio player')} onClick={onClose}>×</button></header>
      {url&&<audio ref={audioRef} src={url} preload="metadata" onLoadedMetadata={event=>{const length=event.currentTarget.duration;setDuration(Number.isFinite(length)?length:0)}} onDurationChange={event=>{const length=event.currentTarget.duration;setDuration(Number.isFinite(length)?length:0)}} onTimeUpdate={event=>setCurrentTime(event.currentTarget.currentTime)} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>setPlaybackFailed(true)}/>}
      <div className="audio-player-timeline"><input type="range" min="0" max={duration||0} step="0.1" value={Math.min(currentTime,duration||0)} disabled={!url||unavailable||!duration} aria-label={t('Audio position')} onChange={event=>seek(Number(event.target.value))}/><div><span>{formatAudioTime(currentTime)}</span><span>{formatAudioTime(duration)}</span></div></div>
      <div className="audio-player-controls">
        <button type="button" aria-label={t('Rewind 15 seconds')} title={t('Rewind 15 seconds')} disabled={!url||unavailable} onClick={()=>skip(-15)}><span aria-hidden="true">↶</span><small>15</small></button>
        <button type="button" className="audio-play-pause" aria-label={t(playing?'Pause':'Play')} title={t(playing?'Pause':'Play')} disabled={!url||unavailable} onClick={togglePlayback}><span aria-hidden="true">{playing?'Ⅱ':'▶'}</span></button>
        <button type="button" aria-label={t('Skip 15 seconds')} title={t('Skip 15 seconds')} disabled={!url||unavailable} onClick={()=>skip(15)}><span aria-hidden="true">↷</span><small>15</small></button>
      </div>
      <p className={`audio-player-status${unavailable?' error':''}`} role="status">{loading?t('Loading audio…'):unavailable?t('Audio unavailable'):playing?t('Playing'):t('Paused')}</p>
    </section>
  </div>,document.body)
}

function AudioTrigger({audio,language,onOpen}:{audio:AudioDescriptor;language:LanguageCode;onOpen:()=>void}) {
  const t=(value:string)=>uiText(value,language),locale=languageMetadata[language].locale
  return <button type="button" className="journal-audio-trigger" aria-label={`${t('Play audio')}: ${audio.name}`} onClick={event=>{event.stopPropagation();onOpen()}} onDoubleClick={stopPlayerEvent}><span className="journal-audio-icon" aria-hidden="true">♪</span><span><strong>{audio.name}</strong><small>{formatPhotoSize(audio.size,locale)}</small></span><span className="journal-audio-action" aria-hidden="true">▶</span></button>
}

export function DriveJournalAudio({audio,connected,language}:{audio:JournalAudio;connected:boolean;language:LanguageCode}) {
  const [open,setOpen]=useState(false),[blob,setBlob]=useState<Blob|null>(null),[url,setUrl]=useState(''),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false)
  const t=(value:string)=>uiText(value,language)
  useEffect(()=>{setOpen(false);setBlob(null);setLoading(false);setFailed(false)},[audio.driveFileId,audio.resourceKey,connected])
  useEffect(()=>{if(!blob){setUrl('');return}const objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);return()=>URL.revokeObjectURL(objectUrl)},[blob])
  useEffect(()=>{if(!open||blob||failed||!connected)return;let disposed=false;setLoading(true);void loadDriveJournalAudio(audio).then(result=>{if(!disposed){setBlob(result);setLoading(false)}}).catch(()=>{if(!disposed){setFailed(true);setLoading(false)}});return()=>{disposed=true}},[open,blob,failed,connected,audio.driveFileId,audio.resourceKey])
  if(!connected)return <div className="journal-audio-placeholder"><span>{t('Audio in Google Drive')}</span><small>{t('Reconnect to listen')}</small></div>
  return <><AudioTrigger audio={audio} language={language} onOpen={()=>setOpen(true)}/>{open&&<AudioPlayer audio={audio} url={url} loading={loading} failed={failed} language={language} onClose={()=>setOpen(false)}/>}</>
}

export function LocalJournalAudio({file,language}:{file:File;language:LanguageCode}) {
  const [url,setUrl]=useState(''),[open,setOpen]=useState(false)
  useEffect(()=>{const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);setOpen(false);return()=>URL.revokeObjectURL(objectUrl)},[file])
  const audio={name:file.name,mimeType:file.type,size:file.size}
  return <><AudioTrigger audio={audio} language={language} onOpen={()=>setOpen(true)}/>{open&&<AudioPlayer audio={audio} url={url} loading={false} failed={false} language={language} onClose={()=>setOpen(false)}/>}</>
}
