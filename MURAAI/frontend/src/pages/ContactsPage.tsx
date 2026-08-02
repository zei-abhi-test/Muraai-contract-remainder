import { useState } from 'react'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { useContacts, useDeleteContact } from '@/hooks/useContacts'
import { useCustomers } from '@/hooks/useCustomers'
import { ContactFormModal } from '@/features/contacts/ContactFormModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { DataTable, type Column, Button, PageHeader } from '@/components/ui'
import { useQuickAddStore } from '@/store/quickAddStore'
import { toast } from 'sonner'
import { queryClient } from '@/lib/react-query'
import { queryKeys } from '@/lib/react-query'
import type { Contact } from '@/api/contacts'

export function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null)
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const openQuickAdd = useQuickAddStore((state) => state.open)

  const { data: contacts, isLoading: contactsLoading, error: contactsError } = useContacts()
  const { data: customers } = useCustomers()
  const deleteContact = useDeleteContact()

  const customerNameById = new Map((customers || []).map((c) => [c.id, c.name]))

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const filteredContacts = contacts?.filter(contact =>
    contact.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (!sortField) return 0
    const aVal = a[sortField as keyof Contact]
    const bVal = b[sortField as keyof Contact]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = String(aVal).localeCompare(String(bVal))
    return sortDir === 'asc' ? cmp : -cmp
  })

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingContact(null)
  }

  const handleConfirmDelete = () => {
    if (!deletingContact) return
    deleteContact.mutate(deletingContact.id, {
      onSuccess: () => {
        toast.success(`Contact "${deletingContact.contact_name}" deleted`)
        setDeletingContact(null)
        queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() })
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.error || err?.message || 'Failed to delete contact')
        setDeletingContact(null)
      },
    })
  }

  const columns: Column<Contact>[] = [
    {
      key: 'contact_name',
      header: 'Name',
      sortable: true,
      render: c => (
        <div>
          <div className="font-medium">{c.contact_name}</div>
          {c.designation && <div className="text-sm text-muted-foreground">{c.designation}</div>}
        </div>
      ),
    },
    {
      key: 'customer_id',
      header: 'Customer',
      render: c => <span className="text-sm text-muted-foreground">{customerNameById.get(c.customer_id) || '-'}</span>,
    },
    { key: 'email', header: 'Email', render: c => <span className="text-sm text-muted-foreground">{c.email || '-'}</span> },
    { key: 'contact_number', header: 'Phone', render: c => <span className="text-sm text-muted-foreground">{c.contact_number || '-'}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: c => (
        <div className="flex items-center gap-2">
          <button onClick={() => handleEdit(c)} className="p-2 hover:bg-accent rounded-lg" aria-label={`Edit ${c.contact_name}`}>
            <Edit className="w-4 h-4" />
          </button>
          <button onClick={() => setDeletingContact(c)} className="p-2 hover:bg-accent rounded-lg text-destructive" aria-label={`Delete ${c.contact_name}`}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Manage contact persons for your customers."
        breadcrumbs={[{ label: 'Contacts' }]}
        action={
          <button onClick={() => openQuickAdd('contact')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        }
      />

      <div
        className="bg-card border border-border rounded-xl p-6">
        <DataTable
          columns={columns}
          data={sortedContacts}
          keyExtractor={c => c.id}
          isLoading={contactsLoading}
          error={contactsError ? 'Failed to load contacts. Please try again.' : null}
          emptyMessage={searchQuery ? 'No contacts match your search.' : 'No contacts yet'}
          emptyAction={!searchQuery ? (
            <Button onClick={() => openQuickAdd('contact')}>
              <Plus className="w-4 h-4" /> Add Contact
            </Button>
          ) : undefined}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search contacts..."
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      <ContactFormModal isOpen={isModalOpen} onClose={handleModalClose} contact={editingContact} />
      <ConfirmDeleteModal isOpen={!!deletingContact} title={`Delete contact "${deletingContact?.contact_name}"?`}
        isDeleting={deleteContact.isPending} onCancel={() => setDeletingContact(null)} onConfirm={handleConfirmDelete} />
    </div>
  )
}
