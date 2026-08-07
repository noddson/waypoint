type WeatherLanguage='en'|'de'|'el'|'es'|'fr'|'is'|'it'|'jp'|'xx'

const settingsGuidance='Choose a temperature scale or turn day-level weather off. Waypoint never uses your device location, and completed trips from 2022 onward show historical weather.'

export const weatherRefinements:Record<WeatherLanguage,Record<string,string>>={
  en:{},
  de:{
    'Historical weather unavailable':'Historische Wetterdaten nicht verfügbar',
    'Historical weather: Open-Meteo':'Historisches Wetter: Open-Meteo',
    [settingsGuidance]:'Wähle eine Temperaturskala oder schalte das Tageswetter aus. Waypoint verwendet nie den Gerätestandort; abgeschlossene Reisen ab 2022 zeigen historische Wetterdaten.',
  },
  el:{
    'Historical weather unavailable':'Τα ιστορικά δεδομένα καιρού δεν είναι διαθέσιμα',
    'Historical weather: Open-Meteo':'Ιστορικός καιρός: Open-Meteo',
    [settingsGuidance]:'Επιλέξτε κλίμακα θερμοκρασίας ή απενεργοποιήστε τον ημερήσιο καιρό. Το Waypoint δεν χρησιμοποιεί ποτέ την τοποθεσία της συσκευής και τα ολοκληρωμένα ταξίδια από το 2022 και μετά εμφανίζουν ιστορικά δεδομένα καιρού.',
  },
  es:{
    'Historical weather unavailable':'Datos meteorológicos históricos no disponibles',
    'Historical weather: Open-Meteo':'Tiempo histórico: Open-Meteo',
    [settingsGuidance]:'Elige una escala de temperatura o desactiva el tiempo diario. Waypoint nunca usa la ubicación del dispositivo y muestra el tiempo histórico de los viajes completados a partir de 2022.',
  },
  fr:{
    'Historical weather unavailable':'Météo historique indisponible',
    'Historical weather: Open-Meteo':'Météo historique : Open-Meteo',
    [settingsGuidance]:'Choisissez une échelle de température ou désactivez la météo quotidienne. Waypoint n’utilise jamais la position de votre appareil et affiche la météo historique des voyages terminés à partir de 2022.',
  },
  is:{
    'Historical weather unavailable':'Söguleg veðurgögn eru ekki tiltæk',
    'Historical weather: Open-Meteo':'Sögulegt veður: Open-Meteo',
    [settingsGuidance]:'Veldu hitakvarða eða slökktu á daglegu veðri. Waypoint notar aldrei staðsetningu tækisins og sýnir sögulegt veður fyrir loknar ferðir frá 2022.',
  },
  it:{
    'Historical weather unavailable':'Meteo storico non disponibile',
    'Historical weather: Open-Meteo':'Meteo storico: Open-Meteo',
    [settingsGuidance]:'Scegli una scala di temperatura o disattiva il meteo giornaliero. Waypoint non usa mai la posizione del dispositivo e mostra il meteo storico dei viaggi completati dal 2022 in poi.',
  },
  jp:{
    'Historical weather unavailable':'過去の天気を利用できません',
    'Historical weather: Open-Meteo':'過去の天気: Open-Meteo',
    [settingsGuidance]:'温度単位を選ぶか、日別の天気をオフにします。Waypointは端末の位置情報を使用せず、2022年以降に完了した旅行には過去の天気を表示します。',
  },
  xx:{
    'Historical weather unavailable':'Old skies be lost at sea',
    'Historical weather: Open-Meteo':'Old skies: Open-Meteo',
    [settingsGuidance]:'Choose a heat scale or turn daily skies off. Waypoint never spies yer device location, and finished voyages from 2022 onward show old skies.',
  },
}
