import { expect, test, type Page } from '@playwright/test'

const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvGQAAAAASUVORK5CYII='
const flight={id:'flight-1',type:'flight',title:'Toronto to London',flightNumber:'AC 854',provider:'Air Canada',confirmation:'ABC123',start:'2026-11-19T18:00',end:'2026-11-20T06:00',timeZone:'America/Toronto',endTimeZone:'Europe/London',status:'confirmed'}
const trip={id:'boarding-pass-trip',name:'Boarding pass test',destination:'London',createdAt:'2026-11-18T12:00:00Z',updatedAt:'2026-11-18T12:00:00Z',items:[flight]}

async function seedLegacyTrip(page:Page,mobile=false){
  await page.goto(mobile?'/?mobile=1':'/?mobile=0')
  await expect(page.getByRole('button',{name:'Open Waypoint menu'})).toBeVisible()
  await page.evaluate(async trip=>{
    await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase('waypoint-trips');r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('waypoint-trips',3)
      request.onupgradeneeded=()=>request.result.createObjectStore('trips',{keyPath:'id'})
      request.onsuccess=()=>{const db=request.result,tx=db.transaction('trips','readwrite');tx.objectStore('trips').put(trip);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}
      request.onerror=()=>reject(request.error)
    })
  },trip)
  await page.reload()
  await expect(page.getByRole('heading',{name:'Toronto to London'})).toBeVisible()
}

async function storedTrip(page:Page){
  return page.evaluate(async()=>new Promise<Record<string,any>>((resolve,reject)=>{
    const request=indexedDB.open('waypoint-trips')
    request.onsuccess=()=>{const db=request.result,tx=db.transaction('trips'),read=tx.objectStore('trips').get('boarding-pass-trip');tx.oncomplete=()=>{db.close();resolve(read.result)};tx.onerror=()=>reject(tx.error)}
    request.onerror=()=>reject(request.error)
  }))
}

test('upgrades a legacy local trip and preserves a linked pass URL and image offline',async({page,context})=>{
  await seedLegacyTrip(page)
  expect(await storedTrip(page)).toMatchObject({id:trip.id,createdAt:trip.createdAt,updatedAt:trip.updatedAt,items:trip.items,schemaVersion:3})
  await page.getByRole('button',{name:'Add boarding pass',exact:true}).click()
  await expect(page.getByLabel('Related flight')).toHaveValue('flight-1')
  await page.getByLabel('Boarding pass URL').fill('https://carrier.example/boarding-pass/private-token')
  await page.getByLabel('Add boarding pass image').setInputFiles({name:'boarding-pass.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')})
  await page.getByRole('button',{name:'Save item',exact:true}).click()
  const card=page.locator('article.boarding-pass')
  await expect(card.getByRole('link',{name:'Open boarding pass ↗'})).toHaveAttribute('href','https://carrier.example/boarding-pass/private-token')
  await expect(card.getByRole('button',{name:'View boarding pass image'})).toBeVisible()
  await page.reload()
  await expect(card).toBeVisible()
  await page.screenshot({path:'/tmp/waypoint-boarding-pass-desktop.png',fullPage:true})
  const saved=await storedTrip(page)
  expect(saved.items[0]).toEqual(expect.objectContaining(flight))
  expect(saved.items[1]).toMatchObject({type:'boarding-pass',relatedItemId:'flight-1',boardingPass:{url:'https://carrier.example/boarding-pass/private-token',image:{name:'boarding-pass.png',dataUrl:`data:image/png;base64,${png}`}}})
  await context.setOffline(true)
  await card.getByRole('button',{name:'View boarding pass image'}).click()
  const viewer=page.getByRole('dialog')
  await expect(viewer).toBeVisible()
  expect(await viewer.locator('img').evaluate((image:HTMLImageElement)=>image.complete&&image.naturalWidth>0)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
})

test('edits personalized and explicit carrier check-in links',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-11-19T12:00:00Z'))
  await seedLegacyTrip(page)
  const checkin=page.getByRole('link',{name:'Check in with Air Canada ↗'})
  await expect(checkin).toHaveAttribute('href','https://www.aircanada.com/home/ca/en/aco/checkin')
  await page.getByRole('heading',{name:'Toronto to London'}).click()
  await page.getByLabel('Passenger last name').fill('Example & Co')
  await page.getByRole('button',{name:'Save item',exact:true}).click()
  await expect(checkin).toHaveAttribute('href','https://checkin.aircanada.com/ac/ssci?ln=en-CA&orderId=ABC123&lastName=Example+%26+Co')
  await page.getByRole('heading',{name:'Toronto to London'}).click()
  await page.getByLabel('Check-in URL (optional)',{exact:true}).fill('https://carrier.example/checkin?booking=direct')
  await page.getByRole('button',{name:'Save item',exact:true}).click()
  await expect(checkin).toHaveAttribute('href','https://carrier.example/checkin?booking=direct')
  await page.reload()
  await expect(checkin).toHaveAttribute('href','https://carrier.example/checkin?booking=direct')
})

test('adds a URL-only boarding pass on a narrow mobile screen',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  await seedLegacyTrip(page,true)
  await page.getByRole('button',{name:'Add boarding pass',exact:true}).click()
  await page.getByLabel('Boarding pass URL').fill('https://carrier.example/mobile-pass')
  await page.screenshot({path:'/tmp/waypoint-boarding-pass-mobile.png',fullPage:true})
  await page.getByRole('button',{name:'Save item',exact:true}).click()
  await expect(page.locator('article.boarding-pass').getByRole('link',{name:'Open boarding pass ↗'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
