/** Locale-owned copy for the QCU entry and empty native-panel frame. */
export const NS = 'qcu-thesis-workbench'

/** English copy contains no native errors or document-derived fields. */
export const en = {
  tools: 'Tools',
  entry: 'Thesis check',
  checking: 'Thesis check · checking',
  unavailable: 'Thesis check · not enabled',
  unavailableDetail: 'The isolated QCU panel is not enabled in this desktop build',
  notReady: 'Thesis check · not ready',
  notReadyDetail: 'The isolated QCU panel may still be starting. Retry to check availability',
  retry: 'Retry thesis check',
  title: 'QCU thesis check',
  opening: 'Opening the isolated QCU panel…',
  back: 'Back',
  close: 'Close panel',
  cancel: 'Cancel opening',
  closeNote: 'Closing this panel does not stop a check already running',
  failed: 'The isolated QCU panel could not be opened',
  closeFailed: 'The native panel could not be closed. Restart the desktop app before trying again',
} as const

/** Keys registered in the official Client locale service. */
export type QcuKey = keyof typeof en

/** Chinese dictionary uses exactly the English dictionary keys. */
export const zh: Record<QcuKey, string> = {
  tools: '工具',
  entry: '论文检查',
  checking: '论文检查 · 检查中',
  unavailable: '论文检查 · 未启用',
  unavailableDetail: '当前桌面版本尚未启用 QCU 隔离面板',
  notReady: '论文检查 · 尚未就绪',
  notReadyDetail: 'QCU 隔离面板可能仍在启动，请重试以检查是否就绪',
  retry: '重试论文检查',
  title: 'QCU 论文检查',
  opening: '正在打开 QCU 隔离面板…',
  back: '返回',
  close: '关闭面板',
  cancel: '取消打开',
  closeNote: '关闭面板不会停止已在运行的检查',
  failed: '无法打开 QCU 隔离面板',
  closeFailed: '无法关闭原生面板，请重启桌面应用后再试',
}
