import { TripItem } from './types'

export type AirlineCheckInMapping = {
  name: string
  iataCodes: readonly string[]
  checkInUrl: string
  aliases?: readonly string[]
}

export type AirlineCheckInOmission = {
  name: string
  iataCodes: readonly string[]
  reason: string
}

/** Reviewed candidates that are intentionally excluded because no usable web check-in URL is mapped. */
export const AIRLINE_CHECK_IN_OMISSIONS: readonly AirlineCheckInOmission[] = [
  {name:'Sun Country Airlines',iataCodes:['SY'],reason:'No working official public web check-in URL is currently available.'},
  {name:'Transavia',iataCodes:['HV','TO'],reason:'Removed because no working check-in destination is currently mapped.'},
  {name:'XiamenAir',iataCodes:['MF'],reason:'No stable official public web check-in URL could be verified.'},
  {name:'Sichuan Airlines',iataCodes:['3U'],reason:'No stable official public web check-in URL could be verified.'},
  {name:'Spring Airlines',iataCodes:['9C'],reason:'No stable official public web check-in URL could be verified.'},
  {name:'Jin Air',iataCodes:['LJ'],reason:'Removed because no working check-in destination is currently mapped.'},
  {name:'Bangkok Airways',iataCodes:['PG'],reason:'Removed because no working check-in destination is currently mapped.'},
  {name:'Lion Air',iataCodes:['JT'],reason:'Lion Air moved check-in to the BookCabin mobile app and no longer offers web check-in.'},
  {name:'FlySafair',iataCodes:['FA'],reason:'Removed because no stable direct web check-in form URL could be verified.'},
  {name:'RwandAir',iataCodes:['WB'],reason:'Removed because no official booking-reference check-in page could be verified.'},
  {name:'Air Algerie',iataCodes:['AH'],reason:'Removed because no stable, inspectable official check-in URL could be verified.'},
  {name:'Air Senegal',iataCodes:['HC'],reason:'Removed because only airport check-in guidance, not an online check-in form, could be verified.'},
  {name:'Africa World Airlines',iataCodes:['AW'],reason:'Removed because no online check-in form could be verified.'},
  {name:'Iraqi Airways',iataCodes:['IA'],reason:'Removed because no stable booking-reference check-in URL could be verified.'},
  {name:'Iran Air',iataCodes:['IR'],reason:'Removed because no functioning official online check-in form could be verified.'},
]

/**
 * Passenger-facing airlines with a confirmed, official online check-in page.
 *
 * A brand can have multiple IATA codes when its regional operating companies use
 * the same check-in flow. Codes are kept uppercase so consumers can also build a
 * lookup map directly from this exported reference array.
 */
export const AIRLINE_CHECK_IN_MAPPINGS: readonly AirlineCheckInMapping[] = [
  // North America (20 verified; Sun Country is omitted because its check-in URL does not work)
  {name:'Alaska Airlines',iataCodes:['AS'],checkInUrl:'https://reservations.alaskaair.com/checkin',aliases:['Alaska']},
  {name:'Hawaiian Airlines',iataCodes:['HA'],checkInUrl:'https://www.hawaiianairlines.com/checkin/',aliases:['Hawaiian']},
  {name:'Allegiant Air',iataCodes:['G4'],checkInUrl:'https://www.allegiantair.com/checkin',aliases:['Allegiant']},
  {name:'American Airlines',iataCodes:['AA'],checkInUrl:'https://www.aa.com/reservation/flightCheckInViewReservationsAccess.do',aliases:['American']},
  {name:'Avelo Airlines',iataCodes:['XP'],checkInUrl:'https://www.aveloair.com/check-in',aliases:['Avelo']},
  {name:'Breeze Airways',iataCodes:['MX'],checkInUrl:'https://www.flybreeze.com/check-in',aliases:['Breeze']},
  {name:'Delta Air Lines',iataCodes:['DL'],checkInUrl:'https://www.delta.com/PCCOciWeb/app/index.html',aliases:['Delta','Delta Airlines']},
  {name:'Frontier Airlines',iataCodes:['F9'],checkInUrl:'https://www.flyfrontier.com/travel/my-trips/check-in/',aliases:['Frontier']},
  {name:'JetBlue',iataCodes:['B6'],checkInUrl:'https://www.jetblue.com/checkin',aliases:['JetBlue Airways']},
  {name:'Southwest Airlines',iataCodes:['WN'],checkInUrl:'https://www.southwest.com/air/check-in/index.html',aliases:['Southwest']},
  {name:'Spirit Airlines',iataCodes:['NK'],checkInUrl:'https://www.spirit.com/check-in',aliases:['Spirit']},
  {name:'United Airlines',iataCodes:['UA'],checkInUrl:'https://www.united.com/en/us/checkin',aliases:['United']},
  {name:'Air Canada',iataCodes:['AC'],checkInUrl:'https://www.aircanada.com/home/ca/en/aco/checkin'},
  {name:'Air Transat',iataCodes:['TS'],checkInUrl:'https://www.airtransat.com/en-CA/travel-information/airports-and-check-in/online-check-in'},
  {name:'Flair Airlines',iataCodes:['F8'],checkInUrl:'https://oci.flyflair.com',aliases:['Flair']},
  {name:'Porter Airlines',iataCodes:['PD'],checkInUrl:'https://www.flyporter.com/en-ca/manage-flights/web-check-in',aliases:['Porter']},
  {name:'WestJet',iataCodes:['WS'],checkInUrl:'https://checkin.westjet.com',aliases:['WestJet Airlines']},
  {name:'Aeromexico',iataCodes:['AM','5D'],checkInUrl:'https://www.aeromexico.com/en-gb/check-in',aliases:['Aeromexico Connect','Aeroméxico']},
  {name:'Viva',iataCodes:['VB'],checkInUrl:'https://www.vivaaerobus.com/en-us/manage/find-booking',aliases:['Viva Aerobus','VivaAerobus']},
  {name:'Volaris',iataCodes:['Y4','Q6','N3'],checkInUrl:'https://cms.volaris.com/en/travel-info/before-your-flight/easy-travel/'},

  // Europe (52 verified; Transavia is omitted)
  {name:'Austrian Airlines',iataCodes:['OS'],checkInUrl:'https://www.austrian.com/ca/en/online-check-in',aliases:['Austrian']},
  {name:'Brussels Airlines',iataCodes:['SN'],checkInUrl:'https://www.brusselsairlines.com/ca/en/check-in-options-and-info/online-check-in-options'},
  {name:'Bulgaria Air',iataCodes:['FB'],checkInUrl:'https://air.bg/en/online-check-in'},
  {name:'Croatia Airlines',iataCodes:['OU'],checkInUrl:'https://wci.croatiaairlines.hr/web/ck_retrieve'},
  {name:'Smartwings',iataCodes:['QS'],checkInUrl:'https://checkin.si.amadeus.net/static/PRD/QS/#/identification?ln=en'},
  {name:'Finnair',iataCodes:['AY'],checkInUrl:'https://www.finnair.com/en/check-in'},
  {name:'Air France',iataCodes:['AF'],checkInUrl:'https://wwws.airfrance.ca/en/check-in'},
  {name:'Corsair',iataCodes:['SS'],checkInUrl:'https://www.flycorsair.com/en/information/online-check-in'},
  {name:'French bee',iataCodes:['BF'],checkInUrl:'https://www.frenchbee.com/en/check-in-online'},
  {name:'Condor',iataCodes:['DE'],checkInUrl:'https://www.condor.com/tcibe/us/mybooking/login'},
  {name:'Discover Airlines',iataCodes:['4Y'],checkInUrl:'https://www.discover-airlines.com/ca/en/my-bookings/check-in/online-check-in',aliases:['Discover']},
  {name:'Eurowings',iataCodes:['EW'],checkInUrl:'https://www.eurowings.com/en/my-trip/checkin.html'},
  {name:'Lufthansa',iataCodes:['LH'],checkInUrl:'https://www.lufthansa.com/ca/en/online-check-in',aliases:['Lufthansa Airlines','Luftansa']},
  {name:'Aegean Airlines',iataCodes:['A3'],checkInUrl:'https://en.aegeanair.com/plan/check-in/',aliases:['Aegean']},
  {name:'SKY express',iataCodes:['GQ'],checkInUrl:'https://flights.skyexpress.gr/el/checkin',aliases:['Sky Express']},
  {name:'Wizz Air',iataCodes:['W6','W4','W9'],checkInUrl:'https://wizzair.com/en-gb/information-and-services/booking-information/check-in-and-boarding',aliases:['Wizz']},
  {name:'Icelandair',iataCodes:['FI'],checkInUrl:'https://www.icelandair.com/support/pre-flight/check-in/'},
  {name:'Aer Lingus',iataCodes:['EI'],checkInUrl:'https://webcheckin.aerlingus.com/html/checkIn/checkin.html'},
  {name:'Ryanair',iataCodes:['FR','RK'],checkInUrl:'https://www.ryanair.com/gb/en/lp/check-in'},
  {name:'Aeroitalia',iataCodes:['XZ'],checkInUrl:'https://book.aeroitalia.com/check-in-search?culture=en-GB'},
  {name:'ITA Airways',iataCodes:['AZ'],checkInUrl:'https://www.ita-airways.com/us/en/manage-my-bookings/manage/check-in',aliases:['ITA']},
  {name:'Neos',iataCodes:['NO'],checkInUrl:'https://www.neosair.com/en/information/web-check-in'},
  {name:'airBaltic',iataCodes:['BT'],checkInUrl:'https://www.airbaltic.com/en/check-in',aliases:['Air Baltic']},
  {name:'Luxair',iataCodes:['LG'],checkInUrl:'https://www.luxair.lu/en/node/146/'},
  {name:'KM Malta Airlines',iataCodes:['KM'],checkInUrl:'https://kmmaltairlines.com/en/',aliases:['KM Malta']},
  {name:'FLYONE',iataCodes:['5F'],checkInUrl:'https://flyone.eu/en/Before-flights/Check-in',aliases:['FlyOne']},
  {name:'HiSky',iataCodes:['H4','H7'],checkInUrl:'https://hisky.aero/en/'},
  {name:'TAROM',iataCodes:['RO'],checkInUrl:'https://www.tarom.ro/en/zboruri-si-rezervari/online-check-in/'},
  {name:'KLM',iataCodes:['KL'],checkInUrl:'https://www.klm.ca/check-in',aliases:['KLM Royal Dutch Airlines']},
  {name:'Norwegian',iataCodes:['DY','D8'],checkInUrl:'https://www.norwegian.com/uk/my-travels/',aliases:['Norwegian Air']},
  {name:'Wideroe',iataCodes:['WF'],checkInUrl:'https://www.wideroe.no/en/travel/check-in',aliases:['Widerøe']},
  {name:'LOT Polish Airlines',iataCodes:['LO'],checkInUrl:'https://www.lot.com/ca/en/check-in',aliases:['LOT']},
  {name:'Azores Airlines',iataCodes:['S4'],checkInUrl:'https://www.azoresairlines.pt/en'},
  {name:'TAP Air Portugal',iataCodes:['TP'],checkInUrl:'https://www.flytap.com/en-ca/check-in',aliases:['TAP Portugal','TAP']},
  {name:'SAS',iataCodes:['SK'],checkInUrl:'https://www.flysas.com/ca-en/checkin/',aliases:['Scandinavian Airlines']},
  {name:'Air Serbia',iataCodes:['JU'],checkInUrl:'https://www.airserbia.com/en/info-and-help/support/check-in-options'},
  {name:'Air Europa',iataCodes:['UX'],checkInUrl:'https://www.aireuropa.com/ve/es/mytrips/checkin'},
  {name:'Binter Canarias',iataCodes:['NT'],checkInUrl:'https://www.bintercanarias.com/en/checkinonline',aliases:['Binter']},
  {name:'Iberia',iataCodes:['IB'],checkInUrl:'https://www.iberia.com/us/online-checkin/'},
  {name:'Volotea',iataCodes:['V7'],checkInUrl:'https://www.volotea.com/en/check-in/'},
  {name:'Vueling',iataCodes:['VY'],checkInUrl:'https://tickets.vueling.com/checkin'},
  {name:'Edelweiss Air',iataCodes:['WK'],checkInUrl:'https://checkin.flyedelweiss.com/web/ck_retrieve',aliases:['Edelweiss']},
  {name:'SWISS',iataCodes:['LX'],checkInUrl:'https://www.swiss.com/ca/en/fly/check-in/online-check-in',aliases:['Swiss International Air Lines']},
  {name:'AJet',iataCodes:['VF'],checkInUrl:'https://ajet.com/en/checkin'},
  {name:'Pegasus Airlines',iataCodes:['PC'],checkInUrl:'https://www.flypgs.com/en/useful-info/info-about-flights/check-in',aliases:['Pegasus']},
  {name:'SunExpress',iataCodes:['XQ'],checkInUrl:'https://www.sunexpress.com/en-gb/check-in/login/'},
  {name:'Turkish Airlines',iataCodes:['TK'],checkInUrl:'https://www.turkishairlines.com/en-int/flights/manage-booking/',aliases:['Turkish']},
  {name:'British Airways',iataCodes:['BA'],checkInUrl:'https://www.britishairways.com/travel/olcilandingpageauthreq/public/en_gb'},
  {name:'easyJet',iataCodes:['U2','EC','DS'],checkInUrl:'https://www.easyjet.com/en/',aliases:['EasyJet']},
  {name:'Jet2',iataCodes:['LS'],checkInUrl:'https://www.jet2.com/en/login',aliases:['Jet2.com']},
  {name:'TUI Airways',iataCodes:['BY','X3','OR','TB'],checkInUrl:'https://www.tui.co.uk/destinations/your-account/managemybooking/login',aliases:['TUI fly','TUI']},
  {name:'Virgin Atlantic',iataCodes:['VS'],checkInUrl:'https://www.virginatlantic.com/PCCOciWeb/findBy'},

  // Asia-Pacific (45 verified; six candidates without a usable web check-in URL are omitted)
  {name:'Air China',iataCodes:['CA'],checkInUrl:'https://m.airchina.com.cn/ac/c/invoke/overseasWebsite/introduction@pg?registerType=418&channel=Overseas_GB&lang=en_US'},
  {name:'China Eastern Airlines',iataCodes:['MU'],checkInUrl:'https://www.ceair.com/en/usd/self-service/before/checkin',aliases:['China Eastern']},
  {name:'China Southern Airlines',iataCodes:['CZ'],checkInUrl:'https://b2c.csair.com/B2C40/modules/bookingnew/manage/login.html',aliases:['China Southern']},
  {name:'Hainan Airlines',iataCodes:['HU'],checkInUrl:'https://www.hainanairlines.com/US/US/Check-in'},
  {name:'Shenzhen Airlines',iataCodes:['ZH'],checkInUrl:'https://global.shenzhenair.com/zhair/ibe/bookingManagement/toCheckIn.do'},
  {name:'Juneyao Air',iataCodes:['HO'],checkInUrl:'https://global.juneyaoair.com/checkIn'},
  {name:'Cathay Pacific',iataCodes:['CX'],checkInUrl:'https://www.cathaypacific.com/cx/en_CA/manage-booking/check-in.html',aliases:['Cathay']},
  {name:'Hong Kong Airlines',iataCodes:['HX'],checkInUrl:'https://new.hongkongairlines.com/hxnewb2c/precheckin/search'},
  {name:'China Airlines',iataCodes:['CI'],checkInUrl:'https://airportservice.china-airlines.com/eCheckin/eCheckin_home?country=us&locale=en'},
  {name:'EVA Air',iataCodes:['BR'],checkInUrl:'https://booking.evaair.com/flyeva/eva/b2c/manage-your-trip/online-checked-in-login.aspx?lang=en-US',aliases:['EVA Airways']},
  {name:'STARLUX Airlines',iataCodes:['JX'],checkInUrl:'https://www.starlux-airlines.com/en-US/check-in',aliases:['Starlux']},
  {name:'ANA',iataCodes:['NH'],checkInUrl:'https://www.ana.co.jp/en/us/travel-information/online-check-in/',aliases:['All Nippon Airways']},
  {name:'Japan Airlines',iataCodes:['JL'],checkInUrl:'https://digital.jal.co.jp/ssci/identification?lang=en-GB',aliases:['JAL']},
  {name:'Peach Aviation',iataCodes:['MM'],checkInUrl:'https://www.flypeach.com/en/lm/ai/airports/how_to_checkin',aliases:['Peach']},
  {name:'Jetstar Japan',iataCodes:['GK'],checkInUrl:'https://booking.jetstar.com/mmb/#/login?culture=en-au'},
  {name:'Korean Air',iataCodes:['KE'],checkInUrl:'https://www.koreanair.com/check-in'},
  {name:'Asiana Airlines',iataCodes:['OZ'],checkInUrl:'https://flyasiana.com/I/US/EN/CheckIn.do',aliases:['Asiana']},
  {name:'Jeju Air',iataCodes:['7C'],checkInUrl:'https://wcc.jejuair.net/ko/ibe/checkin/viewCheckin.do'},
  {name:'Tway Air',iataCodes:['TW'],checkInUrl:'https://www.twayair.com/app/reservation/searchCheckinItinerary',aliases:["T'way Air"]},
  {name:'Air India',iataCodes:['AI'],checkInUrl:'https://www.airindia.com/content/air-india/in/en/manage/web-checkin.html'},
  {name:'IndiGo',iataCodes:['6E'],checkInUrl:'https://www.goindigo.in/web-check-in.html'},
  {name:'Akasa Air',iataCodes:['QP'],checkInUrl:'https://www.akasaair.com/check-in'},
  {name:'SpiceJet',iataCodes:['SG'],checkInUrl:'https://book.spicejet.com/SearchWebCheckin.aspx'},
  {name:'Air India Express',iataCodes:['IX'],checkInUrl:'https://www.airindiaexpress.com/home'},
  {name:'Biman Bangladesh Airlines',iataCodes:['BG'],checkInUrl:'https://www.biman-airlines.com/#check-in',aliases:['Biman']},
  {name:'SriLankan Airlines',iataCodes:['UL'],checkInUrl:'https://www.srilankan.com/en_uk/ca#olci',aliases:['SriLankan']},
  {name:'Singapore Airlines',iataCodes:['SQ'],checkInUrl:'https://www.singaporeair.com/checkInSecuredUser.form'},
  {name:'Scoot',iataCodes:['TR'],checkInUrl:'https://checkin.flyscoot.com/'},
  {name:'Malaysia Airlines',iataCodes:['MH'],checkInUrl:'https://www.malaysiaairlines.com/my/en/travel-info/check-in.html'},
  {name:'AirAsia',iataCodes:['AK'],checkInUrl:'https://www.airasia.com/check-in/'},
  {name:'Batik Air Malaysia',iataCodes:['OD'],checkInUrl:'https://www.bookcabin.com/?check-in=1'},
  {name:'Thai Airways',iataCodes:['TG'],checkInUrl:'https://www.thaiairways.com/en_TH/manage/check_in.page'},
  {name:'Thai AirAsia',iataCodes:['FD'],checkInUrl:'https://www.airasia.com/check-in/'},
  {name:'Vietnam Airlines',iataCodes:['VN'],checkInUrl:'https://www.vietnamairlines.com/us/en/travel-information/check-in/online-check-in'},
  {name:'VietJet Air',iataCodes:['VJ'],checkInUrl:'https://www.vietjetair.com/en/checkin',aliases:['VietJet']},
  {name:'Philippine Airlines',iataCodes:['PR'],checkInUrl:'https://www.philippineairlines.com/ca/en/check-in-online.html'},
  {name:'Cebu Pacific',iataCodes:['5J'],checkInUrl:'https://www.cebupacificair.com/en-PH/CheckIn/Retrieve'},
  {name:'Garuda Indonesia',iataCodes:['GA'],checkInUrl:'https://digital.garuda-indonesia.com/ssci/identification'},
  {name:'Batik Air',iataCodes:['ID'],checkInUrl:'https://www.bookcabin.com/?check-in=1'},
  {name:'Royal Brunei Airlines',iataCodes:['BI'],checkInUrl:'https://www.flyroyalbrunei.com/brunei/en/book-manage/online-check-in/',aliases:['Royal Brunei']},
  {name:'Qantas',iataCodes:['QF'],checkInUrl:'https://www.qantas.com/en-gb/manage-booking/check-in'},
  {name:'Virgin Australia',iataCodes:['VA'],checkInUrl:'https://check-in.virginaustralia.com/checkin/index.html'},
  {name:'Jetstar',iataCodes:['JQ'],checkInUrl:'https://booking.jetstar.com/mmb/#/login?culture=en-au'},
  {name:'Air New Zealand',iataCodes:['NZ'],checkInUrl:'https://flightbookings.airnewzealand.com/vmanage/actions/retrieve/webcheck'},
  {name:'Fiji Airways',iataCodes:['FJ'],checkInUrl:'https://checkin.si.amadeus.net/1ASIHSSCWEBFJ/sscwfj/checkin?ln=en'},

  // Africa (16 verified; seven additional candidates are explicitly omitted above)
  {name:'Ethiopian Airlines',iataCodes:['ET'],checkInUrl:'https://www.ethiopianairlines.com/GH/book/check-in/web-check-in',aliases:['Ethiopian']},
  {name:'Kenya Airways',iataCodes:['KQ'],checkInUrl:'https://www.kenya-airways.com/en-ke/book-manage/post-booking/check-in/'},
  {name:'EgyptAir',iataCodes:['MS'],checkInUrl:'https://digital.egyptair.com/ssci/identification',aliases:['Egypt Air']},
  {name:'Royal Air Maroc',iataCodes:['AT'],checkInUrl:'https://www.royalairmaroc.com/us-en/booking/online-check-in'},
  {name:'South African Airways',iataCodes:['SA'],checkInUrl:'https://www.flysaa.com/manage-fly/manage/check-in/on-line-check-in',aliases:['SAA']},
  {name:'Airlink',iataCodes:['4Z'],checkInUrl:'https://checkin.si.amadeus.net/static/PRD/4Z/#/identification'},
  {name:'Tunisair',iataCodes:['TU'],checkInUrl:'https://www.tunisair.com/en/guide-utilisateur/online-check'},
  {name:'Air Mauritius',iataCodes:['MK'],checkInUrl:'https://www.airmauritius.com/en-de/book-and-manage/check-in-online'},
  {name:'TAAG Angola Airlines',iataCodes:['DT'],checkInUrl:'https://digital.flytaag.com/ssci/identification?lang=en-GB',aliases:['TAAG']},
  {name:'ASKY Airlines',iataCodes:['KP'],checkInUrl:'https://www.flyasky.com/ga/en/fly/booking/check-in',aliases:['ASKY']},
  {name:"Air Cote d'Ivoire",iataCodes:['HF'],checkInUrl:'https://digital.aircotedivoire.com/ssci/identification?lang=en-GB',aliases:["Air Côte d'Ivoire"]},
  {name:'Uganda Airlines',iataCodes:['UR'],checkInUrl:'https://checkin.si.amadeus.net/static/PRD/UR/'},
  {name:'Air Tanzania',iataCodes:['TC'],checkInUrl:'https://book-airtanzania.crane.aero/ibe/checkin/search'},
  {name:'LAM Mozambique Airlines',iataCodes:['TM'],checkInUrl:'https://www.lam.co.mz',aliases:['LAM Mozambique','LAM']},
  {name:'Air Seychelles',iataCodes:['HM'],checkInUrl:'https://fly.airseychelles.com/en-sc/before-you-fly/web-checkin'},
  {name:'Jambojet',iataCodes:['JM'],checkInUrl:'https://www.jambojet.com/en-us/check-in/login/'},

  // Middle East (16 verified; Iraqi Airways and Iran Air are explicitly omitted above)
  {name:'Emirates',iataCodes:['EK'],checkInUrl:'https://www.emirates.com/english/manage-booking/online-check-in/'},
  {name:'Qatar Airways',iataCodes:['QR'],checkInUrl:'https://cki.qatarairways.com/cki/dashboard'},
  {name:'Etihad Airways',iataCodes:['EY'],checkInUrl:'https://www.etihad.com/en/manage/check-in',aliases:['Etihad']},
  {name:'Saudia',iataCodes:['SV'],checkInUrl:'https://www.saudia.com/en-SA/checkIn/checkInoverview/checkInStandAlone',aliases:['Saudi Arabian Airlines']},
  {name:'flydubai',iataCodes:['FZ'],checkInUrl:'https://www.flydubai.com/en/flying-with-us/check-in/online-check-in/',aliases:['Flydubai']},
  {name:'Air Arabia',iataCodes:['G9'],checkInUrl:'https://webcheckin.airarabia.com/accelaero/en/index.html'},
  {name:'Oman Air',iataCodes:['WY'],checkInUrl:'https://www.omanair.com/'},
  {name:'Gulf Air',iataCodes:['GF'],checkInUrl:'https://dxcheckin.gulfair.com/dx/GFCI/'},
  {name:'Kuwait Airways',iataCodes:['KU'],checkInUrl:'https://kuwaitairways.com/en/online-check-in'},
  {name:'Royal Jordanian',iataCodes:['RJ'],checkInUrl:'https://www.rj.com/en/info-and-tips/check-in-options/online-check-in'},
  {name:'Middle East Airlines',iataCodes:['ME'],checkInUrl:'https://digital.mea.com.lb/check-in/identification',aliases:['MEA']},
  {name:'EL AL',iataCodes:['LY'],checkInUrl:'https://www.elal.com/checkin/home/identification/o?language=eng&type=0',aliases:['El Al Israel Airlines','El Al']},
  {name:'flynas',iataCodes:['XY'],checkInUrl:'https://www.flynas.com/en',aliases:['Flynas']},
  {name:'Jazeera Airways',iataCodes:['J9'],checkInUrl:'https://www.jazeeraairways.com/en-eg/check-in'},
  {name:'SalamAir',iataCodes:['OV'],checkInUrl:'https://www.salamair.com/en/book/online-check-in',aliases:['Salam Air']},
  {name:'Air Arabia Abu Dhabi',iataCodes:['3L'],checkInUrl:'https://webcheckin.airarabia.com/accelaero/en/index.html'},

  // Additional verified regional providers
  {name:'Air Haifa',iataCodes:['E2'],checkInUrl:'https://www.airhaifa.com/travelinfo-en/check-in'},
  {name:'Himalaya Airlines',iataCodes:['H9'],checkInUrl:'https://book-himalaya-airlines.crane.aero/ibe/checkin/search'},
  {name:'MIAT Mongolian Airlines',iataCodes:['OM'],checkInUrl:'https://www.miat.com/en',aliases:['MIAT']},
  {name:'Xizang Airlines',iataCodes:['TV'],checkInUrl:'https://www.airxizang.com/stdair/webckipe/allChannelCheckIn?type=baggage',aliases:['Tibet Airlines']},

  // South America, Central America and the Caribbean (20)
  {name:'Aerolineas Argentinas',iataCodes:['AR'],checkInUrl:'https://checkin.aerolineas.com.ar/dx/ARCI/',aliases:['Aerolíneas Argentinas']},
  {name:'Flybondi',iataCodes:['FO'],checkInUrl:'https://reserva.flybondi.com/booking/widget?carrier=fo&module=webcheckin'},
  {name:'LATAM Airlines',iataCodes:['LA'],checkInUrl:'https://www.latamairlines.com/us/en/check-in',aliases:['LATAM']},
  {name:'SKY Airline',iataCodes:['H2'],checkInUrl:'https://check-in.skyairline.com/en/chile/'},
  {name:'JetSMART',iataCodes:['JA','J6'],checkInUrl:'https://jetsmart.com/cl/es/minisitios/checkin/home',aliases:['JetSmart']},
  {name:'JetSMART Argentina',iataCodes:['WJ'],checkInUrl:'https://jetsmart.com/ar/es/minisitios/checkin/home'},
  {name:'GOL Airlines',iataCodes:['G3'],checkInUrl:'https://b2c.voegol.com.br/check-in/?culture=pt-br',aliases:['GOL Linhas Aereas','GOL']},
  {name:'Azul Brazilian Airlines',iataCodes:['AD'],checkInUrl:'https://www.voeazul.com.br/us/en/home/azulwebcheckin.html',aliases:['Azul']},
  {name:'Boliviana de Aviacion',iataCodes:['OB'],checkInUrl:'https://www.boa.bo',aliases:['BoA','Boliviana de Aviación']},
  {name:'Avianca',iataCodes:['AV'],checkInUrl:'https://checkinnew.avianca.com/Check-In?lang=En'},
  {name:'Wingo',iataCodes:['P5'],checkInUrl:'https://reserva.wingo.com/#/admin/login/es/check-in'},
  {name:'Copa Airlines',iataCodes:['CM'],checkInUrl:'https://checkin.copaair.com/',aliases:['Copa']},
  {name:'Arajet',iataCodes:['DM'],checkInUrl:'https://www.arajet.com/en/check-in'},
  {name:'Caribbean Airlines',iataCodes:['BW'],checkInUrl:'https://www.caribbean-airlines.com/#/plan-your-trip/check-in'},
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
