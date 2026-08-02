import { useState } from 'react'
import { useMicrosoftStatus } from '@/hooks/useMicrosoft'
import { OneDrivePanel } from './OneDrivePanel'
import { OutlookPanel } from './OutlookPanel'
import { TeamsPanel } from './TeamsPanel'
import { EntraPanel } from './EntraPanel'

const SERVICE_TABS = [
  { key: 'onedrive', label: 'OneDrive', icon: '📁' },
  { key: 'outlook', label: 'Outlook', icon: '📧' },
  { key: 'teams', label: 'Teams', icon: '💬' },
  { key: 'entra', label: 'Entra ID', icon: '🔐' },
] as const

export function MicrosoftPanel() {
  const { data: status } = useMicrosoftStatus()
  const [activeTab, setActiveTab] = useState<string>('onedrive')

  const configured = status?.configured ?? false

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold">Microsoft 365 Integration</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {configured
              ? 'All services configured via environment variables'
              : 'Configure AZURE_* environment variables to enable these services'}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            configured
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}
        >
          {configured ? 'Configured' : 'Not Configured'}
        </span>
      </div>

      {/* Service tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        {SERVICE_TABS.map((tab) => {
          const svc = (status?.services || []).find((s) => s.provider === tab.key)
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {svc && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    svc.available ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Active panel */}
      {activeTab === 'onedrive' && <OneDrivePanel configured={configured} />}
      {activeTab === 'outlook' && <OutlookPanel configured={configured} />}
      {activeTab === 'teams' && <TeamsPanel configured={configured} />}
      {activeTab === 'entra' && <EntraPanel configured={configured} />}
    </div>
  )
}
