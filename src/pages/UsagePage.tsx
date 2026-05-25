/**
 * Usage page - embeds an external usage dashboard inside an iframe.
 * The iframe URL is configurable per browser via localStorage.
 */

import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import {
  IconExternalLink,
  IconSettings,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useAuthStore, useNotificationStore } from '@/stores';
import styles from './UsagePage.module.scss';

const STORAGE_KEY = 'usagePage.iframeUrl';
const DEFAULT_URL = '/usage';

const resolveIframeUrl = (value: string, apiBase: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = apiBase.trim() || window.location.origin;
  return new URL(trimmed, base.endsWith('/') ? base : `${base}/`).toString();
};

export function UsagePage() {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const apiBase = useAuthStore((state) => state.apiBase);

  const [savedUrl, setSavedUrl] = useLocalStorage<string>(STORAGE_KEY, DEFAULT_URL);
  const [configOpen, setConfigOpen] = useState(false);
  const [draftUrl, setDraftUrl] = useState(savedUrl);
  const [draftError, setDraftError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const trimmedUrl = useMemo(() => savedUrl.trim(), [savedUrl]);
  const iframeUrl = useMemo(() => resolveIframeUrl(trimmedUrl, apiBase), [apiBase, trimmedUrl]);
  const hasUrl = iframeUrl.length > 0;

  const reloadFrame = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useHeaderRefresh(async () => {
    reloadFrame();
  });

  const openConfig = useCallback(() => {
    setDraftUrl(savedUrl);
    setDraftError('');
    setConfigOpen(true);
  }, [savedUrl]);

  const closeConfig = useCallback(() => {
    setConfigOpen(false);
    setDraftError('');
  }, []);

  const validateUrl = useCallback(
    (value: string): string => {
      const trimmed = value.trim();
      if (!trimmed) {
        return t('usage.url_required', { defaultValue: 'URL is required.' });
      }
      if (trimmed.startsWith('/')) return '';
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return t('usage.url_invalid', {
            defaultValue: 'Only http(s) URLs or root-relative paths are allowed.',
          });
        }
        return '';
      } catch {
        return t('usage.url_invalid', {
          defaultValue: 'Only http(s) URLs or root-relative paths are allowed.',
        });
      }
    },
    [t]
  );

  const handleSave = useCallback(
    (event?: FormEvent) => {
      event?.preventDefault();
      const error = validateUrl(draftUrl);
      if (error) {
        setDraftError(error);
        return;
      }
      const next = draftUrl.trim();
      setSavedUrl(next);
      setConfigOpen(false);
      setDraftError('');
      reloadFrame();
      showNotification(
        t('usage.config_saved', { defaultValue: 'Usage URL updated.' }),
        'success'
      );
    },
    [draftUrl, reloadFrame, setSavedUrl, showNotification, t, validateUrl]
  );

  const handleReset = useCallback(() => {
    setDraftUrl(DEFAULT_URL);
    setDraftError('');
  }, []);

  const handleOpenInNewTab = useCallback(() => {
    if (!hasUrl) return;
    window.open(iframeUrl, '_blank', 'noopener,noreferrer');
  }, [hasUrl, iframeUrl]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('usage.title')}</h1>
        <div className={styles.actions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={openConfig}
            title={t('usage.configure')}
            aria-label={t('usage.configure')}
          >
            <IconSettings size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenInNewTab}
            disabled={!hasUrl}
            title={t('usage.open_in_new_tab', { defaultValue: 'Open in new tab' })}
            aria-label={t('usage.open_in_new_tab', { defaultValue: 'Open in new tab' })}
          >
            <IconExternalLink size={16} />
          </Button>
        </div>
      </div>

      <div className={styles.frameWrapper}>
        {hasUrl ? (
          <iframe
            ref={iframeRef}
            key={`${iframeUrl}#${reloadKey}`}
            src={iframeUrl}
            title={t('usage.title')}
            className={styles.frame}
            referrerPolicy="same-origin"
          />
        ) : (
          <div className={styles.emptyState}>
            {t('usage.empty_url', {
              defaultValue: 'Configure an iframe URL to display the usage view.',
            })}
          </div>
        )}
      </div>

      <Modal
        open={configOpen}
        onClose={closeConfig}
        title={t('usage.config_title', { defaultValue: 'Usage iframe URL' })}
        footer={
          <>
            <Button variant="ghost" onClick={handleReset}>
              {t('usage.reset_default', { defaultValue: 'Reset to default' })}
            </Button>
            <Button variant="secondary" onClick={closeConfig}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => handleSave()}>{t('common.save')}</Button>
          </>
        }
      >
        <form className={styles.modalBody} onSubmit={handleSave}>
          <p className={styles.modalHint}>
            {t('usage.config_hint', {
              defaultValue:
                'The URL is stored in your browser only. Use a root-relative path (e.g. /usage) or a full http(s) URL.',
            })}
          </p>
          <Input
            label={t('usage.url_label', { defaultValue: 'Iframe URL' })}
            value={draftUrl}
            onChange={(event) => {
              setDraftUrl(event.target.value);
              if (draftError) setDraftError('');
            }}
            placeholder={DEFAULT_URL}
            error={draftError}
            autoFocus
          />
        </form>
      </Modal>
    </div>
  );
}
