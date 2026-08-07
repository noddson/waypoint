export const journalEnabledStorageKey='waypoint-journal-enabled'

export const journalEnabledFromStorage = (value:string|null) => value==='enabled'

export function loadJournalEnabled() {
  try{return journalEnabledFromStorage(localStorage.getItem(journalEnabledStorageKey))}
  catch{return false}
}

export function saveJournalEnabled(enabled:boolean) {
  try{localStorage.setItem(journalEnabledStorageKey,enabled?'enabled':'disabled')}
  catch{/* The setting remains active for this session when storage is unavailable. */}
}
