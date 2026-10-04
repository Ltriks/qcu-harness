/** Styles are embedded as text and owned by the mounted entry. */
declare module '*.css' {
  const text: string
  export default text
}
