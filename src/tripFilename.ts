interface TripFilenameInput {
  name?: string
  destination?: string
  start?: string
}

const months=['January','February','March','April','May','June','July','August','September','October','November','December']

const slug=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'')

const destinationBasis=(destination:string,name:string)=>{
  const parts=destination.split(/\s*(?:→|->|—|–|\|)\s*/).map(part=>part.trim()).filter(Boolean)
  if(parts.length===1)return parts[0]
  if(parts.length===3&&parts[0].toLocaleLowerCase()===parts[2].toLocaleLowerCase())return parts[1]
  return name||destination
}

export function tripJsonFilename({name='',destination='',start=''}:TripFilenameInput) {
  const match=/^(\d{4})-(\d{2})/.exec(start),basis=destinationBasis(destination,name).replace(/\b(?:19|20)\d{2}\b/g,' ').trim()
  const prefix=(slug(basis)||slug(name)||'Trip').slice(0,80).replace(/-+$/,'')
  if(!match)return `${prefix}.json`
  const month=months[Number(match[2])-1]
  return month?`${prefix}-${month}-${match[1]}.json`:`${prefix}-${match[1]}.json`
}
