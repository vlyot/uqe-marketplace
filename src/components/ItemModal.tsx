
import type { EnrichedItem } from '../types/market'

const discord = import.meta.env.VITE_DISCORD_HANDLE || 'yourdiscord#0000'
const carousell = import.meta.env.VITE_CAROUSELL_URL || 'https://carousell.com/yourstore'

export default function ItemModal({ item, onClose }: { item: EnrichedItem, onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <h3 style={{margin:0}}>{item.name}</h3>
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
        <hr className="hr" />
        <div className="row" style={{gap:24}}>
          <div style={{flex:1}}>
            <div className="small">RAP</div>
            <div style={{fontSize:18}}>{item.rap ?? '—'}</div>
          </div>
          <div style={{flex:1}}>
            <div className="small">Est. SGD Range</div>
            <div style={{fontSize:18}}>S${item.sgdMin.toLocaleString()} – S${item.sgdMax.toLocaleString()}</div>
          </div>
        </div>
        <hr className="hr" />
        <p className="small">Interested? Contact to purchase:</p>
        <div className="row" style={{gap:8}}>
          <a className="btn" href={`https://discord.com/users/@me`} target="_blank" rel="noreferrer">Discord: {discord}</a>
          <a className="btn secondary" href={carousell} target="_blank" rel="noreferrer">Carousell</a>
        </div>
        <p className="small" style={{marginTop:8, opacity:.7}}>Orders are manually processed.</p>
      </div>
    </div>
  )
}
