import { useQuickAddStore } from '@/store/quickAddStore'
import { useCreateContract } from '@/hooks/useContracts'
import { CustomerFormModal } from '@/features/customers/CustomerFormModal'
import { ContactFormModal } from '@/features/contacts/ContactFormModal'
import { ProductFormModal } from '@/features/products/ProductFormModal'
import { PurchaseOrderFormModal } from '@/features/purchase-orders/PurchaseOrderFormModal'
import { InvoiceFormModal } from '@/features/invoices/InvoiceFormModal'
import { ContractWizard } from '@/components/contracts/ContractWizard'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/**
 * Mounted once at the app root. Every "create X" entry point in the app
 * (TopNavigation Quick Add, Dashboard Quick Actions, and each module page's
 * own "New X" button) invokes the SAME modal/wizard rendered here - there is
 * exactly one create flow per entity.
 */
export function QuickAddHost() {
  const activeEntity = useQuickAddStore((state) => state.activeEntity)
  const close = useQuickAddStore((state) => state.close)
  const createContract = useCreateContract()

  return (
    <>
      <CustomerFormModal isOpen={activeEntity === 'customer'} onClose={close} />
      <ContactFormModal isOpen={activeEntity === 'contact'} onClose={close} />
      <ProductFormModal isOpen={activeEntity === 'product'} onClose={close} />
      <PurchaseOrderFormModal isOpen={activeEntity === 'purchase-order'} onClose={close} />
      <InvoiceFormModal isOpen={activeEntity === 'invoice'} onClose={close} />
      {activeEntity === 'contract' && (
        <ErrorBoundary>
          <ContractWizard
            isOpen
            onClose={close}
            onSubmit={(data) => createContract.mutateAsync(data)}
          />
        </ErrorBoundary>
      )}
    </>
  )
}
