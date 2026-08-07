type TransientLanguage='en'|'de'|'el'|'es'|'fr'|'is'|'it'|'jp'|'xx'

export const transientRefinements:Record<TransientLanguage,Record<string,string>>={
  en:{},
  de:{'Click again to delete':'Erneut zum Löschen klicken','Deleting…':'Wird gelöscht…'},
  el:{'Click again to delete':'Κάντε ξανά κλικ για διαγραφή','Deleting…':'Γίνεται διαγραφή…'},
  es:{'Click again to delete':'Haz clic de nuevo para eliminar','Deleting…':'Eliminando…'},
  fr:{'Click again to delete':'Cliquez de nouveau pour supprimer','Deleting…':'Suppression…'},
  is:{'Click again to delete':'Smelltu aftur til að eyða','Deleting…':'Eyði…'},
  it:{'Click again to delete':'Fai di nuovo clic per eliminare','Deleting…':'Eliminazione…'},
  jp:{'Click again to delete':'もう一度クリックして削除','Deleting…':'削除中…'},
  xx:{'Click again to delete':'Strike again to scuttle','Deleting…':'Scuttlin’…'},
}
