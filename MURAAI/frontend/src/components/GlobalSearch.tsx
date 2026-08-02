import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, FileText, Building2, Users, Package, ShoppingCart, Receipt,
  FolderOpen, ArrowRight, RefreshCw, Settings, LayoutDashboard,
  Command, Calendar, BarChart3, Clock, Loader2,
  Briefcase, MessageCircle, CheckSquare, CheckCircle, Inbox,
} from 'lucide-react'
import { useGlobalSearch } from '@/hooks/useSearch'
import { COMMANDS, type SearchResult } from '@/api/search'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (page: string, itemId?: string) => void
}

const RECENT_KEY = 'recent-searches'
const MAX_RECENT = 5

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}

function saveRecent(query: string) {
  const list = getRecent().filter(s => s !== query)
  list.unshift(query)
  if (list.length > MAX_RECENT) list.length = MAX_RECENT
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

function removeRecent(query: string) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter(s => s !== query)))
}

const SEARCH_ICONS: Record<string, React.ElementType> = {
  contract: FileText, customer: Building2, contact: Users,
  product: Package, po: ShoppingCart, invoice: Receipt, document: FolderOpen,
  calendar_event: Calendar, report: BarChart3,
  renewal: RefreshCw, vendor: Briefcase, comment: MessageCircle,
  task: CheckSquare, approval: CheckCircle,
}

const COMMAND_ICONS: Record<string, React.ElementType> = {
  'create-contract': FileText, 'create-customer': Building2,
  'create-contact': Users, 'create-product': Package,
  'create-invoice': Receipt, 'create-po': ShoppingCart,
  'renew-contract': RefreshCw, 'navigate-renewals': RefreshCw,
  'navigate-approvals': CheckCircle, 'navigate-inbox': Inbox,
  'navigate-settings': Settings, 'navigate-dashboard': LayoutDashboard,
  'navigate-calendar': Calendar, 'navigate-reports': BarChart3,
}

const PAGE_MAP: Record<string, string> = {
  contract: 'contract-workspace', customer: 'customers', contact: 'contacts',
  product: 'products', po: 'purchase-orders', invoice: 'invoices',
  document: 'documents', calendar_event: 'calendar', report: 'reports',
  renewal: 'renewal-workspace', vendor: 'purchase-orders',
  comment: 'operational-inbox', task: 'operational-inbox',
  approval: 'approvals',
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    contract: 'bg-blue-100 text-blue-700', customer: 'bg-green-100 text-green-700',
    contact: 'bg-teal-100 text-teal-700', product: 'bg-purple-100 text-purple-700',
    po: 'bg-orange-100 text-orange-700', invoice: 'bg-pink-100 text-pink-700',
    document: 'bg-yellow-100 text-yellow-700',
    calendar_event: 'bg-rose-100 text-rose-700', report: 'bg-indigo-100 text-indigo-700',
    renewal: 'bg-cyan-100 text-cyan-700', vendor: 'bg-emerald-100 text-emerald-700',
    comment: 'bg-violet-100 text-violet-700', task: 'bg-sky-100 text-sky-700',
    approval: 'bg-lime-100 text-lime-700',
  }
  return map[type] || 'bg-gray-100 text-gray-700'
}

function cmdColor(id: string): string {
  return id.startsWith('create-') ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'
}

type FlatItem =
  | { kind: 'section'; label: string }
  | { kind: 'result'; id: string; icon: React.ElementType; color: string; title: string; subtitle: string; type: string; entity_id: number; page: string }
  | { kind: 'command'; id: string; icon: React.ElementType; color: string; label: string; action: string; page: string }

export function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecent)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const showRecent = query.length === 0 && recentSearches.length > 0

  useFocusTrap(containerRef, isOpen)
  useEscapeKey(isOpen, onClose)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  const { data: searchResults, isLoading } = useGlobalSearch(debouncedQuery)

  const results = (searchResults as SearchResult[]) || []

  const mappedCommands = useMemo((): FlatItem[] => {
    const lq = query.toLowerCase()
    const cmds = COMMANDS.filter(c => !lq || c.label.toLowerCase().includes(lq))
    if (!cmds.length) return []
    const items: FlatItem[] = [{ kind: 'section', label: 'Commands' }]
    cmds.forEach(c => {
      items.push({
        kind: 'command', id: c.id,
        icon: COMMAND_ICONS[c.id] || Command,
        color: cmdColor(c.id), label: c.label,
        action: c.action, page: c.page,
      })
    })
    return items
  }, [query])

  const mappedResults = useMemo((): FlatItem[] => {
    if (!results.length) return []
    const items: FlatItem[] = [{ kind: 'section', label: 'Search Results' }]
    results.forEach(r => {
      items.push({
        kind: 'result', id: r.id,
        icon: SEARCH_ICONS[r.type] || FileText,
        color: typeColor(r.type), title: r.title, subtitle: r.subtitle,
        type: r.type, entity_id: r.entity_id, page: PAGE_MAP[r.type] || 'dashboard',
      })
    })
    return items
  }, [results])

  const items = useMemo((): FlatItem[] => {
    if (showRecent) return []
    if (query.length < 2) return mappedCommands
    if (results.length > 0) return [...mappedResults, ...mappedCommands]
    return mappedCommands
  }, [query, showRecent, mappedCommands, mappedResults, results.length])

  const nonSectionItems = useMemo(() => items.filter(i => i.kind !== 'section'), [items])
  const activeDescendantId = nonSectionItems.length > 0 ? `gs-item-${selectedIndex}` : undefined

  const handleNavigate = useCallback((item: FlatItem) => {
    if (query.length >= 2) saveRecent(query)
    if (item.kind === 'command') {
      onClose(); onNavigate(item.page)
    } else {
      onClose(); onNavigate(item.page, String(item.entity_id))
    }
  }, [query, onClose, onNavigate])

  useEffect(() => {
    if (isOpen) { setQuery(''); setDebouncedQuery(''); setSelectedIndex(0); setRecentSearches(getRecent()) }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const count = nonSectionItems.length
    if (count === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => (p + 1) % count) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => (p - 1 + count) % count) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const item = nonSectionItems[selectedIndex]
      if (item) handleNavigate(item)
    }
  }, [nonSectionItems, selectedIndex, handleNavigate])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh]"
        aria-hidden="true"
      >
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text" value={query} autoFocus
                onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
                onKeyDown={handleKeyDown}
                placeholder="Search everything — contracts, renewals, vendors, tasks..."
                role="combobox"
                aria-expanded={nonSectionItems.length > 0}
                aria-autocomplete="list"
                aria-activedescendant={activeDescendantId}
                aria-controls="gs-results"
                className="w-full pl-10 pr-12 py-3 bg-background border border-input rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <kbd className="px-1.5 py-0.5 text-[10px] bg-muted rounded font-mono">ESC</kbd>
              </div>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto" role="listbox" aria-label="Search results">
            {isLoading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="ml-2 text-sm">Searching...</span>
              </div>
            )}

            {showRecent && !isLoading && (
              <div className="p-2">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Searches
                </div>
                {recentSearches.map((s, i) => (
                  <div key={s} className="flex items-center group">
                    <button
                      onClick={() => setQuery(s)}
                      className="flex-1 flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{s}</span>
                    </button>
                    <button
                      onClick={() => { removeRecent(s); setRecentSearches(getRecent()) }}
                      className="p-1.5 mr-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${s}`}
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && items.length === 0 && !showRecent && (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">{query.length >= 2 ? 'No results found' : 'Start typing to search...'}</p>
                <p className="text-sm mt-1">{query.length >= 2 ? 'Try a different search term' : 'Search across contracts, renewals, vendors, customers, tasks, approvals, and more'}</p>
              </div>
            )}

            {!isLoading && items.length > 0 && (
              <div className="p-2" id="gs-results">
                {items.map((item, index) => {
                  if (item.kind === 'section') {
                    return (
                      <div key={item.label} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" role="presentation">
                        {item.label}
                      </div>
                    )
                  }
                  const flatIndex = nonSectionItems.indexOf(item)
                  const isSelected = flatIndex === selectedIndex
                  const itemId = `gs-item-${flatIndex}`

                  if (item.kind === 'command') {
                    const Icon = item.icon
                    return (
                      <motion.button
                        key={item.id}
                        id={itemId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: flatIndex * 0.02 }}
                        onClick={() => handleNavigate(item)}
                        className={cn(
                          'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                          isSelected ? 'bg-accent' : 'hover:bg-accent'
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className={cn('p-2 rounded-lg', item.color)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.action === 'create' ? 'Create new entity' : 'Navigate to page'}
                          </div>
                        </div>
                        {isSelected && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
                      </motion.button>
                    )
                  }

                  const Icon = item.icon
                  return (
                    <motion.button
                      key={item.id}
                      id={itemId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: flatIndex * 0.02 }}
                      onClick={() => handleNavigate(item)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                        isSelected ? 'bg-accent' : 'hover:bg-accent'
                      )}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <div className={cn('p-2 rounded-lg', item.color)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                      </div>
                      {isSelected && <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    </motion.button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">&uarr;&darr;</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">&crarr;</kbd> Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">ESC</kbd> Close
              </span>
            </div>
            <div>
              {showRecent ? `${recentSearches.length} recent` : `${nonSectionItems.length} result${nonSectionItems.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
