import { ReactNode, useEffect, useRef } from 'react'

export type UnifiedMenuSection = 'home'|'trips'|'actions'|'sync-share'|'permission-policies'|'profile'|'language'|'settings'

export interface UnifiedMenuHomeProps {
  tripName: string
  driveStatus: string
  onSelect: (section:Exclude<UnifiedMenuSection,'home'>)=>void
  onClose: () => void
}

const focusableSelector='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function UnifiedMenuDialog({children,className='',onDismiss}:{children:ReactNode;className?:string;onDismiss:()=>void}) {
  const dialogRef=useRef<HTMLElement>(null)
  useEffect(()=>{
    const returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null,dialog=dialogRef.current
    const initial=dialog?.querySelector<HTMLElement>('[data-menu-initial-focus]')||dialog?.querySelector<HTMLElement>(focusableSelector)||dialog
    initial?.focus()
    return()=>returnFocus?.focus()
  },[])
  const handleKeyDown=(event:React.KeyboardEvent<HTMLElement>)=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onDismiss();return}
    if(event.key!=='Tab')return
    const focusable=[...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector)||[])].filter(element=>!element.hidden&&element.getAttribute('aria-hidden')!=='true')
    if(!focusable.length){event.preventDefault();dialogRef.current?.focus();return}
    const first=focusable[0],last=focusable[focusable.length-1]
    if(event.shiftKey&&(document.activeElement===first||!dialogRef.current?.contains(document.activeElement))){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||!dialogRef.current?.contains(document.activeElement))){event.preventDefault();first.focus()}
  }
  return <div className="mobile-sheet-backdrop" onMouseDown={onDismiss}>
    <section ref={dialogRef} className={`mobile-sheet${className?` ${className}`:''}`} role="dialog" aria-modal="true" aria-label="Waypoint menu" tabIndex={-1} onKeyDown={handleKeyDown} onMouseDown={event=>event.stopPropagation()}>{children}</section>
  </div>
}

const sections:Array<{id:Exclude<UnifiedMenuSection,'home'>;icon:string;title:string;description:string}> = [
  {id:'trips',icon:'⌂',title:'Your Trips',description:'Open local, synced, and shared trips'},
  {id:'actions',icon:'⋯',title:'Trip Actions',description:'Import, export, display, archive, or delete'},
  {id:'sync-share',icon:'↻',title:'Sync & Share',description:'Google Drive, live sharing, people, and calendars'},
  {id:'permission-policies',icon:'⊙',title:'Permission Policies',description:'Configure simplified, full, and custom sharing'},
  {id:'settings',icon:'⚙',title:'Settings',description:'Profile, language, weather, and maps'},
]

export function UnifiedMenuHome({tripName,driveStatus,onSelect,onClose}:UnifiedMenuHomeProps) {
  return <>
    <div className="sheet-heading unified-menu-heading">
      <div><p className="eyebrow">WAYPOINT</p><h2>Menu</h2></div>
      <button type="button" className="close" aria-label="Close menu" onClick={onClose}>×</button>
    </div>
    <div className="unified-menu-context"><strong>{tripName}</strong><span>{driveStatus}</span></div>
    <nav className="unified-menu-list" aria-label="Waypoint menu">
      {sections.map((section,index)=><button type="button" key={section.id} data-menu-initial-focus={index===0?'true':undefined} onClick={()=>onSelect(section.id)}>
        <span className="unified-menu-icon" aria-hidden="true">{section.icon}</span>
        <span><strong>{section.title}</strong><small>{section.description}</small></span>
        <span className="unified-menu-chevron" aria-hidden="true">›</span>
      </button>)}
    </nav>
  </>
}

export function UnifiedMenuPanel({title,onBack,onClose,children,className='',backLabel='Back to menu'}:{title:string;onBack:()=>void;onClose:()=>void;children:ReactNode;className?:string;backLabel?:string}) {
  const headingRef=useRef<HTMLHeadingElement>(null)
  useEffect(()=>headingRef.current?.focus(),[title])
  return <div className={`unified-menu-panel ${className}`}>
    <div className="sheet-heading">
      <button type="button" className="unified-menu-back" aria-label={backLabel} onClick={onBack}>←</button>
      <h2 ref={headingRef} tabIndex={-1}>{title}</h2>
      <button type="button" className="close" aria-label={`Close ${title}`} onClick={onClose}>×</button>
    </div>
    {children}
  </div>
}

export function TripAccessBanner({mode}:{mode:'collaborator'|'named-viewer'|'public-viewer'|'snapshot'}) {
  const content = mode==='collaborator'
    ? {icon:'✎',title:'Collaborative trip',body:'You are co-authoring this trip. Your saved changes synchronize to the owner’s Google Drive copy.'}
    : mode==='snapshot'
      ? {icon:'◇',title:'Static snapshot',body:'This fixed, read-only view does not receive later changes.'}
      : mode==='public-viewer'
        ? {icon:'◉',title:'Public live trip',body:'This read-only view refreshes from the owner’s published Google Drive copy.'}
        : {icon:'●',title:'Shared with you',body:'This named, read-only view refreshes from the owner’s published Google Drive copy.'}
  return <section className={`trip-access-banner ${mode}`} role="status">
    <span aria-hidden="true">{content.icon}</span><div><strong>{content.title}</strong><p>{content.body}</p></div>
  </section>
}
