import {useEffect, useRef, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {
  Alert,
  Button,
  CheckboxGroup,
  CheckboxGroupItem,
  Heading,
  InputGroup,
  InputGroupText,
  Layout,
  LayoutContent,
  LayoutHeader,
  Link,
  NumberInput,
  PasswordInput,
  Select,
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
      showToast({
        type: 'success',
        body: 'Settings saved.',
        autoHideDuration: 1500,
      });
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

  const isGmail = settings.smtp.provider === 'gmail';
  // Gmail fills in the host automatically, so it only needs an address and
  // recipient; custom SMTP additionally needs a host.
  const smtpReady = isGmail
    ? Boolean(settings.smtp.user && settings.smtp.to)
    : Boolean(settings.smtp.host && settings.smtp.user && settings.smtp.to);

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
  const setPrimaryTypes = (value: string[]) => {
    commit({
      ...settings,
      releaseFilter: {
        ...settings.releaseFilter,
        primaryTypes: value as ReleaseGroupPrimaryType[],
      },
    });
  };
  const setExcludeSecondaryTypes = (value: string[]) => {
    commit({
      ...settings,
      releaseFilter: {
        ...settings.releaseFilter,
        excludeSecondaryTypes: value as ReleaseGroupSecondaryType[],
      },
    });
  };

  const testEmail = () => {
    testEmailMutation.mutate(settings);
  };

  return (
    <Layout
      height="auto"
      hasDividers={false}
      header={
        <LayoutHeader
          title="Settings"
          level={3}
          subtitle="Notifications, release filters, and email"
          padding={0}
        />
      }
      content={
        <LayoutContent padding={0}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
              maxWidth: 520,
              marginTop: 16,
            }}>
            <section
              style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <Heading level={4}>Notifications</Heading>
              <Switch
                label="In-page “New” badges"
                isSelected={settings.notify.inPage}
                onChange={v => setNotify({inPage: v})}
              />
              <Switch
                label="Email notifications"
                labelTooltip={
                  smtpReady
                    ? undefined
                    : 'Configure SMTP below to enable email.'
                }
                isSelected={settings.notify.email}
                isDisabled={!smtpReady}
                onChange={v => setNotify({email: v})}
              />
            </section>

            <section
              style={{display: 'flex', flexDirection: 'column', gap: 16}}>
              <Heading level={4}>Releases</Heading>
              <CheckboxGroup
                label="Track these release types"
                description="Unchecked types are filtered out when refreshing."
                value={settings.releaseFilter.primaryTypes}
                onChange={setPrimaryTypes}>
                {RELEASE_GROUP_PRIMARY_TYPES.map(type => (
                  <CheckboxGroupItem key={type} label={type} value={type} />
                ))}
              </CheckboxGroup>

              <CheckboxGroup
                label="Exclude these secondary types"
                description="A release carrying any checked type is filtered out."
                value={settings.releaseFilter.excludeSecondaryTypes}
                onChange={setExcludeSecondaryTypes}>
                {RELEASE_GROUP_SECONDARY_TYPES.map(type => (
                  <CheckboxGroupItem key={type} label={type} value={type} />
                ))}
              </CheckboxGroup>
            </section>

            <section
              style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <Heading level={4}>Email</Heading>
              {!settings.notify.email && (
                <Alert
                  status="warning"
                  container="section"
                  title="Email notifications are off"
                  description={
                    smtpReady
                      ? 'Turn on "Email notifications" above to receive these emails.'
                      : 'Finish the setup below, then turn on "Email notifications" above to receive these emails.'
                  }
                />
              )}
              <Select
                label="Email provider"
                value={settings.smtp.provider}
                options={[
                  {value: 'gmail', label: 'Gmail'},
                  {value: 'custom', label: 'Custom (SMTP)'},
                ]}
                onChange={v =>
                  commit({
                    ...settings,
                    smtp: {
                      ...settings.smtp,
                      provider: v === 'gmail' ? 'gmail' : 'custom',
                    },
                  })
                }
              />

              {isGmail ? (
                <>
                  <Text color="secondary">
                    Gmail needs an <strong>app password</strong>, not your
                    normal Google password. First turn on 2-Step Verification
                    for your account, then generate a 16-character app password
                    and paste it below. Your credentials are stored only on this
                    machine.{' '}
                    <Link
                      href="https://myaccount.google.com/apppasswords"
                      isExternalLink>
                      Create an app password
                    </Link>
                  </Text>
                  <InputGroup label="Gmail address">
                    <TextInput
                      label="Gmail address"
                      isLabelHidden
                      // Show only the local part; the full address (needed for
                      // SMTP auth) is reconstructed on change and kept in sync
                      // with `from`.
                      value={settings.smtp.user.replace(/@gmail\.com$/i, '')}
                      onChange={v => {
                        const local = v.replace(/@.*/, '').trim();
                        const addr = local ? `${local}@gmail.com` : '';
                        editSmtp({user: addr, from: addr});
                      }}
                      onBlur={commitCurrent}
                      placeholder="you"
                      autoComplete="off"
                    />
                    <InputGroupText>@gmail.com</InputGroupText>
                  </InputGroup>
                  <PasswordInput
                    label="App password"
                    description="The 16-character code from Google; spaces are OK."
                    value={settings.smtp.pass}
                    onChange={v => editSmtp({pass: v})}
                    onBlur={commitCurrent}
                  />
                  <TextInput
                    label="Send notifications to"
                    value={settings.smtp.to}
                    onChange={v => editSmtp({to: v})}
                    onBlur={commitCurrent}
                    placeholder="you@example.com"
                  />
                </>
              ) : (
                <>
                  <Text color="secondary">
                    Enter the SMTP details from your email provider. Look for
                    "SMTP" or "outgoing mail" settings in their help docs.
                    Credentials are stored only on this machine.
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
                      commit({
                        ...settings,
                        smtp: {...settings.smtp, secure: v},
                      })
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
                </>
              )}
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

            <section
              style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <Heading level={4}>MusicBrainz</Heading>
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
        </LayoutContent>
      }
    />
  );
}
