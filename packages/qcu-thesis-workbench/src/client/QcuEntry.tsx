/** Session-scoped launcher for a native-owned QCU view; no task content is rendered here. */
import * as React from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { qcuBounds, resolveQcuNativeBridge } from '../native-contract.ts'
import type { QcuBounds } from '../native-contract.ts'
import { QcuPanelController } from './controller.ts'
import type { QcuEntryState } from './controller.ts'
import type { NS } from './locales.ts'
import styles from './styles.css'

type Localized = PropsLocale<typeof NS>
type EntryProps = PropsRuntime<'conversation.session.header.actions'> & Localized

function currentBridge() {
  const host = globalThis as typeof globalThis & { dshDesktop?: { qcu?: unknown } }
  try {
    return resolveQcuNativeBridge(host.dshDesktop?.qcu)
  } catch (_error) {
    // A failing optional preload getter means the fixed native capability is unavailable.
    return undefined
  }
}

function viewportBounds(element: HTMLElement): QcuBounds {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) throw new Error('QCU panel has no visible bounds')
  return qcuBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

function NativeFrame({ controller, phase, close, failed, t }: Localized & {
  controller: QcuPanelController
  phase: QcuEntryState['phase']
  close: () => void
  failed: () => void
}) {
  const frame = React.useRef<HTMLDialogElement>(null)
  const view = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()
  const noteId = React.useId()

  React.useLayoutEffect(() => {
    const dialog = frame.current
    const element = view.current
    if (!dialog || !element) return
    const resize = () => {
      try {
        void controller.resize(viewportBounds(element))
      } catch (_error) {
        failed()
      }
    }
    let observer: ResizeObserver | undefined
    try {
      observer = new ResizeObserver(resize)
      observer.observe(element)
      dialog.showModal()
      void controller.open(viewportBounds(element))
    } catch (_error) {
      observer?.disconnect()
      failed()
      return
    }
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', resize, true)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', resize, true)
      dialog.close()
    }
  }, [controller, failed])

  return (
    // Native dialog owns Escape/Tab behavior; its click handler dismisses only the backdrop.
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={frame}
      className="qcu-panel"
      aria-labelledby={titleId}
      aria-describedby={noteId}
      onCancel={event => { event.preventDefault(); close() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom) close()
      }}
    >
      <header className="qcu-panel-header">
        <h2 className="qcu-panel-title" id={titleId}>{t('title')}</h2>
        <button className="qcu-entry-button" type="button" disabled={phase !== 'open'} onClick={() => { void controller.back() }}>{t('back')}</button>
        <button className="qcu-entry-button" type="button" onClick={close} autoFocus>{t(phase === 'opening' ? 'cancel' : 'close')}</button>
      </header>
      <p className="qcu-panel-note" id={noteId}>{t('closeNote')}</p>
      <div ref={view} className="qcu-panel-view" data-qcu-native-placeholder="">
        {phase !== 'open' && <output className="qcu-panel-status">{t('opening')}</output>}
      </div>
    </dialog>
  )
}

function MountedEntry({ t }: Localized) {
  const [bridge] = React.useState(currentBridge)
  const [state, setState] = React.useState<QcuEntryState>({ availability: 'checking', phase: 'idle' })
  const [visible, setVisible] = React.useState(false)
  const visibleRef = React.useRef(false)
  const menu = React.useRef<HTMLDetailsElement>(null)
  const controller = React.useRef<QcuPanelController>()

  React.useEffect(() => {
    const owner = new QcuPanelController(bridge, next => {
      setState(next)
      if (next.phase === 'idle' && (next.availability === 'unavailable' || next.error)) {
        visibleRef.current = false
        setVisible(false)
      }
    })
    controller.current = owner
    void owner.checkAvailability()
    return () => {
      controller.current = undefined
      visibleRef.current = false
      void owner.dispose()
    }
  }, [bridge])

  const close = React.useCallback(() => {
    visibleRef.current = false
    setVisible(false)
    void controller.current?.close()
  }, [])
  const failed = React.useCallback(() => {
    close()
    setState({ availability: 'ready', phase: 'idle', error: 'failed' })
  }, [close])
  const disabled = state.availability !== 'ready' || visible || state.error === 'closeFailed'
  const canRetry = !!bridge && state.availability === 'unavailable' && state.error !== 'closeFailed'
  const label = state.availability === 'checking' ? 'checking' : state.availability === 'unavailable' ? (canRetry ? 'notReady' : 'unavailable') : 'entry'

  return (
    <span className="qcu-entry" data-qcu-entry="">
      <style data-qcu-client-style="">{styles}</style>
      <details ref={menu} className="qcu-tools" onKeyDown={event => {
        if (event.key === 'Escape' && menu.current) menu.current.open = false
      }} onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && menu.current) menu.current.open = false
      }}>
      <summary className="qcu-entry-button">{t('tools')}</summary>
      <span className="qcu-tools-items">
      <button
        className="qcu-entry-button"
        type="button"
        disabled={disabled}
        title={state.availability === 'unavailable' ? t(canRetry ? 'notReadyDetail' : 'unavailableDetail') : t('title')}
        aria-haspopup="dialog"
        aria-expanded={visible}
        onClick={() => {
          if (disabled || visibleRef.current || !controller.current) return
          if (menu.current) menu.current.open = false
          visibleRef.current = true
          setVisible(true)
        }}
      >{t(label)}</button>
      {canRetry && <button
        className="qcu-entry-button"
        type="button"
        title={t('notReadyDetail')}
        onClick={() => {
          const owner = controller.current
          if (!owner || owner.getSnapshot().availability !== 'unavailable') return
          void owner.checkAvailability()
        }}
      >{t('retry')}</button>}
      </span>
      </details>
      {state.error && <span className="qcu-entry-error" role="alert">{t(state.error)}</span>}
      {visible && controller.current && <NativeFrame controller={controller.current} phase={state.phase} close={close} failed={failed} t={t} />}
    </span>
  )
}

/**
 * Read only Session identity and main-view retain status to retire stale entries.
 * @param props - Official slot props; document data and projections are never inspected.
 * @returns The QCU entry for the current Session, or null for a retained background Session.
 */
export function QcuEntry({ sessionId, useSessionRetainInfo, t }: EntryProps) {
  const main = useSessionRetainInfo(info => (info?.retainedBy.mainView ?? 0) > 0)
  return main ? <MountedEntry key={sessionId} t={t} /> : null
}
