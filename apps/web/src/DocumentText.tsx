/** Small safe renderer for the deterministic report grammar. Source bytes stay untouched for export/checking. */
export default function DocumentText({ text }: { text: string }) {
  return <div className="rendered-document">{text.split('\n\n').map((block, index) => {
    if (block.startsWith('### ')) return <section key={index}><h4>{block.split('\n')[0]!.slice(4)}</h4><p>{block.split('\n').slice(1).join('\n')}</p></section>;
    if (block.startsWith('## ')) return <section key={index}><h3>{block.split('\n')[0]!.slice(3)}</h3><p>{block.split('\n').slice(1).join('\n')}</p></section>;
    if (block.startsWith('# ')) return <h2 key={index}>{block.slice(2)}</h2>;
    return <p key={index}>{block}</p>;
  })}</div>;
}
