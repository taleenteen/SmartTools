import * as XLSX from 'xlsx'

import { csvToCardRows, sectionsToCsv } from '@/lib/csv'
import type { BookmarkCard, BookmarkSection, SubCard } from '@/types/bookmark'

const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function sectionsToXlsx(sections: BookmarkSection[]): Blob {
  let csv = sectionsToCsv(sections)
  if (csv.charCodeAt(0) === 0xfeff) csv = csv.slice(1)
  const workbook = XLSX.read(csv, { type: 'string', raw: true })
  const first = workbook.SheetNames[0]
  const sheet = first ? workbook.Sheets[first] : undefined
  if (first && sheet && first !== 'SmartTools') {
    workbook.Sheets.SmartTools = sheet
    delete workbook.Sheets[first]
    workbook.SheetNames = ['SmartTools']
  }
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  return new Blob([buffer], { type: MIME })
}

export function xlsxToCardRows(
  buffer: ArrayBuffer,
): { sectionKey: string; card: BookmarkCard & SubCard; parentId?: string }[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const name = workbook.SheetNames[0]
  if (!name) return []
  const sheet = workbook.Sheets[name]
  if (!sheet) return []
  const csv = XLSX.utils.sheet_to_csv(sheet)
  return csvToCardRows(csv)
}
