import { expect, test, type Page } from '@playwright/test'

async function openActions(page:Page){
  await page.getByRole('button',{name:'Open Waypoint menu'}).click()
  await page.getByRole('button',{name:/Trip Actions/}).click()
}
async function openBuilder(page:Page){
  await openActions(page)
  await page.getByRole('button',{name:'Build email extraction prompt',exact:true}).click()
}

test('imports extraction criteria and saves an edited mailbox window across reloads',async({page})=>{
  await page.goto('/?mobile=0')
  await openActions(page)
  const extractionParameters={tripName:'Airport transfers',destination:'Toronto',travelStart:'2025-07-01',travelEnd:'2025-07-10',emailStart:'2025-01-01',emailEnd:'2025-04-30',people:'Transfer provider',clues:'Airport pickup',searchCategories:{flight:false,train:true}}
  const trip={id:'extraction-test',name:'Airport transfers',destination:'Toronto',createdAt:'2025-01-01T00:00:00Z',updatedAt:'2025-01-01T00:00:00Z',items:[],extractionParameters}
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({name:'transfers.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:2,exportedAt:trip.updatedAt,trip}))})
  await expect(page.getByText('Trip imported as a separate copy. Drive-backed journal media references were omitted.')).toBeVisible()
  // Import closes the trip view but leaves the actions menu open.
  await page.getByRole('button',{name:'Build email extraction prompt',exact:true}).click()
  await expect(page.getByLabel('Search email from')).toHaveValue('2025-01-01')
  await expect(page.getByLabel('Search email through')).toHaveValue('2025-04-30')
  await page.getByLabel('Search email from').fill('2025-05-01')
  await page.getByLabel('Search email through').fill('2025-06-01')
  await page.getByRole('button',{name:'Save search settings',exact:true}).click()
  await expect(page.getByText('Search settings saved for this trip.',{exact:true})).toBeVisible()
  await page.reload()
  await openBuilder(page)
  await expect(page.getByLabel('Search email from')).toHaveValue('2025-05-01')
  await expect(page.getByLabel('Search email through')).toHaveValue('2025-06-01')
  await expect(page.getByLabel('Travellers, possible bookers, and providers')).toHaveValue('Transfer provider')
  await expect(page.getByLabel('Search hints')).toHaveValue('Airport pickup')
  await expect(page.getByRole('checkbox',{name:'Flight',exact:true})).not.toBeChecked()
})
