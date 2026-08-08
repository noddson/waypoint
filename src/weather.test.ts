import { describe, expect, it } from 'vitest'
import { TripItem } from './types'
import { addWeatherDays, agendaItemWeatherPlans, agendaWeatherPlans, dedupeWeatherPlans, formatWeatherTemperature, formatWeatherTemperaturePair, groupAgendaWeatherPlans, HISTORICAL_WEATHER_START_DATE, isHistoricalWeatherDate, isWeatherForecastDate, parseDailyWeatherResponse, resolveWeatherDisplay, tripWeatherWindow, weatherApiUrl, weatherCountryCode, weatherDescription, weatherPlansForDates, weatherPlansForItem, weatherRequestsForPlans, weatherSearchUrl, weatherTargetForDate, weatherTargetFromAddress, weatherTargetsForDate } from './weather'

const item=(id:string,type:TripItem['type'],start:string,location?:string,end?:string,endLocation?:string):TripItem=>({id,type,title:id,start,end,timeZone:'Europe/Dublin',location,endLocation,status:'confirmed'})

describe('itinerary weather planning',()=>{
  it('does not add journal rows or their dates to weather planning',()=>{
    const stay=item('stay','stay','2026-08-07T14:00','Keewatin, Ontario, Canada','2026-08-08T11:00')
    const journal={...item('journal','journal','2026-09-01T12:00','Winnipeg, Manitoba, Canada'),relatedItemId:stay.id}
    expect(weatherPlansForItem(journal)).toEqual([])
    const dates=tripWeatherWindow([stay,journal],'2026-08-06').dates
    expect(dates[dates.length-1]).toBe('2026-08-08')
  })

  it('anchors an upcoming forecast to the trip start without using the device location',()=>{
    const items=[
      item('outbound','flight','2026-07-18T20:50','Toronto Pearson International Airport (YYZ), Toronto, Canada','2026-07-19T08:15','Dublin Airport (DUB), Dublin, Ireland'),
      item('hotel','stay','2026-07-19T15:00','Maldron Hotel, Dublin 8, Ireland','2026-07-31T11:00'),
      item('return','flight','2026-08-01T09:20','Dublin Airport (DUB), Dublin, Ireland','2026-08-01T11:25','Toronto Pearson International Airport (YYZ), Toronto, Canada'),
    ]
    const window=tripWeatherWindow(items,'2026-07-16')
    expect(window.state).toBe('upcoming')
    expect(window.anchor).toBe('2026-07-18')
    expect(window.dates).toHaveLength(14)
    expect(weatherTargetForDate(items,'2026-07-19')?.label).toBe('Dublin')
  })

  it('moves the window with today during a trip and exposes historical dates after the trip',()=>{
    const items=[item('stay','stay','2026-07-10T15:00','Dublin, Ireland','2026-07-30T11:00')]
    const active=tripWeatherWindow(items,'2026-07-20')
    expect(active.state).toBe('active')
    expect(active.anchor).toBe('2026-07-20')
    expect(active.dates[active.dates.length-1]).toBe('2026-07-30')
    const completed=tripWeatherWindow(items,'2026-07-31')
    expect(completed.state).toBe('completed')
    expect(completed.dates[0]).toBe('2026-07-10')
    expect(completed.dates[completed.dates.length-1]).toBe('2026-07-30')
  })

  it('does not expose historical weather before provider coverage begins',()=>{
    const oldTrip=[item('stay','stay','2021-07-10T15:00','Dublin, Ireland','2021-07-20T11:00')]
    expect(HISTORICAL_WEATHER_START_DATE).toBe('2022-01-01')
    expect(tripWeatherWindow(oldTrip,'2021-07-21')).toEqual({state:'completed',dates:[]})
    expect(isHistoricalWeatherDate('2021-12-31','2026-08-06')).toBe(false)
    expect(isHistoricalWeatherDate('2022-01-01','2026-08-06')).toBe(true)
  })

  it('limits the weather window to fourteen itinerary days',()=>{
    const items=[item('stay','stay','2026-09-01T15:00','Dublin, Ireland','2026-10-01T11:00')]
    const window=tripWeatherWindow(items,'2026-08-20')
    expect(window.dates).toHaveLength(14)
    expect(window.dates[0]).toBe('2026-09-01')
    expect(window.dates[window.dates.length-1]).toBe('2026-09-14')
  })

  it('follows itinerary cities across a single ground section',()=>{
    const items=[
      item('dublin-stay','stay','2026-07-19T15:00','Dublin 8, Ireland','2026-07-22T09:00'),
      item('belfast-stay','stay','2026-07-22T15:00','Belfast, Northern Ireland','2026-07-25T09:00'),
      item('galway-stay','stay','2026-07-25T15:00','Galway, Ireland','2026-07-28T09:00'),
    ]
    const dates=['2026-07-20','2026-07-23','2026-07-26']
    expect(weatherPlansForDates(items,dates).map(plan=>plan.target.label)).toEqual(['Dublin','Belfast','Galway'])
  })

  it('uses an itinerary event location for a regional day trip and the stay on quiet days',()=>{
    const items=[
      item('hotel','stay','2026-07-19T15:00','Dublin 8, Ireland','2026-07-25T09:00'),
      item('day-trip','event','2026-07-22T10:00','Titanic Belfast, Belfast, Northern Ireland'),
    ]
    expect(weatherTargetForDate(items,'2026-07-21')?.label).toBe('Dublin')
    expect(weatherTargetForDate(items,'2026-07-22')?.label).toBe('Belfast')
    expect(weatherTargetForDate(items,'2026-07-23')?.label).toBe('Dublin')
  })

  it('uses the final flight arrival on an arrival day',()=>{
    const items=[item('outbound','flight','2026-07-18T20:50','Toronto Pearson International Airport (YYZ), Toronto, Canada','2026-07-19T08:15','Dublin Airport (DUB), Dublin, Ireland')]
    expect(weatherTargetForDate(items,'2026-07-18')?.label).toBe('Toronto')
    expect(weatherTargetForDate(items,'2026-07-19')?.label).toBe('Dublin')
  })

  it('uses one day-level location unless that itinerary day spans distinct places',()=>{
    const items=[
      item('hotel','stay','2026-07-19T15:00','Dublin 8, Ireland','2026-07-25T10:00'),
      item('museum','event','2026-07-20T10:00','National Museum, Dublin, Ireland'),
      item('day-trip','event','2026-07-21T10:00','Titanic Belfast, Belfast, Northern Ireland'),
    ]
    expect(weatherTargetsForDate(items,'2026-07-20').map(target=>target.label)).toEqual(['Dublin'])
    expect(weatherTargetsForDate(items,'2026-07-21').map(target=>target.label)).toEqual(['Dublin','Belfast'])
  })

  it('orders same-day weather locations by itinerary time',()=>{
    const items=[
      item('flight','flight','2026-08-07T09:35','Toronto Pearson International Airport (YYZ), Toronto, Canada','2026-08-07T11:15','Winnipeg Richardson International Airport (YWG), Winnipeg, Canada'),
      item('stay','stay','2026-08-07T14:00','320 McLean Ave, Keewatin, ON, Canada','2026-08-14T11:00'),
    ]
    expect(weatherTargetsForDate(items,'2026-08-07').map(target=>target.label)).toEqual(['Toronto','Winnipeg','Keewatin'])
  })

  it('limits filtered agenda weather to the entries represented by that filter',()=>{
    const items=[
      item('flight','flight','2026-08-07T09:35','Toronto Pearson International Airport (YYZ), Toronto, Canada','2026-08-07T11:15','Winnipeg Richardson International Airport (YWG), Winnipeg, Canada'),
      item('stay','stay','2026-08-07T14:00','320 McLean Ave, Keewatin, ON, Canada','2026-08-14T11:00'),
    ]
    const labels=(visible:TripItem[])=>agendaWeatherPlans(visible,['2026-08-07'],['2026-08-07'],'2026-08-06').map(plan=>plan.target.label)
    expect(labels(items)).toEqual(['Toronto','Winnipeg','Keewatin'])
    expect(labels(items.filter(value=>value.type==='flight'))).toEqual(['Toronto','Winnipeg'])
    expect(labels(items.filter(value=>value.type==='stay'))).toEqual(['Keewatin'])
  })

  it('keeps both endpoint dates on an overnight flight entry',()=>{
    const flight=item('outbound','flight','2026-07-18T20:50','Toronto Pearson International Airport (YYZ), Toronto, Canada','2026-07-19T08:15','Dublin Airport (DUB), Dublin, Ireland')
    expect(weatherPlansForItem(flight).map(plan=>[plan.agendaDate,plan.date,plan.target.label])).toEqual([
      ['2026-07-18','2026-07-18','Toronto'],
      ['2026-07-18','2026-07-19','Dublin'],
    ])
    expect(agendaItemWeatherPlans([flight],['2026-07-19'],'2026-07-19').map(plan=>[plan.date,plan.target.label])).toEqual([
      ['2026-07-18','Toronto'],
      ['2026-07-19','Dublin'],
    ])
  })

  it('keeps both endpoints on ground transport without an end timestamp',()=>{
    const taxi=item('taxi','transport','2026-07-18T17:00','516 Hallmark Drive, Waterloo, Ontario, Canada',undefined,'Toronto Pearson International Airport (YYZ), Toronto, Canada')
    expect(weatherPlansForItem(taxi).map(plan=>[plan.agendaDate,plan.date,plan.target.label])).toEqual([
      ['2026-07-18','2026-07-18','Waterloo'],
      ['2026-07-18','2026-07-18','Toronto'],
    ])
  })

  it('uses one item-scoped weather location for a stay',()=>{
    const stay=item('stay','stay','2026-08-07T14:00','320 McLean Ave, Keewatin, ON, Canada','2026-08-14T11:00')
    expect(weatherPlansForItem(stay).map(plan=>[plan.agendaDate,plan.date,plan.target.label])).toEqual([
      ['2026-08-07','2026-08-07','Keewatin'],
    ])
  })

  it('handles optional endpoints, equivalent places, and non-location entries',()=>{
    const locationOnly=item('location-only','transport','2026-08-01T09:00','Waterloo, Ontario, Canada')
    const endOnly=item('end-only','transport','2026-08-01T10:00',undefined,undefined,'Toronto, Ontario, Canada')
    const noEndpoints=item('no-endpoints','event','2026-08-01T11:00')
    const samePlace=item('same-place','transport','2026-08-01T12:00','Toronto Pearson International Airport (YYZ), Toronto, Canada',undefined,'Toronto, Ontario, Canada')
    const insurance=item('insurance','insurance','2026-08-01T13:00','Waterloo, Ontario, Canada',undefined,'Toronto, Ontario, Canada')

    expect(weatherPlansForItem(locationOnly).map(plan=>plan.target.label)).toEqual(['Waterloo'])
    expect(weatherPlansForItem(endOnly).map(plan=>plan.target.label)).toEqual(['Toronto'])
    expect(weatherPlansForItem(noEndpoints)).toEqual([])
    expect(weatherPlansForItem(samePlace).map(plan=>[plan.target.label,plan.target.countryCode])).toEqual([['Toronto','CA']])
    expect(weatherPlansForItem(insurance)).toEqual([])
  })

  it('deduplicates qualified and unqualified versions of the same desktop weather place',()=>{
    const unqualified=weatherPlansForItem(item('event','event','2026-08-01T09:00','Toronto'))[0]
    const qualified=weatherPlansForItem(item('flight','flight','2026-08-01T10:00','Toronto, Ontario, Canada',undefined,'Winnipeg, Manitoba, Canada'))
    expect(dedupeWeatherPlans([unqualified,...qualified,{...qualified[0],date:'2026-08-02'}]).map(plan=>[plan.date,plan.target.label,plan.target.countryCode])).toEqual([
      ['2026-08-01','Toronto','CA'],
      ['2026-08-01','Winnipeg','CA'],
      ['2026-08-02','Toronto','CA'],
    ])
  })

  it('normalizes airport, street, and venue addresses before desktop weather deduplication',()=>{
    expect(weatherTargetFromAddress('Calgary International Airport (YYC), 2000 Airport Road NE, Calgary, AB T2E 6W5')?.label).toBe('Calgary')
    expect(weatherTargetFromAddress('Online')).toBeUndefined()

    const addresses=[
      'Winnipeg James Armstrong Richardson International Airport (YWG)',
      'Winnipeg, Manitoba, Canada',
      'LaGuardia Airport (LGA), New York',
      'Hotel Beacon, 2130 Broadway at 75th Street, New York, NY 10023',
      'Beacon Theatre, 2124 Broadway, New York, NY 10023',
      'Daniel K. Inouye International Airport (HNL)',
      'Honolulu, HI 96815',
    ]
    expect(addresses.map(address=>weatherTargetFromAddress(address)?.label)).toEqual([
      'Winnipeg','Winnipeg','New York','New York','New York','Honolulu','Honolulu',
    ])
    const plans=addresses.map((address,index)=>weatherPlansForItem(item(String(index),'event','2026-08-01T09:00',address))[0]).filter(Boolean)
    expect(dedupeWeatherPlans(plans).map(plan=>plan.target.label)).toEqual(['Winnipeg','New York','Honolulu'])
  })

  it('keeps itinerary chronology when item-scoped plans supplement desktop day plans',()=>{
    const date='2026-01-09',items=[
      item('stay','stay','2026-01-03T16:00','Banff Centre for Arts and Creativity, 107 Tunnel Mountain Drive, Banff, AB T1L 1H5','2026-01-09T11:00'),
      item('return','car',`${date}T09:54`,'Calgary International Airport, 2000 Airport Road Northeast, Calgary, Alberta'),
      item('flight','flight',`${date}T15:05`,'Calgary International Airport (YYC)',`${date}T20:49`,'Toronto Pearson International Airport (YYZ), Terminal 1'),
    ]
    const dayPlans=agendaWeatherPlans(items,[date],[date],'2026-08-06')
    const itemPlans=agendaItemWeatherPlans(items,[date],'2026-08-06')
    expect(groupAgendaWeatherPlans(dayPlans,itemPlans).get(date)?.map(plan=>plan.target.label)).toEqual(['Banff','Calgary','Toronto'])

    const westCoastItems=[
      item('whistler','stay','2022-05-31T16:00','Pan Pacific Whistler Village Centre, Whistler, BC','2022-06-03T11:00'),
      item('vancouver','stay','2022-06-03T18:00','1601 Bayshore Drive, Vancouver, BC V6G 2V4','2022-06-05T11:00'),
    ]
    const westCoastDate='2022-06-03',westCoastDays=agendaWeatherPlans(westCoastItems,[westCoastDate],[westCoastDate],'2026-08-06'),westCoastItemsPlans=agendaItemWeatherPlans(westCoastItems,[westCoastDate],'2026-08-06')
    expect(groupAgendaWeatherPlans(westCoastDays,westCoastItemsPlans).get(westCoastDate)?.map(plan=>plan.target.label)).toEqual(['Whistler','Vancouver'])
  })

  it('rolls an active ongoing stay item forward to today',()=>{
    const items=[
      item('stay','stay','2026-08-07T14:00','Keewatin, ON, Canada','2026-08-14T11:00'),
      item('event','event','2026-08-10T10:00','Winnipeg, MB, Canada'),
    ]
    expect(agendaItemWeatherPlans(items,['2026-08-09','2026-08-10'],'2026-08-09').map(plan=>[plan.itemId,plan.agendaDate,plan.date,plan.target.label])).toEqual([
      ['stay','2026-08-07','2026-08-09','Keewatin'],
      ['event','2026-08-10','2026-08-10','Winnipeg'],
    ])
  })

  it('collapses return-day airport details into distinct itinerary cities',()=>{
    const items=[
      item('car-return','car','2026-08-01T09:05','Budget Dublin North Office, 151 Lower Drumcondra Road, Dublin 9, Ireland'),
      item('flight','flight','2026-08-01T09:20','Dublin Airport (DUB), Terminal 1','2026-08-01T11:25','Toronto Pearson International Airport (YYZ), Terminal 1'),
      item('taxi','transport','2026-08-01T11:55','Toronto Pearson International Airport (YYZ), Terminal 1, pre-arranged taxi and limo kiosk near Door A',undefined,'516 Hallmark Drive, Waterloo, Ontario, Canada'),
    ]
    expect(weatherTargetsForDate(items,'2026-08-01').map(target=>target.label)).toEqual(['Dublin','Toronto','Waterloo'])
  })

  it('keeps same-name cities separate when their countries are known to differ',()=>{
    const items=[
      item('ontario','event','2026-08-01T09:00','London, Ontario, Canada'),
      item('england','event','2026-08-01T15:00','London, England'),
    ]
    expect(weatherTargetsForDate(items,'2026-08-01').map(target=>[target.label,target.countryCode])).toEqual([['London','CA'],['London','GB']])
  })

  it('keeps forecasts on itinerary rows and rolls an active multi-day stay forward to today',()=>{
    const items=[
      item('stay','stay','2026-08-07T14:00','Keewatin, ON, Canada','2026-08-14T11:00'),
      item('event','event','2026-08-10T10:00','Winnipeg, MB, Canada'),
    ]
    const agendaDates=['2026-08-07','2026-08-10']
    const upcoming=agendaWeatherPlans(items,agendaDates,['2026-08-07','2026-08-08','2026-08-09','2026-08-10'],'2026-08-06')
    expect([...new Set(upcoming.map(plan=>plan.agendaDate))]).toEqual(agendaDates)
    expect([...new Set(upcoming.map(plan=>plan.date))]).toEqual(agendaDates)

    const active=agendaWeatherPlans(items,agendaDates,['2026-08-09','2026-08-10'],'2026-08-09')
    expect(active.map(plan=>[plan.agendaDate,plan.date,plan.target.label])).toEqual([
      ['2026-08-07','2026-08-09','Keewatin'],
      ['2026-08-10','2026-08-10','Keewatin'],
      ['2026-08-10','2026-08-10','Winnipeg'],
    ])
  })
})

describe('weather locations and links',()=>{
  it('uses country hints to disambiguate itinerary cities',()=>{
    expect(weatherCountryCode('Dublin 8, Ireland')).toBe('IE')
    expect(weatherCountryCode('Belfast, Northern Ireland')).toBe('GB')
    expect(weatherCountryCode('Kahuku, HI 96731')).toBe('US')
    expect(weatherCountryCode('Waterloo, ON N2L 3G1')).toBe('CA')
  })

  it('turns airport addresses into their itinerary city rather than a device position',()=>{
    expect(weatherTargetFromAddress('Dublin Airport (DUB), Dublin, Ireland')).toMatchObject({label:'Dublin',countryCode:'IE'})
    expect(weatherTargetFromAddress('Toronto Pearson International Airport (YYZ), Toronto, Ontario, Canada')).toMatchObject({label:'Toronto',countryCode:'CA'})
    expect(weatherTargetFromAddress('Dublin Airport (DUB), Terminal 1')).toMatchObject({label:'Dublin'})
    expect(weatherTargetFromAddress('Toronto Pearson International Airport (YYZ), Terminal 1, pre-arranged taxi and limo kiosk near Door A')).toMatchObject({label:'Toronto'})
  })

  it('keeps the city ahead of a county or similarly named region',()=>{
    expect(weatherTargetFromAddress('Rock of Cashel, Cashel, County Tipperary, Ireland')?.label).toBe('Cashel')
    expect(weatherTargetFromAddress('Butcher Street, Derry, Londonderry, Northern Ireland, BT48 6HL')?.label).toBe('Derry')
  })

  it('creates a dated weather-search link for the displayed itinerary location',()=>{
    const target=weatherTargetFromAddress('Dublin 8, Ireland')!
    const url=new URL(weatherSearchUrl(target,'2026-07-19'))
    expect(url.hostname).toBe('www.google.com')
    expect(url.searchParams.get('q')).toContain('Dublin')
    expect(url.searchParams.get('q')).toContain('2026-07-19')
  })

  it('uses the real provider horizon for live forecast requests',()=>{
    expect(addWeatherDays('2026-07-16',15)).toBe('2026-07-31')
    expect(isWeatherForecastDate('2026-07-31','2026-07-16')).toBe(true)
    expect(isWeatherForecastDate('2026-08-01','2026-07-16')).toBe(false)
  })

  it('selects the historical archive and requested trip dates for completed plans',()=>{
    const target=weatherTargetFromAddress('Dublin 8, Ireland')!,date='2023-07-19'
    const [request]=weatherRequestsForPlans([{agendaDate:date,date,target}],'2026-08-06')
    const url=weatherApiUrl(request,{latitude:53.3498,longitude:-6.2603})
    expect(request).toMatchObject({source:'historical',startDate:date,endDate:date})
    expect(url.hostname).toBe('historical-forecast-api.open-meteo.com')
    expect(url.searchParams.get('start_date')).toBe(date)
    expect(url.searchParams.get('end_date')).toBe(date)
    expect(url.searchParams.has('forecast_days')).toBe(false)
  })

  it('keeps upcoming plans on the live forecast endpoint',()=>{
    const target=weatherTargetFromAddress('Dublin 8, Ireland')!,date='2026-08-10'
    const [request]=weatherRequestsForPlans([{agendaDate:date,date,target}],'2026-08-06')
    const url=weatherApiUrl(request,{latitude:53.3498,longitude:-6.2603})
    expect(request.source).toBe('forecast')
    expect(url.hostname).toBe('api.open-meteo.com')
    expect(url.searchParams.get('forecast_days')).toBe('16')
    expect(url.searchParams.has('start_date')).toBe(false)
  })

  it('maps WMO weather codes to readable conditions',()=>{
    expect(weatherDescription(0)).toEqual({icon:'☀️',label:'Clear'})
    expect(weatherDescription(63).label).toBe('Rain')
    expect(weatherDescription(95).label).toBe('Thunderstorms')
  })

  it('formats temperatures in Celsius, Fahrenheit, and the Kelvin joke option',()=>{
    expect(formatWeatherTemperature(20,'celsius')).toBe('20°C')
    expect(formatWeatherTemperature(20,'fahrenheit')).toBe('68°F')
    expect(formatWeatherTemperature(20,'kelvin')).toBe('293 K')
    expect(formatWeatherTemperaturePair(20,10,'celsius')).toBe('20° / 10°C')
    expect(formatWeatherTemperaturePair(20,10,'fahrenheit')).toBe('68° / 50°F')
    expect(formatWeatherTemperaturePair(20,10,'kelvin')).toBe('293 / 283 K')
  })

  it('migrates separate legacy weather settings into the consolidated choice',()=>{
    expect(resolveWeatherDisplay(null,'false','fahrenheit')).toBe('off')
    expect(resolveWeatherDisplay(null,null,'kelvin')).toBe('kelvin')
    expect(resolveWeatherDisplay('fahrenheit','false','kelvin')).toBe('fahrenheit')
  })

  it('keeps valid forecast days when a provider leaves the uncertain final day null',()=>{
    const days=parseDailyWeatherResponse({daily:{
      time:['2026-08-20','2026-08-21'],
      weather_code:[51,null],
      temperature_2m_max:[18.3,null],
      temperature_2m_min:[12.2,null],
      precipitation_probability_max:[48,null],
      wind_speed_10m_max:[20.5,null],
    }})
    expect([...days.keys()]).toEqual(['2026-08-20'])
    expect(days.get('2026-08-20')).toMatchObject({code:51,high:18.3,low:12.2,precipitationProbability:48})
  })
})
