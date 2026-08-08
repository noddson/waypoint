export const AUDIO_FILE_ACCEPT='.m4a,audio/x-m4a,audio/mp4,.mp3,audio/mpeg,.wav,audio/wav,.aac,audio/aac,.aif,.aiff,audio/aiff,.caf,audio/x-caf,audio/*'

const audioMimeTypesByExtension:Record<string,string>={
  m4a:'audio/x-m4a',
  mp3:'audio/mpeg',
  wav:'audio/wav',
  aac:'audio/aac',
  aif:'audio/aiff',
  aiff:'audio/aiff',
  caf:'audio/x-caf',
}

export function audioMimeType(file:Pick<File,'name'|'type'>) {
  if(file.type.startsWith('audio/'))return file.type
  const extension=file.name.split('.').pop()?.toLocaleLowerCase()
  return extension?audioMimeTypesByExtension[extension]:undefined
}
