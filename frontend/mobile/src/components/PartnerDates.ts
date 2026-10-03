import { daysUntil, formatDate, formatDday } from '@govbiz/shared/domain/labels'

/** All deadlines and received dates in the collaboration UI use the Seoul calendar day. */
export function partnerMonthDay(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '날짜 확인 필요'
    : new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' })
      .format(date).replace(/\s/g, '').replace(/\.$/, '')
}

export function partnerFullDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : '날짜 확인 필요'
}

export function partnerDeadlineDay(value: string) {
  return daysUntil(value)
}

export function recruitmentDeadlineLabel(value: string) {
  const days = partnerDeadlineDay(value)
  if (days === null) return '모집 마감일 확인 필요'
  return days < 0 ? '모집 마감' : `모집 마감 ${formatDday(days)}`
}

export function recruitmentDeadlineTone(value: string): 'warning' | 'neutral' {
  const days = partnerDeadlineDay(value)
  return days !== null && days >= 0 && days <= 3 ? 'warning' : 'neutral'
}
