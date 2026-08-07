import { DailyWeather, formatWeatherTemperaturePair, isWeatherForecastDate, WeatherDayPlan, WeatherForecastState, weatherDescription, weatherSearchUrl, WeatherTemperatureUnit } from './weather'
import { languageMetadata, LanguageCode, uiMessage, uiText } from './i18n'

const shortDate = (date:string,language:LanguageCode) => new Intl.DateTimeFormat(languageMetadata[language].locale,{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(`${date}T12:00:00Z`))
const weatherForPlan = (plan:WeatherDayPlan,state:WeatherForecastState) => state.forecasts.get(plan.target.key)?.days.get(plan.date)
type ListFormatter={format:(values:string[])=>string}
type ListFormatterConstructor=new(locales:string[],options:{style:'long';type:'conjunction'})=>ListFormatter
const formatPlaceList=(values:string[],language:LanguageCode)=>{const Formatter=(Intl as unknown as {ListFormat?:ListFormatterConstructor}).ListFormat;return Formatter?new Formatter([languageMetadata[language].locale],{style:'long',type:'conjunction'}).format(values):values.join(', ')}

function ForecastValues({weather,temperatureUnit,language}:{weather:DailyWeather;temperatureUnit:WeatherTemperatureUnit;language:LanguageCode}) {
  const condition=weatherDescription(weather.code)
  const unitName=temperatureUnit==='fahrenheit'?'Fahrenheit':temperatureUnit==='kelvin'?'Kelvin':'Celsius'
  return <><span className="weather-reading"><span className="weather-icon" aria-hidden="true">{condition.icon}</span><strong className="weather-temperature" title={`High and low temperature in ${unitName}`}>{formatWeatherTemperaturePair(weather.high,weather.low,temperatureUnit)}</strong></span><span className="weather-meta"><span className="weather-condition">{uiText(condition.label,language)}</span>{weather.precipitationProbability!==undefined&&<span className="weather-rain">{uiText('Rain',language)} {Math.round(weather.precipitationProbability)}%</span>}</span></>
}

export function AgendaDayWeather({plans,state,today,temperatureUnit,language}:{plans:WeatherDayPlan[];state:WeatherForecastState;today:string;temperatureUnit:WeatherTemperatureUnit;language:LanguageCode}) {
  if(!plans.length)return null
  const hasWeather=plans.some(plan=>!!weatherForPlan(plan,state)),places=formatPlaceList(plans.map(plan=>plan.target.label),language)
  return <aside className="agenda-day-weather" aria-label={uiMessage('Weather for {places} on {date}',language,{places,date:shortDate(plans[0].date,language)})}>
   <div className="agenda-day-weather-reports">{plans.map(plan=>{const weather=weatherForPlan(plan,state),forecastable=isWeatherForecastDate(plan.date,today),loading=state.loadingTargets.has(plan.target.key),failed=state.failedTargets.has(plan.target.key);return <a className={`agenda-day-weather-report${weather?' has-forecast':' weather-unavailable'}`} key={plan.target.key} href={weatherSearchUrl(plan.target,plan.date)} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>
     <span className="agenda-day-weather-place"><strong>{plan.target.label}</strong><span className="weather-open" aria-hidden="true">↗</span></span>
     {weather?<ForecastValues weather={weather} temperatureUnit={temperatureUnit} language={language}/>:<span className="weather-message">{uiText(!forecastable?'Available closer to trip':failed?'Forecast unavailable':loading?'Loading…':'Open weather ↗',language)}</span>}
    </a>})}</div>
   {hasWeather&&<a className="weather-attribution" href="https://open-meteo.com/" target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>{uiText('Weather: Open-Meteo',language)}</a>}
  </aside>
}
