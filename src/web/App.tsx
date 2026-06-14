import {useState} from 'react';
import {Music, Settings, Users, type LucideIcon} from 'lucide-react';
import {
  AppShell,
  SideNav,
  SideNavHeading,
  SideNavSection,
  SideNavItem,
} from 'silver-ui';
import {ArtistsPanel} from './components/ArtistsPanel.js';
import {ReleasesFeed} from './components/ReleasesFeed.js';
import {SettingsPanel} from './components/SettingsPanel.js';

type View = 'releases' | 'artists' | 'settings';

const NAV: {id: View; label: string; icon: LucideIcon}[] = [
  {id: 'releases', label: 'Releases', icon: Music},
  {id: 'artists', label: 'Artists', icon: Users},
  {id: 'settings', label: 'Settings', icon: Settings},
];

export function App() {
  const [view, setView] = useState<View>('releases');

  return (
    <AppShell
      height="auto"
      contentPadding={6}
      sideNav={
        <SideNav
          header={
            <SideNavHeading
              heading="Silver Music Notifier"
              subheading="Track releases from your artists"
            />
          }>
          <SideNavSection isHeaderHidden title="Main nav">
            {NAV.map(n => (
              <SideNavItem
                key={n.id}
                label={n.label}
                icon={n.icon}
                isSelected={view === n.id}
                onClick={() => setView(n.id)}
              />
            ))}
          </SideNavSection>
        </SideNav>
      }>
      <div
        id={`${view}-panel`}
        role="tabpanel"
        aria-label={NAV.find(n => n.id === view)?.label}
        style={{maxWidth: 960, margin: '0 auto'}}>
        {view === 'releases' && <ReleasesFeed />}
        {view === 'artists' && <ArtistsPanel />}
        {view === 'settings' && <SettingsPanel />}
      </div>
    </AppShell>
  );
}
