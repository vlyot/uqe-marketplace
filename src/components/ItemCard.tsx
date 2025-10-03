
import type { EnrichedItem } from '../types/market'

export default function ItemCard({ item, onClick }: { item: EnrichedItem, onClick: () => void }) {
  return (
    <div className="card" role="button" onClick={onClick}>
      <div className="row" style={{justifyContent:'space-between'}}>
        <strong style={{fontSize:16}}>{item.name}</strong>
        {item.isProjected && <span className="badge">Projected</span>}
      </div>
      <div className="row" style={{marginTop:10}}>
        <div style={{flex:1}}>
          <div className="small">RAP</div>
          <div>{item.rap ?? '—'}</div>
        </div>
        <div style={{flex:1}}>
          <div className="small">USD</div>
          <div>${item.usdPrice.toFixed(2)}</div>
        </div>
        <div style={{flex:1}}>
          <div className="small">Est. SGD Range</div>
          <div>S${item.sgdMin.toLocaleString()} – S${item.sgdMax.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}
