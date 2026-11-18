import type { BoardingPass, BoardingPassImage, TripItem } from './types'
import { uid } from './types'

export const MAX_BOARDING_PASS_IMAGE_BYTES = 2 * 1024 * 1024
export const BOARDING_PASS_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
const object = (value:unknown):value is Record<string,unknown> => !!value&&typeof value==='object'&&!Array.isArray(value)
const https = (value:unknown) => {if(typeof value!=='string'||!value||value.length>4_000)return false;try{return new URL(value).protocol==='https:'}catch{return false}}

export function validBoardingPassImage(value:unknown):value is BoardingPassImage {
  if(!object(value)||Object.keys(value).some(key=>!['name','mimeType','dataUrl'].includes(key))||typeof value.name!=='string'||!value.name.trim()||value.name.length>1_000||typeof value.dataUrl!=='string')return false
  if(!['image/png','image/jpeg','image/webp'].includes(String(value.mimeType)))return false
  const prefix=`data:${value.mimeType};base64,`
  if(!value.dataUrl.startsWith(prefix)||value.dataUrl.length>prefix.length+4*Math.ceil(MAX_BOARDING_PASS_IMAGE_BYTES/3))return false
  const base64=value.dataUrl.slice(prefix.length)
  if(!base64||base64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))return false
  const size=base64.length/4*3-(base64.endsWith('==')?2:base64.endsWith('=')?1:0)
  if(size>MAX_BOARDING_PASS_IMAGE_BYTES)return false
  const header=atob(base64.slice(0,24))
  return value.mimeType==='image/png'?header.startsWith('\x89PNG\r\n\x1a\n'):value.mimeType==='image/jpeg'?header.startsWith('\xff\xd8\xff'):header.startsWith('RIFF')&&header.slice(8,12)==='WEBP'
}

export function validBoardingPass(value:unknown):value is BoardingPass {
  return object(value)&&Object.keys(value).every(key=>key==='url'||key==='image')&&
    (value.url===undefined||https(value.url))&&(value.image===undefined||validBoardingPassImage(value.image))&&
    (value.url!==undefined||value.image!==undefined)
}

export async function readBoardingPassImage(file:File):Promise<BoardingPassImage> {
  if(!BOARDING_PASS_IMAGE_ACCEPT.split(',').includes(file.type))throw new Error('Choose a PNG, JPEG, or WebP boarding pass image.')
  if(file.size>MAX_BOARDING_PASS_IMAGE_BYTES)throw new Error('Choose a boarding pass image smaller than 2 MB.')
  const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('The boarding pass image could not be read.'));reader.readAsDataURL(file)})
  const image={name:file.name,mimeType:file.type,dataUrl}
  if(!validBoardingPassImage(image))throw new Error('The selected file is not a valid PNG, JPEG, or WebP image.')
  return image
}

export function boardingPassForFlight(flight:TripItem,id:string=uid()):TripItem {
  return {id,type:'boarding-pass',title:`Boarding pass · ${flight.flightNumber||flight.title}`,relatedItemId:flight.id,start:flight.start,timeZone:flight.timeZone,location:flight.location,provider:flight.provider,flightNumber:flight.flightNumber,status:'confirmed'}
}

/** Keep the pass beside its flight after schedule changes; retain orphaned passes. */
export function alignBoardingPassesWithFlights(items:TripItem[]):TripItem[] {
  const flights=new Map(items.filter(item=>item.type==='flight').map(item=>[item.id,item]))
  return items.map(item=>{
    const flight=item.type==='boarding-pass'&&item.relatedItemId?flights.get(item.relatedItemId):undefined
    return flight?{...item,start:flight.start,timeZone:flight.timeZone,location:flight.location,provider:flight.provider,flightNumber:flight.flightNumber}:item
  })
}
