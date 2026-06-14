import {useState} from 'react';
import {Heading, Tab, Tabs, Text} from 'silver-ui';
import {ArtistsPanel} from './components/ArtistsPanel.js';
import {ReleasesFeed} from './components/ReleasesFeed.js';
import {SettingsPanel} from './components/SettingsPanel.js';

type View = 'releases' | 'artists' | 'settings';

const NAV: {id: View; label: string}[] = [
  {id: 'releases', label: 'Releases'},
  {id: 'artists', label: 'Artists'},
  {id: 'settings', label: 'Settings'},
];

export function App() {
  const [view, setView] = useState<View>('releases');

  return (
    <div style={{maxWidth: 960, margin: '0 auto', padding: '24px 16px'}}>
      <header style={{marginBottom: 8}}>
        <Heading level={1}>Silver Music Notifier</Heading>
        <Text color="secondary">New releases from the artists you follow.</Text>
      </header>

      <Tabs
        label="Sections"
        value={view}
        onChange={value => setView(value as View)}
        hasDivider
        style={{margin: '16px 0 24px'}}>
        {NAV.map(n => (
          <Tab
            key={n.id}
            id={`${n.id}-tab`}
            controls={`${n.id}-panel`}
            label={n.label}
            value={n.id}
          />
        ))}
      </Tabs>

      <main
        id={`${view}-panel`}
        role="tabpanel"
        aria-labelledby={`${view}-tab`}>
        {view === 'releases' && <ReleasesFeed />}
        {view === 'artists' && <ArtistsPanel />}
        {view === 'settings' && <SettingsPanel />}
      </main>
    </div>
  );
}
