import { useState } from "react";
import { Button, Heading, Text } from "silver-ui";
import { ArtistsPanel } from "./components/ArtistsPanel.js";
import { ReleasesFeed } from "./components/ReleasesFeed.js";
import { SettingsPanel } from "./components/SettingsPanel.js";

type View = "releases" | "artists" | "settings";

const NAV: { id: View; label: string }[] = [
  { id: "releases", label: "Releases" },
  { id: "artists", label: "Artists" },
  { id: "settings", label: "Settings" },
];

export function App() {
  const [view, setView] = useState<View>("releases");

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <header style={{ marginBottom: 8 }}>
        <Heading level={1}>Silver Music Notifier</Heading>
        <Text color="secondary">New releases from the artists you follow.</Text>
      </header>

      <nav style={{ display: "flex", gap: 8, margin: "16px 0 24px" }}>
        {NAV.map((n) => (
          <Button
            key={n.id}
            label={n.label}
            variant={view === n.id ? "primary" : "ghost"}
            onClick={() => setView(n.id)}
          />
        ))}
      </nav>

      <main>
        {view === "releases" && <ReleasesFeed />}
        {view === "artists" && <ArtistsPanel />}
        {view === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
}
