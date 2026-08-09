import type { ItemType, ShareField, SharePolicyPreset, SharePolicyV1 } from './types'
import { SHARE_FIELD_CATALOG, sensitiveCategoriesForSharePolicy, sharePolicyForPreset } from './sharePolicy'
import { typeLabels, types } from './types'

const fieldLabels:Record<ShareField,string>={
  type:'Type',title:'Title',provider:'Provider',confirmation:'Confirmation',start:'Starts',end:'Ends',timeZone:'Time zone',endTimeZone:'End time zone',
  location:'Location',endLocation:'End location',notes:'Notes / journal text',link:'Booking link',emailLink:'Source email link',bookedBy:'Booked by',status:'Status',quantity:'Quantity',
  flightNumber:'Flight number',durationMinutes:'Duration',allDay:'All-day status',createdAt:'Created time',updatedAt:'Updated time',createdBy:'Created by',updatedBy:'Updated by',
}

const sensitiveLabels={
  confirmations:'booking confirmations',
  'booking-details':'booking details',
  'notes-and-journal':'notes or journal text',
  links:'external and source-email links',
  locations:'locations',
  photos:'original photos and metadata',
  audio:'original audio and metadata',
} as const

export function SharePolicyEditor({policy,onChange,disabled=false}:{policy:SharePolicyV1;onChange:(policy:SharePolicyV1)=>void;disabled?:boolean}) {
  const update=(patch:Partial<SharePolicyV1>)=>onChange({...policy,...patch,preset:'custom'})
  const preset=(value:SharePolicyPreset)=>onChange(sharePolicyForPreset(policy.audience,value))
  const toggleType=(type:ItemType)=>{
    const enabled=policy.itemTypes.includes(type),itemTypes=enabled?policy.itemTypes.filter(value=>value!==type):[...policy.itemTypes,type]
    update({itemTypes,includePhotos:type==='journal'&&enabled?false:policy.includePhotos,includeAudio:type==='journal'&&enabled?false:policy.includeAudio})
  }
  const toggleField=(field:ShareField)=>update({fields:policy.fields.includes(field)?policy.fields.filter(value=>value!==field):[...policy.fields,field]})
  const sensitive=sensitiveCategoriesForSharePolicy(policy)
  return <div className="share-policy-editor">
    <label>Sharing preset<select value={policy.preset} disabled={disabled} onChange={event=>preset(event.target.value as SharePolicyPreset)}><option value="simplified">Simplified</option><option value="full">Full</option><option value="custom">Custom</option></select></label>
    <fieldset><legend>Visible itinerary types</legend><div className="share-policy-options">{types.map(type=><label key={type}><input type="checkbox" checked={policy.itemTypes.includes(type)} disabled={disabled} onChange={()=>toggleType(type)}/><span>{typeLabels[type]}</span></label>)}</div></fieldset>
    <details><summary>Visible fields ({policy.fields.length})</summary><div className="share-policy-options share-field-options">{SHARE_FIELD_CATALOG.map(field=><label key={field}><input type="checkbox" checked={policy.fields.includes(field)} disabled={disabled} onChange={()=>toggleField(field)}/><span>{fieldLabels[field]}</span></label>)}</div></details>
    {policy.audience==='named-trip'&&<fieldset><legend>Original journal media</legend><div className="share-policy-options"><label><input type="checkbox" checked={policy.includePhotos} disabled={disabled||!policy.itemTypes.includes('journal')} onChange={()=>onChange({...policy,includePhotos:!policy.includePhotos})}/><span>Photos</span></label><label><input type="checkbox" checked={policy.includeAudio} disabled={disabled||!policy.itemTypes.includes('journal')} onChange={()=>onChange({...policy,includeAudio:!policy.includeAudio})}/><span>Audio</span></label></div><p>Media access is read-only but downloadable and includes every current and future original in the enabled folder. Originals may reveal filenames, EXIF GPS/time/camera data, audio tags, and recorded content.</p></fieldset>}
    <div className={`sensitive-review${sensitive.length?' includes-sensitive':''}`}><strong>Sensitive-data review</strong><span>{sensitive.length?`This policy includes ${sensitive.map(value=>sensitiveLabels[value]).join(', ')}.`:'No sensitive categories are selected.'}</span></div>
  </div>
}
