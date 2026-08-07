import { DailyWeather, formatWeatherTemperaturePair, isWeatherForecastDate, WeatherDayPlan, WeatherForecastState, weatherDescription, weatherSearchUrl, WeatherTemperatureUnit } from './weather'
import { currentLocale } from './i18n'

const shortDate = (date:string) => new Intl.DateTimeFormat(currentLocale(),{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'}).format(new Date(`${date}T12:00:00Z`))
const weatherForPlan = (plan:WeatherDayPlan,state:WeatherForecastState) => state.forecasts.get(plan.target.key)?.days.get(plan.date)

function ForecastValues({weather,temperatureUnit}:{weather:DailyWeather;temperatureUnit:WeatherTemperatureUnit}) {
  const condition=weatherDescription(weather.code)
  const unitName=temperatureUnit==='fahrenheit'?'Fahrenheit':temperatureUnit==='kelvin'?'Kelvin':'Celsius'
  return <><span className="weather-reading"><span className="weather-icon" aria-hidden="true">{condition.icon}</span><strong className="weather-temperature" title={`High and low temperature in ${unitName}`}>{formatWeatherTemperaturePair(weather.high,weather.low,temperatureUnit)}</strong></span><span className="weather-meta"><span className="weather-condition">{condition.label}</span>{weather.precipitationProbability!==undefined&&<span className="weather-rain">Rain {Math.round(weather.precipitationProbability)}%</span>}</span></>
}

export function AgendaDayWeather({plans,state,today,temperatureUnit}:{plans:WeatherDayPlan[];state:WeatherForecastState;today:string;temperatureUnit:WeatherTemperatureUnit}) {
  if(!plans.length)return null
  const hasWeather=plans.some(plan=>!!weatherForPlan(plan,state)),places=plans.map(plan=>plan.target.label).join(' and ')
  return <aside className="agenda-day-weather" aria-label={`Weather for ${places} on ${shortDate(plans[0].date)}`}>
   <div className="agenda-day-weather-reports">{plans.map(plan=>{const weather=weatherForPlan(plan,state),forecastable=isWeatherForecastDate(plan.date,today),loading=state.loadingTargets.has(plan.target.key),failed=state.failedTargets.has(plan.target.key);return <a className={`agenda-day-weather-report${weather?' has-forecast':' weather-unavailable'}`} key={plan.target.key} href={weatherSearchUrl(plan.target,plan.date)} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>
     <span className="agenda-day-weather-place"><strong>{plan.target.label}</strong><span className="weather-open" aria-hidden="true">↗</span></span>
     {weather?<ForecastValues weather={weather} temperatureUnit={temperatureUnit}/>:<span className="weather-message">{!forecastable?'Available closer to trip':failed?'Forecast unavailable':loading?'Loading…':'Open weather ↗'}</span>}
    </a>})}</div>
   {hasWeather&&<a className="weather-attribution" href="https://open-meteo.com/" target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>Weather: Open-Meteo</a>}
  </aside>
}
