export type ConfirmationCodeFormat='qr'|'code128'

export const nextConfirmationCodeFormat = (format:ConfirmationCodeFormat):ConfirmationCodeFormat => format==='qr'?'code128':'qr'
export const confirmationCodeValue = (value?:string) => value?.trim()||undefined
