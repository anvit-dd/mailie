import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

interface LabelPreferences {
  hiddenLabelIds: string[]
  labelOrder: string[]
}

function parseStringArray(value: string | undefined): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function readLabelPreferences(accountId: string): LabelPreferences {
  const row = db.prepare(`
    SELECT hidden_gmail_label_ids, gmail_label_order FROM account_preferences WHERE account_id = ?
  `).get(accountId) as { hidden_gmail_label_ids: string; gmail_label_order?: string } | undefined

  if (!row) {
    return { hiddenLabelIds: [], labelOrder: [] }
  }

  return {
    hiddenLabelIds: parseStringArray(row.hidden_gmail_label_ids),
    labelOrder: parseStringArray(row.gmail_label_order),
  }
}

function writeLabelPreferences(accountId: string, preferences: LabelPreferences) {
  db.prepare(`
    INSERT INTO account_preferences (account_id, hidden_gmail_label_ids, gmail_label_order, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      hidden_gmail_label_ids = excluded.hidden_gmail_label_ids,
      gmail_label_order = excluded.gmail_label_order,
      updated_at = excluded.updated_at
  `).run(
    accountId,
    JSON.stringify([...new Set(preferences.hiddenLabelIds)]),
    JSON.stringify([...new Set(preferences.labelOrder)]),
    Date.now()
  )
}

function getAccountId(request: NextRequest): string | null {
  const sessionId = request.cookies.get('session')?.value
  if (!sessionId) return null

  const session = getSession(sessionId)
  return session?.account_id ?? null
}

export async function GET(request: NextRequest) {
  const accountId = getAccountId(request)
  if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(readLabelPreferences(accountId))
}

export async function POST(request: NextRequest) {
  const accountId = getAccountId(request)
  if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { labelId?: string }
  const labelId = body.labelId?.trim()
  if (!labelId) return NextResponse.json({ error: 'Label id required' }, { status: 400 })

  const preferences = readLabelPreferences(accountId)
  if (!preferences.hiddenLabelIds.includes(labelId)) preferences.hiddenLabelIds.push(labelId)
  writeLabelPreferences(accountId, preferences)

  return NextResponse.json(preferences)
}

export async function DELETE(request: NextRequest) {
  const accountId = getAccountId(request)
  if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const labelId = searchParams.get('labelId')?.trim()
  if (!labelId) return NextResponse.json({ error: 'Label id required' }, { status: 400 })

  const preferences = readLabelPreferences(accountId)
  preferences.hiddenLabelIds = preferences.hiddenLabelIds.filter((id) => id !== labelId)
  writeLabelPreferences(accountId, preferences)

  return NextResponse.json(preferences)
}

export async function PUT(request: NextRequest) {
  const accountId = getAccountId(request)
  if (!accountId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { labelOrder?: unknown }
  const labelOrder = Array.isArray(body.labelOrder)
    ? body.labelOrder.filter((item): item is string => typeof item === 'string')
    : null
  if (!labelOrder) return NextResponse.json({ error: 'Label order required' }, { status: 400 })

  const preferences = readLabelPreferences(accountId)
  preferences.labelOrder = labelOrder
  writeLabelPreferences(accountId, preferences)

  return NextResponse.json(preferences)
}
