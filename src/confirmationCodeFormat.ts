export type ConfirmationCodeFormat='qr'|'code128'

export const nextConfirmationCodeFormat = (format:ConfirmationCodeFormat):ConfirmationCodeFormat => format==='qr'?'code128':'qr'
export const confirmationCodeValue = (value?:string) => value?.trim()||undefined

const confirmationCodesStorageKey='waypoint-confirmation-codes'

export const confirmationCodesEnabledFromStorage = (value:string|null) => value!=='disabled'
export const confirmationCodesStorageValue = (enabled:boolean) => enabled?'enabled':'disabled'

export function loadConfirmationCodesEnabled() {
  try{return confirmationCodesEnabledFromStorage(localStorage.getItem(confirmationCodesStorageKey))}
  catch{return true}
}

export function saveConfirmationCodesEnabled(enabled:boolean) {
  try{localStorage.setItem(confirmationCodesStorageKey,confirmationCodesStorageValue(enabled))}
  catch{/* The setting remains active for this session when storage is unavailable. */}
}
