import { Trip, TripItem } from './types'
import { migrateLegacyJournalEntries } from './journalItems'

const itemWithoutMedia = (item:TripItem):TripItem => {
  const {photos:_photos,audio:_audio,...snapshotItem}=item
  return snapshotItem
}

export function tripForStaticSnapshot(source:Trip):Trip {
  const trip=migrateLegacyJournalEntries(source)
  return {...trip,items:trip.items.map(itemWithoutMedia)}
}
