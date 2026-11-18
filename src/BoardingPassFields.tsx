import { useState } from 'react'
import { BoardingPass, BoardingPassImage } from './types'
import { BOARDING_PASS_IMAGE_ACCEPT, readBoardingPassImage } from './boardingPass'
import { PhotoViewer } from './JournalPhotoViewer'
import { LanguageCode, uiText } from './i18n'

export function BoardingPassPreview({image,language}:{image:BoardingPassImage;language:LanguageCode}) {
  const [expanded,setExpanded]=useState(false),t=(value:string)=>uiText(value,language)
  return <div className="boarding-pass-preview" onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}>
    <button type="button" className="boarding-pass-image" aria-label={t('View boarding pass image')} onClick={()=>setExpanded(true)}><img src={image.dataUrl} alt={image.name}/></button>
    {expanded&&<PhotoViewer photo={{name:image.name,mimeType:image.mimeType,size:0}} url={image.dataUrl} language={language} imageOnly onClose={()=>setExpanded(false)}/>}
  </div>
}

export function BoardingPassFields({value,language,busy,onBusy,onChange}:{value?:BoardingPass;language:LanguageCode;busy:boolean;onBusy:(busy:boolean)=>void;onChange:(value:BoardingPass|undefined)=>void}) {
  const [error,setError]=useState(''),t=(text:string)=>uiText(text,language)
  const update=(next:BoardingPass)=>onChange(next.url||next.image?next:undefined)
  return <fieldset className="boarding-pass-fields"><legend>{t('Boarding pass')}</legend>
    <label>{t('Boarding pass URL')}<input type="url" pattern="https://.*" maxLength={4000} title={t('Use a secure https:// link')} value={value?.url||''} onChange={event=>update({...value,url:event.target.value||undefined})}/></label>
    {value?.image&&<><BoardingPassPreview image={value.image} language={language}/><button type="button" className="secondary" disabled={busy} onClick={()=>update({...value,image:undefined})}>{t('Remove image')}</button></>}
    <label>{t(value?.image?'Replace boarding pass image':'Add boarding pass image')}<input type="file" accept={BOARDING_PASS_IMAGE_ACCEPT} disabled={busy} onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;onBusy(true);setError('');try{update({...value,image:await readBoardingPassImage(file)})}catch(error){setError(error instanceof Error?error.message:'The boarding pass image could not be read.')}finally{onBusy(false)}}}/></label>
    <small>{t('PNG, JPEG, or WebP, up to 2 MB. Saved with your trip for offline use.')}</small>
    {error&&<p role="alert">{t(error)}</p>}
  </fieldset>
}
