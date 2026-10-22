import s from "./Workspace.module.css"
export function Pager({offset, total, change}: {offset: number; total: number; change: (n: number) => void}) {
    return <div className={s.pager}><button disabled={!offset} onClick={() => change(Math.max(0, offset - 50))}>Previous</button>
        <span className={s.muted}>{total ? `${offset + 1}–${Math.min(offset + 50, total)} of ${total}` : "No results"}</span>
        <button disabled={offset + 50 >= total} onClick={() => change(offset + 50)}>Next</button></div>
}
