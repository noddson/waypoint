export type BuildVersion = {
  displayVersion:string
  fullSha:string
  githubCommitUrl:string
}

export function parseBuildVersion(value:unknown):BuildVersion|null {
  if(!value||typeof value!=='object')return null
  const {displayVersion,fullSha,githubCommitUrl}=value as Partial<BuildVersion>
  if(!displayVersion||!fullSha||!githubCommitUrl)return null
  try {
    const url=new URL(githubCommitUrl)
    if(url.protocol!=='https:'||url.hostname!=='github.com')return null
  } catch {
    return null
  }
  return {displayVersion,fullSha,githubCommitUrl}
}

export async function loadBuildVersion(pageUrl:string):Promise<BuildVersion|null> {
  try {
    const response=await fetch(new URL('./version.json',pageUrl),{cache:'no-store'})
    if(!response.ok)return null
    return parseBuildVersion(await response.json())
  } catch {
    return null
  }
}
