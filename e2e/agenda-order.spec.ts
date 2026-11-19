import { expect, test } from '@playwright/test'

test('shows untimed items first within each agenda day',async({page})=>{
  const item=(id:string,type:string,start:string,allDay=false)=>({id,type,title:id,start,allDay,timeZone:'America/Toronto',status:'confirmed'})
  const trip={id:'agenda-order',name:'Agenda order',destination:'Toronto',createdAt:'2026-11-18T12:00:00Z',updatedAt:'2026-11-18T12:00:00Z',items:[
    item('Next-day cover','insurance','2026-11-20T12:00',true),
    item('Noon taxi','transport','2026-11-19T12:00'),
    item('Trip cover','insurance','2026-11-19T12:00',true),
    item('Midnight transfer','transport','2026-11-19T00:00'),
    item('Afternoon workshop','event','2026-11-19T14:45'),
    item('Next-day taxi','transport','2026-11-20T08:00'),
  ]}
  await page.goto('/?mobile=0')
  await expect(page.getByRole('button',{name:'Open Waypoint menu'})).toBeVisible()
  await page.evaluate(async trip=>{
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('waypoint-trips',4)
      request.onsuccess=()=>{const db=request.result,tx=db.transaction('trips','readwrite');tx.objectStore('trips').clear();tx.objectStore('trips').put({...trip,schemaVersion:3});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}
      request.onerror=()=>reject(request.error)
    })
    localStorage.setItem('waypoint-weather-display','off')
  },trip)
  await page.reload()
  const days=page.locator('.agenda .day')
  await expect(days).toHaveCount(2)
  await expect(days.nth(0).getByRole('heading',{level:4})).toHaveText(['Trip cover','Midnight transfer','Noon taxi','Afternoon workshop'])
  await expect(days.nth(1).getByRole('heading',{level:4})).toHaveText(['Next-day cover','Next-day taxi'])
  await expect(days.nth(0).locator('article').first().locator('.time')).toContainText('Time not specified')
  await page.screenshot({path:'output/agenda-order-desktop.png',fullPage:true})
})
