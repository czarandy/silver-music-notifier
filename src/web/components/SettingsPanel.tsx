import {useEffect, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  // JSON of the last value persisted to the server, so we can skip no-op saves
  // (e.g. blurring a text field that wasn't edited).
  const savedRef = useRef<string>('');
  const saveMutation = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: saved => {
      queryClient.setQueryData(['settings'], saved);
      savedRef.current = JSON.stringify(saved);
      setSettings(saved);
      showToast({type: 'success', body: 'Settings saved.'});
    },
  });
  const testEmailMutation = useMutation({
    mutationFn: api.testEmail,
    onSuccess: () => {
      showToast({type: 'success', body: 'Test email sent.'});
    },
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    const serialized = JSON.stringify(settingsQuery.data);
    setSettings(settingsQuery.data);
    savedRef.current = serialized;
  }, [settingsQuery.data]);

  if (!settings) {
    return <Spinner label="Loading settings…" />;
  }

  const smtpReady = Boolean(
    settings.smtp.host && settings.smtp.user && settings.smtp.to,
  );

  // Persist a settings object if it differs from what's already saved. Defined
  // as const arrows so TypeScript keeps `settings` narrowed to non-null inside.
  const persist = (next: Settings) => {
    if (JSON.stringify(next) === savedRef.current) {
      return;
    }
    saveMutation.mutate(next);
  };

  // Discrete controls (switches, checkboxes): update locally and save right away.
  const commit = (next: Settings) => {
    setSettings(next);
    persist(next);
  };
  // Text fields: edit locally; the save happens on blur via commitCurrent.
  const editSmtp = (p: Partial<Settings['smtp']>) => {
    setSettings({...settings, smtp: {...settings.smtp, ...p}});
  };
  const commitCurrent = () => {
    persist(settings);
  };

  const setNotify = (p: Partial<Settings['notify']>) => {
    commit({...settings, notify: {...settings.notify, ...p}});
  };
  const togglePrimaryType = (
    type: ReleaseGroupPrimaryType,
    enabled: boolean,
  ) => {
    const current = settings.releaseFilter.primaryTypes;
    const primaryTypes = enabled
      ? RELEASE_GROUP_PRIMARY_TYPES.filter(
          t => current.includes(t) || t === type,
        )
      : current.filter(t => t !== type);
    commit({
      ...settings,
      releaseFilter: {...settings.releaseFilter, primaryTypes},
    });
  };
  const toggleExcludeSecondaryType = (
    type: ReleaseGroupSecondaryType,
    excluded: boolean,
  ) => {
    const current = settings.releaseFilter.excludeSecondaryTypes;
    const excludeSecondaryTypes = excluded
      ? RELEASE_GROUP_SECONDARY_TYPES.filter(
          t => current.includes(t) || t === type,
        )
      : current.filter(t => t !== type);
    commit({
      ...settings,
      releaseFilter: {...settings.releaseFilter, excludeSecondaryTypes},
    });
  };

  const testEmail = () => {
    testEmailMutation.mutate(settings);
  };

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
          onChange={v => setNotify({inPage: v})}
        />
        <Switch
          label="Desktop notifications"
          isSelected={settings.notify.desktop}
          onChange={v => setNotify({desktop: v})}
        />
        <Switch
          label="Email notifications"
          description={
            smtpReady ? undefined : 'Configure SMTP below to enable email.'
          }
          isSelected={settings.notify.email}
          isDisabled={!smtpReady}
          onChange={v => setNotify({email: v})}
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
          Exclude releases with any of these secondary types.
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
          onChange={v => editSmtp({host: v})}
          onBlur={commitCurrent}
          placeholder="smtp.example.com"
        />
        <NumberInput
          label="Port"
          value={settings.smtp.port}
          onChange={v => editSmtp({port: v ?? 587})}
          onBlur={commitCurrent}
          min={1}
          max={65535}
          isIntegerOnly
        />
        <Switch
          label="Use TLS (secure)"
          isSelected={settings.smtp.secure}
          onChange={v =>
            commit({...settings, smtp: {...settings.smtp, secure: v}})
          }
        />
        <TextInput
          label="Username"
          value={settings.smtp.user}
          onChange={v => editSmtp({user: v})}
          onBlur={commitCurrent}
          autoComplete="off"
        />
        <PasswordInput
          label="Password"
          value={settings.smtp.pass}
          onChange={v => editSmtp({pass: v})}
          onBlur={commitCurrent}
        />
        <TextInput
          label="From address"
          value={settings.smtp.from}
          onChange={v => editSmtp({from: v})}
          onBlur={commitCurrent}
          placeholder="notifier@example.com"
        />
        <TextInput
          label="Send notifications to"
          value={settings.smtp.to}
          onChange={v => editSmtp({to: v})}
          onBlur={commitCurrent}
          placeholder="you@example.com"
        />
        <div>
          <Button
            label="Send test email"
            variant="secondary"
            isLoading={testEmailMutation.isPending}
            isDisabled={!smtpReady}
            onClick={testEmail}
          />
        </div>
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
          onBlur={commitCurrent}
        />
      </section>
    </div>
  );
}
