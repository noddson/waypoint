import { describe, expect, it } from 'vitest'
import { AIRLINE_CHECK_IN_MAPPINGS, AIRLINE_CHECK_IN_OMISSIONS, airlineCheckInForItem, airlineCodeFromFlightNumber } from './airlineCheckIn'
import { TripItem } from './types'

const flight = (flightNumber?:string,provider?:string):TripItem => ({
  id:flightNumber||provider||'flight',
  type:'flight',
  title:'Origin → destination',
  flightNumber,
  provider,
  start:'2026-08-05T12:00',
  timeZone:'America/Toronto',
  status:'confirmed',
})

describe('airline check-in mappings', () => {
  it('exports the 173 verified airline-brand mappings with unique, valid IATA codes and HTTPS URLs', () => {
    expect(AIRLINE_CHECK_IN_MAPPINGS).toHaveLength(173)
    const codes=AIRLINE_CHECK_IN_MAPPINGS.flatMap(mapping=>mapping.iataCodes)
    expect(new Set(codes).size).toBe(codes.length)
    for(const mapping of AIRLINE_CHECK_IN_MAPPINGS){
      expect(mapping.iataCodes.length).toBeGreaterThan(0)
      expect(mapping.iataCodes.every(code=>/^[A-Z0-9]{2}$/.test(code))).toBe(true)
      expect(new URL(mapping.checkInUrl).protocol).toBe('https:')
    }
  })

  it('documents and excludes candidates without a verified web check-in URL', () => {
    expect(AIRLINE_CHECK_IN_OMISSIONS.flatMap(omission=>omission.iataCodes)).toEqual([
      'SY','HV','TO','MF','3U','9C','LJ','PG','JT','FA','WB','AH','HC','AW','IA','IR',
    ])
    const mappedCodes=AIRLINE_CHECK_IN_MAPPINGS.flatMap(mapping=>mapping.iataCodes)
    expect(AIRLINE_CHECK_IN_OMISSIONS.flatMap(omission=>omission.iataCodes).every(code=>!mappedCodes.includes(code))).toBe(true)
  })

  it.each([
    ['WS 123','WestJet','https://checkin.westjet.com'],
    ['HA 1','Hawaiian Airlines','https://www.hawaiianairlines.com/checkin/'],
    ['G4 2','Allegiant Air','https://www.allegiantair.com/checkin'],
    ['F8 120','Flair Airlines','https://oci.flyflair.com'],
    ['VB 3','Viva','https://www.vivaaerobus.com/en-us/manage/find-booking'],
    ['Y4 4','Volaris','https://cms.volaris.com/en/travel-info/before-your-flight/easy-travel/'],
    ['AC800','Air Canada','https://www.aircanada.com/home/ca/en/aco/checkin'],
    ['LH-470','Lufthansa','https://www.lufthansa.com/ca/en/online-check-in'],
    ['DL 183','Delta Air Lines','https://www.delta.com/PCCOciWeb/app/index.html'],
    ['FI602','Icelandair','https://www.icelandair.com/support/pre-flight/check-in/'],
    ['FR 145','Ryanair','https://www.ryanair.com/gb/en/lp/check-in'],
    ['BA93','British Airways','https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb'],
    ['PD 2240','Porter Airlines','https://www.flyporter.com/en-ca/manage-flights/web-check-in'],
    ['SN 1','Brussels Airlines','https://www.brusselsairlines.com/ca/en/check-in-options-and-info/online-check-in-options'],
    ['OU 2','Croatia Airlines','https://wci.croatiaairlines.hr/web/ck_retrieve'],
    ['QS 3','Smartwings','https://checkin.si.amadeus.net/static/PRD/QS/#/identification?ln=en'],
    ['BF 4','French bee','https://www.frenchbee.com/en/check-in-online'],
    ['DE 5','Condor','https://www.condor.com/tcibe/us/mybooking/login'],
    ['4Y 6','Discover Airlines','https://www.discover-airlines.com/ca/en/my-bookings/check-in/online-check-in'],
    ['EW 7','Eurowings','https://www.eurowings.com/en/my-trip/checkin.html'],
    ['GQ 8','SKY express','https://flights.skyexpress.gr/el/checkin'],
    ['EI 9','Aer Lingus','https://webcheckin.aerlingus.com/html/checkIn/checkin.html'],
    ['XZ 10','Aeroitalia','https://book.aeroitalia.com/check-in-search?culture=en-GB'],
    ['AZ 11','ITA Airways','https://www.ita-airways.com/us/en/manage-my-bookings/manage/check-in'],
    ['KM 12','KM Malta Airlines','https://kmmaltairlines.com/en/'],
    ['H4 13','HiSky','https://hisky.aero/en/'],
    ['DY 14','Norwegian','https://www.norwegian.com/uk/my-travels/'],
    ['LO 15','LOT Polish Airlines','https://www.lot.com/ca/en/check-in'],
    ['S4 16','Azores Airlines','https://www.azoresairlines.pt/en'],
    ['JU 17','Air Serbia','https://www.airserbia.com/en/info-and-help/support/check-in-options'],
    ['UX 18','Air Europa','https://www.aireuropa.com/ve/es/mytrips/checkin'],
    ['NT 19','Binter Canarias','https://www.bintercanarias.com/en/checkinonline'],
    ['WK 20','Edelweiss Air','https://checkin.flyedelweiss.com/web/ck_retrieve'],
    ['LX 21','SWISS','https://www.swiss.com/ca/en/fly/check-in/online-check-in'],
    ['VF 22','AJet','https://ajet.com/en/checkin'],
    ['PC 23','Pegasus Airlines','https://www.flypgs.com/en/useful-info/info-about-flights/check-in'],
    ['XQ 24','SunExpress','https://www.sunexpress.com/en-gb/check-in/login/'],
    ['U2 25','easyJet','https://www.easyjet.com/en/'],
    ['FO 26','Flybondi','https://reserva.flybondi.com/booking/widget?carrier=fo&module=webcheckin'],
    ['H2 27','SKY Airline','https://check-in.skyairline.com/en/chile/'],
    ['JA 28','JetSMART','https://jetsmart.com/cl/es/minisitios/checkin/home'],
    ['WJ 29','JetSMART Argentina','https://jetsmart.com/ar/es/minisitios/checkin/home'],
    ['G3 30','GOL Airlines','https://b2c.voegol.com.br/check-in/?culture=pt-br'],
    ['OB 31','Boliviana de Aviacion','https://www.boa.bo'],
    ['P5 32','Wingo','https://reserva.wingo.com/#/admin/login/es/check-in'],
    ['CM 33','Copa Airlines','https://checkin.copaair.com/'],
    ['BW 34','Caribbean Airlines','https://www.caribbean-airlines.com/#/plan-your-trip/check-in'],
    ['IX 35','Air India Express','https://www.airindiaexpress.com/home'],
    ['UL 36','SriLankan Airlines','https://www.srilankan.com/en_uk/ca#olci'],
    ['OD 37','Batik Air Malaysia','https://www.bookcabin.com/?check-in=1'],
    ['VA 38','Virgin Australia','https://check-in.virginaustralia.com/checkin/index.html'],
    ['JQ 39','Jetstar','https://booking.jetstar.com/mmb/#/login?culture=en-au'],
    ['NZ 40','Air New Zealand','https://flightbookings.airnewzealand.com/vmanage/actions/retrieve/webcheck'],
    ['CA 41','Air China','https://m.airchina.com.cn/ac/c/invoke/overseasWebsite/introduction@pg?registerType=418&channel=Overseas_GB&lang=en_US'],
    ['MU 42','China Eastern Airlines','https://www.ceair.com/en/usd/self-service/before/checkin'],
    ['CZ 43','China Southern Airlines','https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html'],
    ['HU 44','Hainan Airlines','https://www.hainanairlines.com/US/US/Check-in'],
    ['ZH 45','Shenzhen Airlines','https://global.shenzhenair.com/zhair/ibe/bookingManagement/toCheckIn.do'],
    ['HX 46','Hong Kong Airlines','https://new.hongkongairlines.com/hxnewb2c/precheckin/search'],
    ['CI 47','China Airlines','https://airportservice.china-airlines.com/eCheckin/eCheckin_home?country=us&locale=en'],
    ['JL 48','Japan Airlines','https://digital.jal.co.jp/ssci/identification?lang=en-GB'],
    ['GK 49','Jetstar Japan','https://booking.jetstar.com/mmb/#/login?culture=en-au'],
    ['OZ 50','Asiana Airlines','https://flyasiana.com/I/US/EN/CheckIn.do'],
    ['7C 51','Jeju Air','https://wcc.jejuair.net/ko/ibe/checkin/viewCheckin.do'],
    ['TW 52','Tway Air','https://www.twayair.com/app/reservation/searchCheckinItinerary'],
    ['5J 53','Cebu Pacific','https://www.cebupacificair.com/en-PH/CheckIn/Retrieve'],
    ['GA 54','Garuda Indonesia','https://digital.garuda-indonesia.com/ssci/identification'],
    ['ID 55','Batik Air','https://www.bookcabin.com/?check-in=1'],
    ['MS 986','EgyptAir','https://digital.egyptair.com/ssci/identification'],
    ['DT 651','TAAG Angola Airlines','https://digital.flytaag.com/ssci/identification?lang=en-GB'],
    ['UR 521','Uganda Airlines','https://checkin.si.amadeus.net/static/PRD/UR/'],
    ['TC 101','Air Tanzania','https://book-airtanzania.crane.aero/ibe/checkin/search'],
    ['TM 301','LAM Mozambique Airlines','https://www.lam.co.mz'],
    ['SV 110','Saudia','https://www.saudia.com/en-SA/checkIn/checkInoverview/checkInStandAlone'],
    ['G9 421','Air Arabia','https://webcheckin.airarabia.com/accelaero/en/index.html'],
    ['ME 201','Middle East Airlines','https://digital.mea.com.lb/check-in/identification'],
    ['XY 317','flynas','https://www.flynas.com/en'],
    ['3L 101','Air Arabia Abu Dhabi','https://webcheckin.airarabia.com/accelaero/en/index.html'],
    ['LY 8','EL AL','https://www.elal.com/checkin/home/identification/o?language=eng&type=0'],
    ['E2 101','Air Haifa','https://www.airhaifa.com/travelinfo-en/check-in'],
    ['H9 891','Himalaya Airlines','https://book-himalaya-airlines.crane.aero/ibe/checkin/search'],
    ['OM 137','MIAT Mongolian Airlines','https://www.miat.com/en'],
    ['TV 9901','Xizang Airlines','https://www.airxizang.com/stdair/webckipe/allChannelCheckIn?type=baggage'],
  ])('matches %s to %s', (flightNumber,name,url) => {
    expect(airlineCheckInForItem(flight(flightNumber))).toMatchObject({name,checkInUrl:url})
  })

  it('prefers the flight-number code over a conflicting provider name', () => {
    expect(airlineCheckInForItem(flight('WS123','Air Canada'))?.name).toBe('WestJet')
  })

  it('falls back to normalized provider names for legacy flights without a number', () => {
    expect(airlineCheckInForItem(flight(undefined,'Air Canada'))?.iataCodes).toContain('AC')
    expect(airlineCheckInForItem(flight(undefined,'Luftansa Airlines'))?.iataCodes).toContain('LH')
  })

  it('does not map unknown codes, providers, or non-flight items', () => {
    expect(airlineCheckInForItem(flight('ZZ123','Unknown Air'))).toBeUndefined()
    expect(airlineCheckInForItem({...flight('AC800'),type:'event'})).toBeUndefined()
  })

  it.each([
    ['WS123','WS'],
    [' ac 800 ','AC'],
    ['LH-470','LH'],
    ['7C 101','7C'],
    ['6E203','6E'],
  ])('extracts the IATA prefix from %s', (value,code) => {
    expect(airlineCodeFromFlightNumber(value)).toBe(code)
  })
})
