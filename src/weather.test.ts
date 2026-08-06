import { describe, expect, it } from 'vitest'
import { TripItem } from './types'
import { addWeatherDays, formatWeatherTemperature, formatWeatherTemperaturePair, isWeatherForecastDate, parseDailyWeatherResponse, resolveWeatherDisplay, tripWeatherWindow, weatherCountryCode, weatherDescription, weatherPlansForDates, weatherSearchUrl, weatherTargetForDate, weatherTargetFromAddress, weatherTargetsForDate } from './weather'

const item=(id:string,type:TripItem['type'],start:string,location?:string,end?:string,endLocation?:string):TripItem=>({id,type,title:id,start,end,timeZone:'Europe/Dublin',location,endLocation,status:'confirmed'})

describe('itinerary weather planning',()=>{
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

  it('moves the window with today during a trip and removes itinerary weather after the trip',()=>{
    const items=[item('stay','stay','2026-07-10T15:00','Dublin, Ireland','2026-07-30T11:00')]
    const active=tripWeatherWindow(items,'2026-07-20')
    expect(active.state).toBe('active')
    expect(active.anchor).toBe('2026-07-20')
    expect(active.dates[active.dates.length-1]).toBe('2026-07-30')
    expect(tripWeatherWindow(items,'2026-07-31')).toEqual({state:'completed',dates:[]})
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
