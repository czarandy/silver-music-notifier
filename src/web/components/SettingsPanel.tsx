import {useEffect, useState} from 'react';
import {
  Button,
  CheckboxInput,
  Heading,
  NumberInput,
  PasswordInput,
  Spinner,
  Switch,
  Text,
  TextInput,
  useToast,
} from 'silver-ui';
import {api, type Settings} from '../api.js';
import {
  RELEASE_GROUP_PRIMARY_TYPES,
  RELEASE_GROUP_SECONDARY_TYPES,
  type ReleaseGroupPrimaryType,
  type ReleaseGroupSecondaryType,
} from '../../lib/releaseTypes.js';

export function SettingsPanel() {
  const showToast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);

  if (!settings) {
    return <Spinner label="Loading settings…" />;
  }

  const smtpReady = Boolean(
    settings.smtp.host && settings.smtp.user && settings.smtp.to,
  );

  function patchNotify(p: Partial<Settings['notify']>) {
    setSettings(s => (s ? {...s, notify: {...s.notify, ...p}} : s));
  }
  function patchSmtp(p: Partial<Settings['smtp']>) {
    setSettings(s => (s ? {...s, smtp: {...s.smtp, ...p}} : s));
  }
  function togglePrimaryType(type: ReleaseGroupPrimaryType, enabled: boolean) {
    setSettings(s => {
      if (!s) {
        return s;
      }
      const current = s.releaseFilter.primaryTypes;
      const primaryTypes = enabled
        ? RELEASE_GROUP_PRIMARY_TYPES.filter(
            t => current.includes(t) || t === type,
          )
        : current.filter(t => t !== type);
      return {...s, releaseFilter: {...s.releaseFilter, primaryTypes}};
    });
  }
  function toggleExcludeSecondaryType(
    type: ReleaseGroupSecondaryType,
    excluded: boolean,
  ) {
    setSettings(s => {
      if (!s) {
        return s;
      }
      const current = s.releaseFilter.excludeSecondaryTypes;
      const excludeSecondaryTypes = excluded
        ? RELEASE_GROUP_SECONDARY_TYPES.filter(
            t => current.includes(t) || t === type,
          )
        : current.filter(t => t !== type);
      return {...s, releaseFilter: {...s.releaseFilter, excludeSecondaryTypes}};
    });
  }

  async function save() {
    if (!settings) {
      return;
    }
    setSaving(true);
    try {
      setSettings(await api.saveSettings(settings));
      showToast({type: 'success', body: 'Settings saved.'});
    } catch (err) {
      showToast({type: 'error', body: errMsg(err)});
    } finally {
      setSaving(false);
    }
  }

  async function testEmail() {
    if (!settings) {
      return;
    }
    setTesting(true);
    try {
      await api.testEmail(settings);
      showToast({type: 'success', body: 'Test email sent.'});
    } catch (err) {
      showToast({type: 'error', body: errMsg(err)});
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        maxWidth: 520,
      }}>
      <section style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <Heading level={2}>Notifications</Heading>
        <Switch
          label="In-page “New” badges"
          isSelected={settings.notify.inPage}
          onChange={v => patchNotify({inPage: v})}
        />
        <Switch
          label="Desktop notifications"
          isSelected={settings.notify.desktop}
          onChange={v => patchNotify({desktop: v})}
        />
        <Switch
          label="Email notifications"
          description={
            smtpReady ? undefined : 'Configure SMTP below to enable email.'
          }
          isSelected={settings.notify.email}
          isDisabled={!smtpReady}
          onChange={v => patchNotify({email: v})}
        />
      </section>

      <section style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <Heading level={2}>Releases</Heading>
        <Text color="secondary">
          Which release types to track. Unchecked types are filtered out when
          refreshing.
        </Text>
        {RELEASE_GROUP_PRIMARY_TYPES.map(type => (
          <CheckboxInput
            key={type}
            label={type}
            value={settings.releaseFilter.primaryTypes.includes(type)}
            onChange={checked => togglePrimaryType(type, checked)}
          />
        ))}

        <Text color="secondary">
          Exclude releases with any of these secondary types. None excluded by
          default.
        </Text>
        {RELEASE_GROUP_SECONDARY_TYPES.map(type => (
          <CheckboxInput
            key={type}
            label={`Exclude ${type}`}
            value={settings.releaseFilter.excludeSecondaryTypes.includes(type)}
            onChange={checked => toggleExcludeSecondaryType(type, checked)}
          />
        ))}
      </section>

      <section style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <Heading level={2}>Email (SMTP)</Heading>
        <Text color="secondary">
          Credentials are stored locally on this machine.
        </Text>
        <TextInput
          label="SMTP host"
          value={settings.smtp.host}
          onChange={v => patchSmtp({host: v})}
          placeholder="smtp.example.com"
        />
        <NumberInput
          label="Port"
          value={settings.smtp.port}
          onChange={v => patchSmtp({port: v ?? 587})}
          min={1}
          max={65535}
          isIntegerOnly
        />
        <Switch
          label="Use TLS (secure)"
          isSelected={settings.smtp.secure}
          onChange={v => patchSmtp({secure: v})}
        />
        <TextInput
          label="Username"
          value={settings.smtp.user}
          onChange={v => patchSmtp({user: v})}
          autoComplete="off"
        />
        <PasswordInput
          label="Password"
          value={settings.smtp.pass}
          onChange={v => patchSmtp({pass: v})}
        />
        <TextInput
          label="From address"
          value={settings.smtp.from}
          onChange={v => patchSmtp({from: v})}
          placeholder="notifier@example.com"
        />
        <TextInput
          label="Send notifications to"
          value={settings.smtp.to}
          onChange={v => patchSmtp({to: v})}
          placeholder="you@example.com"
        />
      </section>

      <section style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <Heading level={2}>MusicBrainz</Heading>
        <TextInput
          label="Contact (for the MusicBrainz API User-Agent)"
          description="An email or URL, per MusicBrainz API etiquette."
          value={settings.musicbrainz.contact}
          onChange={v =>
            setSettings(s => (s ? {...s, musicbrainz: {contact: v}} : s))
          }
        />
      </section>

      <div style={{display: 'flex', gap: 8}}>
        <Button
          label="Save settings"
          variant="primary"
          isLoading={saving}
          onClick={save}
        />
        <Button
          label="Send test email"
          variant="secondary"
          isLoading={testing}
          isDisabled={!smtpReady}
          onClick={testEmail}
        />
      </div>
    </div>
  );
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
