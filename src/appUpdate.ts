const moduleScriptTag = /<script\b(?=[^>]*\btype=["']module["'])[^>]*>/i
const scriptSource = /\bsrc=["']([^"']+)["']/i

export function deployedEntryUrl(html:string,pageUrl:string) {
  const tag=html.match(moduleScriptTag)?.[0]
  const source=tag?.match(scriptSource)?.[1]
  if(!source)return undefined
  try{return new URL(source,pageUrl).href}catch{return undefined}
}

export function sameAppEntry(first:string,second:string) {
  const normalized=(value:string)=>{const url=new URL(value);url.search='';url.hash='';return url.href}
  try{return normalized(first)===normalized(second)}catch{return first===second}
}
