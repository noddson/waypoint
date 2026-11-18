import { expect, test } from '@playwright/test'

const item={id:'old-item',type:'event',title:'Original workshop',start:'2026-11-21T08:30',timeZone:'America/New_York',status:'confirmed'}
const oldTrip={id:'shared-identity',name:'Workshop',destination:'Philadelphia',createdAt:'2026-09-22T01:52:00.000Z',updatedAt:'2026-09-22T02:31:00.000Z',items:[item]}
const phoneTrip={...oldTrip,updatedAt:'2026-11-18T22:41:00.000Z',items:[item,{...item,id:'new-item',title:'Hard CORE Staff',start:'2026-11-21T09:40'}]}

for(const scenario of [{mobile:false,linked:true},{mobile:true,linked:true},{mobile:false,linked:false}])test(`${scenario.linked?'resolves duplicate files':'recovers a missing device link'} on ${scenario.mobile?'mobile':'desktop'} without replacing Drive JSON`,async({page})=>{
  await page.setViewportSize(scenario.mobile?{width:390,height:844}:{width:1280,height:800})
  const files=[{id:'phone-file',name:'Workshop.waypoint.json',appProperties:{waypoint:'trip',tripId:oldTrip.id} as Record<string,string>},{id:'desktop-file',name:'Workshop.waypoint.json',appProperties:{waypoint:'trip',tripId:oldTrip.id} as Record<string,string>}]
  if(!scenario.linked)files.splice(1,1)
  const writes:Array<{path:string;body:any}>=[]
  await page.addInitScript(()=>{
    sessionStorage.setItem('waypoint-drive-session',JSON.stringify({accessToken:'test-only-token',expiresAt:Date.now()+3600_000}))
    ;(window as any).google={accounts:{oauth2:{}}}
  })
  await page.route('https://www.googleapis.com/**',async route=>{
    const request=route.request(),url=new URL(request.url())
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,PATCH,POST,DELETE'}});return}
    let body:unknown
    if(url.searchParams.has('q'))body={files}
    else{
      const id=url.pathname.split('/').pop(),file=files.find(file=>file.id===id)
      if(!file){await route.fulfill({status:404,json:{error:{message:'Unexpected fixture request'}}});return}
      if(request.method()==='PATCH'){
        const update=request.postDataJSON();writes.push({path:url.pathname,body:update})
        for(const [key,value] of Object.entries(update.appProperties||{})){if(value===null)delete file.appProperties[key];else file.appProperties[key]=String(value)}
        body={id:file.id}
      }else if(url.searchParams.get('alt')==='media')body={schemaVersion:3,exportedAt:phoneTrip.updatedAt,trip:id==='phone-file'?phoneTrip:oldTrip}
      else body={...file,ownedByMe:true,headRevisionId:'head-'+id,version:'7',parents:['trip-folder'],capabilities:{canEdit:true,canShare:true,canDownload:true}}
    }
    await route.fulfill({json:body,headers:{'Access-Control-Allow-Origin':'*'}})
  })
  await page.goto(scenario.mobile?'/?mobile=1':'/?mobile=0')
  await expect(page.getByRole('button',{name:'Open Waypoint menu'})).toBeVisible()
  await page.evaluate(async({trip,linked})=>{
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('waypoint-trips',4)
      request.onsuccess=()=>{const db=request.result,tx=db.transaction('trips','readwrite');tx.objectStore('trips').clear();tx.objectStore('trips').put({...trip,schemaVersion:3});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}
      request.onerror=()=>reject(request.error)
    })
    if(linked)localStorage.setItem('waypoint-drive-sync',JSON.stringify({[trip.id]:{tripId:trip.id,fileId:'desktop-file',ownedByMe:true,baseTrip:trip,lastSyncedUpdatedAt:trip.updatedAt,lastSynchronizedAt:trip.updatedAt}}))
  },{trip:oldTrip,linked:scenario.linked})
  await page.reload()
  if(scenario.linked){
    const recovery=page.getByRole('region',{name:'Choose the current trip copy'})
    await expect(recovery).toBeVisible()
    const phone=recovery.getByRole('article').filter({hasText:'2 items'})
    await expect(phone.getByText('2026-11-21 — Hard CORE Staff')).toBeVisible()
    expect(writes).toHaveLength(0)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
    await page.screenshot({path:`output/drive-trip-copies-${scenario.mobile?'mobile':'desktop'}.png`,fullPage:true})
    await phone.getByRole('button',{name:'Use this copy on all devices'}).click()
    await expect(recovery).toHaveCount(0)
  }else{
    await page.getByRole('button',{name:'Open Waypoint menu'}).click()
    await page.getByRole('button',{name:/Sync & Share Google Drive/}).click()
    await page.getByRole('button',{name:'Start syncing this trip'}).click()
    await expect(page.getByRole('button',{name:'Stop syncing this trip'})).toBeVisible()
    await page.getByRole('button',{name:'Close Sync & Share'}).click()
  }
  await expect(page.getByRole('heading',{name:'Hard CORE Staff',exact:true})).toBeVisible()
  const records=await page.evaluate(async()=>{
    const trips=await new Promise<any[]>((resolve,reject)=>{
      const request=indexedDB.open('waypoint-trips')
      request.onsuccess=()=>{const db=request.result,tx=db.transaction('trips'),read=tx.objectStore('trips').getAll();tx.oncomplete=()=>{db.close();resolve(read.result)};tx.onerror=()=>reject(tx.error)}
    })
    return {trips,sync:JSON.parse(localStorage.getItem('waypoint-drive-sync')||'{}')}
  })
  expect(records.sync[oldTrip.id].fileId).toBe('phone-file')
  expect(records.trips.find(trip=>trip.id===oldTrip.id).items).toHaveLength(2)
  expect(records.trips.find(trip=>trip.id!==oldTrip.id&&trip.name.includes('local backup')).items).toEqual(oldTrip.items)
  expect(writes).toEqual(scenario.linked?[{path:'/drive/v3/files/phone-file',body:{appProperties:{waypointCanonicalTrip:'true'}}}]:[])
  expect(files).toHaveLength(scenario.linked?2:1)
})
