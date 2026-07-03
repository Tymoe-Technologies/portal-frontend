import { useState } from 'react'
import { Users, BookOpen } from 'lucide-react'
import ChannelManagement from '@/pages/OrderConfig/ChannelManagement'
import ChannelSettlement from '@/pages/OrderConfig/ChannelSettlement'
import { Tabs } from '@/components/ui-kit'

export default function ChannelManagementPage() {
  const [activeTab, setActiveTab] = useState('channels')

  return (
    <div className="max-w-6xl mx-auto px-6 py-6">
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'channels', label: '渠道列表', icon: <Users className="w-4 h-4" /> },
          { key: 'settlement', label: '账期结算', icon: <BookOpen className="w-4 h-4" /> },
        ]}
      />
      <div className="mt-5">
        {activeTab === 'channels' ? <ChannelManagement /> : <ChannelSettlement />}
      </div>
    </div>
  )
}
