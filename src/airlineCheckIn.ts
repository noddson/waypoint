import { TripItem } from './types'

export type AirlineCheckInMapping = {
  name: string
  iataCodes: readonly string[]
  checkInUrl: string
  aliases?: readonly string[]
}

export type AirlineCheckInOmission = {
  name: string
  iataCode: string
  reason: string
}

/** Candidates from the original 145-airline list that have no verified web check-in URL. */
export const AIRLINE_CHECK_IN_OMISSIONS: readonly AirlineCheckInOmission[] = [
  {name:'XiamenAir',iataCode:'MF',reason:'No stable official public web check-in URL could be verified.'},
  {name:'Sichuan Airlines',iataCode:'3U',reason:'No stable official public web check-in URL could be verified.'},
  {name:'Spring Airlines',iataCode:'9C',reason:'No stable official public web check-in URL could be verified.'},
  {name:'Lion Air',iataCode:'JT',reason:'Lion Air moved check-in to the BookCabin mobile app and no longer offers web check-in.'},
]

/**
 * Passenger-facing airlines with a confirmed, official online check-in page.
 *
 * A brand can have multiple IATA codes when its regional operating companies use
 * the same check-in flow. Codes are kept uppercase so consumers can also build a
 * lookup map directly from this exported reference array.
 */
export const AIRLINE_CHECK_IN_MAPPINGS: readonly AirlineCheckInMapping[] = [
  // North America (21)
  {name:'Alaska Airlines',iataCodes:['AS'],checkInUrl:'https://reservations.alaskaair.com/checkin',aliases:['Alaska']},
  {name:'Hawaiian Airlines',iataCodes:['HA'],checkInUrl:'https://www.hawaiianairlines.com/manage/check-in',aliases:['Hawaiian']},
  {name:'Allegiant Air',iataCodes:['G4'],checkInUrl:'https://www.allegiantair.com/check-in',aliases:['Allegiant']},
  {name:'American Airlines',iataCodes:['AA'],checkInUrl:'https://www.aa.com/reservation/flightCheckInViewReservationsAccess.do',aliases:['American']},
  {name:'Avelo Airlines',iataCodes:['XP'],checkInUrl:'https://www.aveloair.com/check-in',aliases:['Avelo']},
  {name:'Breeze Airways',iataCodes:['MX'],checkInUrl:'https://www.flybreeze.com/check-in',aliases:['Breeze']},
  {name:'Delta Air Lines',iataCodes:['DL'],checkInUrl:'https://www.delta.com/PCCOciWeb/findBy.action',aliases:['Delta','Delta Airlines']},
  {name:'Frontier Airlines',iataCodes:['F9'],checkInUrl:'https://www.flyfrontier.com/travel/my-trips/check-in/',aliases:['Frontier']},
  {name:'JetBlue',iataCodes:['B6'],checkInUrl:'https://www.jetblue.com/checkin',aliases:['JetBlue Airways']},
  {name:'Southwest Airlines',iataCodes:['WN'],checkInUrl:'https://www.southwest.com/air/check-in/index.html',aliases:['Southwest']},
  {name:'Spirit Airlines',iataCodes:['NK'],checkInUrl:'https://www.spirit.com/check-in',aliases:['Spirit']},
  {name:'Sun Country Airlines',iataCodes:['SY'],checkInUrl:'https://www.suncountry.com/check-in',aliases:['Sun Country']},
  {name:'United Airlines',iataCodes:['UA'],checkInUrl:'https://www.united.com/en/us/checkin',aliases:['United']},
  {name:'Air Canada',iataCodes:['AC'],checkInUrl:'https://www.aircanada.com/home/ca/en/aco/checkin'},
  {name:'Air Transat',iataCodes:['TS'],checkInUrl:'https://www.airtransat.com/en-CA/travel-information/airports-and-check-in/online-check-in'},
  {name:'Flair Airlines',iataCodes:['F8'],checkInUrl:'https://flyflair.com/check-in',aliases:['Flair']},
  {name:'Porter Airlines',iataCodes:['PD'],checkInUrl:'https://www.flyporter.com/en-ca/manage-flights/check-in',aliases:['Porter']},
  {name:'WestJet',iataCodes:['WS'],checkInUrl:'https://www.westjet.com/en-ca/manage/check-in',aliases:['WestJet Airlines']},
  {name:'Aeromexico',iataCodes:['AM','5D'],checkInUrl:'https://www.aeromexico.com/en-gb/check-in',aliases:['Aeromexico Connect','Aeroméxico']},
  {name:'Viva',iataCodes:['VB'],checkInUrl:'https://www.vivaaerobus.com/en-us/manage-your-booking/check-in',aliases:['Viva Aerobus','VivaAerobus']},
  {name:'Volaris',iataCodes:['Y4','Q6','N3'],checkInUrl:'https://www.volaris.com/check-in'},

  // Europe (53)
  {name:'Austrian Airlines',iataCodes:['OS'],checkInUrl:'https://www.austrian.com/ca/en/online-check-in',aliases:['Austrian']},
  {name:'Brussels Airlines',iataCodes:['SN'],checkInUrl:'https://www.brusselsairlines.com/ca/en/check-in-options-and-info/online-check-in'},
  {name:'Bulgaria Air',iataCodes:['FB'],checkInUrl:'https://air.bg/en/online-check-in'},
  {name:'Croatia Airlines',iataCodes:['OU'],checkInUrl:'https://www.croatiaairlines.com/Check-in'},
  {name:'Smartwings',iataCodes:['QS'],checkInUrl:'https://www.smartwings.com/en/check-in'},
  {name:'Finnair',iataCodes:['AY'],checkInUrl:'https://www.finnair.com/en/check-in'},
  {name:'Air France',iataCodes:['AF'],checkInUrl:'https://wwws.airfrance.ca/en/check-in'},
  {name:'Corsair',iataCodes:['SS'],checkInUrl:'https://www.flycorsair.com/en/information/online-check-in'},
  {name:'French bee',iataCodes:['BF'],checkInUrl:'https://www.frenchbee.com/en/manage-my-booking/check-in'},
  {name:'Condor',iataCodes:['DE'],checkInUrl:'https://www.condor.com/us/flight-preparation/check-in/online-check-in.jsp'},
  {name:'Discover Airlines',iataCodes:['4Y'],checkInUrl:'https://www.discover-airlines.com/ca/en/prepare/check-in',aliases:['Discover']},
  {name:'Eurowings',iataCodes:['EW'],checkInUrl:'https://www.eurowings.com/en/information/at-the-airport/check-in.html'},
  {name:'Lufthansa',iataCodes:['LH'],checkInUrl:'https://www.lufthansa.com/ca/en/online-check-in',aliases:['Lufthansa Airlines','Luftansa']},
  {name:'Aegean Airlines',iataCodes:['A3'],checkInUrl:'https://en.aegeanair.com/plan/check-in/',aliases:['Aegean']},
  {name:'SKY express',iataCodes:['GQ'],checkInUrl:'https://www.skyexpress.gr/en/sky-experience/before-fly/check-in',aliases:['Sky Express']},
  {name:'Wizz Air',iataCodes:['W6','W4','W9'],checkInUrl:'https://wizzair.com/en-gb/information-and-services/booking-information/check-in-and-boarding',aliases:['Wizz']},
  {name:'Icelandair',iataCodes:['FI'],checkInUrl:'https://www.icelandair.com/support/pre-flight/check-in/'},
  {name:'Aer Lingus',iataCodes:['EI'],checkInUrl:'https://www.aerlingus.com/prepare/check-in-options/online/'},
  {name:'Ryanair',iataCodes:['FR','RK'],checkInUrl:'https://www.ryanair.com/gb/en/lp/check-in'},
  {name:'Aeroitalia',iataCodes:['XZ'],checkInUrl:'https://www.aeroitalia.com/en/check-in'},
  {name:'ITA Airways',iataCodes:['AZ'],checkInUrl:'https://www.ita-airways.com/en_us/fly-ita/check-in.html',aliases:['ITA']},
  {name:'Neos',iataCodes:['NO'],checkInUrl:'https://www.neosair.com/en/information/web-check-in'},
  {name:'airBaltic',iataCodes:['BT'],checkInUrl:'https://www.airbaltic.com/en/check-in',aliases:['Air Baltic']},
  {name:'Luxair',iataCodes:['LG'],checkInUrl:'https://www.luxair.lu/en/node/146/'},
  {name:'KM Malta Airlines',iataCodes:['KM'],checkInUrl:'https://kmmaltairlines.com/en/check-in',aliases:['KM Malta']},
  {name:'FLYONE',iataCodes:['5F'],checkInUrl:'https://flyone.eu/en/Before-flights/Check-in',aliases:['FlyOne']},
  {name:'HiSky',iataCodes:['H4','H7'],checkInUrl:'https://hisky.aero/en/check-in'},
  {name:'TAROM',iataCodes:['RO'],checkInUrl:'https://www.tarom.ro/en/zboruri-si-rezervari/online-check-in/'},
  {name:'KLM',iataCodes:['KL'],checkInUrl:'https://www.klm.ca/check-in',aliases:['KLM Royal Dutch Airlines']},
  {name:'Transavia',iataCodes:['HV','TO'],checkInUrl:'https://www.transavia.com/help/en-eu/flight/check-in/online-check-in'},
  {name:'Norwegian',iataCodes:['DY','D8'],checkInUrl:'https://www.norwegian.com/uk/travel-info/check-in-and-boarding/online-check-in/',aliases:['Norwegian Air']},
  {name:'Wideroe',iataCodes:['WF'],checkInUrl:'https://www.wideroe.no/en/travel/check-in',aliases:['Widerøe']},
  {name:'LOT Polish Airlines',iataCodes:['LO'],checkInUrl:'https://www.lot.com/ca/en/journey/information-checkin/web-check-in',aliases:['LOT']},
  {name:'Azores Airlines',iataCodes:['S4'],checkInUrl:'https://www.azoresairlines.pt/en/before-boarding/check-in/online?language=en'},
  {name:'TAP Air Portugal',iataCodes:['TP'],checkInUrl:'https://www.flytap.com/en-ca/check-in',aliases:['TAP Portugal','TAP']},
  {name:'SAS',iataCodes:['SK'],checkInUrl:'https://www.flysas.com/ca-en/checkin/',aliases:['Scandinavian Airlines']},
  {name:'Air Serbia',iataCodes:['JU'],checkInUrl:'https://www.airserbia.com/en/info-and-help/check-in/online-check-in'},
  {name:'Air Europa',iataCodes:['UX'],checkInUrl:'https://www.aireuropa.com/us/en/aea/travel-information/passengers/check-in.html'},
  {name:'Binter Canarias',iataCodes:['NT'],checkInUrl:'https://www.bintercanarias.com/eng/check-in',aliases:['Binter']},
  {name:'Iberia',iataCodes:['IB'],checkInUrl:'https://www.iberia.com/us/online-checkin/'},
  {name:'Volotea',iataCodes:['V7'],checkInUrl:'https://www.volotea.com/en/check-in/'},
  {name:'Vueling',iataCodes:['VY'],checkInUrl:'https://tickets.vueling.com/checkin'},
  {name:'Edelweiss Air',iataCodes:['WK'],checkInUrl:'https://www.flyedelweiss.com/ca/en/fly/at-the-airport/check-in.html',aliases:['Edelweiss']},
  {name:'SWISS',iataCodes:['LX'],checkInUrl:'https://www.swiss.com/ca/en/fly/check-in',aliases:['Swiss International Air Lines']},
  {name:'AJet',iataCodes:['VF'],checkInUrl:'https://ajet.com/en/check-in'},
  {name:'Pegasus Airlines',iataCodes:['PC'],checkInUrl:'https://www.flypgs.com/en/travel-glossary/check-in',aliases:['Pegasus']},
  {name:'SunExpress',iataCodes:['XQ'],checkInUrl:'https://www.sunexpress.com/en/information/passenger-info/check-in/'},
  {name:'Turkish Airlines',iataCodes:['TK'],checkInUrl:'https://www.turkishairlines.com/en-int/flights/manage-booking/',aliases:['Turkish']},
  {name:'British Airways',iataCodes:['BA'],checkInUrl:'https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb'},
  {name:'easyJet',iataCodes:['U2','EC','DS'],checkInUrl:'https://www.easyjet.com/en/help/booking-and-check-in/check-in',aliases:['EasyJet']},
  {name:'Jet2',iataCodes:['LS'],checkInUrl:'https://www.jet2.com/en/login',aliases:['Jet2.com']},
  {name:'TUI Airways',iataCodes:['BY','X3','OR','TB'],checkInUrl:'https://www.tui.co.uk/destinations/your-account/managemybooking/login',aliases:['TUI fly','TUI']},
  {name:'Virgin Atlantic',iataCodes:['VS'],checkInUrl:'https://www.virginatlantic.com/PCCOciWeb/findBy'},

  // Asia-Pacific (47 verified; four candidates without a usable web check-in URL are omitted)
  {name:'Air China',iataCodes:['CA'],checkInUrl:'https://et.airchina.com.cn/en/service/check-in/'},
  {name:'China Eastern Airlines',iataCodes:['MU'],checkInUrl:'https://us.ceair.com/en/check-in.html',aliases:['China Eastern']},
  {name:'China Southern Airlines',iataCodes:['CZ'],checkInUrl:'https://www.csair.com/en/online/',aliases:['China Southern']},
  {name:'Hainan Airlines',iataCodes:['HU'],checkInUrl:'https://www.hainanairlines.com/HUPortal/dyn/portal/DisplayPage?COUNTRY_SITE=US&SITE=CBHZCBHZ&LANGUAGE=US&PAGE=CHECKIN'},
  {name:'Shenzhen Airlines',iataCodes:['ZH'],checkInUrl:'https://global.shenzhenair.com/zhair/ibe/common/flightSearch.do?language=en&market=CN'},
  {name:'Juneyao Air',iataCodes:['HO'],checkInUrl:'https://global.juneyaoair.com/checkIn'},
  {name:'Cathay Pacific',iataCodes:['CX'],checkInUrl:'https://www.cathaypacific.com/cx/en_CA/manage-booking/check-in.html',aliases:['Cathay']},
  {name:'Hong Kong Airlines',iataCodes:['HX'],checkInUrl:'https://www.hongkongairlines.com/en_CA/valueadd/online-checkin'},
  {name:'China Airlines',iataCodes:['CI'],checkInUrl:'https://calec.china-airlines.com/olci/'},
  {name:'EVA Air',iataCodes:['BR'],checkInUrl:'https://booking.evaair.com/flyeva/eva/b2c/manage-your-trip/online-checked-in-login.aspx?lang=en-US',aliases:['EVA Airways']},
  {name:'STARLUX Airlines',iataCodes:['JX'],checkInUrl:'https://www.starlux-airlines.com/en-US/check-in',aliases:['Starlux']},
  {name:'ANA',iataCodes:['NH'],checkInUrl:'https://www.ana.co.jp/en/us/travel-information/online-check-in/',aliases:['All Nippon Airways']},
  {name:'Japan Airlines',iataCodes:['JL'],checkInUrl:'https://www.jal.co.jp/jp/en/inter/boarding/quic/',aliases:['JAL']},
  {name:'Peach Aviation',iataCodes:['MM'],checkInUrl:'https://www.flypeach.com/en/lm/ai/airports/how_to_checkin',aliases:['Peach']},
  {name:'Jetstar Japan',iataCodes:['GK'],checkInUrl:'https://www.jetstar.com/au/en/help/checking-in'},
  {name:'Korean Air',iataCodes:['KE'],checkInUrl:'https://www.koreanair.com/check-in'},
  {name:'Asiana Airlines',iataCodes:['OZ'],checkInUrl:'https://flyasiana.com/C/US/EN/contents/online-check-in',aliases:['Asiana']},
  {name:'Jeju Air',iataCodes:['7C'],checkInUrl:'https://www.jejuair.net/en/prepare/checkin/online.do'},
  {name:'Tway Air',iataCodes:['TW'],checkInUrl:'https://www.twayair.com/app/serviceInfo/contents/1148',aliases:["T'way Air"]},
  {name:'Jin Air',iataCodes:['LJ'],checkInUrl:'https://www.jinair.com/ready/webCheckin'},
  {name:'Air India',iataCodes:['AI'],checkInUrl:'https://www.airindia.com/content/air-india/in/en/manage/web-checkin.html'},
  {name:'IndiGo',iataCodes:['6E'],checkInUrl:'https://www.goindigo.in/web-check-in.html'},
  {name:'Akasa Air',iataCodes:['QP'],checkInUrl:'https://www.akasaair.com/check-in'},
  {name:'SpiceJet',iataCodes:['SG'],checkInUrl:'https://book.spicejet.com/SearchWebCheckin.aspx'},
  {name:'Air India Express',iataCodes:['IX'],checkInUrl:'https://www.airindiaexpress.com/check-in'},
  {name:'Biman Bangladesh Airlines',iataCodes:['BG'],checkInUrl:'https://www.biman-airlines.com/#check-in',aliases:['Biman']},
  {name:'SriLankan Airlines',iataCodes:['UL'],checkInUrl:'https://www.srilankan.com/en_uk/plan-and-book/online-check-in',aliases:['SriLankan']},
  {name:'Singapore Airlines',iataCodes:['SQ'],checkInUrl:'https://www.singaporeair.com/checkInSecuredUser.form'},
  {name:'Scoot',iataCodes:['TR'],checkInUrl:'https://checkin.flyscoot.com/'},
  {name:'Malaysia Airlines',iataCodes:['MH'],checkInUrl:'https://www.malaysiaairlines.com/my/en/travel-info/check-in.html'},
  {name:'AirAsia',iataCodes:['AK'],checkInUrl:'https://www.airasia.com/check-in/'},
  {name:'Batik Air Malaysia',iataCodes:['OD'],checkInUrl:'https://www.batikair.com.my/check-in'},
  {name:'Thai Airways',iataCodes:['TG'],checkInUrl:'https://www.thaiairways.com/en_TH/manage/check_in.page'},
  {name:'Thai AirAsia',iataCodes:['FD'],checkInUrl:'https://www.airasia.com/check-in/'},
  {name:'Bangkok Airways',iataCodes:['PG'],checkInUrl:'https://www.bangkokair.com/pages/online-check-in'},
  {name:'Vietnam Airlines',iataCodes:['VN'],checkInUrl:'https://www.vietnamairlines.com/us/en/travel-information/check-in/online-check-in'},
  {name:'VietJet Air',iataCodes:['VJ'],checkInUrl:'https://www.vietjetair.com/en/checkin',aliases:['VietJet']},
  {name:'Philippine Airlines',iataCodes:['PR'],checkInUrl:'https://www.philippineairlines.com/ca/en/check-in-online.html'},
  {name:'Cebu Pacific',iataCodes:['5J'],checkInUrl:'https://www.cebupacificair.com/check-in'},
  {name:'Garuda Indonesia',iataCodes:['GA'],checkInUrl:'https://www.garuda-indonesia.com/id/en/garuda-indonesia-experience/on-ground/check-in/index'},
  {name:'Batik Air',iataCodes:['ID'],checkInUrl:'https://www.batikair.com/en/Checkin'},
  {name:'Royal Brunei Airlines',iataCodes:['BI'],checkInUrl:'https://www.flyroyalbrunei.com/brunei/en/book-manage/online-check-in/',aliases:['Royal Brunei']},
  {name:'Qantas',iataCodes:['QF'],checkInUrl:'https://www.qantas.com/en-gb/manage-booking/check-in'},
  {name:'Virgin Australia',iataCodes:['VA'],checkInUrl:'https://www.virginaustralia.com/au/en/travel-info/bookings/check-in/'},
  {name:'Jetstar',iataCodes:['JQ'],checkInUrl:'https://www.jetstar.com/au/en/help/checking-in'},
  {name:'Air New Zealand',iataCodes:['NZ'],checkInUrl:'https://www.airnewzealand.com/online-check-in'},
  {name:'Fiji Airways',iataCodes:['FJ'],checkInUrl:'https://checkin.si.amadeus.net/1ASIHSSCWEBFJ/sscwfj/checkin?ln=en'},

  // South America, Central America and the Caribbean (20)
  {name:'Aerolineas Argentinas',iataCodes:['AR'],checkInUrl:'https://checkin.aerolineas.com.ar/dx/ARCI/',aliases:['Aerolíneas Argentinas']},
  {name:'Flybondi',iataCodes:['FO'],checkInUrl:'https://flybondi.com/ar/check-in'},
  {name:'LATAM Airlines',iataCodes:['LA'],checkInUrl:'https://www.latamairlines.com/us/en/check-in',aliases:['LATAM']},
  {name:'SKY Airline',iataCodes:['H2'],checkInUrl:'https://www.skyairline.com/check-in'},
  {name:'JetSMART',iataCodes:['JA','J6'],checkInUrl:'https://jetsmart.com/us/en/check-in',aliases:['JetSmart']},
  {name:'JetSMART Argentina',iataCodes:['WJ'],checkInUrl:'https://jetsmart.com/ar/es/check-in'},
  {name:'GOL Airlines',iataCodes:['G3'],checkInUrl:'https://www.voegol.com.br/en-US/nh/inicio',aliases:['GOL Linhas Aereas','GOL']},
  {name:'Azul Brazilian Airlines',iataCodes:['AD'],checkInUrl:'https://www.voeazul.com.br/us/en/home/azulwebcheckin.html',aliases:['Azul']},
  {name:'Boliviana de Aviacion',iataCodes:['OB'],checkInUrl:'https://www.boa.bo/BoAWebSite/Home/CheckIn',aliases:['BoA','Boliviana de Aviación']},
  {name:'Avianca',iataCodes:['AV'],checkInUrl:'https://checkinnew.avianca.com/Check-In?lang=En'},
  {name:'Wingo',iataCodes:['P5'],checkInUrl:'https://www.wingo.com/check-in'},
  {name:'Copa Airlines',iataCodes:['CM'],checkInUrl:'https://www.copaair.com/en-us/',aliases:['Copa']},
  {name:'Arajet',iataCodes:['DM'],checkInUrl:'https://www.arajet.com/en/check-in'},
  {name:'Caribbean Airlines',iataCodes:['BW'],checkInUrl:'https://www.caribbean-airlines.com/#/check-in'},
  {name:'Bahamasair',iataCodes:['UP'],checkInUrl:'https://www.bahamasair.com/'},
  {name:'Cayman Airways',iataCodes:['KX'],checkInUrl:'https://dx.checkin.caymanairways.com/dx/KXCI/'},
  {name:'Surinam Airways',iataCodes:['PY'],checkInUrl:'https://www.flyslm.com/'},
  {name:'LATAM Peru',iataCodes:['LP'],checkInUrl:'https://www.latamairlines.com/us/en/check-in'},
  {name:'LATAM Ecuador',iataCodes:['XL'],checkInUrl:'https://www.latamairlines.com/us/en/check-in'},
  {name:'Avianca Ecuador and Costa Rica',iataCodes:['2K','LR'],checkInUrl:'https://checkinnew.avianca.com/Check-In?lang=En',aliases:['Avianca Ecuador','Avianca Costa Rica']},
]

const byIataCode = new Map(AIRLINE_CHECK_IN_MAPPINGS.flatMap(mapping=>mapping.iataCodes.map(code=>[code,mapping] as const)))
const normalizeProvider = (value:string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim()

export function airlineCodeFromFlightNumber(flightNumber?:string) {
  return flightNumber?.trim().toUpperCase().match(/^([A-Z0-9]{2})(?=\s*-?\s*\d)/)?.[1]
}

export function airlineCheckInForItem(item:Pick<TripItem,'type'|'flightNumber'|'provider'>) {
  if(item.type!=='flight')return undefined
  const code=airlineCodeFromFlightNumber(item.flightNumber)
  if(code&&byIataCode.has(code))return byIataCode.get(code)
  const provider=item.provider&&normalizeProvider(item.provider)
  if(!provider)return undefined
  return AIRLINE_CHECK_IN_MAPPINGS.find(mapping=>[mapping.name,...(mapping.aliases||[])].some(name=>{
    const candidate=normalizeProvider(name)
    return provider===candidate||provider.startsWith(`${candidate} `)||provider.endsWith(` ${candidate}`)
  }))
}
